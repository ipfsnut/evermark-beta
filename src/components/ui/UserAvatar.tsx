// src/components/ui/UserAvatar.tsx
// Smart avatar component that handles Farcaster PFPs and wallet addresses

import React, { useState, useCallback } from 'react';
import { UserIcon, ShieldCheckIcon } from 'lucide-react';
import { cn } from '../../utils/responsive';
import type { AppFarcasterUser } from '../../lib/neynar/neynarTypes';

interface UserAvatarProps {
  // User data - can be Farcaster user or just address
  user?: AppFarcasterUser | null;
  address?: string;
  
  // Display options
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shape?: 'circle' | 'rounded' | 'square';
  showBadge?: boolean;
  showBorder?: boolean;
  
  // Fallback options
  fallbackType?: 'blockies' | 'dicebear' | 'identicon' | 'initial';
  fallbackSeed?: string;
  
  // Styling
  className?: string;
  
  // Events
  onClick?: () => void;
}

const sizeMap = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm', 
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
  '2xl': 'w-20 h-20 text-2xl'
};

const badgeSizeMap = {
  xs: 'w-2 h-2 -top-0.5 -right-0.5',
  sm: 'w-2 h-2 -top-0.5 -right-0.5',
  md: 'w-3 h-3 -top-1 -right-1',
  lg: 'w-3 h-3 -top-1 -right-1', 
  xl: 'w-4 h-4 -top-1 -right-1',
  '2xl': 'w-4 h-4 -top-1 -right-1'
};

function generateFallbackUrl(
  type: 'blockies' | 'dicebear' | 'identicon' | 'initial',
  seed: string
): string {
  switch (type) {
    case 'blockies':
      return `https://api.dicebear.com/7.x/shapes/svg?seed=${seed}&backgroundColor=00ff41,0080ff,ff0080`;
    case 'dicebear':
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
    case 'identicon': 
      return `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}&backgroundColor=00ff41,0080ff,ff0080`;
    case 'initial':
      return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=00ff41`;
    default:
      return `https://api.dicebear.com/7.x/shapes/svg?seed=${seed}`;
  }
}

function getDisplayInitial(user?: AppFarcasterUser | null, address?: string): string {
  if (user?.displayName) {
    return user.displayName.charAt(0).toUpperCase();
  }
  if (user?.username) {
    return user.username.charAt(0).toUpperCase();
  }
  if (address) {
    return address.slice(2, 4).toUpperCase();
  }
  return '?';
}

export function UserAvatar({
  user,
  address,
  size = 'md',
  shape = 'circle',
  showBadge = true,
  showBorder = false,
  fallbackType = 'blockies',
  fallbackSeed,
  className,
  onClick
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Determine the seed for fallback generation
  const seed = fallbackSeed || user?.username || address || 'default';
  
  // Get the primary image URL (Farcaster PFP takes priority)
  const primaryImageUrl = user?.pfpUrl;
  
  // Generate fallback URL
  const fallbackImageUrl = generateFallbackUrl(fallbackType, seed);
  
  // Get display initial for text fallback
  const displayInitial = getDisplayInitial(user, address);

  const handleImageLoad = useCallback(() => {
    setImageLoading(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoading(false);
  }, []);

  // Determine what to show
  const shouldShowImage = (primaryImageUrl || fallbackImageUrl) && !imageError;
  const imageUrl = !imageError && primaryImageUrl ? primaryImageUrl : fallbackImageUrl;

  // Build CSS classes
  const shapeClasses = {
    circle: 'rounded-full',
    rounded: 'rounded-lg',
    square: 'rounded-none'
  };

  const containerClasses = cn(
    'relative inline-flex items-center justify-center flex-shrink-0',
    sizeMap[size],
    shapeClasses[shape],
    showBorder && 'ring-2 ring-gray-600',
    onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
    className
  );

  const imageClasses = cn(
    'object-cover',
    shapeClasses[shape]
  );

  const getBadgeColor = (user?: AppFarcasterUser | null) => {
    if (!user) return 'bg-gray-500';
    if (user.isVerified) return 'bg-green-500';
    if (user.hasPowerBadge && !user.isVerified) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const badgeClasses = cn(
    'absolute rounded-full border-2 border-gray-900',
    badgeSizeMap[size],
    getBadgeColor(user)
  );

  return (
    <div className={containerClasses} onClick={onClick}>
      {shouldShowImage ? (
        <>
          <img
            src={imageUrl}
            alt={user?.displayName || user?.username || 'User avatar'}
            className={cn(imageClasses, 'w-full h-full')}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
          />
          {imageLoading && (
            <div className={cn(
              'absolute inset-0 bg-gray-700 animate-pulse flex items-center justify-center',
              shapeClasses[shape]
            )}>
              <UserIcon className="w-1/2 h-1/2 text-gray-500" />
            </div>
          )}
        </>
      ) : (
        // Text fallback
        <div className={cn(
          'w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center font-semibold text-white',
          shapeClasses[shape]
        )}>
          {displayInitial}
        </div>
      )}

      {/* Verification/Power Badge */}
      {showBadge && (user?.isVerified || user?.hasPowerBadge) && (
        <div className={badgeClasses}>
          {user?.isVerified && (
            <ShieldCheckIcon className="w-full h-full text-white p-0.5" />
          )}
        </div>
      )}
    </div>
  );
}

// Preset avatar components for common use cases
export function FarcasterAvatar({ 
  user, 
  size = 'md', 
  className,
  onClick 
}: {
  user: AppFarcasterUser;
  size?: UserAvatarProps['size'];
  className?: string;
  onClick?: () => void;
}) {
  return (
    <UserAvatar
      user={user}
      size={size}
      shape="circle"
      showBadge={true}
      showBorder={false}
      fallbackType="dicebear"
      className={className}
      onClick={onClick}
    />
  );
}

export function WalletAvatar({ 
  address, 
  size = 'md', 
  className,
  onClick 
}: {
  address: string;
  size?: UserAvatarProps['size'];
  className?: string;
  onClick?: () => void;
}) {
  return (
    <UserAvatar
      address={address}
      size={size}
      shape="circle"
      showBadge={false}
      showBorder={true}
      fallbackType="blockies"
      className={className}
      onClick={onClick}
    />
  );
}

// Avatar with user info display
export function UserAvatarWithInfo({
  user,
  address,
  size = 'md',
  showUsername = true,
  showAddress = false,
  layout = 'horizontal',
  className,
  onClick
}: UserAvatarProps & {
  showUsername?: boolean;
  showAddress?: boolean;
  layout?: 'horizontal' | 'vertical';
}) {
  const displayName = user?.displayName || user?.username;
  const displayAddress = address?.slice(0, 6) + '...' + address?.slice(-4);

  return (
    <div 
      className={cn(
        'flex items-center gap-3',
        layout === 'vertical' && 'flex-col text-center',
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
      onClick={onClick}
    >
      <UserAvatar
        user={user}
        address={address}
        size={size}
        showBadge={true}
      />
      
      {(showUsername || showAddress) && (
        <div className="flex flex-col min-w-0">
          {showUsername && displayName && (
            <div className="font-medium text-white truncate">
              {displayName}
            </div>
          )}
          {showUsername && user?.username && user.username !== displayName && (
            <div className="text-sm text-gray-400 truncate">
              @{user.username}
            </div>
          )}
          {showAddress && address && (
            <div className="text-sm text-gray-500 font-mono truncate">
              {displayAddress}
            </div>
          )}
        </div>
      )}
    </div>
  );
}