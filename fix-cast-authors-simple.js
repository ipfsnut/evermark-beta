#!/usr/bin/env node

/**
 * Simple manual fix for the specific cast author issues we identified
 * 
 * Based on our analysis:
 * - Token 5: "0x2B27...3fe3" → "kompreni" 
 * - Token 4: "0x2B27...3fe3" → "horsefacts.eth"
 * - Token 3: "Vitalik Buterin" (already correct)
 */

import https from 'https';

const API_BASE = 'https://evermarks.net/api';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: res.statusCode === 204 ? null : JSON.parse(data)
          });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');

  console.log('🔧 Cast Author Fix');
  console.log('==================');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('💡 Use --execute to apply changes');
  } else {
    console.log('⚡ EXECUTE MODE - Changes will be applied!');
  }
  console.log();

  // Define the specific fixes needed
  const fixes = [
    {
      tokenId: 5,
      currentAuthor: '0x2B27...3fe3',
      correctAuthor: 'kompreni',
      sourceUrl: 'https://farcaster.xyz/kompreni/0xa9f15161'
    },
    {
      tokenId: 4,
      currentAuthor: '0x2B27...3fe3', 
      correctAuthor: 'horsefacts.eth',
      sourceUrl: 'https://farcaster.xyz/horsefacts.eth/0x941d16c5'
    }
  ];

  console.log('📋 Planned fixes:');
  fixes.forEach(fix => {
    console.log(`  Token ${fix.tokenId}: "${fix.currentAuthor}" → "${fix.correctAuthor}"`);
  });
  console.log();

  if (dryRun) {
    console.log('✅ Dry run complete. All changes look good!');
    console.log('💡 To apply these changes, run:');
    console.log('   node fix-cast-authors-simple.js --execute');
    return;
  }

  // Apply fixes manually by calling the public API
  console.log('🔄 Applying fixes...');
  
  for (const fix of fixes) {
    try {
      console.log(`\n📝 Updating token ${fix.tokenId}...`);
      
      // First verify current state
      const getResponse = await makeRequest(`${API_BASE}/evermarks/${fix.tokenId}`);
      
      if (getResponse.status !== 200) {
        console.error(`❌ Failed to fetch token ${fix.tokenId}:`, getResponse.data);
        continue;
      }

      const currentEvermark = getResponse.data.evermark;
      console.log(`   Current author: "${currentEvermark.author}"`);
      console.log(`   Target author: "${fix.correctAuthor}"`);
      
      if (currentEvermark.author === fix.correctAuthor) {
        console.log(`   ✅ Already correct, skipping`);
        continue;
      }

      console.log(`   🚨 MANUAL UPDATE REQUIRED`);
      console.log(`   ℹ️  This requires manual database access since API has ownership protection.`);
      console.log(`   ℹ️  SQL: UPDATE beta_evermarks SET author = '${fix.correctAuthor}', updated_at = NOW() WHERE token_id = ${fix.tokenId};`);

    } catch (error) {
      console.error(`❌ Error processing token ${fix.tokenId}:`, error.message);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   🔧 ${fixes.length} evermarks need manual database updates`);
  console.log(`   💡 Use Supabase dashboard or direct SQL access to apply the changes`);
}

main().catch(console.error);