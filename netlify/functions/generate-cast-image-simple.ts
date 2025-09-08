import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with secret key for storage access
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

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

// Generate SVG image directly without sharp
function generateCastSVG(castData: any): string {
  // Format timestamp
  const date = castData.timestamp ? new Date(castData.timestamp) : new Date();
  const timeAgo = getTimeAgo(date);
  
  // Wrap text with better line breaking
  const wrappedText = wrapText(castData.text || 'No text available', 65);
  const maxLines = 6;
  const displayText = wrappedText.slice(0, maxLines);
  const hasMoreText = wrappedText.length > maxLines;
  
  // Generate text lines
  const textLines = displayText.map((line, index) => 
    `<text x="30" y="${180 + index * 28}" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="16" fill="#1F2937" font-weight="400">${escapeXml(line)}</text>`
  ).join('\n    ');
  
  // Add truncation indicator if text is cut off
  const truncationIndicator = hasMoreText ? 
    `<text x="30" y="${180 + displayText.length * 28}" font-family="Inter, sans-serif" font-size="16" fill="#9CA3AF" font-weight="400">...</text>` : '';

  const svg = `<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#F8FAFC;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FFFFFF;stop-opacity:1" />
    </linearGradient>
    
    <linearGradient id="headerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#8B5CF6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
    </linearGradient>
    
    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.1"/>
    </filter>
  </defs>
  
  <!-- Main card background -->
  <rect width="800" height="400" fill="url(#bgGradient)" rx="8" ry="8" filter="url(#cardShadow)"/>
  
  <!-- Header -->
  <rect width="800" height="60" fill="url(#headerGradient)" rx="8" ry="8"/>
  <rect width="800" height="52" y="8" fill="url(#headerGradient)"/>
  
  <text x="24" y="38" font-family="Inter, sans-serif" font-size="18" font-weight="600" fill="white">Farcaster Cast</text>
  <text x="720" y="38" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="#E2E8F0">Evermarks</text>
  
  <!-- Author section -->
  <rect x="16" y="76" width="768" height="64" fill="#FFFFFF" rx="8" ry="8" opacity="0.8"/>
  
  <!-- Author info -->
  <circle cx="46" cy="108" r="22" fill="#E5E7EB" stroke="#8B5CF6" stroke-width="2" opacity="0.2"/>
  <text x="46" y="114" font-family="Inter, sans-serif" font-size="16" font-weight="600" fill="#8B5CF6" text-anchor="middle">${escapeXml((castData.author_username || 'U').charAt(0).toUpperCase())}</text>
  
  <text x="78" y="100" font-family="Inter, sans-serif" font-size="18" font-weight="600" fill="#1F2937">${escapeXml(castData.author_display_name || castData.author_username || 'Unknown')}</text>
  <text x="78" y="118" font-family="Inter, sans-serif" font-size="14" font-weight="400" fill="#6B7280">@${escapeXml(castData.author_username || 'unknown')} • ${timeAgo}</text>
  
  <!-- Content section -->
  <rect x="16" y="156" width="768" height="180" fill="#FFFFFF" rx="8" ry="8" opacity="0.6"/>
  
  <!-- Cast text -->
  ${textLines}
  ${truncationIndicator}
  
  <!-- Engagement section -->
  <rect x="16" y="352" width="768" height="32" fill="#F8FAFC" rx="6" ry="6"/>
  
  ${castData.likes !== undefined || castData.recasts !== undefined || castData.replies !== undefined ? 
    `<text x="28" y="372" font-family="Inter, sans-serif" font-size="13" font-weight="500" fill="#6B7280">
       ${castData.likes !== undefined ? `❤️ ${formatNumber(castData.likes)}` : ''}
       ${castData.likes !== undefined && castData.recasts !== undefined ? '   ' : ''}
       ${castData.recasts !== undefined ? `🔄 ${formatNumber(castData.recasts)}` : ''}
       ${(castData.likes !== undefined || castData.recasts !== undefined) && castData.replies !== undefined ? '   ' : ''}
       ${castData.replies !== undefined ? `💬 ${formatNumber(castData.replies)}` : ''}
     </text>` : ''
  }
  
  <!-- Border -->
  <rect x="0" y="0" width="800" height="400" fill="none" stroke="#E5E7EB" stroke-width="1" rx="8" ry="8" opacity="0.5"/>
</svg>`;

  return svg;
}

// Format numbers for display
function formatNumber(num: number): string {
  if (num < 1000) return num.toString();
  if (num < 1000000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
}

// Get time ago string
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffHours < 1) return 'now';
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

export const handler: Handler = async (event, context) => {
  try {
    const requestBody = event.body ? JSON.parse(event.body) : {};
    const tokenId = requestBody.token_id || event.queryStringParameters?.token_id;
    
    if (!tokenId) {
      return {
        statusCode: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'token_id parameter is required'
        })
      };
    }

    console.log(`🎨 Generating cast image for Evermark #${tokenId}`);
    
    // Get the current evermark data
    const { data: evermark, error: fetchError } = await supabase
      .from('beta_evermarks')
      .select('*')
      .eq('token_id', parseInt(tokenId))
      .single();

    if (fetchError || !evermark) {
      throw new Error(`Failed to fetch evermark: ${fetchError?.message}`);
    }

    // Only generate cast images for Cast content type
    if (evermark.content_type !== 'Cast') {
      return {
        statusCode: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: `Cannot generate cast image for content type '${evermark.content_type}'. This function only works for Cast evermarks.`
        })
      };
    }

    // Parse the metadata to get cast data
    let castData;
    try {
      const metadata = JSON.parse(evermark.metadata_json || '{}');
      
      // Extract cast data from various formats
      castData = {
        text: metadata.cast?.text || evermark.description || 'No content available',
        author_username: metadata.cast?.author_username || 'unknown',
        author_display_name: metadata.cast?.author_display_name || metadata.cast?.author_username || 'Unknown',
        likes: metadata.cast?.likes || 0,
        recasts: metadata.cast?.recasts || 0,
        replies: metadata.cast?.replies || 0,
        timestamp: metadata.cast?.timestamp || new Date().toISOString()
      };
      
      console.log('📦 Cast data extracted:', castData);
    } catch (parseError) {
      throw new Error(`Failed to parse metadata: ${parseError}`);
    }

    // Generate the SVG
    const svgContent = generateCastSVG(castData);
    
    // Convert SVG to buffer
    const svgBuffer = Buffer.from(svgContent, 'utf-8');

    // Upload to Supabase storage as SVG
    const fileName = `evermarks/${tokenId}-cast-preview.svg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('evermark-images')
      .upload(fileName, svgBuffer, {
        contentType: 'image/svg+xml',
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
        updated_at: new Date().toISOString()
      })
      .eq('token_id', tokenId);

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log('✅ Cast image generated and uploaded successfully');

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: `Cast image generated for Evermark #${tokenId}`,
        imageUrl: urlData.publicUrl,
        imageSize: svgBuffer.length
      })
    };

  } catch (error) {
    console.error('❌ Image generation failed:', error);
    
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};