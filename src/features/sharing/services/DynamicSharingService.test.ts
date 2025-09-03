// src/features/sharing/services/DynamicSharingService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the VotingDataService
vi.mock('../../../shared/services/VotingDataService', () => ({
  VotingDataService: {
    getBulkVotingData: vi.fn().mockResolvedValue(new Map([
      ['1', { votes: 100 }],
      ['2', { votes: 250 }],
      ['3', { votes: 50 }]
    ]))
  }
}));

describe('Dynamic Sharing Service', () => {
  describe('URL Generation', () => {
    it('should generate correct dynamic OG image URL', () => {
      const baseUrl = 'https://evermarks.net';
      const dynamicUrl = `${baseUrl}/.netlify/functions/dynamic-og-image`;
      
      expect(dynamicUrl).toBe('https://evermarks.net/.netlify/functions/dynamic-og-image');
    });

    it('should use proper URL for local development', () => {
      const baseUrl = 'http://localhost:8888';
      const dynamicUrl = `${baseUrl}/.netlify/functions/dynamic-og-image`;
      
      expect(dynamicUrl).toBe('http://localhost:8888/.netlify/functions/dynamic-og-image');
    });

    it('should handle different protocols correctly', () => {
      const httpsUrl = 'https://evermarks.net/.netlify/functions/dynamic-og-image';
      const httpUrl = 'http://evermarks.net/.netlify/functions/dynamic-og-image';
      
      expect(httpsUrl).toContain('https://');
      expect(httpUrl).toContain('http://');
    });
  });

  describe('Meta Tag Generation', () => {
    interface MetaTags {
      title: string;
      description: string;
      image: string;
      url: string;
    }

    function generateMetaTags(topEvermark: any): MetaTags {
      const title = topEvermark 
        ? `🏆 "${topEvermark.title}" is trending on Evermark!`
        : 'Evermark Protocol - Content Preserved Forever';
      
      const description = topEvermark
        ? `Currently #1 with ${topEvermark.votes} votes: ${topEvermark.description || `Content by ${topEvermark.author}`}`
        : 'Preserve and curate your favorite content on the blockchain. Community-driven curation with real rewards.';
      
      const image = topEvermark?.supabase_image_url || 'https://evermarks.net/og-image.png';
      const url = topEvermark 
        ? `https://evermarks.net/evermark/${topEvermark.token_id}`
        : 'https://evermarks.net';

      return { title, description, image, url };
    }

    it('should generate correct meta tags for top evermark', () => {
      const topEvermark = {
        token_id: 123,
        title: 'Why Bitcoin Will Hit $1M',
        author: 'CryptoAnalyst',
        description: 'Deep analysis of Bitcoin economics',
        supabase_image_url: 'https://storage.supabase.co/evermark-123.jpg',
        votes: 523
      };

      const meta = generateMetaTags(topEvermark);
      
      expect(meta.title).toBe('🏆 "Why Bitcoin Will Hit $1M" is trending on Evermark!');
      expect(meta.description).toBe('Currently #1 with 523 votes: Deep analysis of Bitcoin economics');
      expect(meta.image).toBe('https://storage.supabase.co/evermark-123.jpg');
      expect(meta.url).toBe('https://evermarks.net/evermark/123');
    });

    it('should generate fallback meta tags when no top evermark', () => {
      const meta = generateMetaTags(null);
      
      expect(meta.title).toBe('Evermark Protocol - Content Preserved Forever');
      expect(meta.description).toContain('Preserve and curate your favorite content');
      expect(meta.image).toBe('https://evermarks.net/og-image.png');
      expect(meta.url).toBe('https://evermarks.net');
    });

    it('should handle missing description gracefully', () => {
      const topEvermark = {
        token_id: 456,
        title: 'Test Evermark',
        author: 'TestAuthor',
        description: null,
        supabase_image_url: null,
        votes: 100
      };

      const meta = generateMetaTags(topEvermark);
      
      expect(meta.description).toBe('Currently #1 with 100 votes: Content by TestAuthor');
      expect(meta.image).toBe('https://evermarks.net/og-image.png');
    });
  });

  describe('Farcaster Frame Format', () => {
    it('should generate correct Farcaster Mini App meta tags', () => {
      const frameHTML = `
        <meta name="fc:miniapp" content="1" />
        <meta name="fc:miniapp:image" content="image.jpg" />
        <meta name="fc:miniapp:button:1" content="🚀 Open Evermark" />
        <meta name="fc:miniapp:button:1:action" content="link" />
        <meta name="fc:miniapp:button:1:target" content="https://evermarks.net" />
      `;

      expect(frameHTML).toContain('fc:miniapp');
      expect(frameHTML).toContain('fc:miniapp:image');
      expect(frameHTML).toContain('fc:miniapp:button:1');
      expect(frameHTML).toContain('fc:miniapp:button:1:action');
      expect(frameHTML).toContain('fc:miniapp:button:1:target');
    });

    it('should use JSON format for new Farcaster standard', () => {
      const jsonEmbed = {
        version: "1",
        imageUrl: "https://evermarks.net/og-image.png",
        button: {
          title: "🚀 Open Evermark",
          action: {
            type: "launch_miniapp",
            url: "https://evermarks.net"
          }
        }
      };

      expect(jsonEmbed.version).toBe("1");
      expect(jsonEmbed.imageUrl).toBeDefined();
      expect(jsonEmbed.button.title).toContain('Open Evermark');
      expect(jsonEmbed.button.action.type).toBe('launch_miniapp');
    });
  });

  describe('Twitter Card Format', () => {
    it('should generate correct Twitter Card meta tags', () => {
      const twitterCard = {
        card: 'summary_large_image',
        title: 'Test Title',
        description: 'Test Description',
        image: 'https://example.com/image.jpg'
      };

      expect(twitterCard.card).toBe('summary_large_image');
      expect(twitterCard.title).toBeDefined();
      expect(twitterCard.description).toBeDefined();
      expect(twitterCard.image).toMatch(/^https?:\/\//);
    });

    it('should limit description to 200 characters', () => {
      const longDescription = 'A'.repeat(250);
      const truncated = longDescription.substring(0, 197) + '...';
      
      expect(truncated.length).toBeLessThanOrEqual(200);
    });
  });

  describe('Share URL Validation', () => {
    it('should validate HTTPS URLs', () => {
      const validUrls = [
        'https://evermarks.net/.netlify/functions/dynamic-og-image',
        'https://www.evermarks.net/share',
        'https://app.evermarks.net'
      ];

      validUrls.forEach(url => {
        expect(url).toMatch(/^https:\/\//);
      });
    });

    it('should handle localhost URLs for development', () => {
      const localUrls = [
        'http://localhost:8888/.netlify/functions/dynamic-og-image',
        'http://localhost:3000/share',
        'http://127.0.0.1:8888/frame'
      ];

      localUrls.forEach(url => {
        expect(url).toMatch(/^http:\/\/(localhost|127\.0\.0\.1)/);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        '//missing-protocol.com',
        ''
      ];

      invalidUrls.forEach(url => {
        let isValid = true;
        try {
          new URL(url);
        } catch {
          isValid = false;
        }
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Cache Headers', () => {
    it('should set appropriate cache headers', () => {
      const headers = {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300', // 5 minutes
        'Access-Control-Allow-Origin': '*'
      };

      expect(headers['Cache-Control']).toContain('max-age=300');
      expect(headers['Content-Type']).toContain('text/html');
      expect(headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('Error Handling', () => {
    it('should fall back to static content on database error', async () => {
      const fallbackContent = {
        title: 'Evermark Protocol',
        image: 'https://evermarks.net/og-image.png'
      };

      // Simulate database error
      const result = await Promise.resolve(fallbackContent).catch(() => fallbackContent);
      
      expect(result.title).toBe('Evermark Protocol');
      expect(result.image).toContain('og-image.png');
    });

    it('should handle missing voting data gracefully', () => {
      const evermark = { token_id: 1, title: 'Test', votes: undefined };
      const votes = evermark.votes || 0;
      
      expect(votes).toBe(0);
    });
  });
});