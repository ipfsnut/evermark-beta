// Recovery script for tokens 8-17
// Fetches metadata from blockchain and IPFS, then inserts into database

import { createClient } from '@supabase/supabase-js';
import { createThirdwebClient, defineChain, getContract } from 'thirdweb';
import { tokenURI } from 'thirdweb/extensions/erc721';

// Configuration
const EVERMARK_NFT_ADDRESS = '0x504a0BDC3aea29237a6f8E53D0ECDA8e4c9009F2';
const CHAIN_ID = 8453; // Base

// Check environment variables
if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY || !process.env.VITE_THIRDWEB_CLIENT_ID) {
  console.error('❌ Missing required environment variables. Make sure .env.local is loaded.');
  console.log('Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_THIRDWEB_CLIENT_ID');
  process.exit(1);
}

// Initialize clients
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const client = createThirdwebClient({
  clientId: process.env.VITE_THIRDWEB_CLIENT_ID
});

const chain = defineChain(8453); // Base
const contract = getContract({
  client,
  chain,
  address: EVERMARK_NFT_ADDRESS
});

// Fetch token URI from contract
async function getTokenURI(tokenId) {
  try {
    const uri = await tokenURI({ contract, tokenId: BigInt(tokenId) });
    console.log(`✅ Token ${tokenId} URI:`, uri);
    return uri;
  } catch (error) {
    console.error(`❌ Failed to get token URI for ${tokenId}:`, error.message);
    return null;
  }
}

// Fetch metadata from IPFS
async function fetchIPFSMetadata(ipfsUrl) {
  try {
    // Convert IPFS URL to HTTP gateway URL
    let gatewayUrl = ipfsUrl;
    if (ipfsUrl.startsWith('ipfs://')) {
      const hash = ipfsUrl.replace('ipfs://', '');
      gatewayUrl = `https://gateway.pinata.cloud/ipfs/${hash}`;
    }
    
    console.log(`🔍 Fetching metadata from: ${gatewayUrl}`);
    
    const response = await fetch(gatewayUrl, {
      timeout: 10000 // 10 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const metadata = await response.json();
    console.log(`✅ Metadata fetched successfully`);
    return metadata;
  } catch (error) {
    console.error(`❌ Failed to fetch IPFS metadata:`, error.message);
    return null;
  }
}

// Check if token exists in database
async function checkTokenInDatabase(tokenId) {
  try {
    const { data, error } = await supabase
      .from('beta_evermarks')
      .select('token_id, title, author')
      .eq('token_id', tokenId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error(`❌ Database check failed for token ${tokenId}:`, error.message);
    return null;
  }
}

// Insert token into database
async function insertTokenToDatabase(tokenId, metadata, tokenURI) {
  try {
    console.log(`📝 Preparing database record for token ${tokenId}...`);
    
    // Extract key information from metadata
    const title = metadata.name || `Evermark #${tokenId}`;
    const description = metadata.description || '';
    const contentType = metadata.evermark?.contentType || 'Custom';
    const sourceUrl = metadata.external_url || metadata.evermark?.sourceUrl;
    const author = metadata.evermark?.castData?.author || 
                  metadata.attributes?.find(attr => attr.trait_type === 'Creator')?.value || 
                  'Unknown';
    
    // Prepare database record
    const newRecord = {
      token_id: parseInt(tokenId),
      title: title.substring(0, 255), // Limit title length
      author: author,
      owner: '0x0000000000000000000000000000000000000000', // Will need to fetch actual owner
      description: description,
      content_type: contentType,
      source_url: sourceUrl,
      token_uri: tokenURI,
      tx_hash: null, // Will need to fetch from BaseScan
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata_fetched: true,
      verified: false,
      metadata_json: JSON.stringify(metadata.evermark || {}),
      ipfs_metadata_hash: tokenURI.includes('ipfs://') ? tokenURI.replace('ipfs://', '') : null
    };
    
    console.log(`📊 Database record prepared:`, {
      token_id: newRecord.token_id,
      title: newRecord.title,
      author: newRecord.author,
      content_type: newRecord.content_type
    });
    
    const { data, error } = await supabase
      .from('beta_evermarks')
      .insert([newRecord])
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    console.log(`✅ Token ${tokenId} inserted into database successfully`);
    return data;
  } catch (error) {
    console.error(`❌ Failed to insert token ${tokenId} into database:`, error.message);
    return null;
  }
}

// Main recovery function for a single token
async function recoverToken(tokenId) {
  console.log(`\n🔄 Processing token ${tokenId}...`);
  
  // Check if already in database
  const existingRecord = await checkTokenInDatabase(tokenId);
  if (existingRecord) {
    console.log(`✅ Token ${tokenId} already exists in database: "${existingRecord.title}"`);
    return { success: true, action: 'already_exists', tokenId };
  }
  
  // Get token URI from contract
  const tokenURI = await getTokenURI(tokenId);
  if (!tokenURI) {
    return { success: false, error: 'Failed to get token URI', tokenId };
  }
  
  // Fetch metadata from IPFS
  const metadata = await fetchIPFSMetadata(tokenURI);
  if (!metadata) {
    return { success: false, error: 'Failed to fetch IPFS metadata', tokenId };
  }
  
  // Insert into database
  const dbRecord = await insertTokenToDatabase(tokenId, metadata, tokenURI);
  if (!dbRecord) {
    return { success: false, error: 'Failed to insert into database', tokenId };
  }
  
  return { 
    success: true, 
    action: 'recovered', 
    tokenId, 
    title: metadata.name,
    contentType: metadata.evermark?.contentType
  };
}

// Main recovery script
async function recoverTokens(startToken = 8, endToken = 17) {
  console.log(`🚀 Starting token recovery for tokens ${startToken}-${endToken}...`);
  console.log(`📋 Contract: ${EVERMARK_NFT_ADDRESS}`);
  console.log(`🌐 Chain: Base (${CHAIN_ID})`);
  
  const results = [];
  const failures = [];
  
  for (let tokenId = startToken; tokenId <= endToken; tokenId++) {
    try {
      const result = await recoverToken(tokenId);
      results.push(result);
      
      if (!result.success) {
        failures.push({ tokenId, error: result.error });
        console.log(`❌ Token ${tokenId} recovery failed: ${result.error}`);
      } else {
        console.log(`✅ Token ${tokenId} ${result.action}: ${result.title || 'N/A'}`);
      }
      
      // Brief delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Unexpected error recovering token ${tokenId}:`, error);
      failures.push({ tokenId, error: error.message });
    }
  }
  
  // Summary
  console.log(`\n📊 Recovery Summary:`);
  console.log(`✅ Successful: ${results.filter(r => r.success).length}`);
  console.log(`❌ Failed: ${failures.length}`);
  
  if (failures.length > 0) {
    console.log(`\n❌ Failed tokens:`);
    failures.forEach(({ tokenId, error }) => {
      console.log(`  - Token ${tokenId}: ${error}`);
    });
  }
  
  const recovered = results.filter(r => r.success && r.action === 'recovered');
  if (recovered.length > 0) {
    console.log(`\n🎯 Newly recovered tokens:`);
    recovered.forEach(result => {
      console.log(`  - Token ${result.tokenId}: "${result.title}" (${result.contentType})`);
    });
  }
  
  return { results, failures };
}

// Run the script
async function main() {
  try {
    await recoverTokens(8, 17);
    console.log(`\n✅ Recovery script completed`);
  } catch (error) {
    console.error(`❌ Recovery script failed:`, error);
    process.exit(1);
  }
}

// Run the script
main();