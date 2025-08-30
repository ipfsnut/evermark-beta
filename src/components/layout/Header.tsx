import { Link } from 'react-router-dom';
import { useState } from 'react';
import { 
  MenuIcon, 
  BellIcon, 
  SearchIcon,
  UserIcon
} from 'lucide-react';
import { useAppUI, useAppAuth } from '../../providers/AppContext';
import { useFarcasterUser } from '../../lib/farcaster';
import { useTheme } from '../../providers/ThemeProvider';
import { ThemeToggle } from '../ui/ThemeToggle';
import { WalletConnect } from '../ConnectButton';
import { NotificationDropdown } from '../notifications/NotificationDropdown';
import { cn, useIsMobile } from '../../utils/responsive';

export function Header() {
  const { toggleSidebar, notifications } = useAppUI();
  const { isAuthenticated, user } = useAppAuth();
  const { isInFarcaster } = useFarcasterUser();
  const { isDark } = useTheme();
  const isMobile = useIsMobile();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-50 border-b transition-colors duration-200 bg-app-bg-secondary backdrop-blur-sm border-app-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Left section */}
          <div className="flex items-center space-x-4">
            {/* Sidebar toggle - show on mobile, hidden on desktop */}
            {isMobile && (
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Toggle menu"
              >
                <MenuIcon className="h-5 w-5" />
              </button>
            )}
            
            {/* Logo */}
            <Link 
              to="/" 
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-cyber-primary to-cyber-secondary rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-sm">E</span>
              </div>
              {!isMobile && (
                <span className="text-lg font-bold bg-gradient-to-r from-cyber-primary to-cyber-secondary bg-clip-text text-transparent">
                  Evermark
                </span>
              )}
            </Link>
          </div>

          {/* Center section - Search (desktop only) */}
          {!isMobile && !isInFarcaster && (
            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Evermarks..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border transition-colors bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-cyber-primary focus:ring-1 focus:ring-cyber-primary focus:outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-400"
                />
              </div>
            </div>
          )}

          {/* Right section */}
          <div className="flex items-center space-x-3">
            {/* Search icon for mobile */}
            {isMobile && (
              <Link 
                to="/explore"
                className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <SearchIcon className="h-5 w-5" />
              </Link>
            )}

            {/* Theme toggle */}
            <ThemeToggle size="sm" />

            {/* Notifications */}
            <div className="relative">
              <button 
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="relative p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <BellIcon className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              
              <NotificationDropdown 
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
              />
            </div>

            {/* User info or wallet connect */}
            {isAuthenticated && user ? (
              <div className="flex items-center space-x-2 p-2 rounded-lg">
                {user.pfpUrl ? (
                  <img 
                    src={user.pfpUrl} 
                    alt={user.displayName || user.username || 'User'} 
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                    <UserIcon className="h-4 w-4" />
                  </div>
                )}
                {!isMobile && (
                  <span className="text-sm font-medium">
                    {user.displayName || user.username || 'User'}
                  </span>
                )}
              </div>
            ) : (
              <WalletConnect />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}