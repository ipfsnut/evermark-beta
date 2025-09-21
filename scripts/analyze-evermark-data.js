#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createThirdwebClient, getContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { getNFT, totalSupply } from 'thirdweb/extensions/erc721';

// Load environment variables from .env.local
config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const client = createThirdwebClient({
  clientId: process.env.VITE_THIRDWEB_CLIENT_ID
});

const contract = getContract({
  client,
  chain: base,
  address: process.env.VITE_EVERMARK_NFT_ADDRESS
});

console.log('\n📊 EVERMARK DATA ANALYSIS\n');
console.log('=' .repeat(80));

async function analyzeData() {
  try {
    // Get total supply on-chain
    const supply = await totalSupply({ contract });
    const totalSupplyNumber = Number(supply);
    console.log(`\n🔗 ON-CHAIN DATA:`);
    console.log(`  Total NFTs minted: ${totalSupplyNumber}`);

    // Get all evermarks from Supabase
    const { data: supabaseEvermarks, error } = await supabase
      .from('beta_evermarks')
      .select('*')
      .order('token_id', { ascending: true });

    if (error) {
      console.error('Error fetching from Supabase:', error);
      return;
    }

    console.log(`\n💾 SUPABASE DATA:`);
    console.log(`  Total records: ${supabaseEvermarks?.length || 0}`);

    // Analyze data quality
    const analysis = {
      totalRecords: supabaseEvermarks?.length || 0,
      withMetadata: 0,
      withoutMetadata: 0,
      metadataFetched: 0,
      verified: 0,
      withImages: 0,
      withProcessedImages: 0,
      withSupabaseImages: 0,
      contentTypes: {},
      missingOnchain: [],
      missingInSupabase: [],
      dataIssues: []
    };

    // Check each Supabase record
    for (const evermark of supabaseEvermarks || []) {
      // Check metadata
      if (evermark.metadata_json) {
        analysis.withMetadata++;
        
        // Check for double-stringified metadata
        try {
          const parsed = JSON.parse(evermark.metadata_json);
          if (typeof parsed === 'string') {
            analysis.dataIssues.push({
              token_id: evermark.token_id,
              issue: 'Double-stringified metadata'
            });
          }
        } catch (e) {
          analysis.dataIssues.push({
            token_id: evermark.token_id,
            issue: 'Invalid JSON in metadata_json'
          });
        }
      } else {
        analysis.withoutMetadata++;
      }

      if (evermark.metadata_fetched) analysis.metadataFetched++;
      if (evermark.verified) analysis.verified++;
      if (evermark.ipfs_image_hash) analysis.withImages++;
      if (evermark.processed_image_url) analysis.withProcessedImages++;
      if (evermark.supabase_image_url) analysis.withSupabaseImages++;

      // Count content types
      const contentType = evermark.content_type || 'Unknown';
      analysis.contentTypes[contentType] = (analysis.contentTypes[contentType] || 0) + 1;
    }

    // Check for missing records
    const supabaseTokenIds = new Set(supabaseEvermarks?.map(e => e.token_id));
    
    console.log(`\n🔍 CHECKING FOR MISSING RECORDS...`);
    
    // Sample check: Check first 10 and last 10 on-chain tokens
    const samplesToCheck = [];
    if (totalSupplyNumber > 0) {
      // First 10
      for (let i = 1; i <= Math.min(10, totalSupplyNumber); i++) {
        samplesToCheck.push(i);
      }
      // Last 10
      for (let i = Math.max(totalSupplyNumber - 9, 11); i <= totalSupplyNumber; i++) {
        if (!samplesToCheck.includes(i)) {
          samplesToCheck.push(i);
        }
      }
    }

    for (const tokenId of samplesToCheck) {
      if (!supabaseTokenIds.has(tokenId)) {
        try {
          const nft = await getNFT({ contract, tokenId: BigInt(tokenId) });
          if (nft) {
            analysis.missingInSupabase.push(tokenId);
            console.log(`  ⚠️ Token ${tokenId} exists on-chain but missing in Supabase`);
          }
        } catch (e) {
          // Token doesn't exist on-chain
        }
      }
    }

    // Print analysis results
    console.log(`\n📈 ANALYSIS RESULTS:`);
    console.log(`  Records with metadata: ${analysis.withMetadata} (${(analysis.withMetadata/analysis.totalRecords*100).toFixed(1)}%)`);
    console.log(`  Records without metadata: ${analysis.withoutMetadata} (${(analysis.withoutMetadata/analysis.totalRecords*100).toFixed(1)}%)`);
    console.log(`  Metadata fetched flag: ${analysis.metadataFetched} (${(analysis.metadataFetched/analysis.totalRecords*100).toFixed(1)}%)`);
    console.log(`  Verified: ${analysis.verified} (${(analysis.verified/analysis.totalRecords*100).toFixed(1)}%)`);
    console.log(`  With IPFS images: ${analysis.withImages} (${(analysis.withImages/analysis.totalRecords*100).toFixed(1)}%)`);
    console.log(`  With processed images: ${analysis.withProcessedImages} (${(analysis.withProcessedImages/analysis.totalRecords*100).toFixed(1)}%)`);
    console.log(`  With Supabase images: ${analysis.withSupabaseImages} (${(analysis.withSupabaseImages/analysis.totalRecords*100).toFixed(1)}%)`);

    console.log(`\n📊 CONTENT TYPE DISTRIBUTION:`);
    for (const [type, count] of Object.entries(analysis.contentTypes)) {
      console.log(`  ${type}: ${count} (${(count/analysis.totalRecords*100).toFixed(1)}%)`);
    }

    if (analysis.missingInSupabase.length > 0) {
      console.log(`\n⚠️ TOKENS MISSING IN SUPABASE:`);
      console.log(`  ${analysis.missingInSupabase.join(', ')}`);
    }

    if (analysis.dataIssues.length > 0) {
      console.log(`\n🔧 DATA ISSUES FOUND:`);
      for (const issue of analysis.dataIssues.slice(0, 10)) {
        console.log(`  Token ${issue.token_id}: ${issue.issue}`);
      }
      if (analysis.dataIssues.length > 10) {
        console.log(`  ... and ${analysis.dataIssues.length - 10} more issues`);
      }
    }

    // Comparison summary
    console.log(`\n📋 COMPARISON SUMMARY:`);
    console.log('=' .repeat(80));
    
    console.log('\n🔗 ON-CHAIN FIELDS:');
    console.log('  - tokenId (uint256)');
    console.log('  - title (string)');
    console.log('  - creator (string)'); 
    console.log('  - metadataURI (string)');
    console.log('  - creationTime (uint256)');
    console.log('  - minter (address)');
    console.log('  - referrer (address)');
    
    console.log('\n💾 SUPABASE FIELDS:');
    console.log('  - token_id (matches tokenId)');
    console.log('  - title (matches title)');
    console.log('  - author (derived from metadata, not always creator)');
    console.log('  - owner (current owner, not original minter)');
    console.log('  - description (from metadata)');
    console.log('  - content_type (Cast, Tweet, Article, etc.)');
    console.log('  - source_url (original content URL)');
    console.log('  - token_uri (matches metadataURI)');
    console.log('  - metadata_json (full IPFS metadata)');
    console.log('  - metadata_fetched (boolean flag)');
    console.log('  - verified (boolean flag)');
    console.log('  - processed_image_url (cached image)');
    console.log('  - supabase_image_url (Supabase storage)');
    console.log('  - view_count (off-chain metric)');
    
    console.log('\n🔄 KEY DIFFERENCES:');
    console.log('  • On-chain stores minimal data (title, creator, URI)');
    console.log('  • Supabase caches expanded metadata from IPFS');
    console.log('  • Author field may differ from on-chain creator');
    console.log('  • Supabase tracks additional metrics (views, processing status)');
    console.log('  • Image caching and processing happens off-chain');

  } catch (error) {
    console.error('Analysis failed:', error);
  }
}

analyzeData().then(() => {
  console.log('\n✅ Analysis complete!\n');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});