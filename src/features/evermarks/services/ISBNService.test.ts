import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ISBNService, type BookMetadata } from './ISBNService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ISBNService', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('cleanISBN', () => {
    it('should clean ISBN-10 correctly', () => {
      expect(ISBNService.cleanISBN('0-13-468599-2')).toBe('0134685992');
      expect(ISBNService.cleanISBN('0 13 468599 2')).toBe('0134685992');
      expect(ISBNService.cleanISBN('0134685992')).toBe('0134685992');
    });

    it('should clean ISBN-13 correctly', () => {
      expect(ISBNService.cleanISBN('978-0-13-468599-1')).toBe('9780134685991');
      expect(ISBNService.cleanISBN('978 0 13 468599 1')).toBe('9780134685991');
      expect(ISBNService.cleanISBN('9780134685991')).toBe('9780134685991');
    });

    it('should handle ISBN with X', () => {
      expect(ISBNService.cleanISBN('123456789X')).toBe('123456789X');
    });

    it('should throw error for invalid ISBN length', () => {
      expect(() => ISBNService.cleanISBN('123')).toThrow('Invalid ISBN format');
      expect(() => ISBNService.cleanISBN('12345678901234')).toThrow('Invalid ISBN format');
    });
  });

  describe('fetchFromGoogleBooks', () => {
    it('should fetch book data successfully', async () => {
      const mockResponse = {
        items: [{
          volumeInfo: {
            title: 'Clean Code',
            authors: ['Robert C. Martin'],
            description: 'A handbook of agile software craftsmanship',
            publisher: 'Prentice Hall',
            publishedDate: '2008-08-01',
            pageCount: 464,
            categories: ['Computers'],
            imageLinks: {
              thumbnail: 'http://example.com/cover.jpg'
            },
            language: 'en'
          }
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await ISBNService.fetchFromGoogleBooks('9780134685991');

      expect(result).toEqual({
        title: 'Clean Code',
        authors: ['Robert C. Martin'],
        description: 'A handbook of agile software craftsmanship',
        publisher: 'Prentice Hall',
        publishedDate: '2008-08-01',
        pageCount: 464,
        categories: ['Computers'],
        imageUrl: 'https://example.com/cover.jpg', // Should convert to HTTPS
        isbn: '9780134685991',
        language: 'en'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/books/v1/volumes?q=isbn:9780134685991'
      );
    });

    it('should return null if no books found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] })
      });

      const result = await ISBNService.fetchFromGoogleBooks('9780134685991');
      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const result = await ISBNService.fetchFromGoogleBooks('9780134685991');
      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await ISBNService.fetchFromGoogleBooks('9780134685991');
      expect(result).toBeNull();
    });
  });

  describe('fetchFromOpenLibrary', () => {
    it('should fetch book data successfully', async () => {
      const mockResponse = {
        'ISBN:9780134685991': {
          title: 'Clean Code',
          authors: [{ name: 'Robert C. Martin' }],
          publishers: [{ name: 'Prentice Hall' }],
          publish_date: '2008',
          number_of_pages: 464,
          subjects: [{ name: 'Programming' }],
          cover: {
            large: 'https://covers.openlibrary.org/b/id/123-L.jpg'
          },
          languages: [{ key: '/languages/eng' }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await ISBNService.fetchFromOpenLibrary('9780134685991');

      expect(result).toEqual({
        title: 'Clean Code',
        authors: ['Robert C. Martin'],
        description: undefined,
        publisher: 'Prentice Hall',
        publishedDate: '2008',
        pageCount: 464,
        categories: ['Programming'],
        imageUrl: 'https://covers.openlibrary.org/b/id/123-L.jpg',
        isbn: '9780134685991',
        language: 'eng'
      });
    });

    it('should return null if book not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      const result = await ISBNService.fetchFromOpenLibrary('9780134685991');
      expect(result).toBeNull();
    });
  });

  describe('fetchBookMetadata', () => {
    it('should try Google Books first, then Open Library', async () => {
      // Mock Google Books failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      // Mock Open Library success
      const openLibraryResponse = {
        'ISBN:9780134685991': {
          title: 'Clean Code',
          authors: [{ name: 'Robert C. Martin' }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => openLibraryResponse
      });

      const result = await ISBNService.fetchBookMetadata('978-0-13-468599-1');

      expect(result).toBeTruthy();
      expect(result?.title).toBe('Clean Code');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should return null if both services fail', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      });

      const result = await ISBNService.fetchBookMetadata('9780134685991');
      expect(result).toBeNull();
    });
  });

  describe('generateEvermarkTitle', () => {
    it('should generate title with author', () => {
      const metadata: BookMetadata = {
        title: 'Clean Code',
        authors: ['Robert C. Martin'],
        isbn: '9780134685991'
      };

      const title = ISBNService.generateEvermarkTitle(metadata);
      expect(title).toBe('Clean Code by Robert C. Martin');
    });

    it('should handle missing author', () => {
      const metadata: BookMetadata = {
        title: 'Clean Code',
        authors: [],
        isbn: '9780134685991'
      };

      const title = ISBNService.generateEvermarkTitle(metadata);
      expect(title).toBe('Clean Code by Unknown Author');
    });
  });

  describe('generateEvermarkDescription', () => {
    it('should use book description if available', () => {
      const metadata: BookMetadata = {
        title: 'Clean Code',
        authors: ['Robert C. Martin'],
        description: 'A handbook of agile software craftsmanship',
        publisher: 'Prentice Hall',
        publishedDate: '2008',
        pageCount: 464,
        isbn: '9780134685991'
      };

      const description = ISBNService.generateEvermarkDescription(metadata);
      expect(description).toContain('A handbook of agile software craftsmanship');
      expect(description).toContain('[464 pages]');
    });

    it('should generate basic description if no book description', () => {
      const metadata: BookMetadata = {
        title: 'Clean Code',
        authors: ['Robert C. Martin'],
        publisher: 'Prentice Hall',
        publishedDate: '2008-08-01',
        isbn: '9780134685991'
      };

      const description = ISBNService.generateEvermarkDescription(metadata);
      expect(description).toContain('A book by Robert C. Martin published in 2008 by Prentice Hall');
    });

    it('should truncate long descriptions', () => {
      const longDescription = 'A'.repeat(400);
      const metadata: BookMetadata = {
        title: 'Test Book',
        authors: ['Test Author'],
        description: longDescription,
        isbn: '9780134685991'
      };

      const description = ISBNService.generateEvermarkDescription(metadata);
      expect(description.length).toBeLessThan(350); // Should be truncated
      expect(description).toContain('...');
    });
  });

  describe('generateTags', () => {
    it('should generate appropriate tags', () => {
      const metadata: BookMetadata = {
        title: 'Clean Code',
        authors: ['Robert C. Martin'],
        categories: ['Computers', 'Programming'],
        publishedDate: '2008-08-01',
        language: 'en',
        isbn: '9780134685991'
      };

      const tags = ISBNService.generateTags(metadata);
      
      expect(tags).toContain('book');
      expect(tags).toContain('computers');
      expect(tags).toContain('programming');
      expect(tags).toContain('2008');
      expect(tags).not.toContain('en'); // English is default, shouldn't be included
      expect(tags.length).toBeLessThanOrEqual(10);
    });

    it('should include non-English language tags', () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
        authors: ['Test Author'],
        language: 'fr',
        isbn: '9780134685991'
      };

      const tags = ISBNService.generateTags(metadata);
      expect(tags).toContain('fr');
    });

    it('should limit tags to 10', () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
        authors: ['Test Author'],
        categories: Array(15).fill('category'), // More than 10 categories
        isbn: '9780134685991'
      };

      const tags = ISBNService.generateTags(metadata);
      expect(tags.length).toBeLessThanOrEqual(10);
    });
  });
});