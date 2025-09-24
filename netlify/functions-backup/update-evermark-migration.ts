// Admin function to update evermark with ArDrive migration data
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
    const body = JSON.parse(event.body || '{}');
    const { token_id, migration_data } = body;

    if (!token_id || !migration_data) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required fields: token_id, migration_data' 
        })
      };
    }

    console.log(`🔄 Updating evermark #${token_id} with ArDrive migration data`);

    // Update the evermark record with ArDrive data in metadata_json
    const existingData = await supabase
      .from('beta_evermarks')
      .select('metadata_json')
      .eq('token_id', token_id)
      .single();

    let currentMetadata = {};
    try {
      currentMetadata = JSON.parse(existingData.data?.metadata_json || '{}');
    } catch (e) {
      console.warn('Could not parse existing metadata_json, starting fresh');
    }

    // Merge ArDrive migration data into metadata
    const updatedMetadata = {
      ...currentMetadata,
      ardrive_migration: {
        image_tx: migration_data.ardrive_image_tx,
        metadata_tx: migration_data.ardrive_metadata_tx,
        storage_backend: migration_data.storage_backend,
        new_token_uri: migration_data.token_uri,
        migration_status: migration_data.migration_status,
        migration_date: migration_data.migration_date,
        method: 'manual_reconstruction'
      }
    };

    const { data, error } = await supabase
      .from('beta_evermarks')
      .update({
        token_uri: migration_data.token_uri,
        metadata_json: JSON.stringify(updatedMetadata),
        updated_at: new Date().toISOString()
      })
      .eq('token_id', token_id)
      .select()
      .single();

    if (error) {
      console.error('Database update error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Database update failed',
          details: error.message 
        })
      };
    }

    console.log(`✅ Successfully updated evermark #${token_id}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Evermark #${token_id} migration data updated successfully`,
        data: data
      })
    };

  } catch (error) {
    console.error('Update failed:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};