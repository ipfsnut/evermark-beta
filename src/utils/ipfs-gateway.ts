// IPFS Gateway URL replacement utility to avoid rate limiting and CORS issues

// List of CORS-friendly IPFS gateways with good uptime
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs',
  'https://cloudflare-ipfs.com/ipfs',
  'https://dweb.link/ipfs',
  'https://gateway.lighthouse.storage/ipfs',
  'https://ipfs.filebase.io/ipfs',
  'https://w3s.link/ipfs',
  'https://nftstorage.link/ipfs'
];

// Problematic gateways that cause CORS or rate limiting issues
const PROBLEMATIC_GATEWAYS = [
  'gateway.pinata.cloud',
  'pinata.cloud'
];

/**
 * Extract IPFS hash from various URL formats
 */
function extractIPFSHash(url: string): string | null {
  if (!url) return null;
  
  // Match various IPFS URL patterns
  const patterns = [
    /\/ipfs\/([a-zA-Z0-9]+)/,
    /^ipfs:\/\/([a-zA-Z0-9]+)/,
    /^([Qm][a-zA-Z0-9]{44,})$/, // Direct hash
    /^([a-zA-Z0-9]{46,})$/ // CIDv1
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Check if URL is from a problematic gateway
 */
function isProblematicGateway(url: string): boolean {
  if (!url) return false;
  return PROBLEMATIC_GATEWAYS.some(gateway => url.includes(gateway));
}

/**
 * Replace problematic IPFS gateway with a CORS-friendly one
 */
export function replaceIPFSGateway(url: string | undefined, preferredGateway?: string): string | undefined {
  if (!url) return undefined;
  
  // If it's not an IPFS URL or not from a problematic gateway, return as-is
  if (!url.includes('ipfs') && !isProblematicGateway(url)) {
    return url;
  }
  
  // Extract IPFS hash
  const hash = extractIPFSHash(url);
  if (!hash) {
    console.warn('Could not extract IPFS hash from URL:', url);
    return url;
  }
  
  // Use preferred gateway or default to first in list
  const gateway = preferredGateway || IPFS_GATEWAYS[0];
  return `${gateway}/${hash}`;
}

/**
 * Get a random CORS-friendly gateway for load balancing
 */
export function getRandomIPFSGateway(): string {
  return IPFS_GATEWAYS[Math.floor(Math.random() * IPFS_GATEWAYS.length)];
}

/**
 * Process an evermark object to replace problematic gateways
 */
export function processEvermarkImages<T extends { 
  image?: string;
  processed_image_url?: string;
  supabaseImageUrl?: string;
  thumbnailUrl?: string;
}>(evermark: T): T {
  // If we have a supabase URL, prioritize it
  if (evermark.supabaseImageUrl) {
    return evermark;
  }
  
  // Process each image field
  const processed = { ...evermark };
  
  if (processed.image && isProblematicGateway(processed.image)) {
    processed.image = replaceIPFSGateway(processed.image);
  }
  
  if (processed.processed_image_url && isProblematicGateway(processed.processed_image_url)) {
    processed.processed_image_url = replaceIPFSGateway(processed.processed_image_url);
  }
  
  if (processed.thumbnailUrl && isProblematicGateway(processed.thumbnailUrl)) {
    processed.thumbnailUrl = replaceIPFSGateway(processed.thumbnailUrl);
  }
  
  return processed;
}

/**
 * Process an array of evermarks
 */
export function processEvermarkImagesArray<T extends { 
  image?: string;
  processed_image_url?: string;
  supabaseImageUrl?: string;
  thumbnailUrl?: string;
}>(evermarks: T[]): T[] {
  return evermarks.map(processEvermarkImages);
}