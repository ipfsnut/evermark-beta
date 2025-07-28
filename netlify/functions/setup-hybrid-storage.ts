import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    console.log('🔧 Setting up hybrid image storage...');
    
    const results = {
      columnUpdates: [],
      indexCreation: [],
      dataUpdates: [],
      errors: []
    };

    // Step 1: Add hybrid image storage columns
    const columnUpdates = [
      'ALTER TABLE evermarks ADD COLUMN IF NOT EXISTS supabase_image_url TEXT',
      'ALTER TABLE evermarks ADD COLUMN IF NOT EXISTS thumbnail_url TEXT', 
      'ALTER TABLE evermarks ADD COLUMN IF NOT EXISTS ipfs_image_hash TEXT',
      'ALTER TABLE evermarks ADD COLUMN IF NOT EXISTS image_file_size INTEGER',
      'ALTER TABLE evermarks ADD COLUMN IF NOT EXISTS image_dimensions TEXT'
    ];

    for (const sql of columnUpdates) {
      try {
        await supabase.rpc('exec_sql', { sql_query: sql });
        results.columnUpdates.push(`✅ ${sql}`);
      } catch (error) {
        results.errors.push(`❌ Column update failed: ${error}`);
      }
    }

    // Step 2: Create indexes for better performance  
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_evermarks_supabase_images ON evermarks(supabase_image_url) WHERE supabase_image_url IS NOT NULL',
      'CREATE INDEX IF NOT EXISTS idx_evermarks_image_processing ON evermarks(image_processing_status, image_processed_at)'
    ];

    for (const sql of indexQueries) {
      try {
        await supabase.rpc('exec_sql', { sql_query: sql });
        results.indexCreation.push(`✅ ${sql}`);
      } catch (error) {
        results.errors.push(`❌ Index creation failed: ${error}`);
      }
    }

    // Step 3: Update existing records to use supabase_image_url as primary
    try {
      const { data, error } = await supabase
        .from('evermarks')
        .update({ 
          supabase_image_url: supabase.rpc('processed_image_url') 
        })
        .like('processed_image_url', '%supabase%')
        .is('supabase_image_url', null);

      if (error) {
        results.errors.push(`❌ Data update failed: ${error.message}`);
      } else {
        results.dataUpdates.push(`✅ Updated existing Supabase URLs`);
      }
    } catch (error) {
      results.errors.push(`❌ Data update failed: ${error}`);
    }

    // Step 4: Check storage bucket setup
    try {
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        results.errors.push(`❌ Storage check failed: ${bucketsError.message}`);
      } else {
        const evermarkBucket = buckets?.find(b => b.id === 'evermark-images');
        if (evermarkBucket) {
          results.dataUpdates.push('✅ Storage bucket exists');
        } else {
          results.errors.push('⚠️ Storage bucket "evermark-images" not found - create in Supabase dashboard');
        }
      }
    } catch (error) {
      results.errors.push(`❌ Storage check failed: ${error}`);
    }

    const success = results.errors.length === 0;

    return {
      statusCode: success ? 200 : 500,
      headers,
      body: JSON.stringify({
        success,
        message: success ? 'Hybrid storage setup completed' : 'Setup completed with errors',
        results,
        nextSteps: success ? [
          '1. Verify storage bucket policies in Supabase dashboard',
          '2. Test image upload with new components',
          '3. Monitor hybrid storage usage'
        ] : [
          '1. Check Supabase permissions for DDL operations',
          '2. Manually run SQL commands in Supabase SQL editor',
          '3. Create storage bucket if missing'
        ]
      }),
    };

  } catch (error) {
    console.error('❌ Hybrid storage setup failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Setup failed',
        note: 'You may need to run these SQL commands manually in Supabase dashboard'
      }),
    };
  }
};
