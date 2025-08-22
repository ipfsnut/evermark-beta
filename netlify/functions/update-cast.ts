import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Neynar setup
const NEYNAR_API_KEY = process.env.VITE_NEYNAR_API_KEY;

async function fetchCastData(url: string) {
  try {
    const response = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(url)}&type=url`, {
      headers: {
        'accept': 'application/json',
        'api_key': NEYNAR_API_KEY!
      }
    });

    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.status}`);
    }

    const data = await response.json();
    return data.cast;
  } catch (error) {
    console.error('Failed to fetch cast:', error);
    return null;
  }
}

export const handler: Handler = async (event, context) => {
  console.log('🔧 Updating Evermark #3 with correct Farcaster cast data');

  try {
    const tokenId = 3;
    const castUrl = 'https://farcaster.xyz/vitalik.eth/0xdd19b4bd';
    
    // Fetch the actual cast data from Farcaster
    console.log('📡 Fetching cast data from Farcaster...');
    const cast = await fetchCastData(castUrl);
    
    if (!cast) {
      throw new Error('Failed to fetch cast data');
    }

    console.log('✅ Cast data fetched:', {
      text: cast.text?.substring(0, 100),
      author: cast.author?.username,
      embeds: cast.embeds?.length
    });

    // Extract cast metadata
    const castMetadata = {
      text: cast.text || '',
      author_username: cast.author?.username || '',
      author_display_name: cast.author?.display_name || '',
      author_pfp: cast.author?.pfp_url || '',
      author_fid: cast.author?.fid || 0,
      likes: cast.reactions?.likes_count || 0,
      recasts: cast.reactions?.recasts_count || 0,
      replies: cast.replies?.count || 0,
      timestamp: cast.timestamp || new Date().toISOString(),
      hash: cast.hash || ''
    };

    // Look for embedded images or use author's profile picture
    let imageUrl: string | null = null;
    let imageHash = null;
    
    // Check for embedded images first
    if (cast.embeds && cast.embeds.length > 0) {
      for (const embed of cast.embeds) {
        if (embed.url && (
          embed.url.includes('.jpg') || 
          embed.url.includes('.jpeg') || 
          embed.url.includes('.png') || 
          embed.url.includes('.gif') ||
          embed.url.includes('.webp')
        )) {
          imageUrl = embed.url;
          console.log('📸 Found embedded image:', imageUrl);
          break;
        }
        
        if (embed.metadata?.image) {
          imageUrl = embed.metadata.image;
          console.log('📸 Found metadata image:', imageUrl);
          break;
        }
      }
    }

    // If no embedded image, create a text-based representation or use profile picture
    if (!imageUrl && cast.author?.pfp_url) {
      // For now, use the author's profile picture as a fallback
      imageUrl = cast.author.pfp_url;
      console.log('📸 Using author profile picture as fallback:', imageUrl);
    }

    // Update the database with correct metadata
    const updateData: any = {
      title: cast.text?.substring(0, 100) || `Cast by ${castMetadata.author_display_name}`,
      description: cast.text || 'Farcaster cast',
      content_type: 'Cast',
      source_url: castUrl,
      author: castMetadata.author_display_name || castMetadata.author_username,
      updated_at: new Date().toISOString(),
      metadata_json: JSON.stringify({
        cast: castMetadata,
        tags: ['farcaster', 'cast'],
        customFields: [
          { key: 'cast_author', value: castMetadata.author_username },
          { key: 'cast_hash', value: castMetadata.hash },
          { key: 'cast_likes', value: castMetadata.likes.toString() },
          { key: 'cast_recasts', value: castMetadata.recasts.toString() },
          { key: 'cast_timestamp', value: castMetadata.timestamp }
        ]
      })
    };

    // Update IPFS metadata if we have new image info
    if (imageUrl) {
      // For external URLs, we'll store them directly
      // In production, you'd want to download and upload to IPFS
      updateData.supabase_image_url = imageUrl;
      
      // If it's an IPFS URL, extract the hash
      if (imageUrl.includes('ipfs://') || imageUrl.includes('/ipfs/')) {
        const match = imageUrl.match(/([A-Za-z0-9]{46,})/);
        if (match) {
          updateData.ipfs_image_hash = match[1];
        }
      }
    }

    // Update the evermark in the database
    const { error: updateError } = await supabase
      .from('beta_evermarks')
      .update(updateData)
      .eq('token_id', tokenId);

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log('✅ Evermark #3 updated successfully');

    // Fetch the updated record to confirm
    const { data: updatedEvermark, error: fetchError } = await supabase
      .from('beta_evermarks')
      .select('*')
      .eq('token_id', tokenId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch updated record: ${fetchError.message}`);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Evermark #3 updated with correct Farcaster cast data',
        evermark: {
          token_id: updatedEvermark.token_id,
          title: updatedEvermark.title,
          author: updatedEvermark.author,
          content_type: updatedEvermark.content_type,
          source_url: updatedEvermark.source_url,
          image_url: updatedEvermark.supabase_image_url,
          metadata: castMetadata
        }
      })
    };

  } catch (error) {
    console.error('❌ Update failed:', error);
    
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