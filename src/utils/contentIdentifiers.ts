/**
 * Content Identifier Extraction and URL Normalization
 * 
 * This module handles the detection and extraction of unique content identifiers
 * from URLs to enable deduplication across different content types.
 */

export interface ContentIdentifier {
  id: string;
  type: 'cast_hash' | 'doi' | 'isbn' | 'tweet_id' | 'youtube_id' | 'github_resource' | 'normalized_url';
  confidence: 'exact' | 'high' | 'medium' | 'low';
  originalUrl: string;
}

export interface DuplicateCheckResponse {
  exists: boolean;
  confidence: 'exact' | 'high' | 'medium' | 'low';
  existingTokenId?: number;
  existingEvermark?: {
    token_id: number;
    title: string;
    author: string;
    created_at: string;
    vote_count?: number;
    total_staked?: string;
    leaderboard_rank?: number;
  };
  duplicateType: 'cast_hash' | 'doi' | 'isbn' | 'tweet_id' | 'youtube_id' | 'github_resource' | 'normalized_url';
  message: string;
}

/**
 * Extract content identifier from a URL
 * Returns the most specific identifier available with confidence level
 */
export function extractContentIdentifier(url: string): ContentIdentifier {
  const trimmedUrl = url.trim();
  
  // Farcaster cast hash - exact match
  const castMatch = trimmedUrl.match(/farcaster\.xyz\/[^\/]+\/0x([a-fA-F0-9]{8,64})/);
  if (castMatch) {
    return { 
      id: `0x${castMatch[1]}`, 
      type: 'cast_hash', 
      confidence: 'exact',
      originalUrl: trimmedUrl
    };
  }

  // Warpcast URL pattern
  const warpcastMatch = trimmedUrl.match(/warpcast\.com\/[^\/]+\/0x([a-fA-F0-9]{8,64})/);
  if (warpcastMatch) {
    return { 
      id: `0x${warpcastMatch[1]}`, 
      type: 'cast_hash', 
      confidence: 'exact',
      originalUrl: trimmedUrl
    };
  }

  // Direct cast hash (if someone pastes just the hash)
  const directHashMatch = trimmedUrl.match(/^0x[a-fA-F0-9]{8,64}$/);
  if (directHashMatch) {
    return { 
      id: directHashMatch[0], 
      type: 'cast_hash', 
      confidence: 'exact',
      originalUrl: trimmedUrl
    };
  }
  
  // Twitter/X tweet ID - high confidence (check before ISBN to avoid conflicts)
  const tweetMatch = trimmedUrl.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  if (tweetMatch) {
    return { 
      id: tweetMatch[1], 
      type: 'tweet_id', 
      confidence: 'high',
      originalUrl: trimmedUrl
    };
  }

  // DOI patterns - exact match
  const doiMatch = trimmedUrl.match(/doi\.org\/(.+)$/) || trimmedUrl.match(/(10\.\d+\/[^\s\/?#]+)/);
  if (doiMatch) {
    const doiId = doiMatch[1] || doiMatch[0];
    return { 
      id: doiId, 
      type: 'doi', 
      confidence: 'exact',
      originalUrl: trimmedUrl
    };
  }
  
  // ISBN patterns - exact match (more specific pattern to avoid false positives)
  const isbnMatch = trimmedUrl.match(/(?:isbn[:\s]?)?(\d{9}[\d|X]|\d{13})/i);
  if (isbnMatch && !tweetMatch) { // Don't match tweet IDs as ISBNs
    // Additional validation: make sure this looks like an ISBN context
    const contextMatch = trimmedUrl.match(/(?:book|isbn|amazon|goodreads|worldcat)/i);
    if (contextMatch) {
      return { 
        id: isbnMatch[1], 
        type: 'isbn', 
        confidence: 'exact',
        originalUrl: trimmedUrl
      };
    }
  }
  
  // YouTube video ID - high confidence
  const youtubeMatch = trimmedUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (youtubeMatch) {
    return { 
      id: youtubeMatch[1], 
      type: 'youtube_id', 
      confidence: 'high',
      originalUrl: trimmedUrl
    };
  }
  
  // GitHub resource - medium confidence
  const githubMatch = trimmedUrl.match(/github\.com\/([^\/]+\/[^\/]+)(?:\/.*)?$/);
  if (githubMatch) {
    // Try to extract specific commit or tag
    const commitMatch = trimmedUrl.match(/github\.com\/([^\/]+\/[^\/]+)\/(?:commit|tree)\/([a-fA-F0-9]{40})/);
    const tagMatch = trimmedUrl.match(/github\.com\/([^\/]+\/[^\/]+)\/releases\/tag\/([^\/\?#]+)/);
    
    let id = githubMatch[1]; // Default to repo only
    if (commitMatch) {
      id = `${commitMatch[1]}@${commitMatch[2]}`;
    } else if (tagMatch) {
      id = `${tagMatch[1]}@${tagMatch[2]}`;
    }
    
    return { 
      id, 
      type: 'github_resource', 
      confidence: 'medium',
      originalUrl: trimmedUrl
    };
  }
  
  // Fallback: normalized URL - low confidence
  return { 
    id: normalizeURL(trimmedUrl), 
    type: 'normalized_url', 
    confidence: 'low',
    originalUrl: trimmedUrl
  };
}

/**
 * Normalize URL for deduplication
 * Removes tracking parameters, protocol differences, www prefixes, etc.
 */
export function normalizeURL(url: string): string {
  let normalized = url.trim().toLowerCase();
  
  // Add protocol if missing
  if (!normalized.startsWith('http')) {
    normalized = `https://${  normalized}`;
  }
  
  // Convert http to https
  normalized = normalized.replace(/^http:/, 'https:');
  
  try {
    const urlObj = new URL(normalized);
    
    // Remove www prefix
    urlObj.hostname = urlObj.hostname.replace(/^www\./, '');
    
    // Remove trailing slash from pathname
    if (urlObj.pathname.endsWith('/') && urlObj.pathname.length > 1) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    
    // Remove common tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'utm_id', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
      'ref', 'source', 'fbclid', 'gclid', 'msclkid', 'twclid',
      'igshid', 'tt_content', 'tt_medium', 'mc_cid', 'mc_eid',
      '_ga', '_gl', '_hsenc', '_hsmi', 'hsCtaTracking',
      'campaign', 'medium', 'content', 'term'
    ];
    
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // Sort remaining search parameters for consistent ordering
    urlObj.searchParams.sort();
    
    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, return cleaned version without URL constructor
    return normalized
      .replace(/^https:\/\/www\./, 'https://')
      .replace(/\/$/, ''); // Remove trailing slash
  }
}

/**
 * Get confidence level description for UI
 */
export function getConfidenceDescription(confidence: string): string {
  switch (confidence) {
    case 'exact':
      return 'This content is guaranteed to be identical';
    case 'high':
      return 'This content is very likely to be identical';
    case 'medium':
      return 'This content might be identical';
    case 'low':
      return 'This content appears similar';
    default:
      return 'Unknown confidence level';
  }
}

/**
 * Get user-friendly message for duplicate content type
 */
export function getDuplicateMessage(type: string, existingTokenId?: number): string {
  const tokenRef = existingTokenId ? ` (Evermark #${existingTokenId})` : '';
  
  switch (type) {
    case 'cast_hash':
      return `This Farcaster cast has already been preserved${tokenRef}`;
    case 'doi':
      return `This research paper (DOI) has already been preserved${tokenRef}`;
    case 'isbn':
      return `This book (ISBN) has already been preserved${tokenRef}`;
    case 'tweet_id':
      return `This tweet appears to already be preserved${tokenRef}`;
    case 'youtube_id':
      return `This YouTube video appears to already be preserved${tokenRef}`;
    case 'github_resource':
      return `This GitHub resource appears to already be preserved${tokenRef}`;
    case 'normalized_url':
      return `Similar content appears to already exist${tokenRef}`;
    default:
      return `This content might already exist${tokenRef}`;
  }
}

/**
 * Determine if duplication should be strictly prevented (no override)
 */
export function shouldPreventDuplication(confidence: string): boolean {
  return confidence === 'exact';
}

/**
 * Generate search patterns for database queries
 */
export function generateSearchPatterns(identifier: ContentIdentifier): string[] {
  const patterns: string[] = [];
  
  switch (identifier.type) {
    case 'cast_hash':
      // Search for the hash in URLs and metadata
      patterns.push(`%${identifier.id}%`);
      if (identifier.id.startsWith('0x')) {
        patterns.push(`%${identifier.id.slice(2)}%`); // Without 0x prefix
      } else {
        patterns.push(`%0x${identifier.id}%`); // With 0x prefix
      }
      break;
      
    case 'doi':
      patterns.push(`%${identifier.id}%`);
      patterns.push(`%doi.org/${identifier.id}%`);
      break;
      
    case 'isbn':
      patterns.push(`%${identifier.id}%`);
      break;
      
    case 'tweet_id':
      patterns.push(`%/status/${identifier.id}%`);
      patterns.push(`%${identifier.id}%`);
      break;
      
    case 'youtube_id':
      patterns.push(`%v=${identifier.id}%`);
      patterns.push(`%youtu.be/${identifier.id}%`);
      patterns.push(`%${identifier.id}%`);
      break;
      
    case 'github_resource':
      patterns.push(`%${identifier.id}%`);
      break;
      
    case 'normalized_url':
      patterns.push(identifier.id);
      // Also search for variations
      const withWww = identifier.id.replace('https://', 'https://www.');
      const withHttp = identifier.id.replace('https://', 'http://');
      patterns.push(withWww);
      patterns.push(withHttp);
      break;
  }
  
  return patterns;
}