import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MediaPreservationService, type PreservedMedia, type EmbedMetadata } from '../MediaPreservationService';

// Mock fetch
global.fetch = vi.fn();
const mockFetch = fetch as any;

describe('MediaPreservationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('preserveMedia', () => {
    it('should preserve media successfully', async () => {
      const mockResult: PreservedMedia = {
        original_url: 'https://example.com/image.jpg',
        ardrive_tx: 'tx_123',
        ipfs_hash: 'Qm123',
        content_type: 'image/jpeg',
        file_size: 1024,
        dimensions: { width: 800, height: 600 },
        preserved_at: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResult),
      });

      const result = await MediaPreservationService.preserveMedia('https://example.com/image.jpg');

      expect(result).toMatchObject({
        original_url: 'https://example.com/image.jpg',
        ardrive_tx: 'tx_123',
        ipfs_hash: 'Qm123',
        content_type: 'image/jpeg',
        file_size: 1024,
        dimensions: { width: 800, height: 600 },
      });
      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/preserve-media',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/image.jpg' }),
        }
      );
    });

    it('should return null on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      const result = await MediaPreservationService.preserveMedia('https://example.com/missing.jpg');

      expect(result).toBeNull();
    });

    it('should return null for empty URL', async () => {
      const result = await MediaPreservationService.preserveMedia('');

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should deduplicate concurrent requests', async () => {
      const mockResult: PreservedMedia = {
        original_url: 'https://example.com/image.jpg',
        ardrive_tx: 'tx_123',
        ipfs_hash: 'Qm123',
        content_type: 'image/jpeg',
        file_size: 1024,
        dimensions: { width: 800, height: 600 },
        preserved_at: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResult),
      });

      const url = 'https://example.com/image.jpg';
      
      // Make multiple concurrent requests
      const promises = [
        MediaPreservationService.preserveMedia(url),
        MediaPreservationService.preserveMedia(url),
        MediaPreservationService.preserveMedia(url),
      ];

      const results = await Promise.all(promises);

      // All should return the same result
      results.forEach(result => {
        expect(result).toMatchObject({
          original_url: 'https://example.com/image.jpg',
          ardrive_tx: 'tx_123',
          ipfs_hash: 'Qm123',
          content_type: 'image/jpeg',
          file_size: 1024,
          dimensions: { width: 800, height: 600 },
        });
      });

      // But fetch should only be called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('extractEmbedMetadata', () => {
    it('should extract metadata for image URL', async () => {
      const mockMetadata = {
        og_title: 'Test Image',
        og_description: 'A test image',
        og_image: 'https://example.com/preview.jpg',
        favicon: 'https://example.com/favicon.ico',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMetadata),
      });

      const result = await MediaPreservationService.extractEmbedMetadata('https://example.com/image.jpg');

      expect(result).toEqual({
        type: 'image',
        title: 'Test Image',
        description: 'A test image',
        og_image: 'https://example.com/preview.jpg',
        domain: 'example.com',
        favicon: 'https://example.com/favicon.ico',
      });
    });

    it('should detect video URLs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const result = await MediaPreservationService.extractEmbedMetadata('https://youtube.com/watch?v=123');

      expect(result).toEqual({
        type: 'video',
        domain: 'youtube.com',
      });
    });

    it('should detect frame URLs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const result = await MediaPreservationService.extractEmbedMetadata('https://example.com/frames/test');

      expect(result).toEqual({
        type: 'frame',
        domain: 'example.com',
      });
    });

    it('should return null on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await MediaPreservationService.extractEmbedMetadata('invalid-url');

      expect(result).toBeNull();
    });
  });

  describe('preserveMultipleMedia', () => {
    it('should preserve multiple media items in batches', async () => {
      const urls = [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg',
      ];

      const mockResults = urls.map((url, i) => ({
        original_url: url,
        ardrive_tx: `tx_${i}`,
        ipfs_hash: `Qm${i}`,
        content_type: 'image/jpeg',
        file_size: 1024,
        dimensions: { width: 800, height: 600 },
        preserved_at: '2024-01-01T00:00:00Z',
      }));

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResults[0]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResults[1]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResults[2]),
        });

      const result = await MediaPreservationService.preserveMultipleMedia(urls);

      expect(result.size).toBe(3);
      urls.forEach((url, i) => {
        expect(result.get(url)).toMatchObject({
          original_url: url,
          ardrive_tx: `tx_${i}`,
          ipfs_hash: `Qm${i}`,
        });
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle failures gracefully', async () => {
      const urls = [
        'https://example.com/image1.jpg',
        'https://example.com/missing.jpg',
      ];

      const mockResult: PreservedMedia = {
        original_url: urls[0],
        ardrive_tx: 'tx_1',
        ipfs_hash: 'Qm1',
        content_type: 'image/jpeg',
        file_size: 1024,
        dimensions: { width: 800, height: 600 },
        preserved_at: '2024-01-01T00:00:00Z',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResult),
        })
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Not Found',
        });

      const result = await MediaPreservationService.preserveMultipleMedia(urls);

      expect(result.size).toBe(2);
      expect(result.get(urls[0])).toMatchObject({
        original_url: urls[0],
        ardrive_tx: 'tx_1',
        ipfs_hash: 'Qm1',
      });
      expect(result.get(urls[1])).toBeNull();
    });
  });

  describe('checkPreservationStatus', () => {
    it('should check if media is already preserved', async () => {
      const mockStatus = {
        preserved: true,
        ardrive_tx: 'tx_123',
        ipfs_hash: 'Qm123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      });

      const result = await MediaPreservationService.checkPreservationStatus('https://example.com/image.jpg');

      expect(result).toEqual(mockStatus);
      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/check-preservation?url=https%3A%2F%2Fexample.com%2Fimage.jpg'
      );
    });

    it('should return not preserved on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await MediaPreservationService.checkPreservationStatus('https://example.com/image.jpg');

      expect(result).toEqual({ preserved: false });
    });
  });

  describe('getEmbedType', () => {
    const getEmbedType = (MediaPreservationService as any).getEmbedType;

    it('should detect image URLs', () => {
      expect(getEmbedType('https://example.com/image.jpg')).toBe('image');
      expect(getEmbedType('https://example.com/photo.PNG')).toBe('image');
      expect(getEmbedType('https://example.com/graphic.webp')).toBe('image');
    });

    it('should detect video URLs', () => {
      expect(getEmbedType('https://example.com/video.mp4')).toBe('video');
      expect(getEmbedType('https://youtube.com/watch?v=123')).toBe('video');
      expect(getEmbedType('https://youtu.be/123')).toBe('video');
    });

    it('should detect GIF URLs as images', () => {
      expect(getEmbedType('https://example.com/animation.gif')).toBe('image');
    });

    it('should detect GIF in URL path as gif type', () => {
      expect(getEmbedType('https://example.com/test.gif.html')).toBe('gif');
    });

    it('should detect Frame URLs', () => {
      expect(getEmbedType('https://example.com/frames/test')).toBe('frame');
      expect(getEmbedType('https://frame.example.com/test')).toBe('frame');
    });

    it('should default to link for unknown URLs', () => {
      expect(getEmbedType('https://example.com/page')).toBe('link');
      expect(getEmbedType('https://example.com/document.pdf')).toBe('link');
    });
  });
});