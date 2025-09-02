// Check the metadata format in database for recovered tokens
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkMetadataFormat() {
  console.log('🔍 Checking metadata format in database...\n');
  
  // Check a few recovered tokens
  const tokens = [8, 9, 17, 18]; // Mix of recovered and newly created
  
  for (const tokenId of tokens) {
    console.log(`=== TOKEN ${tokenId} ===`);
    
    const { data: evermark, error } = await supabase
      .from('beta_evermarks')
      .select('token_id, title, author, metadata_json')
      .eq('token_id', tokenId)
      .single();
    
    if (error || !evermark) {
      console.log(`❌ Token ${tokenId} not found`);
      continue;
    }
    
    console.log(`Title: ${evermark.title}`);
    console.log(`Author: ${evermark.author}`);
    
    if (evermark.metadata_json) {
      try {
        const metadata = JSON.parse(evermark.metadata_json);
        console.log(`Metadata keys:`, Object.keys(metadata));
        
        // Check different possible locations for cast data
        if (metadata.cast) {
          console.log(`✅ Has metadata.cast:`, Object.keys(metadata.cast));
          console.log(`   Text: ${metadata.cast.text?.substring(0, 50)}...`);
        } else {
          console.log(`❌ No metadata.cast found`);
        }
        
        if (metadata.castData) {
          console.log(`✅ Has metadata.castData:`, Object.keys(metadata.castData));
          console.log(`   Content: ${metadata.castData.content?.substring(0, 50)}...`);
        } else {
          console.log(`❌ No metadata.castData found`);
        }
        
        if (metadata.customFields) {
          console.log(`✅ Has customFields:`, metadata.customFields.length, 'fields');
          const castFields = metadata.customFields.filter(f => f.key.startsWith('cast_'));
          console.log(`   Cast fields:`, castFields.map(f => f.key));
        } else {
          console.log(`❌ No customFields found`);
        }
        
      } catch (parseError) {
        console.log(`❌ Failed to parse metadata_json:`, parseError.message);
      }
    } else {
      console.log(`❌ No metadata_json found`);
    }
    
    console.log(''); // Empty line
  }
}

checkMetadataFormat().catch(console.error);