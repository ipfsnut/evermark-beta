// Database recovery script for tokens 8-17
// Inserts blockchain metadata into database using exact schema

import { createClient } from '@supabase/supabase-js';
import { createThirdwebClient, defineChain, getContract } from 'thirdweb';
import { tokenURI } from 'thirdweb/extensions/erc721';

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
  address: "0x504a0BDC3aea29237a6f8E53D0ECDA8e4c9009F2"
});

async function getTokenData(tokenId) {
  try {
    // Get tokenURI from blockchain
    const uri = await tokenURI({ contract, tokenId: BigInt(tokenId) });
    
    // Fetch metadata from IPFS
    const ipfsHash = uri.replace('ipfs://', '');
    const metadataUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
    
    const response = await fetch(metadataUrl);
    if (!response.ok) {
      throw new Error(`IPFS fetch failed: ${response.status}`);
    }
    
    const metadata = await response.json();
    
    return {
      tokenURI: uri,
      ipfsHash,
      metadata
    };
  } catch (error) {
    console.error(`❌ Failed to get data for token ${tokenId}:`, error.message);
    return null;
  }
}

async function insertToken(tokenId, tokenData) {
  try {
    const { metadata, tokenURI, ipfsHash } = tokenData;
    
    // Prepare database record using exact schema
    const record = {
      token_id: parseInt(tokenId),
      title: metadata.name || `Evermark #${tokenId}`,
      author: metadata.evermark?.castData?.author || 
              metadata.attributes?.find(a => a.trait_type === 'Creator')?.value || 
              'Unknown',
      owner: '0x3427b4716B90C11F9971e43999a48A47Cf5B571E', // Default to dev wallet for recovery
      description: metadata.description || '',
      content_type: metadata.evermark?.contentType || 'Cast',
      source_url: metadata.external_url || metadata.evermark?.sourceUrl,
      token_uri: tokenURI,
      supabase_image_url: null,
      ipfs_image_hash: null, // No manual image for these
      thumbnail_url: null,
      image_width: null,
      image_height: null,
      file_size_bytes: null,
      image_processing_status: null,
      tx_hash: null, // We'll need to get these from BaseScan later
      block_number: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_timestamp: null,
      last_synced_at: new Date().toISOString(),
      verified: false,
      metadata_fetched: true,
      metadata_json: JSON.stringify(metadata.evermark || {}),
      ipfs_metadata: null,
      user_id: null,
      cache_status: null,
      image_dimensions: null,
      last_accessed_at: null,
      access_count: 0
    };
    
    console.log(`📝 Inserting token ${tokenId}: "${record.title}" by ${record.author}`);
    
    const { data, error } = await supabase
      .from('beta_evermarks')
      .insert([record])
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    console.log(`✅ Token ${tokenId} inserted successfully`);
    return data;
    
  } catch (error) {
    console.error(`❌ Failed to insert token ${tokenId}:`, error.message);
    return null;
  }
}

async function recoverTokens() {
  console.log('🚀 Starting database recovery for tokens 8-17...\n');
  
  const missingTokens = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const results = [];
  
  for (const tokenId of missingTokens) {
    console.log(`🔄 Processing token ${tokenId}...`);
    
    // Check if already exists
    const { data: existing } = await supabase
      .from('beta_evermarks')
      .select('token_id, title')
      .eq('token_id', tokenId)
      .single();
    
    if (existing) {
      console.log(`✅ Token ${tokenId} already exists: "${existing.title}"`);
      results.push({ tokenId, status: 'exists', title: existing.title });
      continue;
    }
    
    // Get blockchain data
    const tokenData = await getTokenData(tokenId);
    if (!tokenData) {
      results.push({ tokenId, status: 'failed', error: 'Could not fetch blockchain data' });
      continue;
    }
    
    // Insert into database
    const inserted = await insertToken(tokenId, tokenData);
    if (inserted) {
      results.push({ 
        tokenId, 
        status: 'recovered', 
        title: inserted.title, 
        author: inserted.author 
      });
    } else {
      results.push({ tokenId, status: 'failed', error: 'Database insertion failed' });
    }
    
    // Brief delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n📊 Recovery Summary:');
  console.log('='.repeat(50));
  
  const recovered = results.filter(r => r.status === 'recovered');
  const existing = results.filter(r => r.status === 'exists');
  const failed = results.filter(r => r.status === 'failed');
  
  console.log(`✅ Successfully recovered: ${recovered.length}`);
  console.log(`✅ Already existed: ${existing.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  if (recovered.length > 0) {
    console.log('\n🎯 Newly recovered tokens:');
    recovered.forEach(r => console.log(`  Token ${r.tokenId}: "${r.title}" by ${r.author}`));
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed tokens:');
    failed.forEach(r => console.log(`  Token ${r.tokenId}: ${r.error}`));
  }
  
  console.log('\n✅ Database recovery completed');
}

recoverTokens().catch(console.error);