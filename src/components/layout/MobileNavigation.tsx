// Mobile-first bottom navigation bar
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  HomeIcon,
  CompassIcon,
  PlusIcon,
  TrendingUpIcon,
  ShareIcon,
  FlaskConicalIcon
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
}

const mobileNavItems: NavItem[] = [
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
    to: '/create',
    label: 'Create',
    icon: PlusIcon,
    requireAuth: true,
  },
  {
    to: '/leaderboard',
    label: 'Ranks',
    icon: TrendingUpIcon,
  },
  {
    to: '/beta',
    label: 'Beta',
    icon: FlaskConicalIcon,
    requireAuth: true,
  },
];

export function MobileNavigation() {
  const { isAuthenticated } = useAppAuth();
  const { isInFarcaster } = useFarcasterDetection();
  const { isDark } = useTheme();
  const location = useLocation();

  // Check if current route is active
  const isActiveRoute = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className={cn(
      'fixed bottom-0 left-0 right-0 z-50',
      'backdrop-blur-lg transition-colors duration-200',
      isDark 
        ? 'bg-black/95 border-t border-gray-800' 
        : 'bg-yellow-50/95 border-t border-yellow-200',
      'safe-area-inset-bottom', // iOS safe area
      isInFarcaster ? 'pb-0' : 'pb-safe' // Adjust for Farcaster
    )}>
      <div className="grid grid-cols-5 h-16">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = isActiveRoute(item.to);
          
          // Hide auth items if not authenticated
          if (item.requireAuth && !isAuthenticated) {
            return (
              <div key={item.to} className="opacity-30 pointer-events-none">
                <div className="flex flex-col items-center justify-center h-full px-2">
                  <Icon className={cn(
                    "h-5 w-5",
                    isDark ? "text-gray-600" : "text-gray-400"
                  )} />
                  <span className={cn(
                    "text-[10px] mt-1",
                    isDark ? "text-gray-600" : "text-gray-400"
                  )}>
                    {item.label}
                  </span>
                </div>
              </div>
            );
          }

          // Special styling for create button
          const isCreateButton = item.to === '/create';

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center justify-center h-full px-2',
                'transition-all duration-200 active:scale-95',
                'relative'
              )}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute top-0 inset-x-2 h-0.5 bg-gradient-to-r from-green-400 to-purple-500" />
              )}

              {/* Create button special design */}
              {isCreateButton ? (
                <div className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center',
                  'bg-gradient-to-r from-green-400 to-purple-500',
                  'shadow-lg shadow-purple-500/30',
                  isActive && 'ring-2 ring-white ring-offset-2 ring-offset-black'
                )}>
                  <Icon className="h-6 w-6 text-black" />
                </div>
              ) : (
                <>
                  <Icon className={cn(
                    'h-5 w-5 transition-colors',
                    isActive 
                      ? (isDark ? 'text-white' : 'text-gray-900')
                      : (isDark ? 'text-gray-400' : 'text-gray-500')
                  )} />
                  <span className={cn(
                    'text-[10px] mt-1 transition-colors',
                    isActive 
                      ? (isDark ? 'text-white' : 'text-gray-900')
                      : (isDark ? 'text-gray-400' : 'text-gray-500')
                  )}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}