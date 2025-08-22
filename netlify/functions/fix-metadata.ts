import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export const handler: Handler = async (event, context) => {
  console.log('🔧 Fixing metadata for Beta Evermarks');

  try {
    // Get all evermarks with their IPFS metadata
    const { data: evermarks, error: fetchError } = await supabase
      .from('beta_evermarks')
      .select('token_id, content_type, source_url, ipfs_metadata')
      .in('token_id', [1, 2, 3]);

    if (fetchError) {
      throw new Error(`Failed to fetch evermarks: ${fetchError.message}`);
    }

    let updated = 0;
    const updates: any[] = [];

    for (const evermark of evermarks || []) {
      const updateData: any = {};
      let needsUpdate = false;

      // Parse IPFS metadata if available
      if (evermark.ipfs_metadata) {
        try {
          const metadata = typeof evermark.ipfs_metadata === 'string' 
            ? JSON.parse(evermark.ipfs_metadata) 
            : evermark.ipfs_metadata;

          // Extract content type from metadata
          if (metadata.evermark?.contentType) {
            if (evermark.content_type !== metadata.evermark.contentType) {
              updateData.content_type = metadata.evermark.contentType;
              needsUpdate = true;
            }
          } else if (metadata.attributes) {
            const contentTypeAttr = metadata.attributes.find((attr: any) => 
              attr.trait_type === 'Content Type'
            );
            if (contentTypeAttr && contentTypeAttr.value !== evermark.content_type) {
              updateData.content_type = contentTypeAttr.value;
              needsUpdate = true;
            }
          }

          // Extract source URL from metadata
          if (metadata.external_url && evermark.source_url !== metadata.external_url) {
            updateData.source_url = metadata.external_url;
            needsUpdate = true;
          } else if (metadata.evermark?.sourceUrl && evermark.source_url !== metadata.evermark.sourceUrl) {
            updateData.source_url = metadata.evermark.sourceUrl;
            needsUpdate = true;
          }
        } catch (e) {
          console.error(`Failed to parse metadata for token ${evermark.token_id}:`, e);
        }
      }

      if (needsUpdate) {
        updateData.updated_at = new Date().toISOString();
        
        const { error: updateError } = await supabase
          .from('beta_evermarks')
          .update(updateData)
          .eq('token_id', evermark.token_id);

        if (updateError) {
          console.error(`Failed to update token ${evermark.token_id}:`, updateError);
        } else {
          updated++;
          updates.push({
            token_id: evermark.token_id,
            updates: updateData
          });
          console.log(`✅ Updated token ${evermark.token_id}:`, updateData);
        }
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        updated,
        updates
      })
    };

  } catch (error) {
    console.error('❌ Metadata fix failed:', error);
    
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