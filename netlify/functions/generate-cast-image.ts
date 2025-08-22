import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with secret key for storage access
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

// We'll use a Canvas library that works in Node.js
const { createCanvas, registerFont } = require('canvas');

function generateCastImage(castData: any): Buffer {
  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext('2d');

  // Clear canvas with white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 800, 400);

  // Draw purple header bar (Farcaster brand color)
  ctx.fillStyle = '#8b5cf6';
  ctx.fillRect(0, 0, 800, 60);

  // Draw "Farcaster" label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.fillText('Farcaster Cast', 20, 40);

  // Draw author info
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 20px Arial';
  ctx.fillText(castData.author_display_name || castData.author_username, 30, 100);
  
  ctx.fillStyle = '#6b7280';
  ctx.font = '16px Arial';
  ctx.fillText(`@${castData.author_username}`, 30, 125);

  // Draw cast text (with word wrapping)
  ctx.fillStyle = '#111827';
  ctx.font = '18px Arial';
  wrapText(ctx, castData.text, 30, 160, 740, 25);

  // Draw engagement metrics at bottom
  if (castData.likes !== undefined && castData.recasts !== undefined) {
    ctx.fillStyle = '#6b7280';
    ctx.font = '14px Arial';
    const metricsText = `❤️ ${castData.likes} likes  •  🔄 ${castData.recasts} recasts`;
    ctx.fillText(metricsText, 30, 360);
  }

  // Draw timestamp if available
  if (castData.timestamp) {
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px Arial';
    const date = new Date(castData.timestamp);
    const dateStr = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    ctx.fillText(dateStr, 30, 380);
  }

  // Add border
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 798, 398);

  return canvas.toBuffer('image/png');
}

function wrapText(ctx: any, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && i > 0) {
      ctx.fillText(line, x, currentY);
      line = words[i] + ' ';
      currentY += lineHeight;
      
      // Stop if we're getting too close to the bottom
      if (currentY > 320) {
        ctx.fillText('...', x, currentY);
        break;
      }
    } else {
      line = testLine;
    }
  }
  
  if (currentY <= 320) {
    ctx.fillText(line, x, currentY);
  }
}

export const handler: Handler = async (event, context) => {
  console.log('🎨 Generating cast preview image for Evermark #3');

  try {
    const tokenId = 3;
    
    // Get the current evermark data
    const { data: evermark, error: fetchError } = await supabase
      .from('beta_evermarks')
      .select('*')
      .eq('token_id', tokenId)
      .single();

    if (fetchError || !evermark) {
      throw new Error(`Failed to fetch evermark: ${fetchError?.message}`);
    }

    // Parse the metadata to get cast data
    let castData;
    try {
      const metadata = JSON.parse(evermark.metadata_json || '{}');
      castData = metadata.cast;
      if (!castData) {
        throw new Error('No cast data found in metadata');
      }
    } catch (parseError) {
      throw new Error(`Failed to parse metadata: ${parseError}`);
    }

    console.log('🎯 Cast data:', {
      text: castData.text?.substring(0, 50),
      author: castData.author_display_name,
      likes: castData.likes,
      recasts: castData.recasts
    });

    // Generate the cast preview image
    console.log('🖼️ Generating canvas image...');
    const imageBuffer = generateCastImage(castData);

    // Upload to Supabase storage
    const fileName = `evermarks/${tokenId}-cast-preview.png`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('evermark-images')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('evermark-images')
      .getPublicUrl(fileName);

    // Update the evermark with the new image URL
    const { error: updateError } = await supabase
      .from('beta_evermarks')
      .update({
        supabase_image_url: urlData.publicUrl,
        ipfs_image_hash: null, // Clear old IPFS hash
        updated_at: new Date().toISOString()
      })
      .eq('token_id', tokenId);

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log('✅ Cast preview image generated and uploaded successfully');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Cast preview image generated for Evermark #3',
        imageUrl: urlData.publicUrl,
        imageSize: imageBuffer.length
      })
    };

  } catch (error) {
    console.error('❌ Image generation failed:', error);
    
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