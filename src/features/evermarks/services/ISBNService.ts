// ISBN Service for fetching book metadata from Open Library and Google Books APIs

export interface BookMetadata {
  title: string;
  authors: string[];
  description?: string;
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  categories?: string[];
  imageUrl?: string;
  isbn?: string;
  language?: string;
}

export class ISBNService {
  // Clean and validate ISBN
  static cleanISBN(isbn: string): string {
    console.log('📖 Cleaning ISBN input:', JSON.stringify(isbn));
    
    // Remove all non-alphanumeric characters
    const cleaned = isbn.replace(/[^0-9X]/gi, '');
    console.log('📖 After cleaning:', JSON.stringify(cleaned));
    
    // Validate ISBN-10 or ISBN-13
    if (cleaned.length !== 10 && cleaned.length !== 13) {
      console.log('❌ Invalid ISBN length:', cleaned.length);
      throw new Error('Invalid ISBN format. Must be 10 or 13 digits.');
    }
    
    console.log('✅ ISBN validation passed:', cleaned);
    return cleaned;
  }

  // Fetch from Open Library API
  static async fetchFromOpenLibrary(isbn: string): Promise<BookMetadata | null> {
    try {
      const cleanedISBN = this.cleanISBN(isbn);
      const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanedISBN}&format=json&jscmd=data`);
      
      if (!response.ok) {
        console.error('Open Library API error:', response.status);
        return null;
      }

      const data = await response.json();
      const bookKey = `ISBN:${cleanedISBN}`;
      const bookData = data[bookKey];

      if (!bookData) {
        return null;
      }

      // Extract cover image
      let imageUrl: string | undefined;
      if (bookData.cover) {
        if (bookData.cover.large) {
          imageUrl = bookData.cover.large;
        } else if (bookData.cover.medium) {
          imageUrl = bookData.cover.medium;
        } else if (bookData.cover.small) {
          imageUrl = bookData.cover.small;
        }
      }

      return {
        title: bookData.title || 'Unknown Title',
        authors: bookData.authors ? bookData.authors.map((a: any) => a.name) : [],
        description: bookData.notes || bookData.subtitle || undefined,
        publisher: bookData.publishers ? bookData.publishers[0]?.name : undefined,
        publishedDate: bookData.publish_date || undefined,
        pageCount: bookData.number_of_pages || undefined,
        categories: bookData.subjects ? bookData.subjects.map((s: any) => s.name) : undefined,
        imageUrl,
        isbn: cleanedISBN,
        language: bookData.languages ? bookData.languages[0]?.key?.split('/').pop() : undefined
      };
    } catch (error) {
      console.error('Open Library fetch error:', error);
      return null;
    }
  }

  // Fetch from Google Books API
  static async fetchFromGoogleBooks(isbn: string): Promise<BookMetadata | null> {
    try {
      const cleanedISBN = this.cleanISBN(isbn);
      console.log('🔍 Querying Google Books API for ISBN:', cleanedISBN);
      
      const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanedISBN}`;
      console.log('🌐 API URL:', url);
      
      const response = await fetch(url);
      console.log('📡 Google Books response status:', response.status);
      
      if (!response.ok) {
        console.error('❌ Google Books API error:', response.status);
        return null;
      }

      const data = await response.json();
      console.log('📚 Google Books raw response:', data);
      
      if (!data.items || data.items.length === 0) {
        console.log('❌ No items found in Google Books response');
        return null;
      }

      const book = data.items[0].volumeInfo;
      console.log('📖 First book data:', book);

      return {
        title: book.title || 'Unknown Title',
        authors: book.authors || [],
        description: book.description || book.subtitle || undefined,
        publisher: book.publisher || undefined,
        publishedDate: book.publishedDate || undefined,
        pageCount: book.pageCount || undefined,
        categories: book.categories || undefined,
        imageUrl: book.imageLinks?.thumbnail?.replace('http:', 'https:') || undefined,
        isbn: cleanedISBN,
        language: book.language || undefined
      };
    } catch (error) {
      console.error('Google Books fetch error:', error);
      return null;
    }
  }

  // Main fetch function - tries multiple sources
  static async fetchBookMetadata(isbn: string): Promise<BookMetadata | null> {
    console.log('📚 Fetching book metadata for ISBN:', isbn);

    // Try Google Books first (usually more complete)
    const googleData = await this.fetchFromGoogleBooks(isbn);
    if (googleData && googleData.title !== 'Unknown Title') {
      console.log('✅ Found book data from Google Books:', googleData.title);
      return googleData;
    }

    // Fallback to Open Library
    const openLibraryData = await this.fetchFromOpenLibrary(isbn);
    if (openLibraryData) {
      console.log('✅ Found book data from Open Library:', openLibraryData.title);
      return openLibraryData;
    }

    // If we have partial Google data, use it
    if (googleData) {
      console.log('⚠️ Using partial Google Books data');
      return googleData;
    }

    console.log('❌ No book data found for ISBN:', isbn);
    return null;
  }

  // Generate evermark title from book metadata
  static generateEvermarkTitle(metadata: BookMetadata): string {
    const author = metadata.authors && metadata.authors.length > 0 
      ? metadata.authors[0] 
      : 'Unknown Author';
    
    return `${metadata.title} by ${author}`;
  }

  // Generate evermark description from book metadata
  static generateEvermarkDescription(metadata: BookMetadata): string {
    let description = '';

    // Add book description if available
    if (metadata.description) {
      // Limit description length
      const maxLength = 300;
      description = metadata.description.length > maxLength 
        ? metadata.description.substring(0, maxLength) + '...' 
        : metadata.description;
    } else {
      // Create a basic description
      description = `A book`;
      if (metadata.authors && metadata.authors.length > 0) {
        description += ` by ${metadata.authors.join(', ')}`;
      }
      if (metadata.publishedDate) {
        const year = metadata.publishedDate.split('-')[0];
        description += ` published in ${year}`;
      }
      if (metadata.publisher) {
        description += ` by ${metadata.publisher}`;
      }
    }

    // Add metadata summary
    const metaItems: string[] = [];
    if (metadata.pageCount) {
      metaItems.push(`${metadata.pageCount} pages`);
    }
    if (metadata.categories && metadata.categories.length > 0) {
      metaItems.push(metadata.categories.slice(0, 2).join(', '));
    }
    
    if (metaItems.length > 0) {
      description += `\n\n[${metaItems.join(' • ')}]`;
    }

    return description;
  }

  // Generate tags from book metadata
  static generateTags(metadata: BookMetadata): string[] {
    const tags: string[] = [];
    
    // Add 'book' tag
    tags.push('book');
    
    // Add genre/category tags
    if (metadata.categories) {
      metadata.categories.slice(0, 3).forEach(cat => {
        tags.push(cat.toLowerCase().replace(/\s+/g, '-'));
      });
    }
    
    // Add language tag if not English
    if (metadata.language && metadata.language !== 'en') {
      tags.push(metadata.language);
    }
    
    // Add year tag
    if (metadata.publishedDate) {
      const year = metadata.publishedDate.split('-')[0];
      tags.push(year);
    }
    
    return tags.slice(0, 10); // Limit to 10 tags
  }
}