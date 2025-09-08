// Background job for caching evermark images (simple download and store)
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// Beta table name - using beta_evermarks instead of alpha evermarks table
const EVERMARKS_TABLE = 'beta_evermarks';

// Initialize Supabase for serverless function with secret key for storage access
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export const handler: Handler = async (event, context) => {
  console.log('🔄 Image caching job started');

  try {
    // Parse request body for specific tokenIds
    const body = event.body ? JSON.parse(event.body) : {};
    const specificTokenIds = body.tokenIds as number[] | undefined;

    let pending;
    
    if (specificTokenIds?.length) {
      // Handle specific tokenIds from manual trigger
      console.log(`🎯 Manual trigger for specific tokenIds: ${specificTokenIds.join(', ')}`);
      pending = await getSpecificEvermarksForCache(specificTokenIds);
    } else {
      // Get all pending evermarks
      pending = await getEvermarksNeedingCache();
    }
    
    console.log(`📋 Found ${pending.length} evermarks needing cache`);

    if (pending.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          message: 'No pending images to cache',
          cached: 0
        })
      };
    }

    let cached = 0;
    let failed = 0;
    const errors: string[] = [];

    // Cache each evermark (max 10 at a time to avoid timeouts)
    for (const evermark of pending.slice(0, 10)) {
      try {
        console.log(`📥 Caching tokenId ${evermark.token_id}`);

        // Build IPFS URL from hash for caching
        const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${evermark.ipfs_image_hash}`;
        const result = await cacheImage(evermark.token_id, ipfsUrl);
        
        if (result.success) {
          cached++;
          console.log(`✅ Successfully cached tokenId ${evermark.token_id}`);
        } else {
          failed++;
          errors.push(`TokenId ${evermark.token_id}: ${result.error}`);
          console.error(`❌ Failed to cache tokenId ${evermark.token_id}:`, result.error);
        }

      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`TokenId ${evermark.token_id}: ${errorMsg}`);
        console.error(`❌ Failed to cache tokenId ${evermark.token_id}:`, error);
      }
    }

    console.log(`🎉 Caching complete: ${cached} success, ${failed} failed`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        cached,
        failed,
        errors: errors.slice(0, 10) // Limit error list
      })
    };

  } catch (error) {
    console.error('❌ Image caching job failed:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Get evermarks that need image caching
 */
async function getEvermarksNeedingCache() {
  const { data, error } = await supabase
    .from(EVERMARKS_TABLE)
    .select('token_id, ipfs_image_hash')
    .is('supabase_image_url', null) // Need caching if no Supabase URL
    .not('ipfs_image_hash', 'is', null) // But have IPFS hash
    .limit(20);

  if (error) return [];
  return data || [];
}

/**
 * Get specific evermarks for manual caching
 */
async function getSpecificEvermarksForCache(tokenIds: number[]) {
  console.log('🔍 Looking for token IDs:', tokenIds);
  
  const { data, error } = await supabase
    .from(EVERMARKS_TABLE)
    .select('token_id, ipfs_image_hash, supabase_image_url')
    .in('token_id', tokenIds)
    .not('ipfs_image_hash', 'is', null);

  if (error) {
    console.error('Failed to get specific evermarks:', error);
    return [];
  }
  
  console.log('🔍 Found evermarks:', data);
  
  // For manual triggers, force re-cache even if supabase_image_url exists
  // This allows us to fix incorrectly processed images
  const needsCaching = (data || []); // Don't filter out existing URLs for manual triggers
  
  console.log('🔍 Need caching:', needsCaching);
  
  return needsCaching;
}

/**
 * Cache image from IPFS/Pinata to Supabase storage
 * Enhanced with proper content-type detection and book cover optimization
 */
async function cacheImage(tokenId: number, originalUrl: string) {
  try {
    // Try multiple gateways for download
    const downloadUrls = [
      originalUrl,
      originalUrl.replace('gateway.pinata.cloud', 'ipfs.io'),
      originalUrl.replace('gateway.pinata.cloud', 'cloudflare-ipfs.com')
    ];

    let imageBuffer: ArrayBuffer | null = null;
    let originalContentType = 'image/jpeg'; // Default fallback
    
    // Try each gateway
    for (const url of downloadUrls) {
      try {
        const response = await fetch(url, { 
          signal: AbortSignal.timeout(10000) // 10s timeout
        });
        
        if (response.ok) {
          imageBuffer = await response.arrayBuffer();
          // Preserve original content type
          originalContentType = response.headers.get('content-type') || 'image/jpeg';
          console.log(`📥 Downloaded image: ${imageBuffer.byteLength} bytes, type: ${originalContentType}`);
          break;
        }
      } catch (error) {
        console.warn(`Failed to download from ${url}:`, error);
        continue;
      }
    }

    if (!imageBuffer) {
      throw new Error('Failed to download from all gateways');
    }

    // Get evermark content type to determine if this is a book cover
    const { data: evermark } = await supabase
      .from(EVERMARKS_TABLE)
      .select('content_type')
      .eq('token_id', tokenId)
      .single();

    const isBookCover = evermark?.content_type === 'README' || evermark?.content_type === 'ISBN';
    
    // Determine optimal file extension and content type
    let fileExtension: string;
    let finalContentType: string;

    if (originalContentType.includes('png')) {
      // Preserve PNG for transparency (important for some book covers)
      fileExtension = 'png';
      finalContentType = 'image/png';
    } else if (originalContentType.includes('webp')) {
      // Convert WebP to PNG for better compatibility while preserving quality
      fileExtension = 'png';
      finalContentType = 'image/png';
    } else if (originalContentType.includes('avif')) {
      // FIXED: Handle AVIF images properly - preserve as PNG to avoid browser issues
      fileExtension = 'png';
      finalContentType = 'image/png';
      console.log(`📚 Converting AVIF to PNG for better browser compatibility: #${tokenId}`);
    } else {
      // Use JPEG for photos and other images
      fileExtension = 'jpg';
      finalContentType = 'image/jpeg';
    }

    // For book covers, prefer PNG to preserve text clarity and potential transparency
    if (isBookCover && originalContentType.includes('png')) {
      console.log(`📚 Preserving PNG format for book cover #${tokenId}`);
    } else if (isBookCover && !originalContentType.includes('png')) {
      console.log(`📚 Book cover #${tokenId} detected, keeping original format: ${originalContentType}`);
    }

    // Process image if format conversion is needed
    let finalImageBuffer: Buffer = Buffer.from(imageBuffer);
    
    if (originalContentType.includes('avif') || originalContentType.includes('webp')) {
      console.log(`🔄 Converting ${originalContentType} to ${finalContentType} for tokenId #${tokenId}`);
      try {
        // Convert to the target format while preserving aspect ratio
        finalImageBuffer = await sharp(imageBuffer)
          .png({ quality: 95 }) // High quality PNG for book covers
          .toBuffer();
        console.log(`✅ Successfully converted image: ${originalContentType} -> ${finalContentType}`);
      } catch (error) {
        console.warn(`⚠️ Image conversion failed, using original: ${error}`);
        finalImageBuffer = Buffer.from(imageBuffer); // Fall back to original if conversion fails
      }
    }

    const fileName = `evermarks/${tokenId}.${fileExtension}`;
    console.log(`💾 Storing as: ${fileName} (${finalContentType})`);

    const { data, error } = await supabase.storage
      .from('evermark-images')
      .upload(fileName, finalImageBuffer, {
        contentType: finalContentType,
        upsert: true
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('evermark-images')
      .getPublicUrl(fileName);

    // Update database with cached image URL
    await supabase
      .from(EVERMARKS_TABLE)
      .update({
        supabase_image_url: urlData.publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('token_id', tokenId);

    console.log(`✅ Successfully cached ${isBookCover ? 'book cover' : 'image'} #${tokenId}: ${urlData.publicUrl}`);
    return { success: true, url: urlData.publicUrl };

  } catch (error) {
    // Don't mark as failed - just return error for retry later
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}