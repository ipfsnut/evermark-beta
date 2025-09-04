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

export const handler: Handler = async (event, context) => {
  // Handle preflight
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
    console.log('🔧 Starting metadata repair process...');

    // Get all evermarks with potentially broken metadata
    const { data: evermarks, error: fetchError } = await supabase
      .from('beta_evermarks')
      .select('token_id, metadata_json')
      .not('metadata_json', 'is', null);

    if (fetchError) {
      throw new Error(`Failed to fetch evermarks: ${fetchError.message}`);
    }

    console.log(`📊 Found ${evermarks?.length || 0} evermarks to check`);

    const repairedTokens: number[] = [];
    const failedTokens: { token_id: number; error: string }[] = [];

    for (const evermark of evermarks || []) {
      try {
        let metadata = evermark.metadata_json;
        let needsRepair = false;

        // Check if metadata is double-stringified
        if (typeof metadata === 'string') {
          try {
            // First parse
            const firstParse = JSON.parse(metadata);
            
            // Check if the result is still a string (double-stringified)
            if (typeof firstParse === 'string') {
              console.log(`🔄 Token ${evermark.token_id} has double-stringified metadata`);
              // Parse again to get the actual object
              const actualMetadata = JSON.parse(firstParse);
              metadata = JSON.stringify(actualMetadata); // Store as properly stringified JSON
              needsRepair = true;
            } else {
              // Metadata is correctly stringified, just needs to be re-stringified properly
              metadata = JSON.stringify(firstParse);
            }
          } catch (e) {
            console.log(`⚠️ Token ${evermark.token_id} has invalid JSON, skipping`);
            continue;
          }
        }

        if (needsRepair) {
          // Update the evermark with fixed metadata
          const { error: updateError } = await supabase
            .from('beta_evermarks')
            .update({ 
              metadata_json: metadata,
              updated_at: new Date().toISOString()
            })
            .eq('token_id', evermark.token_id);

          if (updateError) {
            throw new Error(`Update failed: ${updateError.message}`);
          }

          console.log(`✅ Repaired metadata for token ${evermark.token_id}`);
          repairedTokens.push(evermark.token_id);

          // Check if this is a Cast evermark that needs image generation
          const parsedMetadata = JSON.parse(metadata);
          // Also check the content_type in the database to make sure it's actually a Cast
          const { data: evermarkData } = await supabase
            .from('beta_evermarks')
            .select('content_type')
            .eq('token_id', evermark.token_id)
            .single();
          
          if (evermarkData?.content_type === 'Cast' && 
              (parsedMetadata.cast || parsedMetadata.castData || 
               (parsedMetadata.customFields && 
                parsedMetadata.customFields.some((f: any) => f.key === 'cast_author')))) {
            
            console.log(`🎨 Triggering cast image generation for token ${evermark.token_id}`);
            
            // Trigger image generation
            try {
              const response = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/generate-cast-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token_id: evermark.token_id })
              });

              if (!response.ok) {
                console.warn(`⚠️ Image generation failed for token ${evermark.token_id}`);
              } else {
                console.log(`✅ Cast image generated for token ${evermark.token_id}`);
              }
            } catch (imgError) {
              console.warn(`⚠️ Image generation error for token ${evermark.token_id}:`, imgError);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Failed to repair token ${evermark.token_id}:`, error);
        failedTokens.push({
          token_id: evermark.token_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Also trigger image caching for all repaired tokens
    if (repairedTokens.length > 0) {
      try {
        console.log(`📦 Triggering image cache for ${repairedTokens.length} repaired tokens`);
        await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/cache-images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            trigger: 'repair',
            tokenIds: repairedTokens 
          })
        });
      } catch (cacheError) {
        console.warn('⚠️ Cache trigger failed:', cacheError);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Metadata repair completed`,
        repaired: repairedTokens.length,
        repairedTokens,
        failed: failedTokens.length,
        failedTokens,
        totalChecked: evermarks?.length || 0
      })
    };

  } catch (error) {
    console.error('❌ Repair process failed:', error);
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