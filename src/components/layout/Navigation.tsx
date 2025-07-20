import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  HomeIcon,
  CompassIcon,
  TrendingUpIcon,
  CoinsIcon,
  PlusIcon,
  BookOpenIcon
} from 'lucide-react';
import { useAppAuth } from '@/providers/AppContext';
import { cn } from '@/utils/responsive';

// Navigation item interface
interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requireAuth?: boolean;
  badge?: string | number;
}

// Define navigation structure without profile
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
    to: '/leaderboard',
    label: 'Leaderboard',
    icon: TrendingUpIcon,
  },
  {
    to: '/staking',
    label: 'Staking',
    icon: CoinsIcon,
    requireAuth: true,
  },
];

// Secondary actions
const actionItems: NavItem[] = [
  {
    to: '/create',
    label: 'Create Evermark',
    icon: PlusIcon,
    requireAuth: true,
  },
];

export function Navigation() {
  const { isAuthenticated } = useAppAuth();
  const location = useLocation();

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
    
    // Hide auth-required items if not authenticated
    if (item.requireAuth && !isAuthenticated) {
      return null;
    }

    const baseClasses = cn(
      'flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group',
      'hover:bg-gray-800 hover:text-white',
      variant === 'action' && 'bg-gradient-to-r from-cyber-primary/20 to-cyber-secondary/20 border border-cyber-primary/30'
    );

    const activeClasses = cn(
      'bg-gradient-to-r from-cyber-primary/20 to-cyber-secondary/20',
      'text-cyber-primary border border-cyber-primary/30',
      'shadow-sm shadow-cyber-primary/20'
    );

    const iconClasses = cn(
      'h-5 w-5 mr-3 transition-colors',
      isActive ? 'text-cyber-primary' : 'text-gray-400 group-hover:text-white'
    );

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
          isActive ? 'text-cyber-primary' : 'text-gray-300 group-hover:text-white'
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
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Main
        </h3>
        {navigationItems.map(item => renderNavItem(item))}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-800" />

      {/* Action items */}
      {isAuthenticated && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Actions
          </h3>
          {actionItems.map(item => renderNavItem(item, 'action'))}
        </div>
      )}

      {/* Auth prompt for non-authenticated users */}
      {!isAuthenticated && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="text-center">
            <BookOpenIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <h4 className="text-sm font-medium text-white mb-1">
              Create & Collect
            </h4>
            <p className="text-xs text-gray-400 mb-3">
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
      <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span>Base Network</span>
      </div>
    </div>
  );
}