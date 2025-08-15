// Background job for caching evermark images (simple download and store)
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

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
    .from('evermarks')
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
    .from('evermarks')
    .select('token_id, ipfs_image_hash, supabase_image_url')
    .in('token_id', tokenIds)
    .not('ipfs_image_hash', 'is', null);

  if (error) {
    console.error('Failed to get specific evermarks:', error);
    return [];
  }
  
  console.log('🔍 Found evermarks:', data);
  
  // Filter out ones that already have supabase URLs
  const needsCaching = (data || []).filter(item => !item.supabase_image_url);
  console.log('🔍 Need caching:', needsCaching);
  
  return needsCaching;
}

/**
 * Cache image from IPFS/Pinata to Supabase storage
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
    
    // Try each gateway
    for (const url of downloadUrls) {
      try {
        const response = await fetch(url, { 
          signal: AbortSignal.timeout(10000) // 10s timeout
        });
        
        if (response.ok) {
          imageBuffer = await response.arrayBuffer();
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

    // Store in Supabase (keep original filename/format)
    const fileName = `evermarks/${tokenId}.jpg`; // Simple naming
    const { data, error } = await supabase.storage
      .from('evermark-images')
      .upload(fileName, imageBuffer, {
        contentType: 'image/jpeg',
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
      .from('evermarks')
      .update({
        supabase_image_url: urlData.publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('token_id', tokenId);

    return { success: true, url: urlData.publicUrl };

  } catch (error) {
    // Don't mark as failed - just return error for retry later
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}