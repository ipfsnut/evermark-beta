import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const SUPPORTED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/ogg'
];

interface MediaPreservationResult {
  ardrive_tx?: string;
  ipfs_hash?: string;
  content_type?: string;
  file_size?: number;
  dimensions?: { width: number; height: number };
  thumbnail?: {
    ardrive_tx?: string;
    ipfs_hash?: string;
  };
}

/**
 * Download media from URL
 */
async function downloadMedia(url: string): Promise<{
  buffer: Buffer;
  contentType: string;
  size: number;
}> {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch media: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const contentLength = response.headers.get('content-length');
  
  // Check file size before downloading
  if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${contentLength} bytes`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // Verify actual size
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${buffer.length} bytes`);
  }

  return {
    buffer,
    contentType,
    size: buffer.length,
  };
}

/**
 * Store media in Supabase Storage
 */
async function storeInSupabase(
  buffer: Buffer,
  contentType: string,
  url: string
): Promise<string | null> {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const hash = Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
    const extension = contentType.split('/')[1] || 'bin';
    const filename = `preserved_media/${timestamp}_${hash}.${extension}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('evermark-media')
      .upload(filename, buffer, {
        contentType,
        cacheControl: '31536000', // 1 year
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('evermark-media')
      .getPublicUrl(filename);

    return publicUrl;
  } catch (error) {
    console.error('Error storing in Supabase:', error);
    return null;
  }
}

/**
 * Store media on ArDrive (Arweave)
 */
async function storeOnArDrive(
  buffer: Buffer,
  contentType: string
): Promise<string | null> {
  // ArDrive integration would go here
  // For now, returning null as placeholder
  // In production, this would upload to Arweave via ArDrive API
  console.log('ArDrive storage not yet implemented');
  return null;
}

/**
 * Store media on IPFS via Pinata
 */
async function storeOnIPFS(
  buffer: Buffer,
  contentType: string,
  filename: string
): Promise<string | null> {
  try {
    if (!process.env.VITE_PINATA_JWT) {
      console.error('Pinata JWT not configured');
      return null;
    }

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: contentType });
    formData.append('file', blob, filename);

    const metadata = JSON.stringify({
      name: filename,
      keyvalues: {
        type: 'preserved_media',
        preserved_at: new Date().toISOString(),
      }
    });
    formData.append('pinataMetadata', metadata);

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_PINATA_JWT}`,
      },
      body: formData,
    });

    if (!response.ok) {
      console.error('Pinata upload failed:', await response.text());
      return null;
    }

    const result = await response.json();
    return result.IpfsHash;
  } catch (error) {
    console.error('Error storing on IPFS:', error);
    return null;
  }
}

/**
 * Get image dimensions
 */
async function getImageDimensions(
  buffer: Buffer,
  contentType: string
): Promise<{ width: number; height: number } | null> {
  // Simple dimension detection for common image formats
  // In production, you'd use a library like sharp or image-size
  
  if (contentType === 'image/png') {
    // PNG dimensions are at bytes 16-24
    if (buffer.length > 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }
  } else if (contentType === 'image/jpeg' || contentType === 'image/jpg') {
    // JPEG dimension detection is more complex
    // Would need proper JPEG parser
    return null;
  }
  
  return null;
}

/**
 * Check if media is already preserved
 */
async function checkExistingPreservation(url: string): Promise<MediaPreservationResult | null> {
  const { data, error } = await supabase
    .from('preserved_media')
    .select('*')
    .eq('original_url', url)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    ardrive_tx: data.ardrive_tx,
    ipfs_hash: data.ipfs_hash,
    content_type: data.content_type,
    file_size: data.file_size,
    dimensions: data.dimensions ? JSON.parse(data.dimensions) : undefined,
    thumbnail: data.thumbnail ? JSON.parse(data.thumbnail) : undefined,
  };
}

/**
 * Save preservation record to database
 */
async function savePreservationRecord(
  url: string,
  result: MediaPreservationResult
): Promise<void> {
  await supabase.from('preserved_media').insert({
    original_url: url,
    ardrive_tx: result.ardrive_tx,
    ipfs_hash: result.ipfs_hash,
    supabase_url: null, // Would be added if using Supabase Storage
    content_type: result.content_type,
    file_size: result.file_size,
    dimensions: result.dimensions ? JSON.stringify(result.dimensions) : null,
    thumbnail: result.thumbnail ? JSON.stringify(result.thumbnail) : null,
    preserved_at: new Date().toISOString(),
  });
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
    const { url } = JSON.parse(event.body || '{}');
    
    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL is required' }),
      };
    }

    console.log('📥 Preserving media:', url);

    // Check if already preserved
    const existing = await checkExistingPreservation(url);
    if (existing) {
      console.log('✅ Media already preserved');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(existing),
      };
    }

    // Download media
    const { buffer, contentType, size } = await downloadMedia(url);
    console.log(`📊 Downloaded: ${contentType}, ${size} bytes`);

    // Check if supported type
    if (!SUPPORTED_TYPES.includes(contentType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: `Unsupported media type: ${contentType}` 
        }),
      };
    }

    // Get dimensions for images
    const dimensions = await getImageDimensions(buffer, contentType);

    // Store in multiple locations for redundancy
    const [ardriveResult, ipfsResult] = await Promise.all([
      storeOnArDrive(buffer, contentType),
      storeOnIPFS(buffer, contentType, `media_${Date.now()}`),
      storeInSupabase(buffer, contentType, url),
    ]);

    const result: MediaPreservationResult = {
      ardrive_tx: ardriveResult || undefined,
      ipfs_hash: ipfsResult || undefined,
      content_type: contentType,
      file_size: size,
      dimensions: dimensions || undefined,
    };

    // Save preservation record
    await savePreservationRecord(url, result);

    console.log('✅ Media preserved successfully');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('❌ Media preservation failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to preserve media' 
      }),
    };
  }
};