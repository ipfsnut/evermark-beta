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

// Enhanced cast image generation with modern design
async function generateCastImage(castData: any): Promise<Buffer> {
  // Get profile picture if available
  const profileImageDataUri = await getProfileImage(castData.author_pfp);
  
  // Format timestamp
  const date = castData.timestamp ? new Date(castData.timestamp) : new Date();
  const timeAgo = getTimeAgo(date);
  
  // Wrap text with better line breaking
  const wrappedText = wrapText(castData.text || 'No text available', 65);
  const maxLines = 6; // Limit for better visual balance
  const displayText = wrappedText.slice(0, maxLines);
  const hasMoreText = wrappedText.length > maxLines;
  
  // Generate text lines with improved positioning
  const textLines = displayText.map((line, index) => 
    `<text x="30" y="${180 + index * 28}" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="16" fill="#1F2937" font-weight="400">${escapeXml(line)}</text>`
  ).join('\n    ');
  
  // Add truncation indicator if text is cut off
  const truncationIndicator = hasMoreText ? 
    `<text x="30" y="${180 + displayText.length * 28}" font-family="Inter, sans-serif" font-size="16" fill="#9CA3AF" font-weight="400">...</text>` : '';

  // Channel badge if available
  const channelBadge = castData.channel ? 
    `<!-- Channel Badge -->
     <rect x="580" y="106" rx="12" ry="12" width="${Math.min(castData.channel.length * 8 + 40, 160)}" height="24" fill="#F3F4F6" stroke="#E5E7EB"/>
     <text x="596" y="122" font-family="Inter, sans-serif" font-size="12" fill="#6B7280" font-weight="500">📺 ${escapeXml(castData.channel)}</text>` : '';

  // Embed indicators
  const embedIndicators = getEmbedIndicators(castData.embeds);
  
  const svg = `
<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background gradient -->
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#F8FAFC;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FFFFFF;stop-opacity:1" />
    </linearGradient>
    
    <!-- Header gradient -->
    <linearGradient id="headerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#8B5CF6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
    </linearGradient>
    
    <!-- Subtle shadow -->
    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.1"/>
    </filter>
    
    <!-- Profile picture circular mask -->
    <clipPath id="profileClip">
      <circle cx="46" cy="126" r="20"/>
    </clipPath>
  </defs>
  
  <!-- Main card background with gradient -->
  <rect width="800" height="400" fill="url(#bgGradient)" rx="8" ry="8" filter="url(#cardShadow)"/>
  
  <!-- Header with gradient -->
  <rect width="800" height="60" fill="url(#headerGradient)" rx="8" ry="8"/>
  <rect width="800" height="52" y="8" fill="url(#headerGradient)"/>
  
  <!-- Header content -->
  <text x="24" y="38" font-family="Inter, sans-serif" font-size="18" font-weight="600" fill="white">Farcaster Cast</text>
  <text x="720" y="38" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="#E2E8F0">Evermarks</text>
  
  <!-- Author section background -->
  <rect x="16" y="76" width="768" height="64" fill="#FFFFFF" rx="8" ry="8" opacity="0.8"/>
  
  <!-- Profile picture -->
  <circle cx="46" cy="126" r="22" fill="#E5E7EB" stroke="#8B5CF6" stroke-width="2" opacity="0.2"/>
  ${profileImageDataUri ? `<image x="26" y="106" width="40" height="40" href="${profileImageDataUri}" clip-path="url(#profileClip)"/>` : 
    `<text x="46" y="132" font-family="Inter, sans-serif" font-size="16" font-weight="600" fill="#8B5CF6" text-anchor="middle">${escapeXml((castData.author_username || 'U').charAt(0).toUpperCase())}</text>`}
  
  <!-- Author info -->
  <text x="78" y="118" font-family="Inter, sans-serif" font-size="18" font-weight="600" fill="#1F2937">${escapeXml(castData.author_display_name || castData.author_username || 'Unknown')}</text>
  <text x="78" y="136" font-family="Inter, sans-serif" font-size="14" font-weight="400" fill="#6B7280">@${escapeXml(castData.author_username || 'unknown')} • ${timeAgo}</text>
  
  ${channelBadge}
  
  <!-- Content section background -->
  <rect x="16" y="156" width="768" height="180" fill="#FFFFFF" rx="8" ry="8" opacity="0.6"/>
  
  <!-- Cast text with improved typography -->
  ${textLines}
  ${truncationIndicator}
  
  ${embedIndicators}
  
  <!-- Engagement section background -->
  <rect x="16" y="352" width="768" height="32" fill="#F8FAFC" rx="6" ry="6"/>
  
  <!-- Enhanced engagement metrics -->
  ${castData.likes !== undefined || castData.recasts !== undefined || castData.replies !== undefined ? 
    `<text x="28" y="372" font-family="Inter, sans-serif" font-size="13" font-weight="500" fill="#6B7280">
       ${castData.likes !== undefined ? `❤️ ${formatNumber(castData.likes)}` : ''}
       ${castData.likes !== undefined && castData.recasts !== undefined ? '   ' : ''}
       ${castData.recasts !== undefined ? `🔄 ${formatNumber(castData.recasts)}` : ''}
       ${(castData.likes !== undefined || castData.recasts !== undefined) && castData.replies !== undefined ? '   ' : ''}
       ${castData.replies !== undefined ? `💬 ${formatNumber(castData.replies)}` : ''}
     </text>` : ''
  }
  
  <!-- Subtle border -->
  <rect x="0" y="0" width="800" height="400" fill="none" stroke="#E5E7EB" stroke-width="1" rx="8" ry="8" opacity="0.5"/>
</svg>`;

  return await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

// Get profile picture and convert to data URI
async function getProfileImage(pfpUrl: string): Promise<string | null> {
  if (!pfpUrl) return null;
  
  try {
    console.log('📸 Downloading profile picture:', pfpUrl);
    
    // Download profile picture with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(pfpUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Evermarks/1.0 (+https://evermarks.net)'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn('Profile picture download failed:', response.status);
      return null;
    }
    
    const imageBuffer = await response.arrayBuffer();
    
    // Process image: resize to 40x40 and convert to PNG
    const processedImage = await sharp(Buffer.from(imageBuffer))
      .resize(40, 40, {
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toBuffer();
      
    // Convert to data URI for embedding in SVG
    const base64 = processedImage.toString('base64');
    return `data:image/png;base64,${base64}`;
    
  } catch (error) {
    console.warn('Profile picture processing failed:', error);
    return null;
  }
}

// Format numbers for display (1.2K, 1.2M, etc.)
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

// Get embed indicators based on cast embeds
function getEmbedIndicators(embeds: any[]): string {
  if (!embeds || embeds.length === 0) return '';
  
  const indicators: string[] = [];
  let yPosition = 320;
  
  embeds.forEach((embed, index) => {
    if (index >= 3) return; // Limit to 3 indicators
    
    let indicator = '';
    if (embed.url) {
      if (embed.url.includes('youtube.com') || embed.url.includes('youtu.be')) {
        indicator = '🎥 Video';
      } else if (embed.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        indicator = '🖼️ Image';
      } else {
        indicator = '🔗 Link';
      }
    } else if (embed.cast_id) {
      indicator = '💬 Cast';
    }
    
    if (indicator) {
      indicators.push(`<text x="${30 + index * 80}" y="${yPosition}" font-family="Inter, sans-serif" font-size="12" fill="#8B5CF6" font-weight="500">${indicator}</text>`);
    }
  });
  
  return indicators.length > 0 ? indicators.join('\n  ') : '';
}

export const handler: Handler = async (event, context) => {
  try {
    // Get token_id from query parameters or request body
    const tokenId = event.queryStringParameters?.token_id || 
                   (event.body ? JSON.parse(event.body).token_id : null);
    
    if (!tokenId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'token_id parameter is required'
        })
      };
    }

    console.log(`🎨 Generating cast preview image for Evermark #${tokenId}`);
    
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
      console.log('📊 Raw metadata:', {
        hasMetadata: !!evermark.metadata_json,
        metadataKeys: Object.keys(metadata),
        metadata: metadata
      });
      
      // Extract cast data from customFields if available
      let castAuthorUsername = 'unknown';
      let castAuthorDisplayName = 'Unknown';
      let castLikes = 0;
      let castRecasts = 0;
      let castTimestamp = new Date().toISOString();
      
      if (metadata.customFields && Array.isArray(metadata.customFields)) {
        const getCustomField = (key: string) => 
          metadata.customFields.find((field: any) => field.key === key)?.value;
        
        // Support both old and new field formats
        castAuthorUsername = getCustomField('cast_author_username') || getCustomField('cast_author') || castAuthorUsername;
        castAuthorDisplayName = getCustomField('cast_author_display_name') || getCustomField('cast_author') || castAuthorDisplayName;
        castLikes = parseInt(getCustomField('cast_likes') || '0');
        castRecasts = parseInt(getCustomField('cast_recasts') || '0');
        castTimestamp = getCustomField('cast_timestamp') || castTimestamp;
      }
      
      // Also check if there's cast data in the metadata root
      if (metadata.cast) {
        castAuthorUsername = metadata.cast.author_username || castAuthorUsername;
        castAuthorDisplayName = metadata.cast.author_display_name || castAuthorDisplayName;
        castLikes = metadata.cast.likes || castLikes;
        castRecasts = metadata.cast.recasts || castRecasts;
        castTimestamp = metadata.cast.timestamp || castTimestamp;
      }
      
      // Create cast data for image generation with enhanced fields
      castData = {
        text: metadata.cast?.text || evermark.description || 'No content available',
        author_username: metadata.cast?.author_username || castAuthorUsername,
        author_display_name: metadata.cast?.author_display_name || castAuthorDisplayName,
        author_pfp: metadata.cast?.author_pfp, // Profile picture URL from Neynar
        likes: metadata.cast?.likes || castLikes,
        recasts: metadata.cast?.recasts || castRecasts,
        replies: metadata.cast?.replies || 0,
        timestamp: metadata.cast?.timestamp || castTimestamp,
        hash: metadata.cast?.hash,
        channel: metadata.cast?.channel, // Channel name if cast belongs to a channel
        embeds: metadata.cast?.embeds || [] // Array of embed objects
      };
      
      console.log('📦 Adapted cast data from NFT metadata:', castData);
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
      .from('evermarks')
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
        message: `Cast preview image generated for Evermark #${tokenId}`,
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