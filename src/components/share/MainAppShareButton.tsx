// src/components/share/MainAppShareButton.tsx - Share main app with dynamic top evermark
import React, { useState } from 'react';
import { Share2, Twitter, MessageCircle, Copy, Check } from 'lucide-react';
import { ShareService } from '../../services/ShareService';
import { useAppAuth } from '../../providers/AppContext';
import { cn } from '../../utils/responsive';

interface MainAppShareButtonProps {
  className?: string;
  variant?: 'button' | 'icon';
  label?: string;
}

export function MainAppShareButton({ 
  className = '', 
  variant = 'button',
  label = 'Share Evermark' 
}: MainAppShareButtonProps) {
  const { user } = useAppAuth();
  const walletAddress = user?.address;
  const [isOpen, setIsOpen] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [isSharing, setIsSharing] = useState<string | null>(null);
  const [supportsNativeShare, setSupportsNativeShare] = useState(false);

  // Check for native share support on mount
  React.useEffect(() => {
    setSupportsNativeShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  const handleShare = async (platform: 'twitter' | 'farcaster' | 'native' | 'copy') => {
    if (!walletAddress) {
      console.warn('No wallet connected for share tracking');
      return;
    }

    setIsSharing(platform);
    
    try {
      await ShareService.shareMainApp(platform, walletAddress);
      
      if (platform === 'copy') {
        setJustCopied(true);
        setTimeout(() => setJustCopied(false), 2000);
      }
      
      setIsOpen(false);
    } catch (error) {
      console.error('Share failed:', error);
      
      if (platform === 'native' && (error as Error).message.includes('not supported')) {
        // Fallback to copy link
        try {
          await ShareService.shareMainApp('copy', walletAddress);
          setJustCopied(true);
          setTimeout(() => setJustCopied(false), 2000);
        } catch (copyError) {
          console.error('Copy fallback failed:', copyError);
        }
      }
    } finally {
      setIsSharing(null);
    }
  };

  const handleNativeShare = () => {
    // Try native share first, with copy as fallback
    handleShare('native');
  };

  if (variant === 'icon') {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "p-2 rounded-lg transition-colors",
            "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700",
            "text-gray-600 dark:text-gray-400",
            className
          )}
          aria-label="Share Evermark"
        >
          <Share2 className="h-4 w-4" />
        </button>
        
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 z-20 min-w-[200px]">
              <ShareOptions 
                onShare={handleShare}
                isSharing={isSharing}
                justCopied={justCopied}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Web Share API button (mobile) */}
      {supportsNativeShare ? (
        <button
          onClick={handleNativeShare}
          disabled={isSharing === 'native'}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 bg-cyber-primary text-black font-medium rounded-lg",
            "hover:bg-cyber-primary/90 transition-colors disabled:opacity-50",
            className
          )}
        >
          <Share2 className="h-4 w-4" />
          {isSharing === 'native' ? 'Sharing...' : label}
        </button>
      ) : (
        <>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 bg-cyber-primary text-black font-medium rounded-lg",
              "hover:bg-cyber-primary/90 transition-colors",
              className
            )}
          >
            <Share2 className="h-4 w-4" />
            {label}
          </button>
          
          {isOpen && (
            <>
              <div 
                className="fixed inset-0 z-10"
                onClick={() => setIsOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 z-20 min-w-[200px]">
                <ShareOptions 
                  onShare={handleShare}
                  isSharing={isSharing}
                  justCopied={justCopied}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

interface ShareOptionsProps {
  onShare: (platform: 'twitter' | 'farcaster' | 'copy') => void;
  isSharing: string | null;
  justCopied: boolean;
}

function ShareOptions({ onShare, isSharing, justCopied }: ShareOptionsProps) {
  const options = [
    {
      key: 'twitter' as const,
      label: 'Share on X',
      icon: Twitter,
      color: 'text-blue-500'
    },
    {
      key: 'farcaster' as const,
      label: 'Share on Farcaster',
      icon: MessageCircle,
      color: 'text-purple-500'
    },
    {
      key: 'copy' as const,
      label: justCopied ? 'Copied!' : 'Copy Link',
      icon: justCopied ? Check : Copy,
      color: justCopied ? 'text-green-500' : 'text-gray-500'
    }
  ];

  return (
    <div className="space-y-1">
      {options.map(({ key, label, icon: Icon, color }) => (
        <button
          key={key}
          onClick={() => onShare(key)}
          disabled={isSharing === key}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors text-left",
            "hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50",
            color
          )}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          {isSharing === key ? 'Sharing...' : label}
        </button>
      ))}
    </div>
  );
}