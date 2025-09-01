import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

interface WebContentMetadata {
  title: string;
  author: string;
  authors: string[];
  publication?: string;
  publishedDate?: string;
  description?: string;
  siteName?: string;
  domain: string;
  confidence: 'high' | 'medium' | 'low';
  extractionMethod: string;
}

// Known publication domains
const KNOWN_PUBLICATIONS = new Map([
  ['nytimes.com', 'The New York Times'],
  ['washingtonpost.com', 'The Washington Post'],
  ['wsj.com', 'The Wall Street Journal'],
  ['cnn.com', 'CNN'],
  ['bbc.com', 'BBC'],
  ['reuters.com', 'Reuters'],
  ['techcrunch.com', 'TechCrunch'],
  ['theverge.com', 'The Verge'],
  ['wired.com', 'WIRED'],
  ['medium.com', 'Medium'],
  ['substack.com', 'Substack'],
  ['coindesk.com', 'CoinDesk'],
  ['decrypt.co', 'Decrypt']
]);

function extractDomain(url: string): { domain: string; publication?: string } {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, '');
    const publication = KNOWN_PUBLICATIONS.get(domain);
    return { domain, publication };
  } catch {
    return { domain: 'unknown' };
  }
}

function extractTwitterAuthor(url: string): { isTwitter: boolean; author?: string } {
  const twitterPatterns = [
    /(?:twitter\.com|x\.com)\/([^\/]+)\/status/,
    /(?:twitter\.com|x\.com)\/([^\/]+)$/
  ];

  for (const pattern of twitterPatterns) {
    const match = url.match(pattern);
    if (match && match[1] !== 'i' && match[1] !== 'intent') { // Exclude twitter.com/i/... URLs
      return { isTwitter: true, author: match[1] };
    }
  }
  return { isTwitter: false };
}

async function fetchTwitterMetadata(url: string): Promise<WebContentMetadata | null> {
  try {
    const oembedUrl = `https://publish.x.com/oembed?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      throw new Error(`Twitter oEmbed API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      title: 'Tweet',
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

function parseHTMLMetadata(html: string, url: string): WebContentMetadata {
  const { domain, publication } = extractDomain(url);
  
  // Extract meta tags using regex (simplified - production would use proper HTML parser)
  const extractMeta = (property: string): string | null => {
    const patterns = [
      new RegExp(`<meta\\s+property="${property}"\\s+content="([^"]*)"`, 'i'),
      new RegExp(`<meta\\s+name="${property}"\\s+content="([^"]*)"`, 'i'),
      new RegExp(`<meta\\s+content="([^"]*)"\\s+property="${property}"`, 'i'),
      new RegExp(`<meta\\s+content="([^"]*)"\\s+name="${property}"`, 'i')
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    }
    return null;
  };

  // Extract title
  const title = extractMeta('og:title') || 
                extractMeta('twitter:title') ||
                html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
                'Untitled';

  // Extract description
  const description = extractMeta('og:description') || 
                     extractMeta('description') ||
                     extractMeta('twitter:description');

  // Extract site name
  const siteName = extractMeta('og:site_name') || 
                   extractMeta('twitter:site')?.replace('@', '') ||
                   publication;

  // Extract published date
  const publishedDate = extractMeta('article:published_time') || 
                       extractMeta('datePublished') ||
                       extractMeta('publish_date');

  // Extract author information (multiple strategies)
  const authorSources = [
    extractMeta('article:author'),
    extractMeta('author'),
    extractMeta('twitter:creator')?.replace('@', ''),
    // Look for byline patterns in HTML
    html.match(/class="[^"]*byline[^"]*"[^>]*>([^<]+)/i)?.[1]?.trim(),
    html.match(/class="[^"]*author[^"]*"[^>]*>([^<]+)/i)?.[1]?.trim(),
    html.match(/rel="author"[^>]*>([^<]+)/i)?.[1]?.trim()
  ].filter(Boolean).filter(author => 
    // Filter out obvious non-author content
    author && 
    author.length > 2 && 
    author.length < 100 &&
    !author.match(/^https?:\/\//) &&
    !author.includes('<') &&
    !author.includes('&nbsp;')
  ) as string[];

  // Determine primary author
  let primaryAuthor = 'Unknown';
  let confidence: 'high' | 'medium' | 'low' = 'low';

  if (authorSources.length > 0) {
    primaryAuthor = authorSources[0];
    confidence = 'medium';
  } else if (siteName) {
    primaryAuthor = siteName;
    confidence = 'low';
  } else {
    primaryAuthor = domain;
    confidence = 'low';
  }

  return {
    title: title.trim(),
    author: primaryAuthor,
    authors: authorSources,
    publication: siteName,
    publishedDate,
    description,
    siteName,
    domain,
    confidence,
    extractionMethod: authorSources.length > 0 ? 'html_meta_tags' : 'domain_fallback'
  };
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const url = event.queryStringParameters?.url;
    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL parameter required' }),
      };
    }

    console.log(`🌐 Extracting metadata for: ${url}`);

    // 1. Handle Twitter/X URLs
    const twitterCheck = extractTwitterAuthor(url);
    if (twitterCheck.isTwitter) {
      const twitterMeta = await fetchTwitterMetadata(url);
      if (twitterMeta) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, metadata: twitterMeta }),
        };
      }
      
      // Fallback for Twitter
      const { domain, publication } = extractDomain(url);
      const fallbackMeta: WebContentMetadata = {
        title: 'Tweet',
        author: twitterCheck.author || 'Twitter User',
        authors: [twitterCheck.author || 'Twitter User'],
        publication: 'Twitter',
        siteName: 'Twitter',
        domain,
        confidence: 'medium',
        extractionMethod: 'url_parsing'
      };
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, metadata: fallbackMeta }),
      };
    }

    // 2. Fetch and parse HTML for other content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EvermarkBot/1.0; +https://evermarks.net/bot)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const metadata = parseHTMLMetadata(html, url);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, metadata }),
    };

  } catch (error) {
    console.error('Web metadata extraction error:', error);
    
    // Ultimate fallback
    const { domain, publication } = extractDomain(event.queryStringParameters?.url || '');
    const fallbackMeta: WebContentMetadata = {
      title: 'Web Content',
      author: publication || domain,
      authors: [publication || domain],
      publication,
      siteName: publication,
      domain,
      confidence: 'low',
      extractionMethod: 'error_fallback'
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        metadata: fallbackMeta,
        warning: 'Used fallback metadata due to extraction error'
      }),
    };
  }
};