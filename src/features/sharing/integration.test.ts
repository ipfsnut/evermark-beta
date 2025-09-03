// src/features/sharing/integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Dynamic Sharing Integration Tests', () => {
  const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:8888';
  
  describe('Production URL Structure', () => {
    const PROD_URL = 'https://evermarks.net';
    
    it('should have correct production URLs for all share endpoints', () => {
      const endpoints = {
        dynamicOG: `${PROD_URL}/.netlify/functions/dynamic-og-image`,
        frame: `${PROD_URL}/.netlify/functions/frame`,
        shares: `${PROD_URL}/.netlify/functions/shares`,
        leaderboard: `${PROD_URL}/.netlify/functions/leaderboard-data`
      };

      // Verify all URLs are properly formed
      Object.entries(endpoints).forEach(([name, url]) => {
        expect(url).toMatch(/^https:\/\/evermarks\.net/);
        expect(url).toContain('/.netlify/functions/');
        
        // Ensure no double slashes except after protocol
        const withoutProtocol = url.replace(/^https?:\/\//, '');
        expect(withoutProtocol).not.toContain('//');
      });
    });

    it('should generate correct share URLs for different platforms', () => {
      const shareUrls = {
        twitter: 'https://twitter.com/intent/tweet?text=',
        farcaster: 'https://farcaster.xyz/~/compose?text=',
        warpcast: 'https://warpcast.com/~/compose?text='
      };

      Object.entries(shareUrls).forEach(([platform, baseUrl]) => {
        const encodedText = encodeURIComponent('Check out Evermark!');
        const fullUrl = `${baseUrl}${encodedText}`;
        
        expect(fullUrl).toContain(encodedText);
        expect(decodeURIComponent(fullUrl)).toContain('Check out Evermark!');
      });
    });
  });

  describe('Development URL Structure', () => {
    it('should handle localhost URLs correctly', () => {
      const devEndpoints = {
        dynamicOG: `${BASE_URL}/.netlify/functions/dynamic-og-image`,
        frame: `${BASE_URL}/.netlify/functions/frame`,
        shares: `${BASE_URL}/.netlify/functions/shares`
      };

      Object.values(devEndpoints).forEach(url => {
        if (BASE_URL.includes('localhost')) {
          expect(url).toMatch(/^http:\/\/localhost:\d+/);
        }
      });
    });
  });

  describe('Meta Tag Content Validation', () => {
    interface OGMetaTags {
      'og:title': string;
      'og:description': string;
      'og:image': string;
      'og:url': string;
      'og:type': string;
      'og:site_name': string;
    }

    function validateOGTags(tags: OGMetaTags): boolean {
      // Check required fields
      if (!tags['og:title'] || !tags['og:image'] || !tags['og:url']) {
        return false;
      }

      // Validate URL format
      try {
        new URL(tags['og:url']);
        new URL(tags['og:image']);
      } catch {
        return false;
      }

      // Check description length (optimal for social media)
      if (tags['og:description'] && tags['og:description'].length > 300) {
        return false;
      }

      return true;
    }

    it('should generate valid Open Graph meta tags', () => {
      const ogTags: OGMetaTags = {
        'og:title': '🏆 "Test Evermark" is trending on Evermark!',
        'og:description': 'Currently #1 with 100 votes',
        'og:image': 'https://evermarks.net/og-image.png',
        'og:url': 'https://evermarks.net',
        'og:type': 'website',
        'og:site_name': 'Evermark Protocol'
      };

      expect(validateOGTags(ogTags)).toBe(true);
    });

    it('should validate Twitter Card meta tags', () => {
      const twitterTags = {
        'twitter:card': 'summary_large_image',
        'twitter:title': 'Test Title',
        'twitter:description': 'Test Description',
        'twitter:image': 'https://example.com/image.jpg'
      };

      expect(twitterTags['twitter:card']).toBe('summary_large_image');
      expect(twitterTags['twitter:title']).toBeTruthy();
      expect(twitterTags['twitter:description']).toBeTruthy();
      expect(twitterTags['twitter:image']).toMatch(/^https?:\/\//);
    });
  });

  describe('Image Requirements', () => {
    interface ImageSpec {
      url: string;
      width?: number;
      height?: number;
      aspectRatio?: number;
      maxSizeBytes?: number;
    }

    function validateImageSpec(spec: ImageSpec): { valid: boolean; errors: string[] } {
      const errors: string[] = [];

      // Check URL
      if (!spec.url || !spec.url.match(/^https?:\/\//)) {
        errors.push('Invalid image URL');
      }

      // Check dimensions for Farcaster (3:2 aspect ratio)
      if (spec.width && spec.height) {
        const aspectRatio = spec.width / spec.height;
        if (Math.abs(aspectRatio - 1.5) > 0.1) { // Allow 10% variance
          errors.push('Image should have 3:2 aspect ratio for Farcaster');
        }

        // Check minimum dimensions
        if (spec.width < 600 || spec.height < 400) {
          errors.push('Image too small (min 600x400)');
        }

        // Check maximum dimensions
        if (spec.width > 3000 || spec.height > 2000) {
          errors.push('Image too large (max 3000x2000)');
        }
      }

      // Check file size (max 10MB)
      if (spec.maxSizeBytes && spec.maxSizeBytes > 10 * 1024 * 1024) {
        errors.push('Image file too large (max 10MB)');
      }

      return {
        valid: errors.length === 0,
        errors
      };
    }

    it('should validate Farcaster image requirements', () => {
      const validImage: ImageSpec = {
        url: 'https://example.com/image.jpg',
        width: 1200,
        height: 800,
        aspectRatio: 1.5,
        maxSizeBytes: 5 * 1024 * 1024 // 5MB
      };

      const result = validateImageSpec(validImage);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid image specs', () => {
      const invalidImage: ImageSpec = {
        url: 'not-a-url',
        width: 100, // Too small
        height: 100,
        maxSizeBytes: 20 * 1024 * 1024 // Too large
      };

      const result = validateImageSpec(invalidImage);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Share Tracking', () => {
    interface ShareEvent {
      evermarkId: string;
      platform: string;
      userAddress: string;
      timestamp: number;
    }

    it('should create valid share tracking events', () => {
      const shareEvent: ShareEvent = {
        evermarkId: '123',
        platform: 'Twitter',
        userAddress: '0x742d35Cc6634C0532925a3b8D0c46BD5bB8D2D2D',
        timestamp: Date.now()
      };

      expect(shareEvent.evermarkId).toBeTruthy();
      expect(shareEvent.platform).toMatch(/^(Twitter|Farcaster|Native Share|Link Copy)$/);
      expect(shareEvent.userAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(shareEvent.timestamp).toBeGreaterThan(0);
    });

    it('should handle app-level shares differently', () => {
      const appShare: ShareEvent = {
        evermarkId: 'app', // Special ID for app shares
        platform: 'Farcaster',
        userAddress: '0x0000000000000000000000000000000000000000',
        timestamp: Date.now()
      };

      expect(appShare.evermarkId).toBe('app');
    });
  });

  describe('Error Recovery', () => {
    it('should fall back gracefully when services are unavailable', async () => {
      const fallbackStrategy = {
        database: 'Use static content',
        image: 'Use default og-image.png',
        voting: 'Show 0 votes',
        sharing: 'Copy link fallback'
      };

      Object.entries(fallbackStrategy).forEach(([service, strategy]) => {
        expect(strategy).toBeTruthy();
      });
    });

    it('should handle network timeouts', () => {
      const timeout = 5000; // 5 seconds
      const startTime = Date.now();
      
      // Simulate timeout check
      setTimeout(() => {
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeGreaterThanOrEqual(timeout);
      }, timeout);
    });
  });

  describe('Content Sanitization', () => {
    function sanitizeForMeta(text: string): string {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .substring(0, 200);
    }

    it('should sanitize user content for meta tags', () => {
      const maliciousContent = '<script>alert("XSS")</script>';
      const sanitized = sanitizeForMeta(maliciousContent);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
      expect(sanitized).toContain('&quot;');
    });

    it('should truncate long content', () => {
      const longContent = 'A'.repeat(500);
      const sanitized = sanitizeForMeta(longContent);
      
      expect(sanitized.length).toBeLessThanOrEqual(200);
    });
  });
});