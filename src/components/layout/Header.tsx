import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  MenuIcon, 
  BellIcon, 
  SearchIcon,
  UserIcon
} from 'lucide-react';
import { useAppUI, useAppAuth } from '../../providers/AppContext';
import { useFarcasterDetection } from '../../hooks/useFarcasterDetection';
import { ThemeToggle } from '../ui/ThemeToggle';
import { WalletConnect } from '../ConnectButton';
import { NotificationDropdown } from '../notifications/NotificationDropdown';
import { useIsMobile } from '../../utils/responsive';

export function Header() {
  const { toggleSidebar, notifications } = useAppUI();
  const { isAuthenticated, user } = useAppAuth();
  const { isInFarcaster } = useFarcasterDetection();
  const isMobile = useIsMobile(1024); // Use 1024px breakpoint (lg screen) to show hamburger on tablets too
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Show hamburger button if mobile OR in Farcaster miniapp context (since no native nav)
  const shouldShowHamburger = isMobile || isInFarcaster;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-50 border-b transition-colors duration-200 bg-app-bg-secondary backdrop-blur-sm border-app-border">
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Left section */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Sidebar toggle - show on mobile/tablet OR in Farcaster miniapp context */}
            {shouldShowHamburger && (
              <button
                onClick={toggleSidebar}
                className="p-1.5 lg:p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0"
                aria-label="Toggle menu"
              >
                <MenuIcon className="h-4 w-4 lg:h-5 lg:w-5" />
              </button>
            )}
            
            {/* Logo */}
            <Link 
              to="/" 
              className="flex items-center space-x-1 sm:space-x-2 hover:opacity-80 transition-opacity flex-shrink-0"
            >
              <div className="relative w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-r from-cyber-primary to-cyber-secondary rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-xs sm:text-sm">E</span>
                {isMobile && (
                  <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 px-1 py-0.5 text-[7px] sm:text-[8px] font-bold rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white">
                    β
                  </span>
                )}
              </div>
              {!isMobile && (
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold bg-gradient-to-r from-cyber-primary to-cyber-secondary bg-clip-text text-transparent">
                    Evermark
                  </span>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white">
                    BETA
                  </span>
                </div>
              )}
            </Link>
          </div>

          {/* Center section - Search (desktop only, but allow in Farcaster if not mobile) */}
          {!isMobile && (
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
          <div className="flex items-center space-x-1 sm:space-x-3">
            {/* Search icon for mobile */}
            {isMobile && (
              <Link 
                to="/explore"
                className="p-1.5 sm:p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0"
              >
                <SearchIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
            )}

            {/* Theme toggle */}
            <div className="flex-shrink-0">
              <ThemeToggle size="sm" />
            </div>

            {/* Notifications */}
            <div className="relative flex-shrink-0">
              <button 
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="relative p-1.5 sm:p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <BellIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center">
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
            <div className="flex-shrink-0">
              {isAuthenticated && user ? (
                <div className="flex items-center space-x-1 sm:space-x-2 p-1 sm:p-2 rounded-lg">
                  {user.pfpUrl ? (
                    <img 
                      src={user.pfpUrl} 
                      alt={user.displayName || user.username || 'User'} 
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-700 rounded-full flex items-center justify-center">
                      <UserIcon className="h-3 w-3 sm:h-4 sm:w-4" />
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
      </div>
    </header>
  );
}