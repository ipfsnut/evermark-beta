import React, { useEffect, useState } from 'react';
import { FileText, Clock, Eye, Vote, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useEvermarksState } from '@/features/evermarks';
import { EvermarkCard } from '@/features/evermarks/components/EvermarkCard';
import { useVotingState } from '@/features/voting';
import { useAppAuth } from '@/providers/AppContext';
import { useThemeClasses } from '@/providers/ThemeProvider';
import { cn } from '@/utils/responsive';

export default function MyEvermarksPage() {
  const { isAuthenticated, user } = useAppAuth();
  const themeClasses = useThemeClasses();
  const { evermarks, isLoading, error, loadEvermarks } = useEvermarksState();
  const { votingHistory } = useVotingState();
  const [activeTab, setActiveTab] = useState<'created' | 'supported'>('created');

  // Filter evermarks by current wallet
  const myCreatedEvermarks = evermarks.filter(evermark => 
    user?.address && evermark.creator.toLowerCase() === user.address.toLowerCase()
  );
  
  // Supported evermarks: ones where user has delegated votes
  const mySupportedEvermarks = evermarks.filter(evermark => {
    // User is not the creator
    if (evermark.creator.toLowerCase() === user?.address?.toLowerCase()) {
      return false;
    }
    
    // Check if user has voted on this evermark
    const hasVoted = votingHistory?.some(vote => 
      vote.evermarkId === evermark.id && vote.amount > 0
    );
    
    return hasVoted || false;
  });

  useEffect(() => {
    // Load all evermarks and then filter client-side for now
    // TODO: Add API endpoint for user-specific evermarks
    loadEvermarks();
  }, [loadEvermarks]);

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

  const currentEvermarks = activeTab === 'created' ? myCreatedEvermarks : mySupportedEvermarks;

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
          
          <Link
            to="/create"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-500 hover:to-green-600 transition-colors font-medium"
          >
            <Plus className="h-4 w-4" />
            Create Evermark
          </Link>
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
            Supported ({mySupportedEvermarks.length})
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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