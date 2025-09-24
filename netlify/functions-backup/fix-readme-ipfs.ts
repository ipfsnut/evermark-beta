import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Correct IPFS hashes from the actual NFT metadata on Polygon
const CORRECT_IPFS_HASHES = {
  22: {
    name: 'Further From Home',
    correctHash: 'QmZTabQ6SunKAUmzJD4TmTE3ER4wqJnpFbyo2KQE9aR3Vk',
    dimensions: '604x1000',
    aspectRatio: 0.604
  },
  23: {
    name: 'Think and Grow Rich',
    correctHash: 'QmVezaHQEvFbdspKEQ4ejxp1X69BfhgapUqZLt1XPYx46d',
    dimensions: '1202x1600', 
    aspectRatio: 0.75
  }
};

export const handler: Handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('🔧 Starting README book IPFS hash fix...');
    
    let updated = 0;
    const errors: string[] = [];

    // Update each README book with the correct IPFS hash
    for (const [tokenId, data] of Object.entries(CORRECT_IPFS_HASHES)) {
      try {
        console.log(`📚 Updating token ${tokenId} (${data.name})...`);
        console.log(`  New IPFS hash: ${data.correctHash}`);
        console.log(`  Expected dimensions: ${data.dimensions} (aspect ratio: ${data.aspectRatio})`);
        
        // Update the database with the correct IPFS hash and clear cached image
        const { error: updateError } = await supabase
          .from('beta_evermarks')
          .update({
            ipfs_image_hash: data.correctHash,
            supabase_image_url: null, // Clear cached image so it gets re-processed
            image_processing_status: null,
            updated_at: new Date().toISOString()
          })
          .eq('token_id', tokenId);
        
        if (updateError) {
          throw new Error(`Failed to update token ${tokenId}: ${updateError.message}`);
        }
        
        updated++;
        console.log(`✅ Successfully updated token ${tokenId} with correct IPFS hash`);
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Failed to update token ${tokenId}:`, errorMsg);
        errors.push(`Token ${tokenId}: ${errorMsg}`);
      }
    }

    console.log(`\n🎉 README book IPFS hash fix complete: ${updated} updated`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `README book IPFS hashes updated`,
        updated,
        errors
      })
    };

  } catch (error) {
    console.error('❌ README book IPFS hash fix failed:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    };
  }
};