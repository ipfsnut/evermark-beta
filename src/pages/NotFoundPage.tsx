// src/pages/NotFoundPage.tsx - 404 error page with cyber theme
import { Link, useNavigate } from 'react-router-dom';
import { themeClasses } from '../utils/theme';
import { 
  HomeIcon, 
  CompassIcon, 
  SearchIcon,
  ArrowLeftIcon,
  ZapIcon,
  TrendingUpIcon,
  RefreshCwIcon,
  AlertTriangleIcon
} from 'lucide-react';
import { useFarcasterDetection } from '@/hooks/useFarcasterDetection';
import { useAppAuth } from '@/providers/AppContext';
import { cn, useIsMobile } from '@/utils/responsive';

// Animated 404 component
const Animated404: React.FC = () => {
  return (
    <div className="relative">
      <div className={themeClasses.errorCodeHuge}>
        404
      </div>
      
      {/* Glitch effect overlay */}
      <div className="absolute inset-0 text-8xl md:text-9xl font-bold text-red-500 opacity-20 animate-ping">
        404
      </div>
      
      {/* Matrix rain effect background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="matrix-bg opacity-10"></div>
      </div>
    </div>
  );
};

// Quick action card component
const ActionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  variant?: 'primary' | 'secondary';
}> = ({ icon, title, description, href, variant = 'secondary' }) => {
  const baseClasses = cn(
    "group p-6 rounded-lg border transition-all duration-300 hover:shadow-lg",
    variant === 'primary' 
      ? "bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border-cyan-500/30 hover:border-cyan-400/50 hover:shadow-cyan-500/20"
      : "bg-gray-800/50 border-gray-700 hover:border-gray-600 hover:shadow-gray-500/10"
  );

  return (
    <Link to={href} className={baseClasses}>
      <div className={cn(
        "w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-transform group-hover:scale-110",
        variant === 'primary' 
          ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-black"
          : "bg-gray-700 text-gray-300 group-hover:bg-gray-600"
      )}>
        {icon}
      </div>
      <h3 className={cn(
        "text-lg font-semibold mb-2 transition-colors",
        variant === 'primary' ? "text-cyan-300 group-hover:text-cyan-200" : "text-white group-hover:text-gray-100"
      )}>
        {title}
      </h3>
      <p className="text-gray-400 group-hover:text-gray-300 transition-colors">
        {description}
      </p>
    </Link>
  );
};

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { isInFarcaster } = useFarcasterDetection();
  const { isAuthenticated } = useAppAuth();
  const isMobile = useIsMobile();

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-red-400/20 to-purple-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-cyan-400/20 to-yellow-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      
      <div className="relative z-10 container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
        <div className="text-center max-w-4xl mx-auto">
          
          {/* Animated 404 */}
          <div className="mb-8">
            <Animated404 />
          </div>
          
          {/* Error message */}
          <div className="space-y-6 mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Oops! Page Not Found
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              The page you're looking for seems to have vanished into the{' '}
              <span className="text-cyan-400 font-bold">digital void</span>. 
              Don't worry, even in the matrix, some links get corrupted.
            </p>
            
            {/* Context-aware messaging */}
            {isInFarcaster && (
              <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-4 max-w-md mx-auto">
                <p className="text-purple-300 text-sm">
                  🚀 <strong>Farcaster Frame detected:</strong> Some links may not work properly in frames. 
                  Try opening in your browser for the full experience.
                </p>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="mb-12">
            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={handleGoBack}
                className="inline-flex items-center px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Go Back
              </button>
              
              <Link
                to="/"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg transition-colors font-medium"
              >
                <HomeIcon className="h-5 w-5 mr-2" />
                Home
              </Link>
              
              <button
                onClick={handleRefresh}
                className="inline-flex items-center px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium"
              >
                <RefreshCwIcon className="h-5 w-5 mr-2" />
                Refresh
              </button>
            </div>
          </div>

          {/* Helpful navigation cards */}
          <div className="space-y-8">
            <h2 className="text-2xl font-semibold text-white mb-6">
              Where would you like to go?
            </h2>
            
            <div className={cn(
              "grid gap-6",
              isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            )}>
              <ActionCard
                icon={<CompassIcon className="h-6 w-6" />}
                title="Explore Evermarks"
                description="Discover amazing content preserved forever on the blockchain"
                href="/explore"
                variant="primary"
              />
              
              <ActionCard
                icon={<TrendingUpIcon className="h-6 w-6" />}
                title="Leaderboard"
                description="See the most voted content and community rankings"
                href="/leaderboard"
              />
              
              {isAuthenticated ? (
                <ActionCard
                  icon={<ZapIcon className="h-6 w-6" />}
                  title="Create Evermark"
                  description="Preserve your favorite content and earn rewards"
                  href="/create"
                />
              ) : (
                <ActionCard
                  icon={<ZapIcon className="h-6 w-6" />}
                  title="Get Started"
                  description="Connect your wallet and join the community"
                  href="/"
                />
              )}
            </div>
          </div>

          {/* Search suggestion */}
          <div className="mt-12 p-6 bg-gray-800/30 border border-gray-700 rounded-lg">
            <div className="flex items-center justify-center mb-4">
              <SearchIcon className="h-6 w-6 text-gray-400 mr-2" />
              <h3 className="text-lg font-medium text-white">Looking for something specific?</h3>
            </div>
            <p className="text-gray-400 mb-4">
              Try searching for evermarks, or browse by category
            </p>
            <Link
              to="/explore"
              className="inline-flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <SearchIcon className="h-4 w-4 mr-2" />
              Start Exploring
            </Link>
          </div>

          {/* Protocol info */}
          <div className="mt-12 pt-8 border-t border-gray-800">
            <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                <span>Base Network</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-cyan-500 rounded-full mr-2" />
                <span>IPFS Storage</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2" />
                <span>Beta v2.0</span>
              </div>
            </div>
          </div>

          {/* Developer info */}
          {import.meta.env.DEV && (
            <div className="mt-8 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <AlertTriangleIcon className="h-4 w-4 text-yellow-400 mr-2" />
                <span className="text-yellow-300 font-medium">Development Mode</span>
              </div>
              <p className="text-yellow-200 text-sm">
                Current path: <code className="bg-yellow-900/50 px-2 py-1 rounded text-xs">{window.location.pathname}</code>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}