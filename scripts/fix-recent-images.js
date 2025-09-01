// Fix recent evermarks missing image hashes
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

function extractIpfsHash(imageUrl) {
  if (!imageUrl) return null;
  
  // Handle ipfs:// URLs
  if (imageUrl.startsWith('ipfs://')) {
    return imageUrl.replace('ipfs://', '');
  }
  
  // Handle gateway URLs
  const match = imageUrl.match(/\/ipfs\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

async function fixRecentImages() {
  console.log('🔧 Fixing image hashes for recent evermarks...');
  
  // Get recent evermarks with null image hashes
  const { data: evermarks, error } = await supabase
    .from('beta_evermarks')
    .select('token_id, token_uri, metadata_json')
    .is('ipfs_image_hash', null)
    .order('token_id', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error('Failed to fetch evermarks:', error);
    return;
  }
  
  console.log(`Found ${evermarks.length} evermarks to fix`);
  
  for (const evermark of evermarks) {
    try {
      console.log(`Processing token ${evermark.token_id}...`);
      
      // Fetch metadata from IPFS
      const metadataUrl = evermark.token_uri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
      const response = await fetch(metadataUrl);
      const metadata = await response.json();
      
      console.log(`Metadata for ${evermark.token_id}:`, metadata);
      
      // Extract image hash
      const imageHash = extractIpfsHash(metadata.image);
      
      if (imageHash) {
        // Update database
        const { error: updateError } = await supabase
          .from('beta_evermarks')
          .update({
            ipfs_image_hash: imageHash,
            image_processing_status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('token_id', evermark.token_id);
          
        if (updateError) {
          console.error(`Failed to update token ${evermark.token_id}:`, updateError);
        } else {
          console.log(`✅ Updated token ${evermark.token_id} with image hash: ${imageHash}`);
        }
      } else {
        console.log(`❌ No image found for token ${evermark.token_id}`);
      }
      
    } catch (error) {
      console.error(`Error processing token ${evermark.token_id}:`, error);
    }
  }
  
  console.log('🎉 Image hash fixing complete!');
}

fixRecentImages().catch(console.error);