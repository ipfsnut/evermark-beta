import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with secret key for storage access
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

import sharp from 'sharp';

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
    return c;
  });
}

function wrapText(text: string, maxLength: number = 80): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + word).length > maxLength && currentLine.length > 0) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }
  
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }
  
  return lines.slice(0, 8); // Limit to 8 lines
}

async function generateCastImage(castData: any): Promise<Buffer> {
  const wrappedText = wrapText(castData.text || 'No text available', 70);
  const textLines = wrappedText.map((line, index) => 
    `<text x="30" y="${160 + index * 25}" font-family="Arial, sans-serif" font-size="18" fill="#111827">${escapeXml(line)}</text>`
  ).join('\n    ');

  const date = castData.timestamp ? new Date(castData.timestamp) : new Date();
  const dateStr = date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });

  const svg = `
<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="800" height="400" fill="white"/>
  
  <!-- Header bar -->
  <rect width="800" height="60" fill="#8b5cf6"/>
  
  <!-- Farcaster label -->
  <text x="20" y="40" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white">Farcaster Cast</text>
  
  <!-- Author info -->
  <text x="30" y="100" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#1f2937">${escapeXml(castData.author_display_name || castData.author_username || 'Unknown')}</text>
  <text x="30" y="125" font-family="Arial, sans-serif" font-size="16" fill="#6b7280">@${escapeXml(castData.author_username || 'unknown')}</text>
  
  <!-- Cast text -->
  ${textLines}
  
  <!-- Engagement metrics -->
  ${castData.likes !== undefined && castData.recasts !== undefined ? 
    `<text x="30" y="360" font-family="Arial, sans-serif" font-size="14" fill="#6b7280">❤️ ${castData.likes} likes  •  🔄 ${castData.recasts} recasts</text>` : 
    ''
  }
  
  <!-- Timestamp -->
  <text x="30" y="380" font-family="Arial, sans-serif" font-size="12" fill="#9ca3af">${escapeXml(dateStr)}</text>
  
  <!-- Border -->
  <rect x="1" y="1" width="798" height="398" fill="none" stroke="#e5e7eb" stroke-width="2"/>
</svg>`;

  return await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
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
    console.log('🖼️ Generating SVG image...');
    const imageBuffer = await generateCastImage(castData);

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