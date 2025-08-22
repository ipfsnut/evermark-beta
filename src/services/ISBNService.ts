// ISBN Service for fetching book metadata from Open Library and Google Books APIs

interface ISBNMetadata {
  title: string;
  authors: string[];
  publisher?: string;
  publishedDate?: string;
  isbn: string;
  pageCount?: number;
  categories?: string[];
  description?: string;
  coverImage?: string;
  url?: string;
}

interface ISBNFetchResult {
  success: boolean;
  metadata?: ISBNMetadata;
  error?: string;
}

class ISBNService {
  private readonly OPEN_LIBRARY_API = 'https://openlibrary.org/api/books';
  private readonly GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';

  /**
   * Extract ISBN from various formats (ISBN-10, ISBN-13, with/without hyphens)
   */
  extractISBN(input: string): string | null {
    // Remove all non-digit characters except X (for ISBN-10)
    const cleaned = input.replace(/[^\dX]/gi, '');
    
    // Check for ISBN-13 (13 digits)
    if (cleaned.length === 13 && cleaned.startsWith('978')) {
      return cleaned;
    }
    
    // Check for ISBN-10 (10 characters, last can be X)
    if (cleaned.length === 10) {
      return cleaned;
    }
    
    // Try to find ISBN pattern in longer strings
    const isbn13Match = input.match(/978[\d-]{10,}/);
    if (isbn13Match) {
      const digits = isbn13Match[0].replace(/[^\d]/g, '');
      if (digits.length === 13) return digits;
    }
    
    const isbn10Match = input.match(/[\d-]{9}[\dX]/i);
    if (isbn10Match) {
      const cleaned = isbn10Match[0].replace(/[^\dX]/gi, '');
      if (cleaned.length === 10) return cleaned;
    }
    
    return null;
  }

  /**
   * Fetch metadata for an ISBN from multiple sources
   */
  async fetchISBNMetadata(isbnOrInput: string): Promise<ISBNFetchResult> {
    try {
      console.log('🔍 Fetching ISBN metadata for:', isbnOrInput);
      
      // Extract ISBN from input
      const isbn = this.extractISBN(isbnOrInput);
      
      if (!isbn) {
        return {
          success: false,
          error: 'Invalid ISBN format'
        };
      }

      console.log('📚 Extracted ISBN:', isbn);

      // Try multiple sources for best coverage
      let metadata: ISBNMetadata | null = null;
      
      // Primary: Google Books API (usually has better descriptions)
      try {
        metadata = await this.fetchFromGoogleBooks(isbn);
        if (metadata) {
          console.log('✅ Retrieved metadata from Google Books');
        }
      } catch (error) {
        console.log('⚠️ Google Books failed, trying Open Library');
      }
      
      // Fallback: Open Library (more comprehensive, includes covers)
      if (!metadata) {
        try {
          metadata = await this.fetchFromOpenLibrary(isbn);
          if (metadata) {
            console.log('✅ Retrieved metadata from Open Library');
          }
        } catch (error) {
          console.log('⚠️ Open Library also failed');
        }
      }
      
      if (!metadata) {
        return {
          success: false,
          error: 'Book not found in any database'
        };
      }

      console.log('✅ ISBN metadata fetched successfully:', {
        title: metadata.title.substring(0, 50),
        authors: metadata.authors.slice(0, 3).join(', '),
        publisher: metadata.publisher
      });

      return {
        success: true,
        metadata
      };

    } catch (error) {
      console.error('❌ Failed to fetch ISBN metadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch metadata from Google Books API
   */
  private async fetchFromGoogleBooks(isbn: string): Promise<ISBNMetadata | null> {
    const response = await fetch(`${this.GOOGLE_BOOKS_API}?q=isbn:${isbn}`);
    
    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return null;
    }

    const book = data.items[0].volumeInfo;
    
    return {
      title: book.title || 'Unknown Title',
      authors: book.authors || [],
      publisher: book.publisher,
      publishedDate: book.publishedDate,
      isbn,
      pageCount: book.pageCount,
      categories: book.categories,
      description: book.description,
      coverImage: book.imageLinks?.large || book.imageLinks?.medium || book.imageLinks?.thumbnail,
      url: book.infoLink || `https://www.google.com/search?q=isbn:${isbn}`
    };
  }

  /**
   * Fetch metadata from Open Library API
   */
  private async fetchFromOpenLibrary(isbn: string): Promise<ISBNMetadata | null> {
    const response = await fetch(`${this.OPEN_LIBRARY_API}?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    
    if (!response.ok) {
      throw new Error(`Open Library API error: ${response.status}`);
    }

    const data = await response.json();
    const bookKey = `ISBN:${isbn}`;
    
    if (!data[bookKey]) {
      return null;
    }

    const book = data[bookKey];
    
    return {
      title: book.title || 'Unknown Title',
      authors: book.authors?.map((author: any) => author.name) || [],
      publisher: book.publishers?.[0]?.name,
      publishedDate: book.publish_date,
      isbn,
      pageCount: book.number_of_pages,
      categories: book.subjects?.slice(0, 5)?.map((subject: any) => subject.name),
      description: book.notes || book.description,
      coverImage: book.cover?.large || book.cover?.medium || book.cover?.small,
      url: book.url || `https://openlibrary.org/search?q=isbn:${isbn}`
    };
  }

  /**
   * Check if input appears to be an ISBN
   */
  isISBN(input: string): boolean {
    return this.extractISBN(input) !== null;
  }

  /**
   * Check if a URL contains an ISBN (for auto-detection)
   */
  findISBNInURL(url: string): string | null {
    // Common patterns where ISBNs appear in URLs
    const patterns = [
      /isbn[=\/:]?(\d{13})/i,
      /isbn[=\/:]?(\d{10})/i,
      /(\d{13})/g,
      /(\d{10})/g
    ];
    
    for (const pattern of patterns) {
      const matches = url.match(pattern);
      if (matches) {
        for (const match of matches) {
          const isbn = this.extractISBN(match);
          if (isbn) return isbn;
        }
      }
    }
    
    return null;
  }
}

export const isbnService = new ISBNService();
export type { ISBNMetadata, ISBNFetchResult };