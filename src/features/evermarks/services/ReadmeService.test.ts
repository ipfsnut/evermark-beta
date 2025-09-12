import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReadmeService, type ReadmeMetadata } from './ReadmeService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ReadmeService', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('isReadmeBook', () => {
    it('should identify OpenSea README book URLs', () => {
      const validUrls = [
        'https://opensea.io/assets/matic/0x931204fb8cea7f7068995dce924f0d76d571df99/1',
        'https://opensea.io/assets/polygon/0x931204fb8cea7f7068995dce924f0d76d571df99/123',
        'https://opensea.io/assets/0x931204fb8cea7f7068995dce924f0d76d571df99/1'
      ];

      validUrls.forEach(url => {
        expect(ReadmeService.isReadmeBook(url)).toBe(true);
      });
    });

    it('should reject non-README book URLs', () => {
      const invalidUrls = [
        'https://opensea.io/assets/ethereum/0xother123/1',
        'https://opensea.io/collection/test',
        'https://example.com/book',
        'https://opensea.io/assets/matic/0xdifferentcontract/1'
      ];

      invalidUrls.forEach(url => {
        expect(ReadmeService.isReadmeBook(url)).toBe(false);
      });
    });

    it('should handle malformed URLs', () => {
      const malformedUrls = [
        'not-a-url',
        'https://opensea.io',
        'https://opensea.io/assets',
        'https://opensea.io/assets/matic'
      ];

      malformedUrls.forEach(url => {
        expect(ReadmeService.isReadmeBook(url)).toBe(false);
      });
    });
  });

  describe('parseOpenSeaUrl', () => {
    it('should parse valid OpenSea URLs correctly', () => {
      const url = 'https://opensea.io/assets/matic/0x931204fb8cea7f7068995dce924f0d76d571df99/123';
      const result = ReadmeService.parseOpenSeaUrl(url);

      expect(result).toEqual({
        contractAddress: '0x931204fb8cea7f7068995dce924f0d76d571df99',
        tokenId: '123',
        network: 'matic'
      });
    });

    it('should handle URLs without explicit network', () => {
      const url = 'https://opensea.io/assets/0x931204fb8cea7f7068995dce924f0d76d571df99/456';
      const result = ReadmeService.parseOpenSeaUrl(url);

      expect(result).toEqual({
        contractAddress: '0x931204fb8cea7f7068995dce924f0d76d571df99',
        tokenId: '456',
        network: 'ethereum' // default
      });
    });

    it('should return null for invalid URLs', () => {
      const invalidUrls = [
        'https://opensea.io/collection/test',
        'https://opensea.io/assets/invalid',
        'https://example.com/test'
      ];

      invalidUrls.forEach(url => {
        expect(ReadmeService.parseOpenSeaUrl(url)).toBeNull();
      });
    });
  });

  describe('fetchOpenSeaMetadata', () => {
    it('should fetch NFT metadata successfully', async () => {
      const mockResponse = {
        name: 'Clean Code',
        description: 'A handbook of agile software craftsmanship by Robert C. Martin',
        image_url: 'https://example.com/cover.jpg',
        traits: [
          { trait_type: 'Author', value: 'Robert C. Martin' },
          { trait_type: 'Genre', value: 'Programming' },
          { trait_type: 'IPFS Hash', value: 'QmTest123' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await ReadmeService.fetchOpenSeaMetadata(
        '0x931204fb8cea7f7068995dce924f0d76d571df99',
        '1'
      );

      expect(result).toEqual({
        title: 'Clean Code',
        description: 'A handbook of agile software craftsmanship by Robert C. Martin',
        image: 'https://example.com/cover.jpg',
        author: 'Robert C. Martin',
        genre: 'Programming',
        ipfsHash: 'QmTest123',
        tokenId: '1',
        contractAddress: '0x931204fb8cea7f7068995dce924f0d76d571df99'
      });
    });

    it('should handle missing traits gracefully', async () => {
      const mockResponse = {
        name: 'Test Book',
        description: 'Test description',
        image_url: 'https://example.com/image.jpg',
        traits: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await ReadmeService.fetchOpenSeaMetadata(
        '0x931204fb8cea7f7068995dce924f0d76d571df99',
        '1'
      );

      expect(result?.title).toBe('Test Book');
      expect(result?.author).toBeUndefined();
      expect(result?.ipfsHash).toBeUndefined();
    });

    it('should return null on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const result = await ReadmeService.fetchOpenSeaMetadata(
        '0x931204fb8cea7f7068995dce924f0d76d571df99',
        '1'
      );

      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await ReadmeService.fetchOpenSeaMetadata(
        '0x931204fb8cea7f7068995dce924f0d76d571df99',
        '1'
      );

      expect(result).toBeNull();
    });
  });

  describe('fetchReadmeMetadata', () => {
    it('should fetch complete README metadata', async () => {
      // Mock OpenSea API response
      const openSeaResponse = {
        name: 'Clean Code',
        description: 'A handbook by Robert C. Martin',
        image_url: 'https://example.com/cover.jpg',
        traits: [
          { trait_type: 'Author', value: 'Robert C. Martin' },
          { trait_type: 'IPFS Hash', value: 'QmTest123' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => openSeaResponse
      });

      const url = 'https://opensea.io/assets/matic/0x931204fb8cea7f7068995dce924f0d76d571df99/1';
      const result = await ReadmeService.fetchReadmeMetadata(url);

      expect(result).toBeTruthy();
      expect(result?.bookTitle).toBe('Clean Code');
      expect(result?.bookAuthor).toBe('Robert C. Martin');
      expect(result?.image).toBe('https://example.com/cover.jpg');
      expect(result?.confidence).toBe('high');
      expect(result?.extractionMethod).toContain('OpenSea API');
    });

    it('should return null for invalid URLs', async () => {
      const result = await ReadmeService.fetchReadmeMetadata('https://invalid.com/test');
      expect(result).toBeNull();
    });

    it('should handle API failures gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const url = 'https://opensea.io/assets/matic/0x931204fb8cea7f7068995dce924f0d76d571df99/1';
      const result = await ReadmeService.fetchReadmeMetadata(url);
      
      expect(result).toBeNull();
    });
  });

  describe('generateEvermarkTitle', () => {
    it('should generate title from README book data', () => {
      const readmeData = {
        title: 'Clean Code',
        author: 'Robert C. Martin',
        tokenId: '1',
        contractAddress: '0x931204fb8cea7f7068995dce924f0d76d571df99'
      };

      const title = ReadmeService.generateEvermarkTitle(readmeData);
      expect(title).toBe('Clean Code by Robert C. Martin');
    });

    it('should handle missing author', () => {
      const readmeData = {
        title: 'Clean Code',
        tokenId: '1',
        contractAddress: '0x931204fb8cea7f7068995dce924f0d76d571df99'
      };

      const title = ReadmeService.generateEvermarkTitle(readmeData);
      expect(title).toBe('Clean Code by Unknown Author');
    });

    it('should handle missing title', () => {
      const readmeData = {
        author: 'Robert C. Martin',
        tokenId: '1',
        contractAddress: '0x931204fb8cea7f7068995dce924f0d76d571df99'
      };

      const title = ReadmeService.generateEvermarkTitle(readmeData);
      expect(title).toBe('README Book #1 by Robert C. Martin');
    });
  });

  describe('generateEvermarkDescription', () => {
    it('should generate description from README data', () => {
      const readmeData = {
        title: 'Clean Code',
        author: 'Robert C. Martin',
        description: 'A handbook of agile software craftsmanship',
        genre: 'Programming',
        ipfsHash: 'QmTest123',
        tokenId: '1',
        contractAddress: '0x931204fb8cea7f7068995dce924f0d76d571df99'
      };

      const description = ReadmeService.generateEvermarkDescription(readmeData);
      
      expect(description).toContain('A handbook of agile software craftsmanship');
      expect(description).toContain('PageDAO README Book');
      expect(description).toContain('Programming');
      expect(description).toContain('Token ID: 1');
    });

    it('should create basic description without book description', () => {
      const readmeData = {
        title: 'Test Book',
        author: 'Test Author',
        tokenId: '123',
        contractAddress: '0x931204fb8cea7f7068995dce924f0d76d571df99'
      };

      const description = ReadmeService.generateEvermarkDescription(readmeData);
      
      expect(description).toContain('PageDAO README Book by Test Author');
      expect(description).toContain('Token ID: 123');
    });

    it('should include IPFS information when available', () => {
      const readmeData = {
        title: 'Test Book',
        author: 'Test Author',
        ipfsHash: 'QmTest123',
        tokenId: '1',
        contractAddress: '0x931204fb8cea7f7068995dce924f0d76d571df99'
      };

      const description = ReadmeService.generateEvermarkDescription(readmeData);
      
      expect(description).toContain('📁 Content stored on IPFS: QmTest123');
    });
  });

  describe('tryIpfsGateway', () => {
    it('should return content for successful gateway', async () => {
      const mockContent = 'This is IPFS content';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockContent
      });

      const result = await ReadmeService.tryIpfsGateway(
        'https://ipfs.io/ipfs/',
        'QmTest123'
      );

      expect(result).toBe(mockContent);
    });

    it('should return null for failed gateway', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const result = await ReadmeService.tryIpfsGateway(
        'https://ipfs.io/ipfs/',
        'QmTest123'
      );

      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await ReadmeService.tryIpfsGateway(
        'https://ipfs.io/ipfs/',
        'QmTest123'
      );

      expect(result).toBeNull();
    });
  });

  describe('fetchIpfsContent', () => {
    it('should try multiple gateways until success', async () => {
      // First gateway fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      // Second gateway succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => 'IPFS content',
        headers: new Map([['content-type', 'text/plain']])
      });

      const result = await ReadmeService.fetchIpfsContent('QmTest123');

      expect(result).toEqual({
        content: 'IPFS content',
        gateway: 'https://gateway.pinata.cloud/ipfs/',
        contentType: 'text'
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should return null if all gateways fail', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404
      });

      const result = await ReadmeService.fetchIpfsContent('QmTest123');
      expect(result).toBeNull();
    });
  });
});