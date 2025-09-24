import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with secret key for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

interface BatchProgress {
  total: number;
  processed: number;
  generated: number;
  errors: number;
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  errorDetails: Array<{ tokenId: number; error: string }>;
}

export const handler: Handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Simple auth check (you might want to enhance this)
  const authHeader = event.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_API_KEY}`) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    console.log('🎨 Starting batch cast image generation...');

    // Get all Cast evermarks without images
    const { data: castEvermarks, error: fetchError } = await supabase
      .from('beta_evermarks')
      .select('token_id, title, content_type, supabase_image_url, metadata_json')
      .eq('content_type', 'Cast')
      .or('supabase_image_url.is.null,supabase_image_url.eq.')
      .order('token_id', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch Cast evermarks: ${fetchError.message}`);
    }

    if (!castEvermarks || castEvermarks.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'No Cast evermarks need image generation',
          stats: { total: 0, processed: 0, generated: 0, errors: 0 }
        })
      };
    }

    const progress: BatchProgress = {
      total: castEvermarks.length,
      processed: 0,
      generated: 0,
      errors: 0,
      status: 'running',
      startTime: new Date().toISOString(),
      errorDetails: []
    };

    console.log(`📊 Found ${progress.total} Cast evermarks without images`);

    // Process in batches to avoid timeout (Netlify has 10s limit for functions)
    const batchSize = 5; // Conservative batch size
    const requestBody = JSON.parse(event.body || '{}');
    const startIndex = requestBody.startIndex || 0;
    const endIndex = Math.min(startIndex + batchSize, castEvermarks.length);
    
    console.log(`🔄 Processing batch ${startIndex}-${endIndex} of ${castEvermarks.length}`);

    for (let i = startIndex; i < endIndex; i++) {
      const evermark = castEvermarks[i];
      
      try {
        console.log(`🎯 Processing evermark ${evermark.token_id}: "${evermark.title}"`);

        // Call the existing cast image generation function
        const generateResponse = await fetch(`${process.env.URL}/.netlify/functions/generate-cast-image`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
          },
          body: JSON.stringify({ token_id: evermark.token_id }),
          signal: AbortSignal.timeout(15000) // 15 second timeout per generation
        });

        if (generateResponse.ok) {
          const result = await generateResponse.json();
          console.log(`✅ Generated image for evermark ${evermark.token_id}`);
          progress.generated++;
        } else {
          const errorText = await generateResponse.text();
          console.warn(`⚠️ Failed to generate image for evermark ${evermark.token_id}: ${errorText}`);
          progress.errors++;
          progress.errorDetails.push({
            tokenId: evermark.token_id,
            error: `HTTP ${generateResponse.status}: ${errorText}`
          });
        }

      } catch (error) {
        console.error(`❌ Error processing evermark ${evermark.token_id}:`, error);
        progress.errors++;
        progress.errorDetails.push({
          tokenId: evermark.token_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      progress.processed++;
      
      // Log progress
      console.log(`📈 Progress: ${progress.processed}/${progress.total} (Generated: ${progress.generated}, Errors: ${progress.errors})`);
    }

    // Update progress status
    if (endIndex >= castEvermarks.length) {
      progress.status = 'completed';
      progress.endTime = new Date().toISOString();
    }

    const isComplete = endIndex >= castEvermarks.length;
    const nextBatch = isComplete ? null : endIndex;

    console.log(`🎉 Batch complete! Generated: ${progress.generated}, Errors: ${progress.errors}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        progress,
        isComplete,
        nextBatch,
        message: isComplete 
          ? `Batch generation completed! Generated ${progress.generated} images with ${progress.errors} errors.`
          : `Batch ${startIndex}-${endIndex} completed. Continue with batch ${nextBatch}.`
      })
    };

  } catch (error) {
    console.error('❌ Batch generation failed:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Batch cast image generation failed'
      })
    };
  }
};