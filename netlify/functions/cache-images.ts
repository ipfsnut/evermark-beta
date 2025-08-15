// Background job for caching evermark images (simple download and store)
import { Handler } from '@netlify/functions';
import { getEvermarksNeedingCache } from '../../src/lib/chain-sync';
import { cacheImage } from '../../src/lib/image-cache';
import { supabase } from '../../src/lib/supabase';

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

        const result = await cacheImage(evermark.token_id, evermark.processed_image_url);
        
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
 * Get specific evermarks for manual caching
 */
async function getSpecificEvermarksForCache(tokenIds: number[]) {
  const { data, error } = await supabase!
    .from('evermarks')
    .select('token_id, processed_image_url, ipfs_image_hash')
    .in('token_id', tokenIds)
    .not('processed_image_url', 'is', null);

  if (error) {
    console.error('Failed to get specific evermarks:', error);
    return [];
  }
  
  return data || [];
}