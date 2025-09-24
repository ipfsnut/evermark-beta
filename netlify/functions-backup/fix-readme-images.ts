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
    console.log('🔧 Starting README book image fix process...');

    // Get all README books (content_type = 'README')
    const { data: readmeBooks, error } = await supabase
      .from('beta_evermarks')
      .select('token_id, ipfs_image_hash, supabase_image_url, content_type')
      .eq('content_type', 'README')
      .not('ipfs_image_hash', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch README books: ${error.message}`);
    }

    console.log(`📚 Found ${readmeBooks?.length || 0} README books to process`);

    if (!readmeBooks || readmeBooks.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'No README books found to fix',
          processed: 0
        })
      };
    }

    // Process README books in batches to avoid timeouts
    const batchSize = 5;
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < readmeBooks.length; i += batchSize) {
      const batch = readmeBooks.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(readmeBooks.length / batchSize)}`);

      // Process batch in parallel
      const batchPromises = batch.map(async (book) => {
        try {
          console.log(`🔄 Re-caching README book #${book.token_id}`);

          // Trigger re-cache via the cache-images function
          const response = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/cache-images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trigger: 'fix-readme-images',
              tokenIds: [book.token_id]
            })
          });

          if (!response.ok) {
            throw new Error(`Cache request failed: ${response.status}`);
          }

          const result = await response.json();
          
          if (result.success && result.cached > 0) {
            console.log(`✅ Successfully re-cached README book #${book.token_id}`);
            return { success: true, tokenId: book.token_id };
          } else {
            throw new Error(`Cache operation failed: ${result.errors?.[0] || 'Unknown error'}`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ Failed to re-cache README book #${book.token_id}:`, errorMsg);
          return { success: false, tokenId: book.token_id, error: errorMsg };
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Count results
      for (const result of batchResults) {
        if (result.success) {
          processed++;
        } else {
          failed++;
          errors.push(`Token #${result.tokenId}: ${result.error}`);
        }
      }

      // Add delay between batches to avoid overwhelming the system
      if (i + batchSize < readmeBooks.length) {
        console.log('⏳ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`🎉 README book image fix complete: ${processed} processed, ${failed} failed`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `README book image fix complete`,
        totalFound: readmeBooks.length,
        processed,
        failed,
        errors: errors.slice(0, 10) // Limit error list
      })
    };

  } catch (error) {
    console.error('❌ README book image fix failed:', error);
    
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