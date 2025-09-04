import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event, context) => {
  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Allow GET for easy browser access
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('🔧 Starting automated metadata repair...');

    // Get all evermarks with potentially broken metadata
    const { data: evermarks, error: fetchError } = await supabase
      .from('beta_evermarks')
      .select('token_id, metadata_json, content_type')
      .not('metadata_json', 'is', null);

    if (fetchError) {
      throw new Error(`Failed to fetch evermarks: ${fetchError.message}`);
    }

    const repairedTokens: number[] = [];
    const imageGenTokens: number[] = [];
    let totalFixed = 0;

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
              // Parse again to get the actual object
              const actualMetadata = JSON.parse(firstParse);
              metadata = JSON.stringify(actualMetadata);
              needsRepair = true;
            }
          } catch (e) {
            // Invalid JSON, skip
            continue;
          }
        }

        if (needsRepair) {
          // Update with fixed metadata
          const { error: updateError } = await supabase
            .from('beta_evermarks')
            .update({ 
              metadata_json: metadata,
              updated_at: new Date().toISOString()
            })
            .eq('token_id', evermark.token_id);

          if (!updateError) {
            repairedTokens.push(evermark.token_id);
            totalFixed++;

            // Check if it's a Cast that needs image generation
            if (evermark.content_type === 'Cast') {
              imageGenTokens.push(evermark.token_id);
              
              // Trigger image generation
              try {
                const baseUrl = process.env.URL || `https://${process.env.SITE_NAME}.netlify.app`;
                await fetch(`${baseUrl}/.netlify/functions/generate-cast-image`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token_id: evermark.token_id })
                });
                console.log(`✅ Triggered image gen for token ${evermark.token_id}`);
              } catch (e) {
                console.warn(`Failed to generate image for ${evermark.token_id}`);
              }
            }
          }
        }
      } catch (error) {
        console.error(`Failed to process token ${evermark.token_id}:`, error);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Repair complete! Fixed ${totalFixed} evermarks. ${imageGenTokens.length} Cast images regenerated.`,
        totalChecked: evermarks?.length || 0,
        totalFixed,
        repairedTokens,
        imageGenTokens
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Repair failed'
      })
    };
  }
};