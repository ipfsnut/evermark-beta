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
   * Attempt to find DOI from academic URL by trying common patterns
   */
  private async tryExtractDOIFromAcademicUrl(url: string): Promise<string | null> {
    try {
      // For psycnet.apa.org URLs, try to extract from the URL path
      if (url.includes('psycnet.apa.org')) {
        // Pattern: /fulltext/YYYY-NNNNN-NNN.html
        const match = url.match(/fulltext\/(\d{4}-\d{5}-\d{3})/);
        if (match) {
          // This might correspond to a DOI pattern, but we'd need to fetch the page
          // For now, return null and let it fall back to URL detection
          return null;
        }
      }
      
      // Could add more academic URL patterns here
      return null;
    } catch (error) {
      console.warn('Failed to extract DOI from academic URL:', error);
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
      let doi = this.extractDOI(doiOrUrl);
      
      // If no direct DOI found, try to extract from academic URL
      if (!doi && this.isDOIUrl(doiOrUrl)) {
        doi = await this.tryExtractDOIFromAcademicUrl(doiOrUrl);
      }
      
      // If still no DOI, use the input as-is (might be a direct DOI)
      if (!doi) {
        doi = doiOrUrl;
      }
      
      // Validate that we have something that looks like a DOI
      if (!doi.includes('/') || !doi.match(/10\.\d{4}/)) {
        console.warn('❌ Invalid DOI format:', doi);
        return {
          success: false,
          error: 'Could not extract valid DOI from input'
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
      console.log('📊 Crossref API response received:', { status: response.status, hasMessage: !!data.message });
      
      if (!data.message) {
        console.error('❌ Invalid Crossref response:', data);
        throw new Error('Invalid response from Crossref API');
      }

      const work = data.message;
      console.log('📋 Paper data from Crossref:', { 
        title: work.title?.[0], 
        authorCount: work.author?.length || 0,
        doi: work.DOI 
      });

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
   * Check if a URL appears to be a DOI or academic paper URL
   */
  isDOIUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      
      // Direct DOI URLs
      if (urlObj.hostname.includes('doi.org')) {
        return true;
      }
      
      // Try to extract DOI from URL
      if (this.extractDOI(url) !== null) {
        return true;
      }
      
      // Check for academic domains that often contain DOIs
      const academicDomains = [
        'psycnet.apa.org',
        'pubmed.ncbi.nlm.nih.gov',
        'scholar.google.com',
        'arxiv.org',
        'nature.com',
        'science.org',
        'sciencedirect.com',
        'springer.com',
        'ieee.org',
        'acm.org',
        'jstor.org',
        'plos.org'
      ];
      
      const hostname = urlObj.hostname.toLowerCase();
      return academicDomains.some(domain => hostname.includes(domain));
    } catch {
      return false;
    }
  }
}

export const doiService = new DOIService();
export type { DOIMetadata, DOIFetchResult };