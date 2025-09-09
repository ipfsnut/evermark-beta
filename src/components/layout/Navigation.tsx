import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  HomeIcon,
  CompassIcon,
  TrendingUpIcon,
  CoinsIcon,
  PlusIcon,
  BookOpenIcon,
  InfoIcon,
  ShareIcon,
  ArrowUpDownIcon,
  UserIcon,
  FlaskConicalIcon,
  MonitorIcon
} from 'lucide-react';
import { useAppAuth } from '../../providers/AppContext';
import { useTheme } from '../../providers/ThemeProvider';
import { useWalletAddress } from '../../hooks/core/useWalletAccount';
import { cn } from '../../utils/responsive';

// Development wallet address
const DEVELOPMENT_WALLET_ADDRESS = '0x3427b4716B90C11F9971e43999a48A47Cf5B571E';

// Navigation item interface
interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requireAuth?: boolean;
  badge?: string | number;
}

// Main navigation items
const navigationItems: NavItem[] = [
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
    to: '/leaderboard',
    label: 'Leaderboard',
    icon: TrendingUpIcon,
  },
  {
    to: '/swap',
    label: 'Swap',
    icon: ArrowUpDownIcon,
  },
  {
    to: '/staking',
    label: 'Staking',
    icon: CoinsIcon,
  },
  {
    to: '/beta',
    label: 'Beta',
    icon: FlaskConicalIcon,
    requireAuth: true,
  },
];

// Secondary actions
const actionItems: NavItem[] = [
  {
    to: '/create',
    label: 'Create Evermark',
    icon: PlusIcon,
  },
];

// Info section items
const infoItems: NavItem[] = [
  {
    to: '/about',
    label: 'About',
    icon: InfoIcon,
  },
  {
    to: '/dev-dashboard',
    label: 'Dev Dashboard',
    icon: MonitorIcon,
  },
];

export function Navigation() {
  const { isAuthenticated } = useAppAuth();
  const { isDark } = useTheme();
  const location = useLocation();
  const walletAddress = useWalletAddress();
  
  // Check if connected wallet is the development wallet
  const isDevWallet = walletAddress?.toLowerCase() === DEVELOPMENT_WALLET_ADDRESS.toLowerCase();
  
  // Filter info items to only show dev dashboard for development wallet
  const filteredInfoItems = infoItems.filter(item => 
    item.to !== '/dev-dashboard' || isDevWallet
  );

  // Check if a route is active
  const isActiveRoute = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // Render a navigation item
  const renderNavItem = (item: NavItem, variant: 'primary' | 'action' = 'primary') => {
    const Icon = item.icon;
    const isActive = isActiveRoute(item.to);
    const isDisabled = item.requireAuth && !isAuthenticated;

    const baseClasses = cn(
      'flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group',
      isDisabled 
        ? (isDark ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 cursor-not-allowed')
        : (isDark ? 'hover:bg-gray-800 hover:text-white' : 'hover:bg-gray-200 hover:text-gray-900'),
      variant === 'action' && !isDisabled && 'bg-gradient-to-r from-cyber-primary/20 to-cyber-secondary/20 border border-cyber-primary/30'
    );

    const activeClasses = cn(
      'bg-gradient-to-r from-cyber-primary/20 to-cyber-secondary/20',
      'text-cyber-primary border border-cyber-primary/30',
      'shadow-sm shadow-cyber-primary/20'
    );

    const iconClasses = cn(
      'h-5 w-5 mr-3 transition-colors',
      isDisabled 
        ? (isDark ? 'text-gray-600' : 'text-gray-400')
        : isActive 
          ? 'text-cyber-primary' 
          : isDark 
            ? 'text-gray-400 group-hover:text-white' 
            : 'text-gray-500 group-hover:text-gray-900'
    );

    if (isDisabled) {
      return (
        <div
          key={item.to}
          className={baseClasses}
        >
          <Icon className={iconClasses} />
          <span className={cn(
            'font-medium',
            isDark ? 'text-gray-600' : 'text-gray-400'
          )}>
            {item.label}
          </span>
          <span className={cn(
            'ml-auto text-xs',
            isDark ? 'text-gray-700' : 'text-gray-500'
          )}>
            Sign in required
          </span>
        </div>
      );
    }

    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive: linkActive }) => cn(
          baseClasses,
          (isActive || linkActive) && activeClasses
        )}
      >
        <Icon className={iconClasses} />
        <span className={cn(
          'font-medium transition-colors',
          isActive 
            ? 'text-cyber-primary' 
            : isDark 
              ? 'text-gray-300 group-hover:text-white'
              : 'text-gray-600 group-hover:text-gray-900'
        )}>
          {item.label}
        </span>
        
        {/* Badge for notifications/counts */}
        {item.badge && (
          <span className="ml-auto bg-cyber-primary text-black text-xs font-bold px-2 py-1 rounded-full">
            {item.badge}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <div className="space-y-6">
      {/* Primary navigation */}
      <div className="space-y-1">
        <h3 className={cn(
          "text-xs font-semibold uppercase tracking-wider mb-3",
          isDark ? "text-gray-500" : "text-gray-400"
        )}>
          Main
        </h3>
        {navigationItems.map(item => renderNavItem(item))}
      </div>

      {/* Divider */}
      <div className={cn(
        "border-t",
        isDark ? "border-gray-800" : "border-gray-200"
      )} />

      {/* Action items */}
      <div className="space-y-1">
        <h3 className={cn(
          "text-xs font-semibold uppercase tracking-wider mb-3",
          isDark ? "text-gray-500" : "text-gray-400"
        )}>
          Actions
        </h3>
        {actionItems.map(item => renderNavItem(item, 'action'))}
      </div>

      {/* Divider */}
      <div className={cn(
        "border-t",
        isDark ? "border-gray-800" : "border-gray-200"
      )} />

      {/* Info section */}
      <div className="space-y-1">
        <h3 className={cn(
          "text-xs font-semibold uppercase tracking-wider mb-3",
          isDark ? "text-gray-500" : "text-gray-400"
        )}>
          Info
        </h3>
        {filteredInfoItems.map(item => renderNavItem(item))}
      </div>

      {/* Auth prompt for non-authenticated users */}
      {!isAuthenticated && (
        <div className={cn(
          "rounded-lg p-4",
          isDark 
            ? "bg-gray-800/50 border border-gray-700"
            : "bg-gray-100/50 border border-gray-300"
        )}>
          <div className="text-center">
            <BookOpenIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <h4 className={cn(
              "text-sm font-medium mb-1",
              isDark ? "text-white" : "text-gray-900"
            )}>
              Create & Collect
            </h4>
            <p className={cn(
              "text-xs mb-3",
              isDark ? "text-gray-400" : "text-gray-600"
            )}>
              Connect to start creating Evermarks and building your collection.
            </p>
            <NavLink
              to="/"
              className="inline-flex items-center px-3 py-1.5 bg-cyber-primary text-black text-sm font-medium rounded hover:bg-opacity-90 transition-colors"
            >
              Get Started
            </NavLink>
          </div>
        </div>
      )}

      {/* Network status indicator */}
      <div className={cn(
        "flex items-center justify-center space-x-2 text-xs",
        isDark ? "text-gray-500" : "text-gray-400"
      )}>
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span>Base Network</span>
      </div>
    </div>
  );
}