// src/components/layout/MobileMenu.tsx - Mobile slide-out navigation menu
import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  HomeIcon,
  CompassIcon,
  PlusIcon,
  TrendingUpIcon,
  BookOpenIcon,
  InfoIcon,
  ArrowUpDownIcon,
  LayersIcon,
  XIcon,
  ExternalLinkIcon,
  UserIcon
} from 'lucide-react';
import { useAppAuth } from '../../providers/AppContext';
import { useFarcasterDetection } from '../../hooks/useFarcasterDetection';
import { useTheme } from '../../providers/ThemeProvider';
import { cn } from '../../utils/responsive';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requireAuth?: boolean;
  external?: boolean;
}

const MAIN_NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Home',
    icon: HomeIcon,
  },
  {
    to: '/explore',
    label: 'Explore',
    icon: CompassIcon,
  },
  {
    to: '/my-evermarks',
    label: 'My Evermarks',
    icon: UserIcon,
    requireAuth: true,
  },
  {
    to: '/create',
    label: 'Create',
    icon: PlusIcon,
    requireAuth: true,
  },
  {
    to: '/swap',
    label: 'Swap',
    icon: ArrowUpDownIcon,
  },
  {
    to: '/staking',
    label: 'Staking',
    icon: LayersIcon,
    requireAuth: true,
  },
  {
    to: '/leaderboard',
    label: 'Leaderboard',
    icon: TrendingUpIcon,
  },
];

const SECONDARY_NAV_ITEMS: NavItem[] = [
  {
    to: '/about',
    label: 'About',
    icon: InfoIcon,
  },
];

const EXTERNAL_LINKS: NavItem[] = [
  {
    to: 'https://github.com/ipfsnut/evermark-beta',
    label: 'GitHub',
    icon: ExternalLinkIcon,
    external: true,
  },
];

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const { isAuthenticated, user } = useAppAuth();
  const { isInFarcaster: _isInFarcaster } = useFarcasterDetection();
  const { isDark } = useTheme();

  const renderNavItem = (item: NavItem, onClick?: () => void) => {
    const Icon = item.icon;
    const isDisabled = item.requireAuth && !isAuthenticated;

    if (item.external) {
      return (
        <a
          key={item.to}
          href={item.to}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
          className={cn(
            "flex items-center space-x-3 p-4 rounded-lg transition-colors",
            isDark
              ? "text-gray-300 hover:text-white hover:bg-gray-800"
              : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          )}
        >
          <Icon className="h-5 w-5" />
          <span className="font-medium">{item.label}</span>
        </a>
      );
    }

    if (isDisabled) {
      return (
        <div
          key={item.to}
          className={cn(
            "flex items-center space-x-3 p-4 rounded-lg opacity-50",
            isDark ? "text-gray-600" : "text-gray-400"
          )}
        >
          <Icon className="h-5 w-5" />
          <span className="font-medium">{item.label}</span>
          <span className="text-xs ml-auto">Sign in required</span>
        </div>
      );
    }

    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={onClick}
        className={({ isActive }) => cn(
          "flex items-center space-x-3 p-4 rounded-lg transition-colors",
          isActive 
            ? (isDark 
                ? "bg-purple-900/30 text-purple-300 border border-purple-500/30" 
                : "bg-purple-100/80 text-purple-700 border border-purple-200")
            : (isDark
                ? "text-gray-300 hover:text-white hover:bg-gray-800"
                : "text-gray-700 hover:text-gray-900 hover:bg-gray-100")
        )}
      >
        <Icon className="h-5 w-5" />
        <span className="font-medium">{item.label}</span>
      </NavLink>
    );
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={onClose}
          aria-label="Close menu"
        />
      )}
      
      {/* Mobile Menu */}
      <div className={cn(
        "fixed top-0 left-0 bottom-0 z-50 w-80 max-w-[85vw] transform transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full",
        isDark 
          ? "bg-gray-900 border-r border-gray-800" 
          : "bg-gray-50 border-r border-gray-200"
      )}>
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between p-6 border-b",
          isDark ? "border-gray-800" : "border-gray-200"
        )}>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-cyan-500 rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-sm">E</span>
            </div>
            <span className={cn(
              "text-lg font-bold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              Evermark Beta
            </span>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "p-2 rounded-lg transition-colors",
              isDark 
                ? "text-gray-400 hover:text-white hover:bg-gray-800" 
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
            aria-label="Close menu"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* User Info */}
        {isAuthenticated && user && (
          <div className={cn(
            "p-6 border-b",
            isDark ? "border-gray-800" : "border-gray-200"
          )}>
            <div className="flex items-center space-x-3">
              {user.pfpUrl ? (
                <img 
                  src={user.pfpUrl} 
                  alt={user.displayName || user.username || 'User'} 
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  isDark ? "bg-gray-700" : "bg-gray-300"
                )}>
                  <span className={cn(
                    "text-lg font-bold",
                    isDark ? "text-white" : "text-gray-700"
                  )}>
                    {(user.displayName || user.username || 'U')[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <div className={cn(
                  "font-semibold",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  {user.displayName || user.username || 'User'}
                </div>
                <div className={cn(
                  "text-sm",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}>
                  Connected
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Main Navigation */}
          <div className="space-y-1 mb-8">
            <h3 className={cn(
              "text-xs font-semibold uppercase tracking-wider mb-4",
              isDark ? "text-gray-400" : "text-gray-600"
            )}>
              Navigation
            </h3>
            {MAIN_NAV_ITEMS.map(item => renderNavItem(item, onClose))}
          </div>

          {/* Secondary Navigation */}
          <div className="space-y-1 mb-8">
            <h3 className={cn(
              "text-xs font-semibold uppercase tracking-wider mb-4",
              isDark ? "text-gray-400" : "text-gray-600"
            )}>
              Information
            </h3>
            {SECONDARY_NAV_ITEMS.map(item => renderNavItem(item, onClose))}
          </div>

          {/* External Links */}
          <div className="space-y-1">
            <h3 className={cn(
              "text-xs font-semibold uppercase tracking-wider mb-4",
              isDark ? "text-gray-400" : "text-gray-600"
            )}>
              External
            </h3>
            {EXTERNAL_LINKS.map(item => renderNavItem(item, onClose))}
          </div>
        </div>

        {/* Footer */}
        <div className={cn(
          "p-6 border-t",
          isDark ? "border-gray-800" : "border-gray-200"
        )}>
          <div className={cn(
            "text-center text-xs",
            isDark ? "text-gray-500" : "text-gray-500"
          )}>
            <div className="mb-2">Evermark Beta v0.1</div>
            <div className="flex items-center justify-center space-x-2">
              <span>Built on</span>
              <span className="font-semibold text-blue-500">Base</span>
              <span>•</span>
              <span>Powered by</span>
              <span className="font-semibold text-purple-500">EMARK</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}