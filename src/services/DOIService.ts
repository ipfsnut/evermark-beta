// DOI Service for fetching academic paper metadata from Crossref API

interface DOIAuthor {
  given?: string;
  family?: string;
  ORCID?: string;
}

interface DOIMetadata {
  title: string;
  authors: string[];
  journal?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publishedDate?: string;
  doi: string;
  abstract?: string;
  url?: string;
}

interface DOIFetchResult {
  success: boolean;
  metadata?: DOIMetadata;
  error?: string;
}

class DOIService {
  private readonly CROSSREF_API_BASE = 'https://api.crossref.org/v1';

  /**
   * Extract DOI from various URL formats
   * Supports: https://doi.org/10.1037/xge0001449, https://dx.doi.org/10.1037/xge0001449, etc.
   */
  extractDOI(url: string): string | null {
    try {
      const urlObj = new URL(url);
      
      // Handle doi.org and dx.doi.org URLs
      if (urlObj.hostname.includes('doi.org')) {
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
          // Reconstruct DOI from path parts (handle DOIs with slashes)
          return pathParts.join('/');
        }
      }
      
      // Handle direct DOI strings
      const doiMatch = url.match(/10\.\d{4,}\/[^\s]+/);
      if (doiMatch) {
        return doiMatch[0];
      }
      
      return null;
    } catch (e) {
      console.error('Failed to extract DOI from URL:', e);
      return null;
    }
  }

  /**
   * Fetch metadata for a DOI from Crossref API
   */
  async fetchDOIMetadata(doiOrUrl: string): Promise<DOIFetchResult> {
    try {
      console.log('🔍 Fetching DOI metadata for:', doiOrUrl);
      
      // Extract DOI if URL is provided
      const doi = this.extractDOI(doiOrUrl) || doiOrUrl;
      
      if (!doi) {
        return {
          success: false,
          error: 'Invalid DOI format'
        };
      }

      console.log('📄 Extracted DOI:', doi);

      // Query Crossref API
      const response = await fetch(`${this.CROSSREF_API_BASE}/works/${encodeURIComponent(doi)}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Evermark/1.0 (mailto:contact@evermark.com)' // Polite API usage
        }
      });

      if (!response.ok) {
        throw new Error(`Crossref API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.message) {
        throw new Error('Invalid response from Crossref API');
      }

      const work = data.message;

      // Extract and format metadata
      const metadata: DOIMetadata = {
        title: work.title?.[0] || 'Unknown Title',
        authors: this.formatAuthors(work.author || []),
        journal: work['container-title']?.[0],
        publisher: work.publisher,
        volume: work.volume,
        issue: work.issue,
        pages: work.page,
        publishedDate: this.formatPublicationDate(work.published || work['published-online']),
        doi: work.DOI || doi,
        abstract: work.abstract, // Usually not available in Crossref
        url: `https://doi.org/${work.DOI || doi}`
      };

      console.log('✅ DOI metadata fetched successfully:', {
        title: metadata.title.substring(0, 50),
        authors: metadata.authors.slice(0, 3).join(', '),
        journal: metadata.journal
      });

      return {
        success: true,
        metadata
      };

    } catch (error) {
      console.error('❌ Failed to fetch DOI metadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Format author list from Crossref data
   */
  private formatAuthors(authors: DOIAuthor[]): string[] {
    return authors
      .map(author => {
        const given = author.given || '';
        const family = author.family || '';
        if (given && family) {
          return `${given} ${family}`;
        } else if (family) {
          return family;
        } else if (given) {
          return given;
        }
        return 'Unknown Author';
      })
      .filter(name => name !== 'Unknown Author');
  }

  /**
   * Format publication date from Crossref date-parts
   */
  private formatPublicationDate(publishedData: any): string | undefined {
    if (!publishedData?.['date-parts']?.[0]) {
      return undefined;
    }

    const dateParts = publishedData['date-parts'][0];
    if (dateParts.length >= 1) {
      const year = dateParts[0];
      const month = dateParts[1] || 1;
      const day = dateParts[2] || 1;
      
      try {
        return new Date(year, month - 1, day).toISOString().split('T')[0];
      } catch (e) {
        return String(year);
      }
    }
    
    return undefined;
  }

  /**
   * Check if a URL appears to be a DOI
   */
  isDOIUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.includes('doi.org') || 
             this.extractDOI(url) !== null;
    } catch {
      return false;
    }
  }
}

export const doiService = new DOIService();
export type { DOIMetadata, DOIFetchResult };