// src/services/ShareService.ts
// Service for handling Evermark sharing and triggering notifications

import { NotificationService } from './NotificationService';

export interface ShareData {
  evermarkId: string;
  platform: string;
  userAddress: string;
  evermarkTitle?: string;
  evermarkOwner?: string;
}

export class ShareService {
  /**
   * Generate a Mini App compatible URL for sharing within Farcaster
   */
  static generateMiniAppUrl(evermarkId: string, source: 'share' | 'direct' = 'direct'): string {
    // Use Frame endpoint that has proper fc:miniapp meta tags
    // This ensures Farcaster opens the link in the mini-app
    return `${window.location.origin}/.netlify/functions/frame?token_id=${evermarkId}`;
  }

  /**
   * Generate a Mini App compatible URL for any path (docs, pages, etc.)
   */
  static generateMiniAppUrlForPath(path: string, source: 'share' | 'direct' = 'direct'): string {
    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const baseUrl = `${window.location.origin}${cleanPath}`;
    
    // Add Farcaster Mini App context parameters
    const params = new URLSearchParams();
    if (source === 'share') {
      params.set('fc_miniapp', '1');
      params.set('fc_source', 'share');
    }
    
    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  }

  /**
   * Share an Evermark to a platform and record the share
   */
  static async shareEvermark(shareData: ShareData): Promise<void> {
    try {
      // Record the share via API
      const response = await fetch('/.netlify/functions/shares', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token_id: parseInt(shareData.evermarkId),
          platform: shareData.platform,
          user_address: shareData.userAddress,
          metadata: {
            timestamp: Date.now(),
            title: shareData.evermarkTitle
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to record share');
      }

      const result = await response.json();
      
      // Trigger notification if share was recorded successfully and evermark data is available
      if (result.evermark && result.evermark.author !== shareData.userAddress) {
        NotificationService.triggerShareNotification({
          evermarkId: shareData.evermarkId,
          sharerAddress: shareData.userAddress,
          platform: shareData.platform,
          evermarkTitle: result.evermark.title,
          evermarkOwner: result.evermark.author
        });
      }

      console.log('✅ Share recorded:', result);
    } catch (error) {
      console.error('Failed to share Evermark:', error);
      throw error;
    }
  }

  /**
   * Share to Twitter/X
   */
  static async shareToTwitter(evermark: {
    id: string;
    title: string;
    author?: string;
    url?: string;
  }, userAddress: string): Promise<void> {
    const url = evermark.url || `${window.location.origin}/evermark/${evermark.id}`;
    const text = `Check out this Evermark: "${evermark.title}" 🌟\n\n${url}\n\n#Evermark #Web3 #OnChain`;
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    
    // Open Twitter sharing dialog
    window.open(twitterUrl, '_blank', 'width=550,height=350');
    
    // Record the share
    await this.shareEvermark({
      evermarkId: evermark.id,
      platform: 'Twitter',
      userAddress,
      evermarkTitle: evermark.title,
      evermarkOwner: evermark.author
    });
  }

  /**
   * Share to Farcaster
   */
  static async shareToFarcaster(evermark: {
    id: string;
    title: string;
    author?: string;
    url?: string;
  }, userAddress: string): Promise<void> {
    const isInFarcaster = typeof window !== 'undefined' && 
                         (window as any).__evermark_farcaster_detected === true;
    
    // Use Mini App compatible URL for Farcaster shares
    const url = evermark.url || this.generateMiniAppUrl(evermark.id, 'share');
    const text = `Check out this Evermark: "${evermark.title}" 🌟\n\n${url}`;
    
    // If in Farcaster mini app, use SDK for native sharing
    if (isInFarcaster) {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk');
        // Use SDK's share functionality if available
        if (sdk && 'share' in sdk) {
          await sdk.share(text);
          // Record the share
          await this.shareEvermark({
            evermarkId: evermark.id,
            platform: 'Farcaster',
            userAddress,
            evermarkTitle: evermark.title,
            evermarkOwner: evermark.author
          });
          return;
        }
      } catch (error) {
        console.warn('Farcaster SDK share failed, falling back to web share:', error);
      }
    }
    
    const farcasterUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(text)}`;
    
    // Open Farcaster sharing dialog
    window.open(farcasterUrl, '_blank', 'width=550,height=600');
    
    // Record the share
    await this.shareEvermark({
      evermarkId: evermark.id,
      platform: 'Farcaster',
      userAddress,
      evermarkTitle: evermark.title,
      evermarkOwner: evermark.author
    });
  }

  /**
   * Copy link to clipboard
   */
  static async copyLink(evermark: {
    id: string;
    title: string;
    author?: string;
    url?: string;
  }, userAddress: string): Promise<void> {
    // Generate different URLs based on context - Mini App URL if in Farcaster
    const isInFarcaster = typeof window !== 'undefined' && 
                         (window as any).__evermark_farcaster_detected === true;
    
    const url = evermark.url || (isInFarcaster 
      ? this.generateMiniAppUrl(evermark.id, 'share')
      : `${window.location.origin}/evermark/${evermark.id}`);
    
    await navigator.clipboard.writeText(url);
    
    // Record the share
    await this.shareEvermark({
      evermarkId: evermark.id,
      platform: 'Link Copy',
      userAddress,
      evermarkTitle: evermark.title,
      evermarkOwner: evermark.author
    });
  }

  /**
   * Share via Web Share API if supported
   */
  static async shareNative(evermark: {
    id: string;
    title: string;
    author?: string;
    url?: string;
  }, userAddress: string): Promise<void> {
    if (!navigator.share) {
      throw new Error('Web Share API not supported');
    }

    // Use Mini App compatible URL for native sharing in Farcaster context
    const isInFarcaster = typeof window !== 'undefined' && 
                         (window as any).__evermark_farcaster_detected === true;
    
    const url = evermark.url || (isInFarcaster 
      ? this.generateMiniAppUrl(evermark.id, 'share')
      : `${window.location.origin}/evermark/${evermark.id}`);
    
    try {
      await navigator.share({
        title: `Evermark: ${evermark.title}`,
        text: `Check out this Evermark: "${evermark.title}"`,
        url
      });

      // Record the share
      await this.shareEvermark({
        evermarkId: evermark.id,
        platform: 'Native Share',
        userAddress,
        evermarkTitle: evermark.title,
        evermarkOwner: evermark.author
      });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        throw error;
      }
    }
  }

  /**
   * Share documentation page to Twitter/X
   */
  static async shareDocToTwitter(docTitle: string, docId: string): Promise<void> {
    const isInFarcaster = typeof window !== 'undefined' && 
                         (window as any).__evermark_farcaster_detected === true;
    
    const url = isInFarcaster 
      ? this.generateMiniAppUrlForPath(`/docs/${docId}`, 'share')
      : `${window.location.origin}/docs/${docId}`;
    
    const text = `Check out this Evermark documentation: "${docTitle}" 📚\n\n${url}\n\n#Evermark #Web3 #Documentation`;
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    
    // Open Twitter sharing dialog
    window.open(twitterUrl, '_blank', 'width=550,height=350');
  }

  /**
   * Share documentation page to Farcaster
   */
  static async shareDocToFarcaster(docTitle: string, docId: string): Promise<void> {
    const isInFarcaster = typeof window !== 'undefined' && 
                         (window as any).__evermark_farcaster_detected === true;
    
    const url = isInFarcaster 
      ? this.generateMiniAppUrlForPath(`/docs/${docId}`, 'share')
      : `${window.location.origin}/docs/${docId}`;
    
    const text = `Check out this Evermark documentation: "${docTitle}" 📚\n\n${url}`;
    
    // If in Farcaster mini app, use SDK for native sharing
    if (isInFarcaster) {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk');
        // Use SDK's share functionality if available
        if (sdk && 'share' in sdk) {
          await sdk.share(text);
          return;
        }
      } catch (error) {
        console.warn('Farcaster SDK share failed, falling back to web share:', error);
      }
    }
    
    const farcasterUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(text)}`;
    
    // Open Farcaster sharing dialog
    window.open(farcasterUrl, '_blank', 'width=550,height=600');
  }

  /**
   * Copy documentation link to clipboard
   */
  static async copyDocLink(docTitle: string, docId: string): Promise<void> {
    const isInFarcaster = typeof window !== 'undefined' && 
                         (window as any).__evermark_farcaster_detected === true;
    
    const url = isInFarcaster 
      ? this.generateMiniAppUrlForPath(`/docs/${docId}`, 'share')
      : `${window.location.origin}/docs/${docId}`;
    
    await navigator.clipboard.writeText(url);
  }

  /**
   * Share documentation via Web Share API if supported
   */
  static async shareDocNative(docTitle: string, docId: string): Promise<void> {
    if (!navigator.share) {
      throw new Error('Web Share API not supported');
    }

    const isInFarcaster = typeof window !== 'undefined' && 
                         (window as any).__evermark_farcaster_detected === true;
    
    const url = isInFarcaster 
      ? this.generateMiniAppUrlForPath(`/docs/${docId}`, 'share')
      : `${window.location.origin}/docs/${docId}`;
    
    try {
      await navigator.share({
        title: `Evermark Docs: ${docTitle}`,
        text: `Check out this Evermark documentation: "${docTitle}"`,
        url
      });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        throw error;
      }
    }
  }

  /**
   * Test share notification (for development)
   */
  static async testShare(): Promise<void> {
    const testShareData: ShareData = {
      evermarkId: '123',
      platform: 'Twitter',
      userAddress: '0x742d35Cc6634C0532925a3b8D0c46BD5bB8D2D2D',
      evermarkTitle: 'Test Evermark for Sharing',
      evermarkOwner: '0x1234567890123456789012345678901234567890'
    };

    // Trigger the notification directly
    NotificationService.triggerShareNotification({
      evermarkId: testShareData.evermarkId,
      sharerAddress: testShareData.userAddress,
      platform: testShareData.platform,
      evermarkTitle: testShareData.evermarkTitle,
      evermarkOwner: testShareData.evermarkOwner
    });
  }
}