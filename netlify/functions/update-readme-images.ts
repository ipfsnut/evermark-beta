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

// Helper function to extract IPFS hash from OpenSea URLs or other sources
function extractIPFSHash(url: string): string | null {
  if (!url) return null;
  
  // Try to extract from various URL patterns
  const patterns = [
    /ipfs:\/\/([a-zA-Z0-9]{46,})/,
    /\/ipfs\/([a-zA-Z0-9]{46,})/,
    // OpenSea sometimes includes IPFS hashes in their CDN URLs
    /([a-zA-Z0-9]{46,})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1].startsWith('Qm')) {
      return match[1];
    }
  }
  
  return null;
}

// Helper function to get better image source from metadata
async function findBetterImageSource(tokenId: number, metadata: any): Promise<string | null> {
  console.log(`🔍 Looking for better image source for token ${tokenId}`);
  
  if (!metadata) return null;
  
  let parsedMetadata;
  try {
    parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
  } catch (error) {
    console.warn(`⚠️ Could not parse metadata for token ${tokenId}:`, error);
    return null;
  }
  
  // For README books, check temporaryImageUrl first (often higher quality)
  if (parsedMetadata.temporaryImageUrl) {
    console.log(`📸 Found temporaryImageUrl for token ${tokenId}:`, parsedMetadata.temporaryImageUrl);
    
    // If it's an OpenSea image, try to get the original size
    if (parsedMetadata.temporaryImageUrl.includes('openseauserdata.com') || parsedMetadata.temporaryImageUrl.includes('seadn.io')) {
      // Remove size parameters to get original
      let originalUrl = parsedMetadata.temporaryImageUrl.split('=')[0];
      
      // For seadn.io URLs, try removing specific sizing patterns
      if (parsedMetadata.temporaryImageUrl.includes('seadn.io')) {
        // These URLs might have different patterns, try as-is first
        originalUrl = parsedMetadata.temporaryImageUrl;
      }
      
      console.log(`🔄 Using OpenSea image for token ${tokenId}:`, originalUrl);
      return originalUrl;
    }
    
    return parsedMetadata.temporaryImageUrl;
  }
  
  // Check readmeData for better image sources
  if (parsedMetadata.readmeData) {
    const readmeData = parsedMetadata.readmeData;
    
    // Look for IPFS hash in various fields
    const ipfsFields = ['ipfsImageHash', 'coverImageHash', 'imageHash'];
    for (const field of ipfsFields) {
      if (readmeData[field]) {
        const ipfsUrl = `https://ipfs.io/ipfs/${readmeData[field]}`;
        console.log(`🔗 Found IPFS image in ${field} for token ${tokenId}:`, ipfsUrl);
        return ipfsUrl;
      }
    }
  }
  
  // Try to extract IPFS hash from any image URL in metadata
  const imageFields = ['image', 'image_url', 'cover_image', 'thumbnail', 'animation_url'];
  for (const field of imageFields) {
    if (parsedMetadata[field]) {
      const ipfsHash = extractIPFSHash(parsedMetadata[field]);
      if (ipfsHash) {
        const ipfsUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
        console.log(`🔗 Extracted IPFS hash from ${field} for token ${tokenId}:`, ipfsUrl);
        return ipfsUrl;
      }
    }
  }
  
  return null;
}

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
    console.log('🔧 Starting README book image source update...');

    // Get all README books from database
    const { data: readmeBooks, error } = await supabase
      .from('beta_evermarks')
      .select('token_id, ipfs_image_hash, metadata_json, source_url')
      .eq('content_type', 'README')
      .not('metadata_json', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch README books: ${error.message}`);
    }

    console.log(`📚 Found ${readmeBooks?.length || 0} README books to analyze`);

    if (!readmeBooks || readmeBooks.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'No README books found',
          updated: 0
        })
      };
    }

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process each README book
    for (const book of readmeBooks) {
      try {
        console.log(`\n🔍 Analyzing token ${book.token_id}`);
        console.log(`Current IPFS hash: ${book.ipfs_image_hash}`);
        
        // Find a better image source
        const betterImageUrl = await findBetterImageSource(book.token_id, book.metadata_json);
        
        if (betterImageUrl) {
          // Check if this is a different source than what we currently have
          let shouldUpdate = false;
          let updateData: any = {
            supabase_image_url: null, // Clear cached image so it gets re-processed
            image_processing_status: null,
            updated_at: new Date().toISOString()
          };
          
          // Try to extract IPFS hash from the better source
          const newIpfsHash = extractIPFSHash(betterImageUrl);
          
          if (newIpfsHash && newIpfsHash !== book.ipfs_image_hash) {
            console.log(`✨ Found better IPFS image source for token ${book.token_id}:`);
            console.log(`  Old hash: ${book.ipfs_image_hash}`);
            console.log(`  New hash: ${newIpfsHash}`);
            console.log(`  Source URL: ${betterImageUrl}`);
            updateData.ipfs_image_hash = newIpfsHash;
            shouldUpdate = true;
          } else if (!newIpfsHash && betterImageUrl.includes('seadn.io')) {
            // For OpenSea CDN URLs, update metadata to include the better image
            console.log(`✨ Found better OpenSea CDN image for token ${book.token_id}:`);
            console.log(`  Current IPFS: ${book.ipfs_image_hash}`);
            console.log(`  New CDN URL: ${betterImageUrl}`);
            
            // Update the metadata to include the better image URL as the primary source
            let updatedMetadata;
            try {
              const currentMetadata = JSON.parse(book.metadata_json);
              updatedMetadata = {
                ...currentMetadata,
                primaryImageUrl: betterImageUrl, // Add as primary source
                imageSource: 'opensea_cdn'
              };
            } catch (error) {
              console.warn(`⚠️ Could not update metadata for token ${book.token_id}:`, error);
              updatedMetadata = {
                primaryImageUrl: betterImageUrl,
                imageSource: 'opensea_cdn'
              };
            }
            
            updateData.metadata_json = JSON.stringify(updatedMetadata);
            shouldUpdate = true;
            
            // Trigger immediate re-processing with the new URL
            try {
              console.log(`🔄 Processing OpenSea CDN image for token ${book.token_id}...`);
              const processResponse = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/process-readme-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: betterImageUrl })
              });
              
              if (processResponse.ok) {
                const processResult = await processResponse.json();
                if (processResult.success && processResult.dimensions) {
                  console.log(`📐 Processed image dimensions: ${processResult.dimensions.width}x${processResult.dimensions.height}`);
                  console.log(`📐 Aspect ratio: ${processResult.dimensions.aspectRatio.toFixed(3)}`);
                  
                  // If we got valid dimensions, store the processed image directly
                  if (processResult.dataUrl) {
                    console.log(`💾 Storing processed image directly to Supabase for token ${book.token_id}...`);
                    // We could store this directly to Supabase here if needed
                  }
                }
              }
            } catch (processError) {
              console.warn(`⚠️ Could not process image immediately:`, processError);
            }
          }
          
          if (shouldUpdate) {
            // Update the database
            const { error: updateError } = await supabase
              .from('beta_evermarks')
              .update(updateData)
              .eq('token_id', book.token_id);
            
            if (updateError) {
              throw new Error(`Failed to update token ${book.token_id}: ${updateError.message}`);
            }
            
            updated++;
            console.log(`✅ Updated token ${book.token_id} with better image source`);
          } else {
            console.log(`ℹ️ Token ${book.token_id} already has the best available image source`);
          }
        } else {
          console.log(`⚠️ No better image source found for token ${book.token_id}`);
        }
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Failed to process token ${book.token_id}:`, errorMsg);
        failed++;
        errors.push(`Token ${book.token_id}: ${errorMsg}`);
      }
    }

    console.log(`\n🎉 README book image update complete: ${updated} updated, ${failed} failed`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `README book image sources updated`,
        totalBooks: readmeBooks.length,
        updated,
        failed,
        errors: errors.slice(0, 5) // Limit error list
      })
    };

  } catch (error) {
    console.error('❌ README book image update failed:', error);
    
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