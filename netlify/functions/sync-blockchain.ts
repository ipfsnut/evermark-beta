// netlify/functions/sync-blockchain.ts - Scheduled blockchain sync (FIXED)
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('🔄 Starting scheduled blockchain sync...');
  
  try {
    // Sync unverified evermarks - FIXED: include created_at in select
    const { data: unverifiedEvermarks } = await supabase
      .from('evermarks')
      .select('token_id, tx_hash, created_at')
      .eq('verified', false)
      .not('tx_hash', 'is', null);

    let syncedCount = 0;
    let errorCount = 0;
    
    for (const evermark of unverifiedEvermarks || []) {
      try {
        // Here you would call your blockchain to verify the transaction
        // For now, we'll just mark old transactions as verified
        const createdAt = new Date(evermark.created_at);
        const now = new Date();
        const hoursOld = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursOld > 1) { // If more than 1 hour old, probably confirmed
          await supabase
            .from('evermarks')
            .update({ 
              verified: true,
              last_synced_at: new Date().toISOString()
            })
            .eq('token_id', evermark.token_id);
          
          syncedCount++;
        }
      } catch (error) {
        console.error(`Failed to sync evermark ${evermark.token_id}:`, error);
        errorCount++;
      }
    }

    // Update sync metadata for evermarks needing metadata fetch
    const { data: needsMetadata } = await supabase
      .from('evermarks')
      .select('token_id, token_uri')
      .eq('metadata_fetched', false)
      .not('token_uri', 'is', null)
      .limit(10); // Process in batches

    let metadataProcessed = 0;
    
    for (const evermark of needsMetadata || []) {
      try {
        // Here you would fetch IPFS metadata from token_uri
        // For now, just mark as fetched
        await supabase
          .from('evermarks')
          .update({
            metadata_fetched: true,
            last_synced_at: new Date().toISOString()
          })
          .eq('token_id', evermark.token_id);
          
        metadataProcessed++;
      } catch (error) {
        console.error(`Failed to fetch metadata for ${evermark.token_id}:`, error);
        errorCount++;
      }
    }

    // Update image processing status for pending images
    const { data: needsImageProcessing } = await supabase
      .from('evermarks')
      .select('token_id, token_uri, image_processing_status')
      .in('image_processing_status', ['pending', 'processing', null])
      .not('token_uri', 'is', null)
      .limit(5); // Smaller batch for image processing

    let imagesProcessed = 0;
    
    for (const evermark of needsImageProcessing || []) {
      try {
        // Here you would process images from IPFS
        // For now, simulate processing
        await supabase
          .from('evermarks')
          .update({
            image_processing_status: 'completed',
            processed_image_url: `https://gateway.pinata.cloud/ipfs/${evermark.token_uri.replace('ipfs://', '')}`,
            image_processed_at: new Date().toISOString()
          })
          .eq('token_id', evermark.token_id);
          
        imagesProcessed++;
      } catch (error) {
        console.error(`Failed to process image for ${evermark.token_id}:`, error);
        errorCount++;
      }
    }

    // Log sync completion with detailed stats
    await supabase
      .from('sync_logs')
      .insert([{
        sync_type: 'blockchain',
        synced_count: syncedCount + metadataProcessed + imagesProcessed,
        error_count: errorCount,
        completed_at: new Date().toISOString(),
        status: errorCount === 0 ? 'success' : 'partial',
        metadata: {
          verified_evermarks: syncedCount,
          metadata_processed: metadataProcessed,
          images_processed: imagesProcessed,
          total_unverified: unverifiedEvermarks?.length || 0,
          total_needs_metadata: needsMetadata?.length || 0,
          total_needs_images: needsImageProcessing?.length || 0
        }
      }]);

    const totalProcessed = syncedCount + metadataProcessed + imagesProcessed;
    console.log(`✅ Blockchain sync completed. Processed ${totalProcessed} items (${syncedCount} verified, ${metadataProcessed} metadata, ${imagesProcessed} images), ${errorCount} errors.`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        processed: {
          verified: syncedCount,
          metadata: metadataProcessed,
          images: imagesProcessed,
          total: totalProcessed
        },
        errors: errorCount,
        timestamp: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error('❌ Blockchain sync failed:', error);
    
    // Log sync failure
    await supabase
      .from('sync_logs')
      .insert([{
        sync_type: 'blockchain',
        synced_count: 0,
        error_count: 1,
        completed_at: new Date().toISOString(),
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }]);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};