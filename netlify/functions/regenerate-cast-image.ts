import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export const handler: Handler = async (event, context) => {
  console.log('🔧 Setting up Evermark #3 for client-side image generation');

  try {
    // For now, just clear the image so the frontend will show a placeholder
    // The user can then use the new creation flow to generate a proper cast image
    const updateData = {
      supabase_image_url: null,
      ipfs_image_hash: null,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('beta_evermarks')
      .update(updateData)
      .eq('token_id', 3);

    if (updateError) {
      throw new Error(`Update failed: ${updateError.message}`);
    }

    console.log('✅ Cleared image for Evermark #3');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Evermark #3 image cleared - ready for new cast image generation',
        note: 'Use the creation form with the Farcaster URL to generate a proper cast preview'
      })
    };

  } catch (error) {
    console.error('❌ Update failed:', error);
    
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