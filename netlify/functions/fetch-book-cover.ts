import { Handler } from '@netlify/functions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface BookMetadata {
  isbn: string;
  title?: string;
  authors?: string[];
  publisher?: string;
  year?: string;
  coverUrl?: string;
}

/**
 * Clean ISBN - remove hyphens and spaces
 */
function cleanISBN(isbn: string): string {
  return isbn.replace(/[-\s]/g, '');
}

/**
 * Validate ISBN format
 */
function isValidISBN(isbn: string): boolean {
  const cleaned = cleanISBN(isbn);
  return /^(?:\d{9}[\dX]|\d{13})$/.test(cleaned);
}

/**
 * Try Open Library Covers API
 */
async function fetchOpenLibraryCover(isbn: string): Promise<string | null> {
  const cleanedISBN = cleanISBN(isbn);
  
  // Open Library covers API - try different sizes
  const sizes = ['L', 'M', 'S']; // Large, Medium, Small
  
  for (const size of sizes) {
    try {
      const url = `https://covers.openlibrary.org/b/isbn/${cleanedISBN}-${size}.jpg`;
      console.log(`🔍 Checking Open Library cover: ${url}`);
      
      const response = await fetch(url, { 
        method: 'HEAD' // Just check if image exists
      });
      
      if (response.ok && response.headers.get('content-type')?.startsWith('image/')) {
        console.log(`✅ Found Open Library cover: ${size} size`);
        return url;
      }
    } catch (error) {
      console.warn(`⚠️ Open Library ${size} size failed:`, error);
    }
  }
  
  return null;
}

/**
 * Try Google Books API
 */
async function fetchGoogleBooksCover(isbn: string): Promise<{ coverUrl: string | null, metadata?: BookMetadata }> {
  const cleanedISBN = cleanISBN(isbn);
  
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanedISBN}`;
    console.log(`🔍 Checking Google Books API: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const book = data.items[0].volumeInfo;
      const coverUrl = book.imageLinks?.large || 
                      book.imageLinks?.medium || 
                      book.imageLinks?.thumbnail || 
                      book.imageLinks?.smallThumbnail;
      
      // Also extract metadata while we're here
      const metadata: BookMetadata = {
        isbn: cleanedISBN,
        title: book.title,
        authors: book.authors,
        publisher: book.publisher,
        year: book.publishedDate?.split('-')[0], // Extract year
        coverUrl: coverUrl || undefined
      };
      
      console.log(`✅ Found Google Books data:`, { 
        title: book.title?.substring(0, 50) + '...',
        hasCover: !!coverUrl 
      });
      
      return { coverUrl, metadata };
    }
    
    return { coverUrl: null };
  } catch (error) {
    console.warn('⚠️ Google Books API failed:', error);
    return { coverUrl: null };
  }
}

/**
 * Try WorldCat Covers (alternative)
 */
async function fetchWorldCatCover(isbn: string): Promise<string | null> {
  const cleanedISBN = cleanISBN(isbn);
  
  try {
    // WorldCat has a covers service
    const url = `https://covers.oclc.org/ImageWebSvc/CoverImage?isbn=${cleanedISBN}&size=L&format=jpeg`;
    console.log(`🔍 Checking WorldCat cover: ${url}`);
    
    const response = await fetch(url, { 
      method: 'HEAD'
    });
    
    if (response.ok && response.headers.get('content-type')?.startsWith('image/')) {
      console.log(`✅ Found WorldCat cover`);
      return url;
    }
  } catch (error) {
    console.warn('⚠️ WorldCat cover failed:', error);
  }
  
  return null;
}

/**
 * Main book cover fetching function
 */
async function fetchBookCover(isbn: string): Promise<{ 
  success: boolean;
  coverUrl?: string;
  metadata?: BookMetadata;
  source?: string;
  fallbackToUpload?: boolean;
}> {
  if (!isValidISBN(isbn)) {
    throw new Error('Invalid ISBN format');
  }
  
  console.log(`📚 Fetching book cover for ISBN: ${isbn}`);
  
  // Try Google Books first (gives us metadata too)
  const googleResult = await fetchGoogleBooksCover(isbn);
  if (googleResult.coverUrl) {
    return {
      success: true,
      coverUrl: googleResult.coverUrl,
      metadata: googleResult.metadata,
      source: 'Google Books'
    };
  }
  
  // Try Open Library
  const openLibraryCover = await fetchOpenLibraryCover(isbn);
  if (openLibraryCover) {
    return {
      success: true,
      coverUrl: openLibraryCover,
      metadata: googleResult.metadata, // Use metadata from Google even if cover comes from elsewhere
      source: 'Open Library'
    };
  }
  
  // Try WorldCat as last resort
  const worldCatCover = await fetchWorldCatCover(isbn);
  if (worldCatCover) {
    return {
      success: true,
      coverUrl: worldCatCover,
      metadata: googleResult.metadata,
      source: 'WorldCat'
    };
  }
  
  // No cover found - user will need to upload
  console.log(`❌ No book cover found for ISBN: ${isbn}`);
  return {
    success: false,
    metadata: googleResult.metadata, // Still return metadata if we have it
    fallbackToUpload: true
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { isbn, preview = false } = JSON.parse(event.body || '{}');

    if (!isbn) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'ISBN is required' }),
      };
    }

    const result = await fetchBookCover(isbn);

    if (preview && result.coverUrl) {
      // For preview, we might want to proxy the image or return it directly
      // For now, just return the URL
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          preview: true,
          imageUrl: result.coverUrl,
          source: result.source,
          metadata: result.metadata
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: result.success,
        coverUrl: result.coverUrl,
        source: result.source,
        metadata: result.metadata,
        fallbackToUpload: result.fallbackToUpload,
        message: result.success 
          ? `Book cover found from ${result.source}`
          : 'No cover found - user upload required'
      }),
    };

  } catch (error) {
    console.error('❌ Book cover fetching failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch book cover',
        details: error instanceof Error ? error.message : 'Unknown error',
        fallbackToUpload: true
      }),
    };
  }
};