// DOI Service for fetching academic paper metadata from CrossRef API

export interface PaperMetadata {
  title: string;
  authors: string[];
  abstract?: string;
  journal?: string;
  publisher?: string;
  publishedDate?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi: string;
  url?: string;
  subjects?: string[];
  citations?: number;
  type?: string;
}

export class DOIService {
  // Clean and validate DOI
  static cleanDOI(doi: string): string {
    console.log('🧹 Cleaning DOI input:', JSON.stringify(doi));
    
    // Remove URL prefix if present
    let cleaned = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
    console.log('🧹 After URL removal:', JSON.stringify(cleaned));
    
    // Remove any whitespace
    cleaned = cleaned.trim();
    console.log('🧹 After trim:', JSON.stringify(cleaned));
    
    // Very permissive DOI format validation - basically just check it starts with 10.
    // The real validation happens at the API level
    if (!cleaned.match(/^10\./)) {
      console.log('❌ Failed basic 10. check');
      throw new Error('Invalid DOI format');
    }
    
    // Check if it has a slash and something after it
    if (!cleaned.includes('/') || cleaned.split('/').length < 2) {
      console.log('❌ Missing slash or suffix');
      throw new Error('Invalid DOI format');
    }
    
    // Check if there's actual content after the slash
    const parts = cleaned.split('/');
    if (parts.length < 2 || parts[1].trim().length === 0) {
      console.log('❌ Empty suffix after slash');
      throw new Error('Invalid DOI format');
    }
    
    // More strict validation - suffix should have substantial content
    if (parts[1].trim().length < 2) {
      console.log('❌ Suffix too short');
      throw new Error('Invalid DOI format');
    }
    
    console.log('✅ DOI validation passed:', cleaned);
    return cleaned;
  }

  // Check if DOI looks complete enough to attempt API call
  static isCompleteDOI(doi: string): boolean {
    try {
      const cleaned = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '').trim();
      // Must start with 10., have a slash, and have substantial content after slash
      return cleaned.match(/^10\.\d+\/\w+/) !== null;
    } catch {
      return false;
    }
  }

  // Fetch from CrossRef API
  static async fetchFromCrossRef(doi: string): Promise<PaperMetadata | null> {
    try {
      const cleanedDOI = this.cleanDOI(doi);
      
      // CrossRef API with content negotiation for JSON
      const response = await fetch(`https://api.crossref.org/works/${cleanedDOI}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Evermark/1.0 (https://evermark.app; contact@evermark.app)'
        }
      });
      
      if (!response.ok) {
        console.error('CrossRef API error:', response.status);
        return null;
      }

      const data = await response.json();
      const paper = data.message;

      if (!paper) {
        return null;
      }

      // Extract authors
      const authors: string[] = [];
      if (paper.author) {
        paper.author.forEach((author: any) => {
          const name = author.given && author.family 
            ? `${author.given} ${author.family}`
            : author.name || 'Unknown Author';
          authors.push(name);
        });
      }

      // Extract published date
      let publishedDate: string | undefined;
      if (paper['published-print']) {
        const dateParts = paper['published-print']['date-parts'][0];
        publishedDate = dateParts.join('-');
      } else if (paper['published-online']) {
        const dateParts = paper['published-online']['date-parts'][0];
        publishedDate = dateParts.join('-');
      } else if (paper.created) {
        publishedDate = paper.created['date-time']?.split('T')[0];
      }

      // Extract journal name
      let journal: string | undefined;
      if (paper['container-title'] && paper['container-title'].length > 0) {
        journal = paper['container-title'][0];
      } else if (paper['short-container-title'] && paper['short-container-title'].length > 0) {
        journal = paper['short-container-title'][0];
      }

      // Extract subjects
      const subjects: string[] = [];
      if (paper.subject) {
        subjects.push(...paper.subject);
      }

      return {
        title: paper.title ? paper.title[0] : 'Unknown Title',
        authors,
        abstract: paper.abstract ? this.cleanAbstract(paper.abstract) : undefined,
        journal,
        publisher: paper.publisher || undefined,
        publishedDate,
        volume: paper.volume || undefined,
        issue: paper.issue || undefined,
        pages: paper.page || undefined,
        doi: cleanedDOI,
        url: paper.URL || `https://doi.org/${cleanedDOI}`,
        subjects,
        citations: paper['is-referenced-by-count'] || undefined,
        type: paper.type || undefined
      };
    } catch (error) {
      console.error('CrossRef fetch error:', error);
      return null;
    }
  }

  // Clean abstract text (remove XML/HTML tags)
  static cleanAbstract(abstract: string): string {
    // Remove XML/HTML tags
    let cleaned = abstract.replace(/<[^>]*>/g, '');
    
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Decode HTML entities (works in both browser and Node.js)
    try {
      if (typeof document !== 'undefined') {
        // Browser environment
        const textarea = document.createElement('textarea');
        textarea.innerHTML = cleaned;
        cleaned = textarea.value;
      } else {
        // Node.js environment - manual decode of common entities
        cleaned = cleaned
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ');
      }
    } catch (error) {
      // Fallback if DOM manipulation fails
      console.warn('HTML entity decoding failed, using raw text');
    }
    
    return cleaned;
  }

  // Fetch from alternative source (Unpaywall for open access info)
  static async fetchFromUnpaywall(doi: string): Promise<{ openAccessUrl?: string } | null> {
    try {
      const cleanedDOI = this.cleanDOI(doi);
      
      // Unpaywall API (requires email in query)
      const response = await fetch(
        `https://api.unpaywall.org/v2/${cleanedDOI}?email=evermark@example.com`
      );
      
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      if (data.is_oa && data.best_oa_location) {
        return {
          openAccessUrl: data.best_oa_location.url_for_pdf || data.best_oa_location.url
        };
      }
      
      return null;
    } catch (error) {
      console.error('Unpaywall fetch error:', error);
      return null;
    }
  }

  // Main fetch function
  static async fetchPaperMetadata(doi: string): Promise<PaperMetadata | null> {
    console.log('📄 Fetching paper metadata for DOI:', doi);

    // Check if DOI is complete enough for API calls
    if (!this.isCompleteDOI(doi)) {
      console.log('⏳ DOI appears incomplete, skipping API call:', doi);
      return null;
    }

    // Fetch from CrossRef
    const crossRefData = await this.fetchFromCrossRef(doi);
    
    if (!crossRefData) {
      console.log('❌ No paper data found for DOI:', doi);
      return null;
    }

    console.log('✅ Found paper data from CrossRef:', crossRefData.title);

    // Try to get open access URL
    const openAccessData = await this.fetchFromUnpaywall(doi);
    if (openAccessData?.openAccessUrl) {
      console.log('🔓 Found open access version');
      crossRefData.url = openAccessData.openAccessUrl;
    }

    return crossRefData;
  }

  // Generate evermark title from paper metadata
  static generateEvermarkTitle(metadata: PaperMetadata): string {
    // Use full title - no truncation needed since we increased the limit
    let title = metadata.title;
    
    return title;
  }

  // Generate evermark description from paper metadata
  static generateEvermarkDescription(metadata: PaperMetadata): string {
    let description = '';

    // Add abstract if available - use complete abstract (no truncation)
    if (metadata.abstract) {
      description = metadata.abstract;
    } else {
      // Create a basic description
      description = 'Academic paper';
      
      if (metadata.authors && metadata.authors.length > 0) {
        const authorList = metadata.authors.length > 3 
          ? `${metadata.authors.slice(0, 3).join(', ')} et al.`
          : metadata.authors.join(', ');
        description = `Paper by ${authorList}`;
      }
      
      if (metadata.journal) {
        description += ` published in ${metadata.journal}`;
      }
      
      if (metadata.publishedDate) {
        const year = metadata.publishedDate.split('-')[0];
        description += ` (${year})`;
      }
    }

    // Add metadata summary
    const metaItems: string[] = [];
    
    if (metadata.journal) {
      metaItems.push(metadata.journal);
    }
    
    if (metadata.publishedDate) {
      const year = metadata.publishedDate.split('-')[0];
      metaItems.push(year);
    }
    
    if (metadata.citations && metadata.citations > 0) {
      metaItems.push(`${metadata.citations} citations`);
    }
    
    if (metaItems.length > 0) {
      description += `\n\n[${metaItems.join(' • ')}]`;
    }

    // Add DOI
    description += `\n\nDOI: ${metadata.doi}`;

    return description;
  }

  // Generate tags from paper metadata
  static generateTags(metadata: PaperMetadata): string[] {
    const tags: string[] = [];
    
    // Add 'research' and 'paper' tags
    tags.push('research', 'paper');
    
    // Add subject tags
    if (metadata.subjects) {
      metadata.subjects.slice(0, 3).forEach(subject => {
        tags.push(subject.toLowerCase().replace(/\s+/g, '-'));
      });
    }
    
    // Add type tag
    if (metadata.type) {
      const typeTag = metadata.type.replace('journal-', '').replace(/-/g, ' ');
      tags.push(typeTag);
    }
    
    // Add year tag
    if (metadata.publishedDate) {
      const year = metadata.publishedDate.split('-')[0];
      tags.push(year);
    }
    
    // Add journal tag if short enough
    if (metadata.journal && metadata.journal.length < 20) {
      tags.push(metadata.journal.toLowerCase().replace(/\s+/g, '-'));
    }
    
    return tags.slice(0, 10); // Limit to 10 tags
  }
}