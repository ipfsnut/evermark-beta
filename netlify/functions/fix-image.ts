import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export const handler: Handler = async (event, context) => {
  console.log('🔧 Fixing image for Evermark #3');

  try {
    // Clear the old IPFS hash and ensure the correct image URL is used
    const updateData = {
      ipfs_image_hash: null, // Clear the old incorrect IPFS hash
      supabase_image_url: 'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/b663cd63-fecf-4d0f-7f87-0e0b6fd42800/original',
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('beta_evermarks')
      .update(updateData)
      .eq('token_id', 3);

    if (updateError) {
      throw new Error(`Update failed: ${updateError.message}`);
    }

    // Verify the update
    const { data: updatedRecord, error: fetchError } = await supabase
      .from('beta_evermarks')
      .select('token_id, supabase_image_url, ipfs_image_hash')
      .eq('token_id', 3)
      .single();

    if (fetchError) {
      throw new Error(`Failed to verify update: ${fetchError.message}`);
    }

    console.log('✅ Image fixed for Evermark #3');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Image URL fixed for Evermark #3',
        data: updatedRecord
      })
    };

  } catch (error) {
    console.error('❌ Fix failed:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};