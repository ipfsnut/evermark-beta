import type { EvermarkMetadata } from '../types';
import { ReadmeService } from './ReadmeService';

export interface AuthorInfo {
  given?: string;
  family?: string;
  name?: string;
  orcid?: string;
}

export interface ExtendedMetadata {
  title: string;
  authors: AuthorInfo[];
  primaryAuthor: string; // For display and compatibility
  journal?: string;
  publisher?: string;
  publishedDate?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  abstract?: string;
}

export class MetadataService {
  /**
   * Extract DOI from various URL formats
   */
  static extractDOI(input: string): string | null {
    const patterns = [
      /(?:doi:|DOI:)\s*(.+)/,
      /doi\.org\/(.+)/,
      /dx\.doi\.org\/(.+)/,
      /^(10\.\d+\/.+)$/
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Extract ISBN from various formats
   */
  static extractISBN(input: string): string | null {
    // Remove hyphens and spaces, keep only digits and X
    const cleaned = input.replace(/[-\s]/g, '');
    
    // ISBN-10 or ISBN-13 patterns
    if (/^(?:ISBN:?)?(\d{9}[\dX]|\d{13})$/i.test(cleaned)) {
      return cleaned.replace(/^ISBN:?/i, '');
    }
    return null;
  }

  /**
   * Fetch DOI metadata from CrossRef API
   */
  static async fetchDOIMetadata(doi: string): Promise<ExtendedMetadata | null> {
    try {
      console.log(`📚 Fetching DOI metadata for: ${doi}`);
      
      const response = await fetch(`https://api.crossref.org/works/${doi}`);
      if (!response.ok) {
        throw new Error(`CrossRef API error: ${response.status}`);
      }

      const data = await response.json();
      const work = data.message;

      if (!work) {
        throw new Error('No work data found in CrossRef response');
      }

      // Extract authors
      const authors: AuthorInfo[] = (work.author || []).map((author: any) => ({
        given: author.given,
        family: author.family,
        name: author.name || `${author.given || ''} ${author.family || ''}`.trim(),
        orcid: author.ORCID ? author.ORCID.replace('http://orcid.org/', '') : undefined
      }));

      // Create primary author string
      let primaryAuthor = 'Unknown';
      if (authors.length > 0) {
        const firstAuthor = authors[0];
        if (firstAuthor.name) {
          primaryAuthor = firstAuthor.name;
        } else if (firstAuthor.given && firstAuthor.family) {
          primaryAuthor = `${firstAuthor.given} ${firstAuthor.family}`;
        } else if (firstAuthor.family) {
          primaryAuthor = firstAuthor.family;
        }

        // Add "et al." if multiple authors
        if (authors.length > 1) {
          primaryAuthor += ' et al.';
        }
      }

      const publishedDate = work.published?.['date-parts']?.[0] 
        ? work.published['date-parts'][0].join('-')
        : undefined;

      return {
        title: Array.isArray(work.title) ? work.title[0] : work.title || 'Untitled',
        authors,
        primaryAuthor,
        journal: Array.isArray(work['container-title']) ? work['container-title'][0] : work['container-title'],
        publisher: work.publisher,
        publishedDate,
        volume: work.volume,
        issue: work.issue,
        pages: work.page,
        abstract: work.abstract
      };

    } catch (error) {
      console.error('Failed to fetch DOI metadata:', error);
      return null;
    }
  }

  /**
   * Fetch ISBN metadata from OpenLibrary API
   */
  static async fetchISBNMetadata(isbn: string): Promise<ExtendedMetadata | null> {
    try {
      console.log(`📚 Fetching ISBN metadata for: ${isbn}`);
      
      const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
      if (!response.ok) {
        throw new Error(`OpenLibrary API error: ${response.status}`);
      }

      const data = await response.json();
      const book = data[`ISBN:${isbn}`];

      if (!book) {
        throw new Error('No book data found in OpenLibrary response');
      }

      // Extract authors
      const authors: AuthorInfo[] = (book.authors || []).map((author: any) => ({
        name: author.name,
        given: author.name?.split(' ')[0],
        family: author.name?.split(' ').slice(1).join(' ')
      }));

      // Create primary author string
      let primaryAuthor = 'Unknown';
      if (authors.length > 0) {
        primaryAuthor = authors[0].name || 'Unknown';
        if (authors.length > 1) {
          primaryAuthor += ' et al.';
        }
      }

      const publishedDate = book.publish_date;

      return {
        title: book.title || 'Untitled',
        authors,
        primaryAuthor,
        publisher: book.publishers?.[0]?.name,
        publishedDate
      };

    } catch (error) {
      console.error('Failed to fetch ISBN metadata:', error);
      return null;
    }
  }

  /**
   * Auto-detect content type and fetch appropriate metadata
   */
  static async fetchContentMetadata(sourceUrl: string): Promise<{
    contentType: 'DOI' | 'ISBN' | 'README' | null;
    metadata: ExtendedMetadata | null;
  }> {
    // Try README book first
    if (ReadmeService.isReadmeBook(sourceUrl)) {
      const readmeMetadata = await ReadmeService.fetchReadmeMetadata(sourceUrl);
      if (readmeMetadata) {
        // Convert README metadata to ExtendedMetadata format
        const metadata: ExtendedMetadata = {
          title: readmeMetadata.bookTitle,
          authors: [{ name: readmeMetadata.bookAuthor }],
          primaryAuthor: readmeMetadata.bookAuthor,
          publisher: readmeMetadata.readmeData.publisher,
          publishedDate: readmeMetadata.readmeData.publicationDate,
          abstract: readmeMetadata.description
        };
        return { contentType: 'README', metadata };
      }
    }

    // Try DOI
    const doi = this.extractDOI(sourceUrl);
    if (doi) {
      const metadata = await this.fetchDOIMetadata(doi);
      return { contentType: 'DOI', metadata };
    }

    // Try ISBN
    const isbn = this.extractISBN(sourceUrl);
    if (isbn) {
      const metadata = await this.fetchISBNMetadata(isbn);
      return { contentType: 'ISBN', metadata };
    }

    return { contentType: null, metadata: null };
  }

  /**
   * Format authors for display
   */
  static formatAuthorsForDisplay(authors: AuthorInfo[], maxLength = 50): string {
    if (!authors || authors.length === 0) return 'Unknown';
    
    if (authors.length === 1) {
      return authors[0].name || 'Unknown';
    }

    // For multiple authors, try different formats based on length
    const firstAuthor = authors[0].name || 'Unknown';
    
    if (authors.length === 2) {
      const fullFormat = `${firstAuthor} & ${authors[1].name}`;
      if (fullFormat.length <= maxLength) {
        return fullFormat;
      }
    }
    
    if (authors.length <= 3) {
      const fullFormat = authors.map(a => a.name).join(', ');
      if (fullFormat.length <= maxLength) {
        return fullFormat;
      }
    }

    // Fallback to "et al." format
    return `${firstAuthor} et al.`;
  }

  /**
   * Check if wallet address could match any of the authors
   * This is for potential verification - matches based on name similarity
   */
  static couldWalletMatchAuthor(walletAddress: string, authors: AuthorInfo[]): {
    couldMatch: boolean;
    matchedAuthor?: AuthorInfo;
    confidence: 'low' | 'medium' | 'high';
  } {
    // This is a placeholder for future ENS/social verification
    // For now, we can't automatically match wallet addresses to academic authors
    return {
      couldMatch: false,
      confidence: 'low'
    };
  }
}