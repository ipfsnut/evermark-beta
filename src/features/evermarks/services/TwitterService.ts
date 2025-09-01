import type { TwitterTweetData } from '../types';

export class TwitterService {
  /**
   * Validate if input is a Twitter/X URL
   */
  static validateTwitterInput(input: string): { 
    isValid: boolean; 
    type: 'tweet_url' | 'profile_url' | null; 
    error?: string 
  } {
    if (!input?.trim()) {
      return { isValid: false, type: null, error: 'Input is required' };
    }

    const trimmedInput = input.trim();

    // Check for tweet URLs
    const tweetPatterns = [
      /^https:\/\/(?:twitter\.com|x\.com)\/[^/]+\/status\/\d+/,
      /^https:\/\/(?:twitter\.com|x\.com)\/[^/]+\/status\/\d+\?/
    ];

    for (const pattern of tweetPatterns) {
      if (pattern.test(trimmedInput)) {
        return { isValid: true, type: 'tweet_url' };
      }
    }

    return { 
      isValid: false, 
      type: null, 
      error: 'Invalid Twitter/X tweet URL format' 
    };
  }

  /**
   * Extract tweet ID and username from Twitter URL
   */
  static extractTweetInfo(url: string): { tweetId: string | null; username: string | null } {
    const match = url.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/);
    if (match) {
      return {
        username: match[1],
        tweetId: match[2]
      };
    }
    return { tweetId: null, username: null };
  }

  /**
   * Fetch tweet metadata using oEmbed API (preserves content even if tweet is deleted later)
   */
  static async fetchTweetMetadata(tweetUrl: string): Promise<TwitterTweetData | null> {
    try {
      const { tweetId, username } = this.extractTweetInfo(tweetUrl);
      if (!tweetId || !username) {
        throw new Error('Could not extract tweet information from URL');
      }

      console.log(`🐦 Fetching tweet metadata for: @${username}/status/${tweetId}`);

      // Use oEmbed API to get tweet content
      const oembedUrl = `https://publish.x.com/oembed?url=${encodeURIComponent(tweetUrl)}`;
      const response = await fetch(oembedUrl);
      
      if (!response.ok) {
        throw new Error(`Twitter oEmbed API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract content from HTML (basic parsing)
      const htmlContent = data.html || '';
      const textMatch = htmlContent.match(/<p[^>]*>([^<]+)</);
      const tweetText = textMatch ? textMatch[1].replace(/&[^;]+;/g, ' ').trim() : '';
      
      // Extract timestamp from HTML
      const dateMatch = htmlContent.match(/(\w+ \d+, \d{4})/);
      const timestamp = dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString();

      return {
        tweetId,
        author: data.author_name || username,
        username,
        displayName: data.author_name,
        content: tweetText,
        timestamp,
        engagement: {
          likes: 0, // oEmbed doesn't provide engagement numbers
          retweets: 0,
          replies: 0
        },
        verified: false, // Would need additional API for verification status
        preservedAt: new Date().toISOString(),
        // Note: We get the tweet content via oEmbed which preserves it even if deleted
      };

    } catch (error) {
      console.error('Failed to fetch tweet metadata:', error);
      
      // Fallback: Extract what we can from URL
      const { tweetId, username } = this.extractTweetInfo(tweetUrl);
      if (username) {
        return {
          tweetId: tweetId || undefined,
          author: username,
          username,
          displayName: username,
          content: 'Tweet content preserved via Evermark',
          timestamp: new Date().toISOString(),
          engagement: {
            likes: 0,
            retweets: 0,
            replies: 0
          },
          preservedAt: new Date().toISOString()
        };
      }
      
      return null;
    }
  }

  /**
   * Generate a tweet image/screenshot for preservation
   * This would be called by a server-side function
   */
  static async generateTweetImage(tweetData: TwitterTweetData): Promise<string | null> {
    try {
      // This would be implemented as a Netlify function that:
      // 1. Takes tweet data
      // 2. Generates a screenshot-like image using Canvas/Puppeteer
      // 3. Returns the image URL
      
      // For now, return null to indicate no custom image generated
      return null;
    } catch (error) {
      console.error('Failed to generate tweet image:', error);
      return null;
    }
  }

  /**
   * Check if content should be treated as a Tweet vs Cast
   */
  static shouldTreatAsTweet(url: string): boolean {
    return /(?:twitter\.com|x\.com)\/[^/]+\/status/.test(url);
  }

  /**
   * Auto-detect if URL should be Tweet content type
   */
  static detectContentType(url: string): 'Tweet' | 'Cast' | null {
    // Twitter/X URLs should be tweets
    if (this.shouldTreatAsTweet(url)) {
      return 'Tweet';
    }
    
    // Farcaster URLs should remain as casts
    if (url.match(/(?:warpcast\.com|farcaster\.xyz|supercast\.xyz)/)) {
      return 'Cast';
    }
    
    return null;
  }
}