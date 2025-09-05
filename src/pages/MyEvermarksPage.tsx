import React, { useEffect, useState, useMemo } from 'react';
import { FileText, Clock, Eye, Vote, Plus, Share, Copy, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useEvermarksState } from '@/features/evermarks';
import { EvermarkCard } from '@/features/evermarks/components/EvermarkCard';
import { EvermarkSearch } from '@/features/evermarks/components/EvermarkSearch';
import type { EvermarkFilters } from '@/features/evermarks/types';
import { useVotingState } from '@/features/voting';
import { useAppAuth } from '@/providers/AppContext';
import { useWalletAccount } from '@/hooks/core/useWalletAccount';
import { useThemeClasses } from '@/providers/ThemeProvider';
import { useFarcasterDetection } from '@/hooks/useFarcasterDetection';
import { useBetaPoints } from '@/features/points';
import { cn } from '@/utils/responsive';

export default function MyEvermarksPage() {
  const { isAuthenticated, user } = useAppAuth();
  const account = useWalletAccount();
  const themeClasses = useThemeClasses();
  const { isInFarcaster } = useFarcasterDetection();
  const { evermarks, isLoading, error, loadEvermarks } = useEvermarksState();
  const { userPoints } = useBetaPoints();
  const [activeTab, setActiveTab] = useState<'created' | 'supported'>('created');

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<EvermarkFilters>({
    search: '',
    author: '',
    contentType: undefined,
    verified: undefined,
    tags: [],
    dateRange: undefined
  });
  const [shareCollectionCopied, setShareCollectionCopied] = useState(false);

  // Apply search and filters to evermarks
  const filteredEvermarks = useMemo(() => {
    let filtered = evermarks;

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(evermark => 
        evermark.title.toLowerCase().includes(query) ||
        evermark.author.toLowerCase().includes(query) ||
        evermark.description.toLowerCase().includes(query) ||
        evermark.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply filters
    if (filters.author) {
      filtered = filtered.filter(evermark => 
        evermark.author.toLowerCase().includes(filters.author!.toLowerCase())
      );
    }

    if (filters.contentType) {
      filtered = filtered.filter(evermark => evermark.contentType === filters.contentType);
    }

    if (filters.verified !== undefined) {
      filtered = filtered.filter(evermark => evermark.verified === filters.verified);
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(evermark => 
        filters.tags!.some(tag => 
          evermark.tags.some(evermarkTag => 
            evermarkTag.toLowerCase().includes(tag.toLowerCase())
          )
        )
      );
    }

    return filtered;
  }, [evermarks, searchQuery, filters]);

  // Filter by current wallet - check both user address and account address for cross-context compatibility
  const myCreatedEvermarks = evermarks.filter(evermark => {
    const creatorLower = evermark.creator.toLowerCase();
    const userAddress = user?.address?.toLowerCase();
    const accountAddress = account?.address?.toLowerCase();
    
    return (userAddress && creatorLower === userAddress) || 
           (accountAddress && creatorLower === accountAddress);
  });

  // Apply search/filters only to created evermarks if needed
  const filteredCreatedEvermarks = useMemo(() => {
    if (activeTab !== 'created') return myCreatedEvermarks;
    
    let filtered = myCreatedEvermarks;

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(evermark => 
        evermark.title.toLowerCase().includes(query) ||
        evermark.author.toLowerCase().includes(query) ||
        evermark.description.toLowerCase().includes(query) ||
        evermark.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply filters
    if (filters.author) {
      filtered = filtered.filter(evermark => 
        evermark.author.toLowerCase().includes(filters.author!.toLowerCase())
      );
    }

    if (filters.contentType) {
      filtered = filtered.filter(evermark => evermark.contentType === filters.contentType);
    }

    if (filters.verified !== undefined) {
      filtered = filtered.filter(evermark => evermark.verified === filters.verified);
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(evermark => 
        filters.tags!.some(tag => 
          evermark.tags.some(evermarkTag => 
            evermarkTag.toLowerCase().includes(tag.toLowerCase())
          )
        )
      );
    }

    return filtered;
  }, [myCreatedEvermarks, activeTab, searchQuery, filters]);

  // Debug: Check if evermarks are being filtered out
  console.log('Debug - Total evermarks:', evermarks.length);
  console.log('Debug - My created evermarks:', myCreatedEvermarks.length);
  console.log('Debug - Filtered created evermarks:', filteredCreatedEvermarks.length);
  console.log('Debug - Current filters:', filters);
  console.log('Debug - User address:', user?.address);
  
  // Get current cycle for accurate vote filtering
  const { votingHistory, currentCycle } = useVotingState();

  // Base supported evermarks: ones where user has delegated votes
  const baseSupportedEvermarks = evermarks.filter(evermark => {
    // User is not the creator
    if (evermark.creator.toLowerCase() === user?.address?.toLowerCase()) {
      return false;
    }
    
    // Check if user has voted on this evermark using voting history (single source of truth)
    const hasVoted = votingHistory?.some(vote => 
      vote.evermarkId === evermark.id && 
      vote.amount > 0 &&
      (!currentCycle || vote.season === currentCycle.cycleNumber) // Use current cycle if available
    );
    
    // Debug logging for the first few evermarks
    if (parseInt(evermark.id) <= 5) {
      const userVote = votingHistory?.find(vote => vote.evermarkId === evermark.id);
      console.log(`Evermark ${evermark.id}: hasVoted=${hasVoted}, userVote=${userVote?.amount?.toString() || 'none'}, season=${userVote?.season || 'none'}, currentCycle=${currentCycle?.cycleNumber || 'none'}`);
    }
    
    // Only include if user has actually voted
    return hasVoted;
  });

  // Apply search/filters to supported evermarks if needed
  const filteredSupportedEvermarks = useMemo(() => {
    if (activeTab !== 'supported') return baseSupportedEvermarks;
    
    let filtered = baseSupportedEvermarks;

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(evermark => 
        evermark.title.toLowerCase().includes(query) ||
        evermark.author.toLowerCase().includes(query) ||
        evermark.description.toLowerCase().includes(query) ||
        evermark.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply filters (same logic as created)
    if (filters.author) {
      filtered = filtered.filter(evermark => 
        evermark.author.toLowerCase().includes(filters.author!.toLowerCase())
      );
    }

    if (filters.contentType) {
      filtered = filtered.filter(evermark => evermark.contentType === filters.contentType);
    }

    if (filters.verified !== undefined) {
      filtered = filtered.filter(evermark => evermark.verified === filters.verified);
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(evermark => 
        filters.tags!.some(tag => 
          evermark.tags.some(evermarkTag => 
            evermarkTag.toLowerCase().includes(tag.toLowerCase())
          )
        )
      );
    }

    return filtered;
  }, [baseSupportedEvermarks, activeTab, searchQuery, filters]);

  useEffect(() => {
    // Load all evermarks with a large limit to get all data for supported calculation
    loadEvermarks({ 
      pageSize: 100,  // Large enough to get all evermarks
      page: 1 
    });
  }, [loadEvermarks]);

  // Search and filter handlers
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setFilters(prev => ({ ...prev, search: query }));
  };

  const handleFiltersChange = (newFilters: Partial<EvermarkFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  // Share collection functionality
  const handleShareCollection = async () => {
    const currentList = activeTab === 'created' ? myCreatedEvermarks : baseSupportedEvermarks;
    const collectionType = activeTab === 'created' ? 'Portfolio' : 'Reading List';
    const userName = user?.displayName || user?.username || 'Anonymous';
    
    // Use proper URL format based on context
    const getEvermarkUrl = (id: string) => {
      if (isInFarcaster) {
        // For Farcaster, use the Frame URL that opens within the app
        return `https://evermark.xyz/frame/evermark/${id}`;
      } else {
        // For web/PWA, use regular URL
        return `${window.location.origin}/evermark/${id}`;
      }
    };
    
    const getMainUrl = () => {
      if (isInFarcaster) {
        return 'https://evermark.xyz/frame';
      } else {
        return window.location.origin;
      }
    };
    
    const shareText = `📚 ${userName}'s ${collectionType} (${currentList.length} articles)\n\n${ 
      currentList.slice(0, 8).map(item => 
        `• ${item.title} by ${item.author}\n  ${getEvermarkUrl(item.id)}`
      ).join('\n\n') 
      }${currentList.length > 8 ? `\n\n...and ${currentList.length - 8} more evermarks` : '' 
      }\n\n🔗 Preserve your own articles at ${getMainUrl()}`;

    try {
      await navigator.clipboard.writeText(shareText);
      setShareCollectionCopied(true);
      setTimeout(() => setShareCollectionCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy collection:', error);
    }
  };

  // Not connected state
  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen ${themeClasses.bg.primary} ${themeClasses.text.primary}`}>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center max-w-md mx-auto">
            <div className="text-6xl mb-4">🔗</div>
            <h1 className="text-2xl font-bold text-purple-400 mb-2">Connect Your Wallet</h1>
            <p className={`${themeClasses.text.muted} mb-6`}>
              Connect your wallet to view your created and supported evermarks.
            </p>
            <Link
              to="/connect"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-500 hover:to-blue-500 transition-colors font-medium"
            >
              Connect Wallet
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`min-h-screen ${themeClasses.bg.primary} ${themeClasses.text.primary}`}>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4" />
            <p className={themeClasses.text.muted}>Loading your evermarks...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`min-h-screen ${themeClasses.bg.primary} ${themeClasses.text.primary}`}>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center max-w-md mx-auto">
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-red-400 mb-2">Error Loading Evermarks</h1>
            <p className={`${themeClasses.text.muted} mb-6`}>{error}</p>
            <button
              onClick={() => loadEvermarks()}
              className={`px-4 py-2 ${themeClasses.button.secondary} rounded-lg transition-colors`}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentEvermarks = activeTab === 'created' ? filteredCreatedEvermarks : filteredSupportedEvermarks;

  return (
    <div className={`min-h-screen ${themeClasses.bg.primary} ${themeClasses.text.primary}`}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Evermarks</h1>
            <p className={themeClasses.text.muted}>
              Manage your created evermarks and track content you support
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Share Collection Button - only show when there are items */}
            {currentEvermarks.length > 0 && (
              <button
                onClick={handleShareCollection}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium",
                  shareCollectionCopied
                    ? "bg-green-600 text-white"
                    : `${themeClasses.button.secondary} hover:bg-gray-600`
                )}
              >
                {shareCollectionCopied ? (
                  <>
                    <Copy className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Share className="h-4 w-4" />
                    Share {activeTab === 'created' ? 'Portfolio' : 'Reading List'}
                  </>
                )}
              </button>
            )}
            
            <Link
              to="/create"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-500 hover:to-green-600 transition-colors font-medium"
            >
              <Plus className="h-4 w-4" />
              Create Evermark
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 mb-8">
          <button
            onClick={() => setActiveTab('created')}
            className={cn(
              "px-4 py-2 font-medium text-sm border-b-2 transition-colors",
              activeTab === 'created'
                ? "border-purple-400 text-purple-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            )}
          >
            <FileText className="h-4 w-4 mr-2 inline" />
            Created ({myCreatedEvermarks.length})
          </button>
          <button
            onClick={() => setActiveTab('supported')}
            className={cn(
              "px-4 py-2 font-medium text-sm border-b-2 transition-colors",
              activeTab === 'supported'
                ? "border-purple-400 text-purple-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            )}
          >
            <Vote className="h-4 w-4 mr-2 inline" />
            Supported ({baseSupportedEvermarks.length})
          </button>
        </div>

        {/* Search and Filters */}
        <div className="mb-8">
          <EvermarkSearch
            onSearch={handleSearch}
            onFiltersChange={handleFiltersChange}
            currentFilters={filters}
            placeholder={activeTab === 'created' 
              ? "Search your created evermarks..." 
              : "Search your saved articles..."
            }
            showFilters={true}
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className={`${themeClasses.bg.card} border ${themeClasses.border.primary} rounded-lg p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-2xl font-bold ${themeClasses.text.primary}`}>
                  {myCreatedEvermarks.length}
                </p>
                <p className={`text-sm ${themeClasses.text.muted}`}>Created</p>
              </div>
              <FileText className="h-8 w-8 text-purple-400" />
            </div>
          </div>
          
          <div className={`${themeClasses.bg.card} border ${themeClasses.border.primary} rounded-lg p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-2xl font-bold ${themeClasses.text.primary}`}>
                  {myCreatedEvermarks.reduce((sum, e) => sum + (e.viewCount || 0), 0)}
                </p>
                <p className={`text-sm ${themeClasses.text.muted}`}>Total Views</p>
              </div>
              <Eye className="h-8 w-8 text-cyan-400" />
            </div>
          </div>
          
          <div className={`${themeClasses.bg.card} border ${themeClasses.border.primary} rounded-lg p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-2xl font-bold ${themeClasses.text.primary}`}>
                  {myCreatedEvermarks.reduce((sum, e) => sum + (e.votes || 0), 0)}
                </p>
                <p className={`text-sm ${themeClasses.text.muted}`}>Total Votes</p>
              </div>
              <Vote className="h-8 w-8 text-green-400" />
            </div>
          </div>
          
          <div className={`${themeClasses.bg.card} border ${themeClasses.border.primary} rounded-lg p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-2xl font-bold ${themeClasses.text.primary}`}>
                  {userPoints?.total_points?.toLocaleString() || 0}
                </p>
                <p className={`text-sm ${themeClasses.text.muted}`}>Beta Points Earned</p>
              </div>
              <Star className="h-8 w-8 text-yellow-400" />
            </div>
          </div>
        </div>

        {/* Content */}
        {currentEvermarks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">
              {activeTab === 'created' ? '📝' : '❤️'}
            </div>
            <h3 className={`text-xl font-semibold ${themeClasses.text.primary} mb-2`}>
              No {activeTab} evermarks yet
            </h3>
            <p className={`${themeClasses.text.muted} mb-6 max-w-md mx-auto`}>
              {activeTab === 'created' 
                ? "You haven't created any evermarks yet. Start preserving important content on the blockchain!"
                : "You haven't voted on any evermarks yet. Support content creators by delegating your voting power!"
              }
            </p>
            {activeTab === 'created' && (
              <Link
                to="/create"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-500 hover:to-green-600 transition-colors font-medium"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Evermark
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentEvermarks.map((evermark) => (
              <EvermarkCard
                key={evermark.id}
                evermark={evermark}
                variant="standard"
                onClick={() => {
                  // Navigate to evermark detail page
                  window.location.href = `/evermark/${evermark.id}`;
                }}
                showVotes={true}
                showViews={true}
                showDescription={true}
                showImage={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}