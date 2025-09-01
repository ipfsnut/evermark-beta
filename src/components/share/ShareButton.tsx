import React, { useState } from 'react';
import {
  ShareIcon,
  LinkIcon,
  ExternalLinkIcon
} from 'lucide-react';
import { useAppAuth } from '../../providers/AppContext';
import { ShareService } from '../../services/ShareService';
import { cn } from '../../utils/responsive';

interface ShareButtonProps {
  evermark: {
    id: string;
    title: string;
    author?: string;
    url?: string;
  };
  variant?: 'button' | 'dropdown';
  className?: string;
}

export function ShareButton({ evermark, variant = 'dropdown', className }: ShareButtonProps) {
  const { user, isAuthenticated, addNotification } = useAppAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async (platform: string, shareFunction: () => Promise<void>) => {
    if (!isAuthenticated || !user?.address) {
      addNotification({
        type: 'warning',
        title: 'Connect wallet to share',
        message: 'You need to connect your wallet to share Evermarks'
      });
      return;
    }

    setIsSharing(true);
    try {
      await shareFunction();
      addNotification({
        type: 'success',
        title: `Shared to ${platform}!`,
        message: 'The Evermark creator will be notified'
      });
      setIsOpen(false);
    } catch (error) {
      console.error('Share failed:', error);
      addNotification({
        type: 'error',
        title: 'Share failed',
        message: error instanceof Error ? error.message : 'Failed to share Evermark'
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleTwitterShare = () => {
    if (!user?.address) return;
    return handleShare('Twitter', () => ShareService.shareToTwitter(evermark, user.address!));
  };

  const handleFarcasterShare = () => {
    if (!user?.address) return;
    return handleShare('Farcaster', () => ShareService.shareToFarcaster(evermark, user.address!));
  };

  const handleCopyLink = () => {
    if (!user?.address) return;
    return handleShare('Link', () => ShareService.copyLink(evermark, user.address!));
  };

  const handleNativeShare = () => {
    if (!user?.address) return;
    return handleShare('Share Menu', () => ShareService.shareNative(evermark, user.address!));
  };

  if (variant === 'button') {
    return (
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSharing}
        className={cn(
          "relative inline-flex items-center px-3 py-2 rounded-lg transition-colors",
          "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700",
          "text-gray-700 dark:text-gray-300",
          isSharing && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <ShareIcon className="h-4 w-4 mr-2" />
        Share
        {isOpen && (
          <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            <div className="py-2">
              <ShareOptions
                onTwitterShare={handleTwitterShare}
                onFarcasterShare={handleFarcasterShare}
                onCopyLink={handleCopyLink}
                onNativeShare={handleNativeShare}
                isSharing={isSharing}
              />
            </div>
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSharing}
        className={cn(
          "p-2 rounded-lg transition-colors",
          "hover:bg-gray-100 dark:hover:bg-gray-800",
          "text-gray-600 dark:text-gray-400",
          isSharing && "opacity-50 cursor-not-allowed",
          className
        )}
        title="Share Evermark"
      >
        <ShareIcon className="h-5 w-5" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            <div className="py-2">
              <ShareOptions
                onTwitterShare={handleTwitterShare}
                onFarcasterShare={handleFarcasterShare}
                onCopyLink={handleCopyLink}
                onNativeShare={handleNativeShare}
                isSharing={isSharing}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ShareOptions({ 
  onTwitterShare, 
  onFarcasterShare, 
  onCopyLink, 
  onNativeShare,
  isSharing 
}: {
  onTwitterShare: () => void;
  onFarcasterShare: () => void;
  onCopyLink: () => void;
  onNativeShare: () => void;
  isSharing: boolean;
}) {
  const supportsNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <>
      <button
        onClick={onTwitterShare}
        disabled={isSharing}
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center disabled:opacity-50"
      >
        <div className="w-4 h-4 mr-3 bg-blue-500 rounded flex items-center justify-center">
          <span className="text-white text-xs font-bold">𝕏</span>
        </div>
        Share on Twitter
      </button>

      <button
        onClick={onFarcasterShare}
        disabled={isSharing}
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center disabled:opacity-50"
      >
        <div className="w-4 h-4 mr-3 bg-purple-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">F</span>
        </div>
        Share on Farcaster
      </button>

      <button
        onClick={onCopyLink}
        disabled={isSharing}
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center disabled:opacity-50"
      >
        <LinkIcon className="h-4 w-4 mr-3 text-gray-500" />
        Copy Link
      </button>

      {supportsNativeShare && (
        <button
          onClick={onNativeShare}
          disabled={isSharing}
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center disabled:opacity-50"
        >
          <ExternalLinkIcon className="h-4 w-4 mr-3 text-gray-500" />
          More Options
        </button>
      )}
    </>
  );
}