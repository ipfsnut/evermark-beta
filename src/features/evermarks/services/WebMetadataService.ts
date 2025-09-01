/**
 * Web Content Metadata Extraction Service
 * 
 * Handles metadata extraction for news articles, blog posts, and general web content
 * Uses multiple fallback strategies for inconsistent metadata
 */

export interface WebContentMetadata {
  title: string;
  author: string;
  authors: string[]; // Multiple authors if available
  publication?: string;
  publishedDate?: string;
  description?: string;
  siteName?: string;
  domain: string;
  confidence: 'high' | 'medium' | 'low';
  extractionMethod: string;
}

export class WebMetadataService {
  /**
   * Known publication domains and their display names
   */
  private static readonly KNOWN_PUBLICATIONS = new Map([
    // News outlets
    ['nytimes.com', 'The New York Times'],
    ['washingtonpost.com', 'The Washington Post'],
    ['wsj.com', 'The Wall Street Journal'],
    ['cnn.com', 'CNN'],
    ['bbc.com', 'BBC'],
    ['reuters.com', 'Reuters'],
    ['apnews.com', 'Associated Press'],
    ['npr.org', 'NPR'],
    ['theguardian.com', 'The Guardian'],
    ['bloomberg.com', 'Bloomberg'],
    
    // Tech publications  
    ['techcrunch.com', 'TechCrunch'],
    ['arstechnica.com', 'Ars Technica'],
    ['theverge.com', 'The Verge'],
    ['wired.com', 'WIRED'],
    ['venturebeat.com', 'VentureBeat'],
    ['engadget.com', 'Engadget'],
    
    // Social/blogging platforms
    ['medium.com', 'Medium'],
    ['substack.com', 'Substack'],
    ['dev.to', 'DEV Community'],
    ['hashnode.com', 'Hashnode'],
    
    // Finance/crypto
    ['coindesk.com', 'CoinDesk'],
    ['cointelegraph.com', 'Cointelegraph'],
    ['decrypt.co', 'Decrypt'],
    ['theblock.co', 'The Block']
  ]);

  /**
   * Extract domain and publication name from URL
   */
  static extractDomain(url: string): { domain: string; publication?: string } {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace(/^www\./, '');
      const publication = this.KNOWN_PUBLICATIONS.get(domain);
      
      return { domain, publication };
    } catch {
      return { domain: 'unknown' };
    }
  }

  /**
   * Check if URL is Twitter/X and extract author
   */
  static extractTwitterAuthor(url: string): { isTwitter: boolean; author?: string } {
    const twitterPatterns = [
      /(?:twitter\.com|x\.com)\/([^\/]+)\/status/,
      /(?:twitter\.com|x\.com)\/([^\/]+)$/
    ];

    for (const pattern of twitterPatterns) {
      const match = url.match(pattern);
      if (match) {
        return { isTwitter: true, author: match[1] };
      }
    }

    return { isTwitter: false };
  }

  /**
   * Fetch Twitter oEmbed data
   */
  static async fetchTwitterMetadata(url: string): Promise<WebContentMetadata | null> {
    try {
      const oembedUrl = `https://publish.x.com/oembed?url=${encodeURIComponent(url)}`;
      const response = await fetch(oembedUrl);
      
      if (!response.ok) {
        throw new Error(`Twitter oEmbed API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        title: 'Tweet', // Twitter doesn't provide titles
        author: data.author_name || 'Twitter User',
        authors: [data.author_name || 'Twitter User'],
        publication: 'Twitter',
        siteName: 'Twitter',
        domain: 'twitter.com',
        confidence: 'high',
        extractionMethod: 'twitter_oembed'
      };
    } catch (error) {
      console.error('Twitter metadata extraction failed:', error);
      return null;
    }
  }

  /**
   * Extract metadata from Open Graph and meta tags
   * This would typically run server-side to avoid CORS
   */
  static parseHTMLMetadata(html: string, url: string): WebContentMetadata {
    const { domain, publication } = this.extractDomain(url);
    
    // This is a simplified version - in practice you'd use a proper HTML parser
    const extractMeta = (property: string) => {
      const patterns = [
        new RegExp(`<meta\\s+property="${property}"\\s+content="([^"]*)"`, 'i'),
        new RegExp(`<meta\\s+name="${property}"\\s+content="([^"]*)"`, 'i'),
        new RegExp(`<meta\\s+content="([^"]*)"\\s+property="${property}"`, 'i'),
        new RegExp(`<meta\\s+content="([^"]*)"\\s+name="${property}"`, 'i')
      ];
      
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return match[1];
      }
      return null;
    };

    // Extract various metadata fields
    const title = extractMeta('og:title') || extractMeta('title') || 'Untitled';
    const description = extractMeta('og:description') || extractMeta('description');
    const siteName = extractMeta('og:site_name') || publication;
    const publishedDate = extractMeta('article:published_time') || extractMeta('datePublished');
    
    // Try various author extraction patterns
    const authorSources = [
      extractMeta('article:author'),
      extractMeta('author'),
      extractMeta('twitter:creator'),
      extractMeta('twitter:site')
    ].filter((author): author is string => Boolean(author));

    const author = authorSources[0] || siteName || domain;
    const confidence = authorSources.length > 0 ? 'medium' : 'low';

    return {
      title,
      author,
      authors: authorSources,
      publication: siteName || undefined,
      publishedDate: publishedDate || undefined,
      description: description || undefined,
      siteName: siteName || undefined,
      domain,
      confidence,
      extractionMethod: 'html_meta_tags'
    };
  }

  /**
   * Comprehensive content metadata extraction
   */
  static async fetchWebContentMetadata(url: string): Promise<WebContentMetadata | null> {
    try {
      console.log(`🌐 Fetching web content metadata for: ${url}`);

      // 1. Check if it's Twitter/X content
      const twitterCheck = this.extractTwitterAuthor(url);
      if (twitterCheck.isTwitter) {
        const twitterMeta = await this.fetchTwitterMetadata(url);
        if (twitterMeta) {
          return twitterMeta;
        }
        // Fallback to URL parsing for Twitter
        return {
          title: 'Tweet',
          author: twitterCheck.author || 'Twitter User',
          authors: [twitterCheck.author || 'Twitter User'],
          publication: 'Twitter',
          siteName: 'Twitter',
          domain: 'twitter.com',
          confidence: 'medium',
          extractionMethod: 'url_parsing'
        };
      }

      // 2. For other content, we need server-side extraction
      // For now, provide domain-based fallback
      const { domain, publication } = this.extractDomain(url);
      
      return {
        title: 'Web Content',
        author: publication || domain,
        authors: [publication || domain],
        publication,
        siteName: publication,
        domain,
        confidence: 'low',
        extractionMethod: 'domain_fallback'
      };

    } catch (error) {
      console.error('Web content metadata extraction failed:', error);
      return null;
    }
  }

  /**
   * Server-side metadata extraction (for Netlify function)
   * This version can fetch and parse HTML directly
   */
  static async fetchWebContentMetadataServerSide(url: string): Promise<WebContentMetadata | null> {
    try {
      console.log(`🌐 [Server] Fetching web content metadata for: ${url}`);

      // 1. Handle Twitter/X URLs
      const twitterCheck = this.extractTwitterAuthor(url);
      if (twitterCheck.isTwitter) {
        const twitterMeta = await this.fetchTwitterMetadata(url);
        if (twitterMeta) return twitterMeta;
      }

      // 2. Fetch the webpage HTML
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EvermarkBot/1.0; +https://evermarks.net/bot)'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const metadata = this.parseHTMLMetadata(html, url);
      
      return metadata;

    } catch (error) {
      console.error('Server-side web metadata extraction failed:', error);
      
      // Ultimate fallback: domain-based
      const { domain, publication } = this.extractDomain(url);
      return {
        title: 'Web Content',
        author: publication || domain,
        authors: [publication || domain],
        publication,
        siteName: publication,
        domain,
        confidence: 'low',
        extractionMethod: 'fallback'
      };
    }
  }

  /**
   * Detect content type from URL patterns
   */
  static detectContentType(url: string): 'Cast' | 'DOI' | 'ISBN' | 'URL' {
    // Twitter/X content should be treated as Cast
    if (url.match(/(?:twitter\.com|x\.com)\/[^\/]+\/status/)) {
      return 'Cast';
    }

    // Farcaster content
    if (url.match(/(?:warpcast\.com|farcaster\.xyz|supercast\.xyz)/)) {
      return 'Cast';
    }

    // DOI patterns
    if (url.match(/doi\.org|dx\.doi\.org/) || url.match(/^(?:doi:)?10\.\d+\//)) {
      return 'DOI';
    }

    // ISBN patterns (less common in URLs)
    if (url.match(/isbn/i)) {
      return 'ISBN';
    }

    // Default to URL
    return 'URL';
  }
}