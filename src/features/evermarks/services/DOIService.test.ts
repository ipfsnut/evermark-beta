import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DOIService, type PaperMetadata } from './DOIService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock document for cleanAbstract function
Object.defineProperty(global, 'document', {
  value: {
    createElement: vi.fn(() => ({
      innerHTML: '',
      value: ''
    }))
  },
  writable: true
});

describe('DOIService', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('cleanDOI', () => {
    it('should clean DOI URLs correctly', () => {
      expect(DOIService.cleanDOI('https://doi.org/10.1038/nature12373')).toBe('10.1038/nature12373');
      expect(DOIService.cleanDOI('https://dx.doi.org/10.1038/nature12373')).toBe('10.1038/nature12373');
      expect(DOIService.cleanDOI('http://doi.org/10.1038/nature12373')).toBe('10.1038/nature12373');
    });

    it('should handle plain DOI correctly', () => {
      expect(DOIService.cleanDOI('10.1038/nature12373')).toBe('10.1038/nature12373');
      expect(DOIService.cleanDOI('  10.1038/nature12373  ')).toBe('10.1038/nature12373');
    });

    it('should throw error for invalid DOI format', () => {
      expect(() => DOIService.cleanDOI('invalid-doi')).toThrow('Invalid DOI format');
      expect(() => DOIService.cleanDOI('10.invalid')).toThrow('Invalid DOI format');
      expect(() => DOIService.cleanDOI('10.123/x')).toThrow('Invalid DOI format');
    });
  });

  describe('cleanAbstract', () => {
    beforeEach(() => {
      // Mock textarea element for HTML decoding
      const mockTextarea = {
        value: '',
        set innerHTML(html: string) { 
          // Replace tags with spaces, then clean up multiple spaces
          this.value = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); 
        }
      };
      vi.mocked(document.createElement).mockReturnValue(mockTextarea as any);
    });

    it('should remove HTML tags and clean whitespace', () => {
      const htmlAbstract = '<p>This is a <strong>test</strong> abstract</p> <em>with formatting</em>';
      const result = DOIService.cleanAbstract(htmlAbstract);
      
      expect(result).toBe('This is a test abstract with formatting');
    });

    it('should handle multiple whitespace', () => {
      const abstract = 'This    has   multiple     spaces';
      const result = DOIService.cleanAbstract(abstract);
      
      expect(result).toBe('This has multiple spaces');
    });
  });

  describe('fetchFromCrossRef', () => {
    it('should fetch paper data successfully', async () => {
      const mockResponse = {
        message: {
          title: ['CRISPR-Cas9 genome editing'],
          author: [
            { given: 'Jennifer', family: 'Doudna' },
            { given: 'Emmanuelle', family: 'Charpentier' }
          ],
          'container-title': ['Nature'],
          publisher: 'Nature Publishing Group',
          'published-print': {
            'date-parts': [[2012, 6, 28]]
          },
          volume: '486',
          issue: '7403',
          page: '456-462',
          URL: 'https://www.nature.com/articles/nature11247',
          subject: ['Molecular biology', 'Genetics'],
          'is-referenced-by-count': 15000,
          type: 'journal-article',
          abstract: '<p>This paper describes CRISPR-Cas9 technology</p>'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await DOIService.fetchFromCrossRef('10.1038/nature11247');

      expect(result).toEqual({
        title: 'CRISPR-Cas9 genome editing',
        authors: ['Jennifer Doudna', 'Emmanuelle Charpentier'],
        abstract: 'This paper describes CRISPR-Cas9 technology',
        journal: 'Nature',
        publisher: 'Nature Publishing Group',
        publishedDate: '2012-6-28',
        volume: '486',
        issue: '7403',
        pages: '456-462',
        doi: '10.1038/nature11247',
        url: 'https://www.nature.com/articles/nature11247',
        subjects: ['Molecular biology', 'Genetics'],
        citations: 15000,
        type: 'journal-article'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.crossref.org/works/10.1038/nature11247',
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Evermark/1.0 (https://evermark.app; contact@evermark.app)'
          }
        }
      );
    });

    it('should handle missing author names', () => {
      // This would be tested with a mock response that has incomplete author data
    });

    it('should return null on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const result = await DOIService.fetchFromCrossRef('10.1038/invalid');
      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await DOIService.fetchFromCrossRef('10.1038/nature11247');
      expect(result).toBeNull();
    });
  });

  describe('fetchFromUnpaywall', () => {
    it('should return open access URL when available', async () => {
      const mockResponse = {
        is_oa: true,
        best_oa_location: {
          url_for_pdf: 'https://example.com/paper.pdf',
          url: 'https://example.com/paper'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await DOIService.fetchFromUnpaywall('10.1038/nature11247');
      expect(result).toEqual({
        openAccessUrl: 'https://example.com/paper.pdf'
      });
    });

    it('should return null when not open access', async () => {
      const mockResponse = {
        is_oa: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await DOIService.fetchFromUnpaywall('10.1038/nature11247');
      expect(result).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'));

      const result = await DOIService.fetchFromUnpaywall('10.1038/nature11247');
      expect(result).toBeNull();
    });
  });

  describe('fetchPaperMetadata', () => {
    it('should integrate CrossRef and Unpaywall data', async () => {
      // Mock CrossRef response
      const crossrefResponse = {
        message: {
          title: ['Test Paper'],
          author: [{ given: 'John', family: 'Doe' }],
          URL: 'https://journal.com/paper'
        }
      };

      // Mock Unpaywall response
      const unpaywallResponse = {
        is_oa: true,
        best_oa_location: {
          url_for_pdf: 'https://arxiv.org/pdf/paper.pdf'
        }
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => crossrefResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => unpaywallResponse
        });

      const result = await DOIService.fetchPaperMetadata('10.1000/test');

      expect(result?.url).toBe('https://arxiv.org/pdf/paper.pdf'); // Should use open access URL
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should return null if CrossRef fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const result = await DOIService.fetchPaperMetadata('10.1000/invalid');
      expect(result).toBeNull();
    });
  });

  describe('generateEvermarkTitle', () => {
    it('should return title as-is if short enough', () => {
      const metadata: PaperMetadata = {
        title: 'Short Title',
        authors: ['John Doe'],
        doi: '10.1000/test'
      };

      const title = DOIService.generateEvermarkTitle(metadata);
      expect(title).toBe('Short Title');
    });

    it('should preserve long titles without truncation', () => {
      const longTitle = 'A'.repeat(150);
      const metadata: PaperMetadata = {
        title: longTitle,
        authors: ['John Doe'],
        doi: '10.1000/test'
      };

      const title = DOIService.generateEvermarkTitle(metadata);
      expect(title).toBe(longTitle);
      expect(title.length).toBe(150);
    });
  });

  describe('generateEvermarkDescription', () => {
    it('should use abstract if available', () => {
      const metadata: PaperMetadata = {
        title: 'Test Paper',
        authors: ['John Doe'],
        abstract: 'This is the abstract of the paper',
        journal: 'Nature',
        publishedDate: '2023-01-01',
        citations: 100,
        doi: '10.1000/test'
      };

      const description = DOIService.generateEvermarkDescription(metadata);
      expect(description).toContain('This is the abstract of the paper');
      expect(description).toContain('[Nature • 2023 • 100 citations]');
      expect(description).toContain('DOI: 10.1000/test');
    });

    it('should create basic description without abstract', () => {
      const metadata: PaperMetadata = {
        title: 'Test Paper',
        authors: ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Brown'],
        journal: 'Science',
        publishedDate: '2023-05-15',
        doi: '10.1000/test'
      };

      const description = DOIService.generateEvermarkDescription(metadata);
      expect(description).toContain('Paper by John Doe, Jane Smith, Bob Johnson et al.');
      expect(description).toContain('published in Science (2023)');
      expect(description).toContain('DOI: 10.1000/test');
    });

    it('should preserve complete abstracts without truncation', () => {
      const longAbstract = 'A'.repeat(400);
      const metadata: PaperMetadata = {
        title: 'Test Paper',
        authors: ['John Doe'],
        abstract: longAbstract,
        doi: '10.1000/test'
      };

      const description = DOIService.generateEvermarkDescription(metadata);
      expect(description).toContain(longAbstract);
      expect(description).toContain('DOI: 10.1000/test');
      // The description includes the abstract plus metadata, so it's longer than just the abstract
      expect(description.length).toBeGreaterThan(400);
    });
  });

  describe('generateTags', () => {
    it('should generate appropriate tags', () => {
      const metadata: PaperMetadata = {
        title: 'CRISPR-Cas9 Study',
        authors: ['John Doe'],
        subjects: ['Molecular Biology', 'Genetics', 'Biotechnology'],
        publishedDate: '2023-01-01',
        journal: 'Nature',
        type: 'journal-article',
        doi: '10.1000/test'
      };

      const tags = DOIService.generateTags(metadata);

      expect(tags).toContain('research');
      expect(tags).toContain('paper');
      expect(tags).toContain('molecular-biology');
      expect(tags).toContain('genetics');
      expect(tags).toContain('biotechnology');
      expect(tags).toContain('2023');
      expect(tags).toContain('nature');
      expect(tags).toContain('article');
      expect(tags.length).toBeLessThanOrEqual(10);
    });

    it('should limit tags to 10', () => {
      const metadata: PaperMetadata = {
        title: 'Test Paper',
        authors: ['John Doe'],
        subjects: Array(15).fill('subject'), // More than 10 subjects
        doi: '10.1000/test'
      };

      const tags = DOIService.generateTags(metadata);
      expect(tags.length).toBeLessThanOrEqual(10);
    });

    it('should skip long journal names for tags', () => {
      const metadata: PaperMetadata = {
        title: 'Test Paper',
        authors: ['John Doe'],
        journal: 'Very Long Journal Name That Should Be Excluded From Tags',
        doi: '10.1000/test'
      };

      const tags = DOIService.generateTags(metadata);
      expect(tags).not.toContain('very-long-journal-name-that-should-be-excluded-from-tags');
    });
  });
});