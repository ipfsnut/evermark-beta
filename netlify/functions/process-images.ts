// Background job for processing evermark images
import { Handler } from '@netlify/functions';
import fetch from 'node-fetch';
import { supabase } from '../../src/lib/supabase';
import { getPendingEvermarks } from '../../src/lib/images/chain-sync';
import { processImage, generateThumbnail, validateImage } from '../../src/lib/images/processor';
import { uploadImage, uploadThumbnail } from '../../src/lib/images/storage';

export const handler: Handler = async (event, context) => {
  console.log('🔄 Image processing job started');

  try {
    // Get pending evermarks
    const pending = await getPendingEvermarks();
    console.log(`📋 Found ${pending.length} pending evermarks`);

    if (pending.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          message: 'No pending images to process',
          processed: 0
        })
      };
    }

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process each evermark
    for (const evermark of pending.slice(0, 10)) { // Process max 10 at a time
      try {
        console.log(`🖼️  Processing tokenId ${evermark.token_id}`);

        // Mark as processing
        await updateProcessingStatus(evermark.token_id, 'processing');

        // Download image from IPFS/Pinata
        const imageBuffer = await downloadImage(evermark.processed_image_url);
        if (!imageBuffer) {
          throw new Error('Failed to download image');
        }

        // Validate image
        const validation = await validateImage(imageBuffer);
        if (!validation.valid) {
          throw new Error(`Invalid image: ${validation.error}`);
        }

        // Process main image
        const processedResult = await processImage(imageBuffer, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 85,
          format: 'jpeg'
        });

        if (!processedResult.success || !processedResult.buffer) {
          throw new Error(`Processing failed: ${processedResult.error}`);
        }

        // Upload main image
        const uploadResult = await uploadImage(
          evermark.token_id, 
          processedResult.buffer, 
          processedResult.contentType
        );

        if (!uploadResult.success || !uploadResult.url) {
          throw new Error(`Upload failed: ${uploadResult.error}`);
        }

        // Generate and upload thumbnail
        let thumbnailUrl: string | undefined;
        try {
          const thumbnailResult = await generateThumbnail(imageBuffer, 400);
          if (thumbnailResult.success && thumbnailResult.buffer) {
            const thumbUpload = await uploadThumbnail(
              evermark.token_id,
              thumbnailResult.buffer,
              thumbnailResult.contentType
            );
            if (thumbUpload.success) {
              thumbnailUrl = thumbUpload.url;
            }
          }
        } catch (thumbError) {
          console.warn(`Thumbnail generation failed for ${evermark.token_id}:`, thumbError);
          // Continue without thumbnail
        }

        // Update database with URLs
        const { error: updateError } = await supabase
          .from('evermarks')
          .update({
            supabase_image_url: uploadResult.url,
            thumbnail_url: thumbnailUrl,
            image_processing_status: 'completed',
            image_width: processedResult.dimensions?.width,
            image_height: processedResult.dimensions?.height,
            file_size_bytes: processedResult.buffer.length,
            updated_at: new Date().toISOString()
          })
          .eq('token_id', evermark.token_id);

        if (updateError) {
          throw new Error(`Database update failed: ${updateError.message}`);
        }

        processed++;
        console.log(`✅ Successfully processed tokenId ${evermark.token_id}`);

      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`TokenId ${evermark.token_id}: ${errorMsg}`);
        
        console.error(`❌ Failed to process tokenId ${evermark.token_id}:`, error);
        
        // Mark as failed
        await updateProcessingStatus(evermark.token_id, 'failed');
      }
    }

    console.log(`🎉 Processing complete: ${processed} success, ${failed} failed`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        processed,
        failed,
        errors: errors.slice(0, 10) // Limit error list
      })
    };

  } catch (error) {
    console.error('❌ Image processing job failed:', error);
    
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
 * Download image from URL with fallback gateways
 */
async function downloadImage(url: string): Promise<Buffer | null> {
  const gateways = [
    url, // Original URL
    url.replace('gateway.pinata.cloud', 'ipfs.io'), // IPFS.io fallback
    url.replace('gateway.pinata.cloud', 'cloudflare-ipfs.com') // Cloudflare fallback
  ];

  for (const gateway of gateways) {
    try {
      console.log(`📥 Trying to download from: ${gateway.substring(0, 50)}...`);
      
      const response = await fetch(gateway, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'Evermark-Bot/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = await response.buffer();
      console.log(`✅ Downloaded ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      console.warn(`❌ Failed to download from ${gateway}: ${error}`);
      continue;
    }
  }

  return null;
}

/**
 * Update processing status in database
 */
async function updateProcessingStatus(
  tokenId: number, 
  status: 'pending' | 'processing' | 'completed' | 'failed'
): Promise<void> {
  try {
    const { error } = await supabase
      .from('evermarks')
      .update({ 
        image_processing_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('token_id', tokenId);

    if (error) {
      console.error(`Failed to update status for ${tokenId}:`, error);
    }
  } catch (error) {
    console.error(`Failed to update status for ${tokenId}:`, error);
  }
}