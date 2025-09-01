// src/components/share/DocShareButton.tsx
// Share button component specifically for documentation pages

import React, { useState } from 'react';
import { Share2, Twitter, MessageCircle, Link, Copy, ExternalLink } from 'lucide-react';
import { ShareService } from '../../services/ShareService';

interface DocShareButtonProps {
  docTitle: string;
  docId: string;
  variant?: 'default' | 'compact' | 'floating';
  className?: string;
}

export function DocShareButton({ 
  docTitle, 
  docId, 
  variant = 'default',
  className = '' 
}: DocShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleShare = async (platform: string, shareFunction: () => Promise<void>) => {
    try {
      await shareFunction();
      setIsOpen(false);
    } catch (error) {
      console.error(`Failed to share to ${platform}:`, error);
    }
  };

  const handleCopyLink = async () => {
    try {
      await ShareService.copyDocLink(docTitle, docId);
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
        setIsOpen(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleTwitterShare = () => {
    return handleShare('Twitter', () => ShareService.shareDocToTwitter(docTitle, docId));
  };

  const handleFarcasterShare = () => {
    return handleShare('Farcaster', () => ShareService.shareDocToFarcaster(docTitle, docId));
  };

  const handleNativeShare = () => {
    return handleShare('Share Menu', () => ShareService.shareDocNative(docTitle, docId));
  };

  // Compact variant - just a small share icon
  if (variant === 'compact') {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-gray-400 hover:text-purple-400 transition-colors"
          title="Share this documentation"
        >
          <Share2 className="w-4 h-4" />
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)}
            />
            
            {/* Share menu */}
            <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20">
              <div className="p-3">
                <p className="text-xs text-gray-400 mb-2">Share documentation</p>
                
                <div className="space-y-2">
                  <button
                    onClick={handleTwitterShare}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                  >
                    <Twitter className="w-4 h-4" />
                    Share to Twitter
                  </button>
                  
                  <button
                    onClick={handleFarcasterShare}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Share to Farcaster
                  </button>
                  
                  <button
                    onClick={handleCopyLink}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                  >
                    {copySuccess ? (
                      <>
                        <Copy className="w-4 h-4 text-green-400" />
                        <span className="text-green-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Link className="w-4 h-4" />
                        Copy Link
                      </>
                    )}
                  </button>
                  
                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <button
                      onClick={handleNativeShare}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Share Menu
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Floating variant - fixed position share button
  if (variant === 'floating') {
    return (
      <div className={`fixed bottom-6 right-6 z-30 ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition-colors"
          title="Share this documentation"
        >
          <Share2 className="w-5 h-5" />
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)}
            />
            
            {/* Share menu */}
            <div className="absolute bottom-full right-0 mb-4 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20">
              <div className="p-4">
                <h3 className="text-sm font-medium text-white mb-3">Share &quot;{docTitle}&quot;</h3>
                
                <div className="space-y-2">
                  <button
                    onClick={handleTwitterShare}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                  >
                    <Twitter className="w-4 h-4" />
                    Share to Twitter
                  </button>
                  
                  <button
                    onClick={handleFarcasterShare}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Share to Farcaster
                  </button>
                  
                  <button
                    onClick={handleCopyLink}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                  >
                    {copySuccess ? (
                      <>
                        <Copy className="w-4 h-4 text-green-400" />
                        <span className="text-green-400">Link copied!</span>
                      </>
                    ) : (
                      <>
                        <Link className="w-4 h-4" />
                        Copy Link
                      </>
                    )}
                  </button>
                  
                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <button
                      onClick={handleNativeShare}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Share Menu
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Default variant - inline share buttons
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-gray-400">Share:</span>
      
      <button
        onClick={handleTwitterShare}
        className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
        title="Share on Twitter"
      >
        <Twitter className="w-4 h-4" />
      </button>
      
      <button
        onClick={handleFarcasterShare}
        className="p-2 text-gray-400 hover:text-purple-400 transition-colors"
        title="Share on Farcaster"
      >
        <MessageCircle className="w-4 h-4" />
      </button>
      
      <button
        onClick={handleCopyLink}
        className="p-2 text-gray-400 hover:text-green-400 transition-colors"
        title="Copy link"
      >
        {copySuccess ? (
          <Copy className="w-4 h-4 text-green-400" />
        ) : (
          <Link className="w-4 h-4" />
        )}
      </button>
      
      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <button
          onClick={handleNativeShare}
          className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
          title="Share menu"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}