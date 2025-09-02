// Test that generated images now contain actual cast content
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testImageContent() {
  console.log('🔍 Testing image content for a few tokens...\n');
  
  const testTokens = [8, 10, 17]; // Sample different tokens
  
  for (const tokenId of testTokens) {
    console.log(`=== TOKEN ${tokenId} ===`);
    
    const { data: evermark, error } = await supabase
      .from('beta_evermarks')
      .select('token_id, title, author, description, supabase_image_url, metadata_json')
      .eq('token_id', tokenId)
      .single();
    
    if (error || !evermark) {
      console.log(`❌ Token ${tokenId} not found`);
      continue;
    }
    
    console.log(`Title: ${evermark.title}`);
    console.log(`Author: ${evermark.author}`);
    console.log(`Description: ${evermark.description?.substring(0, 100)}...`);
    
    if (evermark.supabase_image_url) {
      console.log(`✅ Has generated image: ${evermark.supabase_image_url}`);
    } else {
      console.log(`❌ No generated image found`);
    }
    
    // Check what cast content should be in the image
    if (evermark.metadata_json) {
      try {
        const metadata = JSON.parse(evermark.metadata_json);
        
        if (metadata.castData?.content) {
          console.log(`📝 Expected content in image: "${metadata.castData.content.substring(0, 80)}..."`);
        } else if (metadata.cast?.text) {
          console.log(`📝 Expected content in image: "${metadata.cast.text.substring(0, 80)}..."`);
        } else {
          console.log(`❌ No cast content found in metadata`);
        }
        
      } catch (parseError) {
        console.log(`❌ Failed to parse metadata`);
      }
    }
    
    console.log(''); // Empty line
  }
}

testImageContent().catch(console.error);