import React, { useState, useEffect } from 'react';
import { User, ExternalLink, Verified, Crown, Users, Link2 } from 'lucide-react';
import { useThemeClasses } from '@/providers/ThemeProvider';

interface ProfileInfo {
  address: string;
  farcasterUsername?: string;
  farcasterDisplayName?: string;
  farcasterFid?: number;
  farcasterPfp?: string;
  ensName?: string;
  displayName: string;
  source: 'farcaster' | 'ens' | 'address';
}

interface CreatorProfileProps {
  creatorAddress: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showBio?: boolean;
}

export function CreatorProfile({ 
  creatorAddress, 
  className = '', 
  size = 'md',
  showBio = true 
}: CreatorProfileProps) {
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const themeClasses = useThemeClasses();

  useEffect(() => {
    async function loadProfile() {
      if (!creatorAddress) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`/.netlify/functions/resolve-profile?address=${creatorAddress}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.profile) {
            setProfile(data.profile);
          } else {
            // Fallback to basic address display
            setProfile({
              address: creatorAddress,
              displayName: `${creatorAddress.slice(0, 6)}...${creatorAddress.slice(-4)}`,
              source: 'address'
            });
          }
        } else {
          throw new Error('Profile resolution failed');
        }
      } catch (err) {
        console.warn('Failed to resolve creator profile:', err);
        setError('Failed to load profile');
        // Fallback to basic address display
        setProfile({
          address: creatorAddress,
          displayName: `${creatorAddress.slice(0, 6)}...${creatorAddress.slice(-4)}`,
          source: 'address'
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [creatorAddress]);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          avatar: 'h-8 w-8',
          name: 'text-sm font-medium',
          subtitle: 'text-xs',
          badge: 'text-xs px-2 py-0.5'
        };
      case 'lg':
        return {
          avatar: 'h-16 w-16',
          name: 'text-xl font-bold',
          subtitle: 'text-sm',
          badge: 'text-sm px-3 py-1'
        };
      default: // md
        return {
          avatar: 'h-12 w-12',
          name: 'text-lg font-semibold',
          subtitle: 'text-sm',
          badge: 'text-xs px-2 py-1'
        };
    }
  };

  const sizeClasses = getSizeClasses();

  if (isLoading) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className={`${sizeClasses.avatar} bg-gray-700 rounded-full animate-pulse`} />
        <div className="space-y-1">
          <div className="h-4 bg-gray-700 rounded animate-pulse w-24" />
          <div className="h-3 bg-gray-700 rounded animate-pulse w-16" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className={`${sizeClasses.avatar} bg-gray-700 rounded-full flex items-center justify-center`}>
          <User className="h-4 w-4 text-gray-400" />
        </div>
        <div>
          <p className={`${sizeClasses.name} ${themeClasses.text.primary}`}>Unknown Creator</p>
          <p className={`${sizeClasses.subtitle} ${themeClasses.text.muted}`}>Failed to load profile</p>
        </div>
      </div>
    );
  }

  const getProfileUrl = () => {
    if (profile.farcasterUsername) {
      return `https://farcaster.xyz/${profile.farcasterUsername}`;
    }
    return `https://etherscan.io/address/${profile.address}`;
  };

  const getVerificationBadge = () => {
    if (profile.source === 'farcaster') {
      return (
        <div className="flex items-center gap-1 bg-purple-600/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
          <Verified className="h-3 w-3" />
          <span className="text-xs font-medium">Farcaster</span>
        </div>
      );
    }
    
    if (profile.source === 'ens') {
      return (
        <div className="flex items-center gap-1 bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
          <Link2 className="h-3 w-3" />
          <span className="text-xs font-medium">ENS</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`group ${className}`}>
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {profile.farcasterPfp ? (
            <img
              src={profile.farcasterPfp}
              alt={`${profile.displayName} avatar`}
              className={`${sizeClasses.avatar} rounded-full border-2 border-purple-500/30 object-cover`}
            />
          ) : (
            <div className={`${sizeClasses.avatar} bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center border-2 border-purple-500/30`}>
              <User className="h-6 w-6 text-white" />
            </div>
          )}
          
          {/* Source indicator dot */}
          <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 ${themeClasses.border.primary} flex items-center justify-center text-xs ${
            profile.source === 'farcaster' ? 'bg-purple-600' :
            profile.source === 'ens' ? 'bg-blue-600' : 
            'bg-gray-600'
          }`}>
            {profile.source === 'farcaster' ? '🚀' :
             profile.source === 'ens' ? '🏷️' : 
             '💳'}
          </div>
        </div>

        {/* Profile Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`${sizeClasses.name} ${themeClasses.text.primary} truncate`}>
              {profile.displayName}
            </h3>
            {getVerificationBadge()}
          </div>

          <div className="flex flex-col gap-1">
            {/* Username and FID */}
            {profile.farcasterUsername && (
              <p className={`${sizeClasses.subtitle} text-purple-400`}>
                @{profile.farcasterUsername}
                {profile.farcasterFid && ` • FID ${profile.farcasterFid}`}
              </p>
            )}

            {/* ENS Name */}
            {profile.ensName && profile.source !== 'farcaster' && (
              <p className={`${sizeClasses.subtitle} text-blue-400`}>
                {profile.ensName}
              </p>
            )}

            {/* Address */}
            <p className={`${sizeClasses.subtitle} ${themeClasses.text.muted} font-mono`}>
              {profile.address.slice(0, 8)}...{profile.address.slice(-6)}
            </p>

            {/* View Profile Link */}
            <div className="flex items-center gap-2 mt-1">
              <a
                href={getProfileUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 ${sizeClasses.subtitle} text-cyan-400 hover:text-cyan-300 transition-colors`}
              >
                <span>View Profile</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Creator Badge */}
      <div className="mt-3 inline-flex items-center gap-1 bg-gradient-to-r from-green-600/20 to-emerald-600/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30">
        <Crown className="h-3 w-3" />
        <span className="text-xs font-medium">Evermark Creator</span>
      </div>
    </div>
  );
}

export default CreatorProfile;