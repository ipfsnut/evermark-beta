// netlify/functions/ardrive-upload.ts
// ArDrive upload proxy for secure server-side uploads

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { ArDriveSeasonService } from '../lib/ArDriveSeasonService';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Wallet-Address',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface UploadRequest {
  image?: string; // base64 data URL
  metadata?: object;
  filename?: string;
  contentType?: string;
  tags?: Record<string, string>;
  uploadType: 'image' | 'metadata' | 'thumbnail';
  seasonNumber?: number;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
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
    console.log('🔄 ArDrive upload request received');

    // Check if ArDrive is enabled
    if (process.env.VITE_ARDRIVE_ENABLED !== 'true') {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: 'ArDrive uploads are currently disabled',
          backend: 'ipfs'
        }),
      };
    }

    // Parse request body
    const uploadRequest: UploadRequest = JSON.parse(event.body || '{}');
    
    if (!uploadRequest.uploadType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'uploadType is required (image, metadata, or thumbnail)' }),
      };
    }

    // Initialize ArDrive service
    const ardriveService = new ArDriveSeasonService();
    await ardriveService.initialize();

    // Process upload based on type
    let result;
    
    if (uploadRequest.uploadType === 'image' || uploadRequest.uploadType === 'thumbnail') {
      result = await handleImageUpload(ardriveService, uploadRequest, event);
    } else if (uploadRequest.uploadType === 'metadata') {
      result = await handleMetadataUpload(ardriveService, uploadRequest, event);
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid upload type. Must be: image, metadata, or thumbnail' }),
      };
    }

    console.log('✅ ArDrive upload completed:', result.txId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        txId: result.txId,
        url: result.url,
        ardriveUrl: result.url,
        season: result.season,
        cost: result.cost,
        size: result.size,
        timestamp: result.timestamp,
        folderPath: result.folderPath
      }),
    };

  } catch (error) {
    console.error('❌ ArDrive upload failed:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'ArDrive upload failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Please check your file format and size, or try again later'
      }),
    };
  }
};

/**
 * Handle image/thumbnail upload
 */
async function handleImageUpload(
  ardriveService: ArDriveSeasonService,
  uploadRequest: UploadRequest,
  event: HandlerEvent
) {
  if (!uploadRequest.image) {
    throw new Error('Image data is required for image uploads');
  }

  // Convert base64 to File object
  const base64Data = uploadRequest.image.includes(',') 
    ? uploadRequest.image.split(',')[1] 
    : uploadRequest.image;
  
  const imageBuffer = Buffer.from(base64Data, 'base64');
  
  // Determine content type
  let contentType = uploadRequest.contentType || 'image/jpeg';
  if (uploadRequest.image.includes('data:image/')) {
    const typeMatch = uploadRequest.image.match(/data:image\/([^;]+)/);
    if (typeMatch) {
      contentType = `image/${typeMatch[1]}`;
    }
  }
  
  // Create File object
  const filename = uploadRequest.filename || `evermark-${uploadRequest.uploadType}-${Date.now()}.jpg`;
  const imageFile = new File([imageBuffer], filename, { type: contentType });
  
  // Build tags
  const tags = {
    'Content-Type': contentType,
    'Original-Filename': uploadRequest.filename || filename,
    'Upload-Method': 'proxy',
    'Client-IP': getClientIP(event),
    ...(uploadRequest.tags || {})
  };

  // Upload to current season
  return await ardriveService.uploadToCurrentSeason(
    imageFile,
    uploadRequest.uploadType as 'image' | 'thumbnail',
    tags
  );
}

/**
 * Handle metadata upload
 */
async function handleMetadataUpload(
  ardriveService: ArDriveSeasonService,
  uploadRequest: UploadRequest,
  event: HandlerEvent
) {
  if (!uploadRequest.metadata) {
    throw new Error('Metadata is required for metadata uploads');
  }

  // Convert metadata to File object
  const metadataString = JSON.stringify(uploadRequest.metadata, null, 2);
  const metadataBuffer = Buffer.from(metadataString, 'utf-8');
  const filename = uploadRequest.filename || `evermark-metadata-${Date.now()}.json`;
  
  const metadataFile = new File([metadataBuffer], filename, { 
    type: 'application/json' 
  });
  
  // Build tags
  const tags = {
    'Content-Type': 'application/json',
    'Original-Filename': filename,
    'Upload-Method': 'proxy',
    'Client-IP': getClientIP(event),
    'Metadata-Title': (uploadRequest.metadata as any)?.name || 'Unknown',
    ...(uploadRequest.tags || {})
  };

  // Upload to current season
  return await ardriveService.uploadToCurrentSeason(
    metadataFile,
    'metadata',
    tags
  );
}

/**
 * Get client IP address for logging
 */
function getClientIP(event: HandlerEvent): string {
  return event.headers['x-forwarded-for'] || 
         event.headers['x-real-ip'] || 
         'unknown';
}

/**
 * Validate file size limits
 */
function validateFileSize(sizeBytes: number, type: string): void {
  const limits = {
    image: 10 * 1024 * 1024,      // 10MB for images
    thumbnail: 1 * 1024 * 1024,   // 1MB for thumbnails
    metadata: 100 * 1024          // 100KB for metadata
  };
  
  const limit = limits[type as keyof typeof limits] || limits.image;
  
  if (sizeBytes > limit) {
    throw new Error(`File too large. Maximum size for ${type}: ${(limit / 1024 / 1024).toFixed(1)}MB`);
  }
}

/**
 * Validate content type
 */
function validateContentType(contentType: string, uploadType: string): void {
  const allowedTypes = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    thumbnail: ['image/jpeg', 'image/png', 'image/webp'],
    metadata: ['application/json', 'text/plain']
  };
  
  const allowed = allowedTypes[uploadType as keyof typeof allowedTypes] || [];
  
  if (!allowed.includes(contentType)) {
    throw new Error(`Invalid content type for ${uploadType}. Allowed: ${allowed.join(', ')}`);
  }
}

/**
 * Sanitize filename
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100); // Limit length
}