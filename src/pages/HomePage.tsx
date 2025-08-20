// src/pages/HomePage.tsx - Updated with Supabase test and real evermarks
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  PlusIcon, 
  TrendingUpIcon, 
  GridIcon,
  ZapIcon,
  StarIcon,
  UserIcon,
  ChevronRightIcon,
  VoteIcon,
  CoinsIcon
} from 'lucide-react';

// Providers and utilities
import { useAppAuth } from '../providers/AppContext';
import { useFarcasterUser } from '../lib/farcaster';
import { useTheme } from '../providers/ThemeProvider';
import { cn, useIsMobile } from '../utils/responsive';
import { devLog } from '../utils/debug';

// Evermarks feature
import { useEvermarksState, EvermarkFeed } from '../features/evermarks';

// Quick Supabase Test Component
const QuickSupabaseTest = () => {
  const [testResult, setTestResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const testConnection = async () => {
      try {
        // Test if supabase client exists and can connect
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        devLog('Environment check:', {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey,
          url: supabaseUrl?.substring(0, 30) + '...'
        });

        if (!supabaseUrl || !supabaseKey) {
          setTestResult({ 
            success: false, 
            error: 'Missing Supabase environment variables',
            hasUrl: !!supabaseUrl,
            hasKey: !!supabaseKey
          });
          return;
        }

        // Use existing singleton client to avoid multiple instances
        const { supabase } = await import('../lib/supabase');
        if (!supabase) {
          throw new Error('Supabase client not initialized');
        }
        
        // Test query
        const { data, error, count } = await supabase
          .from('evermarks')
          .select('*', { count: 'exact' })
          .limit(3);

        setTestResult({
          success: !error,
          error: error?.message,
          count,
          sampleData: data?.slice(0, 2), // Just first 2 records
          hasData: (data?.length || 0) > 0
        });

      } catch (error) {
        console.error('Supabase test failed:', error);
        setTestResult({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      } finally {
        setIsLoading(false);
      }
    };

    testConnection();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 mb-4">
        <p className="text-yellow-300">🔍 Testing Supabase connection...</p>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-4 mb-4 ${
      testResult?.success 
        ? 'bg-green-900/30 border-green-500/50' 
        : 'bg-red-900/30 border-red-500/50'
    }`}>
      <h3 className={`font-semibold mb-2 ${
        testResult?.success ? 'text-green-300' : 'text-red-300'
      }`}>
        🔍 Supabase Connection Test
      </h3>
      
      {testResult?.success ? (
        <div className="text-green-200 space-y-2">
          <p>✅ Successfully connected to Supabase!</p>
          <p>📊 Found {testResult.count || 0} evermarks in database</p>
          {testResult.hasData && (
            <div>
              <p>📝 Sample data:</p>
              <pre className="text-xs bg-gray-800 p-2 rounded mt-2 overflow-auto max-h-32">
                {JSON.stringify(testResult.sampleData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <div className="text-red-200 space-y-2">
          <p>❌ Supabase connection failed</p>
          <p className="text-sm">Error: {testResult?.error}</p>
          {!testResult?.hasUrl && <p className="text-sm">• Missing VITE_SUPABASE_URL</p>}
          {!testResult?.hasKey && <p className="text-sm">• Missing VITE_SUPABASE_ANON_KEY</p>}
        </div>
      )}
    </div>
  );
};

// Real Protocol Stats using the evermarks hook
const ProtocolStats: React.FC = () => {
  const isMobile = useIsMobile();
  const { totalCount, evermarks, isLoading } = useEvermarksState();
  
  // Calculate stats from real data with null checks
  const safeEvermarks = Array.isArray(evermarks) ? evermarks : [];
  const stats = {
    totalEvermarks: totalCount || 0,
    withImages: safeEvermarks.filter(e => e && e.image).length,
    activeCreators: new Set(safeEvermarks.filter(e => e && e.author).map(e => e.author)).size,
    thisWeek: safeEvermarks.filter(e => {
      if (!e || !e.createdAt) return false;
      try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return new Date(e.createdAt) > weekAgo;
      } catch {
        return false;
      }
    }).length
  };

  const statCards = [
    {
      label: 'Total Evermarks',
      value: isLoading ? '...' : stats.totalEvermarks.toLocaleString(),
      icon: <StarIcon className="h-5 w-5" />,
      gradient: 'from-purple-400 to-purple-600',
      glow: 'shadow-purple-500/20'
    },
    {
      label: 'With Media',
      value: isLoading ? '...' : stats.withImages.toLocaleString(),
      icon: <GridIcon className="h-5 w-5" />,
      gradient: 'from-green-400 to-green-600',
      glow: 'shadow-green-500/20'
    },
    {
      label: 'Active Creators',
      value: isLoading ? '...' : stats.activeCreators.toLocaleString(),
      icon: <UserIcon className="h-5 w-5" />,
      gradient: 'from-cyan-400 to-cyan-600',
      glow: 'shadow-cyan-500/20'
    },
    {
      label: 'This Week',
      value: isLoading ? '...' : stats.thisWeek.toLocaleString(),
      icon: <TrendingUpIcon className="h-5 w-5" />,
      gradient: 'from-yellow-400 to-yellow-600',
      glow: 'shadow-yellow-500/20'
    }
  ];

  return (
    <div className={cn(
      "grid gap-4",
      isMobile ? "grid-cols-2" : "grid-cols-1 md:grid-cols-4"
    )}>
      {statCards.map((stat, index) => (
        <div
          key={index}
          className={cn(
            "bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center transition-all duration-300 hover:border-gray-600",
            stat.glow
          )}
        >
          <div className={cn(
            "w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center bg-gradient-to-r text-black",
            stat.gradient
          )}>
            {stat.icon}
          </div>
          <div className="text-xl font-bold text-white mb-1">
            {stat.value}
          </div>
          <div className="text-gray-400 text-sm">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
};

// Quick Actions component
const QuickActions: React.FC = () => {
  const { isAuthenticated } = useAppAuth();
  const isMobile = useIsMobile();

  const actions = [
    {
      label: 'Create Evermark',
      description: 'Preserve content forever',
      icon: <PlusIcon className="h-5 w-5" />,
      href: '/create',
      gradient: 'from-green-400 to-green-600',
      requireAuth: true
    },
    {
      label: 'Explore All',
      description: 'Browse the collection',
      icon: <GridIcon className="h-5 w-5" />,
      href: '/explore',
      gradient: 'from-blue-400 to-blue-600',
      requireAuth: false
    },
    {
      label: 'Start Staking',
      description: 'Earn voting power',
      icon: <CoinsIcon className="h-5 w-5" />,
      href: '/staking',
      gradient: 'from-purple-400 to-purple-600',
      requireAuth: true
    },
    {
      label: 'View Rankings',
      description: 'See community favorites',
      icon: <TrendingUpIcon className="h-5 w-5" />,
      href: '/leaderboard',
      gradient: 'from-yellow-400 to-yellow-600',
      requireAuth: false
    }
  ];

  const availableActions = actions.filter(action => 
    !action.requireAuth || isAuthenticated
  );

  return (
    <div className={cn(
      "grid gap-4",
      isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-4"
    )}>
      {availableActions.map((action, index) => (
        <Link
          key={index}
          to={action.href}
          className="group bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-all duration-300 hover:shadow-lg"
        >
          <div className={cn(
            "w-10 h-10 mb-3 rounded-lg flex items-center justify-center bg-gradient-to-r text-black transition-transform group-hover:scale-110",
            action.gradient
          )}>
            {action.icon}
          </div>
          <h3 className="font-medium text-white mb-1 group-hover:text-gray-100">
            {action.label}
          </h3>
          <p className="text-sm text-gray-400 group-hover:text-gray-300">
            {action.description}
          </p>
        </Link>
      ))}
    </div>
  );
};

// Real Evermarks Feed Component
const EvermarksFeed: React.FC = () => {
  const { evermarks, isLoading, error, isEmpty } = useEvermarksState();

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-600/20 rounded-full flex items-center justify-center">
          <GridIcon className="h-8 w-8 text-red-400" />
        </div>
        <h3 className="text-xl font-semibold text-red-300 mb-2">Failed to Load Evermarks</h3>
        <p className="text-red-400 mb-6">{error}</p>
        <Link
          to="/explore"
          className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Explore Page
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center animate-pulse">
          <GridIcon className="h-8 w-8 text-black" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Loading Evermarks...</h3>
        <p className="text-gray-400">Fetching the latest preserved content</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center">
          <GridIcon className="h-8 w-8 text-black" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">No Evermarks Yet</h3>
        <p className="text-gray-400 mb-6">
          Be the first to preserve content forever on the blockchain!
        </p>
        <Link
          to="/create"
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-500 hover:to-green-600 transition-colors"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Create First Evermark
        </Link>
      </div>
    );
  }

  return (
    <div>
      <EvermarkFeed
        showCreateButton={false}
        showFilters={false}
        variant="grid"
        onEvermarkClick={(evermark) => {
          // Navigate to evermark detail page
          window.location.href = `/evermark/${evermark.id}`;
        }}
        className="space-y-6"
      />
    </div>
  );
};

// Main HomePage component
export default function HomePage() {
  const { isAuthenticated } = useAppAuth();
  const { isInFarcaster } = useFarcasterUser();
  const { isDark } = useTheme();
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen transition-colors duration-200 bg-gray-50 text-gray-900 dark:bg-black dark:text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden transition-colors duration-200 bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-black dark:to-gray-900">
        {/* Animated background effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-green-400/20 to-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-cyan-400/20 to-yellow-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        
        <div className="relative container mx-auto px-4 py-16 md:py-20">
          <div className="text-center space-y-8">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-purple-500 rounded-3xl blur-xl opacity-40 scale-110 animate-pulse" />
                <img 
                  src="/EvermarkLogo.png" 
                  alt="Evermark Protocol" 
                  className="relative h-24 md:h-32 w-auto drop-shadow-2xl hover:scale-105 transition-transform duration-300"
                />
              </div>
            </div>
            
            {/* Title and description */}
            <div className="max-w-4xl mx-auto space-y-6">
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-green-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent leading-tight">
                EVERMARK PROTOCOL <span className="text-2xl md:text-4xl text-cyan-400 font-normal">[BETA]</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-gray-300 leading-relaxed max-w-3xl mx-auto">
                Discover amazing content online and earn rewards by sharing Evermarks through{' '}
                <span className="text-green-400 font-bold">community curation</span>
              </p>
              
              {/* Feature badges */}
              <div className="flex flex-wrap gap-3 justify-center">
                <span className="px-4 py-2 bg-green-400/20 text-green-400 rounded-full font-medium border border-green-400/30">
                  🔗 Permanent Links
                </span>
                <span className="px-4 py-2 bg-purple-400/20 text-purple-400 rounded-full font-medium border border-purple-400/30">
                  💰 $WEMARK Rewards
                </span>
                <span className="px-4 py-2 bg-cyan-400/20 text-cyan-400 rounded-full font-medium border border-cyan-400/30">
                  🗳️ Community Voting
                </span>
                {isInFarcaster && (
                  <span className="px-4 py-2 bg-yellow-400/20 text-yellow-400 rounded-full font-medium border border-yellow-400/30">
                    🚀 Farcaster Native
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Supabase Test (temporary) */}
      <div className="container mx-auto px-4 py-6">
        <QuickSupabaseTest />
      </div>

      {/* Protocol Stats */}
      <div className="container mx-auto px-4 py-12">
        <ProtocolStats />
      </div>

      {/* Quick Actions */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Get Started</h2>
          <p className="text-gray-400">Choose your path in the Evermark ecosystem</p>
        </div>
        <QuickActions />
      </div>

      {/* Main Content Layout */}
      <div className="container mx-auto px-4 py-8">
        <div className={cn(
          "gap-8",
          isMobile ? "space-y-8" : "grid grid-cols-1 lg:grid-cols-3"
        )}>
          {/* Left Column - Main Feed (2/3 width on desktop) */}
          <div className={cn("space-y-8", !isMobile && "lg:col-span-2")}>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Community Feed</h2>
              <Link 
                to="/explore"
                className="inline-flex items-center text-cyan-400 hover:text-cyan-300 font-medium group"
              >
                View All
                <ChevronRightIcon className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            
            <EvermarksFeed />
          </div>

          {/* Right Column - Sidebar (1/3 width on desktop) */}
          <div className="space-y-6">
            {/* Connect prompt for non-authenticated users */}
            {!isAuthenticated ? (
              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 text-center">
                <VoteIcon className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Join the Community</h3>
                <p className="text-gray-400 mb-4">
                  Connect your wallet to vote on content and earn rewards
                </p>
                <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-sm text-blue-300">
                    {isInFarcaster 
                      ? "🚀 Native Farcaster wallet integration ready"
                      : "🖥️ Desktop wallet connection available"
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 text-center">
                <CoinsIcon className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Welcome Back!</h3>
                <p className="text-gray-400 mb-4">
                  Your wallet is connected. Start creating and curating content.
                </p>
                <Link
                  to="/create"
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-500 hover:to-green-600 transition-colors"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Create Evermark
                </Link>
              </div>
            )}

            {/* Community Insights */}
            <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Protocol Insights</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Network:</span>
                  <span className="text-green-400 font-medium">Base Mainnet</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Storage:</span>
                  <span className="text-cyan-400 font-medium">IPFS + Blockchain</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-green-400 font-medium flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                    Live
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Version:</span>
                  <span className="text-purple-400 font-medium">Beta v2.0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      {!isAuthenticated && (
        <div className="container mx-auto px-4 py-16">
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-8 md:p-12 text-center">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-400 to-purple-500 bg-clip-text text-transparent mb-6">
                Ready to Preserve Something Amazing?
              </h2>
              <p className="text-gray-300 text-lg mb-8 leading-relaxed">
                Transform any online content into a permanent, shareable Evermark. 
                Join our community of curators and earn <span className="text-green-400 font-bold">$WEMARK</span> rewards.
              </p>
              
              <div className={cn(
                "flex gap-4 justify-center",
                isMobile ? "flex-col" : "flex-row"
              )}>
                <Link
                  to="/create"
                  className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-green-400 to-green-600 text-black font-bold rounded-lg hover:from-green-300 hover:to-green-500 transition-all shadow-lg shadow-green-500/30"
                >
                  <ZapIcon className="w-5 h-5 mr-2" />
                  Create Your First Evermark
                </Link>
                <Link
                  to="/explore"
                  className="inline-flex items-center px-8 py-4 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <GridIcon className="w-5 h-5 mr-2" />
                  Explore All Evermarks
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}