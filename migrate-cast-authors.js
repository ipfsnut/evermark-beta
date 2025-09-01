#!/usr/bin/env node

/**
 * Migration script to fix cast evermark authors
 * 
 * This script:
 * 1. Finds all cast evermarks with incorrect authors (wallet addresses)
 * 2. Fetches the correct cast metadata from Farcaster
 * 3. Updates the author field with the actual cast author
 * 
 * Usage:
 *   node migrate-cast-authors.js --dry-run    # Preview changes
 *   node migrate-cast-authors.js --execute    # Apply changes
 */

import https from 'https';
import { execSync } from 'child_process';

// Configuration
const API_BASE = 'https://evermarks.net/api';
const BATCH_SIZE = 5; // Process in small batches
const DELAY_MS = 1000; // Delay between requests to avoid rate limiting

// Utility functions
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractCastHash(url) {
  const hashMatch = url.match(/0x[a-fA-F0-9]+/);
  return hashMatch ? hashMatch[0] : null;
}

function extractUsernameFromUrl(url) {
  // Extract username from farcaster.xyz URLs: https://farcaster.xyz/kompreni/0xa9f15161
  const match = url.match(/farcaster\.xyz\/([^/]+)\/0x[a-fA-F0-9]+/);
  return match ? match[1] : null;
}

async function fetchCastMetadata(sourceUrl) {
  try {
    console.log(`  📡 Fetching cast metadata for: ${sourceUrl}`);
    
    const castHash = extractCastHash(sourceUrl);
    if (!castHash) {
      throw new Error('Could not extract cast hash from URL');
    }

    // Try to use our Netlify function
    const response = await makeRequest(`${API_BASE}/farcaster-cast?hash=${castHash}`);
    
    if (response.status === 200 && response.data?.success && response.data?.data) {
      const data = response.data.data;
      return {
        castHash: data.castHash || castHash,
        author: data.author || 'Unknown',
        username: data.username || '',
        content: data.content || '',
        timestamp: data.timestamp || new Date().toISOString(),
      };
    }
    
    // Fallback: extract username from URL
    console.log(`  ⚠️  API fetch failed, trying URL extraction...`);
    const username = extractUsernameFromUrl(sourceUrl);
    if (username) {
      return {
        castHash,
        author: username,
        username: username,
        content: 'Cast content from farcaster.xyz',
        timestamp: new Date().toISOString(),
      };
    }
    
    throw new Error('Could not fetch or extract cast metadata');
  } catch (error) {
    console.error(`  ❌ Failed to fetch cast metadata:`, error.message);
    return null;
  }
}

async function updateEvermarkAuthor(tokenId, newAuthor, dryRun = true) {
  if (dryRun) {
    console.log(`  🔍 DRY RUN: Would update token ${tokenId} author to "${newAuthor}"`);
    return { success: true };
  }

  try {
    console.log(`  📝 Updating token ${tokenId} author to "${newAuthor}"`);
    
    const updateData = {
      author: newAuthor,
      updated_at: new Date().toISOString()
    };

    const response = await makeRequest(`${API_BASE}/evermarks/${tokenId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Wallet-Address': '0x0000000000000000000000000000000000000000' // Admin override
      },
      body: JSON.stringify(updateData)
    });

    if (response.status === 200) {
      console.log(`  ✅ Successfully updated token ${tokenId}`);
      return { success: true, data: response.data };
    } else {
      console.error(`  ❌ Failed to update token ${tokenId}:`, response.data);
      return { success: false, error: response.data };
    }
  } catch (error) {
    console.error(`  ❌ Error updating token ${tokenId}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  const verbose = args.includes('--verbose');

  console.log('🔧 Cast Author Migration Script');
  console.log('================================');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('💡 Use --execute to apply changes');
  } else {
    console.log('⚡ EXECUTE MODE - Changes will be applied!');
  }
  console.log();

  try {
    // Step 1: Fetch all cast evermarks
    console.log('📋 Step 1: Fetching all cast evermarks...');
    const response = await makeRequest(`${API_BASE}/evermarks?content_type=Cast&limit=100`);
    
    if (response.status !== 200 || !response.data?.evermarks) {
      throw new Error('Failed to fetch cast evermarks');
    }

    const castEvermarks = response.data.evermarks;
    console.log(`✅ Found ${castEvermarks.length} cast evermarks`);
    
    if (castEvermarks.length === 0) {
      console.log('🎉 No cast evermarks to process!');
      return;
    }

    // Step 2: Identify evermarks that need fixing
    console.log('\n🔍 Step 2: Identifying evermarks that need fixing...');
    const needsFixing = [];
    
    for (const evermark of castEvermarks) {
      const hasWalletAuthor = evermark.author && evermark.author.match(/^0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}$/);
      const isWalletAddress = evermark.author && evermark.author.match(/^0x[a-fA-F0-9]{40}$/i);
      
      if (hasWalletAuthor || isWalletAddress) {
        needsFixing.push(evermark);
        console.log(`  🔴 Token ${evermark.token_id}: "${evermark.author}" needs fixing`);
      } else {
        console.log(`  ✅ Token ${evermark.token_id}: "${evermark.author}" looks correct`);
      }
    }

    if (needsFixing.length === 0) {
      console.log('🎉 No cast evermarks need author fixing!');
      return;
    }

    console.log(`\n📊 Found ${needsFixing.length} evermarks that need author correction`);

    // Step 3: Process each evermark that needs fixing
    console.log('\n🔄 Step 3: Processing evermarks...');
    const results = {
      success: 0,
      failed: 0,
      skipped: 0
    };

    for (let i = 0; i < needsFixing.length; i++) {
      const evermark = needsFixing[i];
      console.log(`\n[${i + 1}/${needsFixing.length}] Processing token ${evermark.token_id}:`);
      console.log(`  📝 Current author: "${evermark.author}"`);
      console.log(`  🔗 Source URL: ${evermark.source_url}`);

      // Fetch correct cast metadata
      const castData = await fetchCastMetadata(evermark.source_url);
      
      if (!castData || !castData.author) {
        console.log(`  ⏭️  Skipping - could not determine correct author`);
        results.skipped++;
        continue;
      }

      const newAuthor = castData.username || castData.author;
      console.log(`  ✨ Correct author: "${newAuthor}"`);

      if (newAuthor === evermark.author) {
        console.log(`  ✅ Author already correct, skipping`);
        results.skipped++;
        continue;
      }

      // Update the evermark
      const updateResult = await updateEvermarkAuthor(evermark.token_id, newAuthor, dryRun);
      
      if (updateResult.success) {
        results.success++;
      } else {
        results.failed++;
      }

      // Rate limiting
      if (i < needsFixing.length - 1) {
        await sleep(DELAY_MS);
      }
    }

    // Step 4: Summary
    console.log('\n📊 Migration Summary:');
    console.log('====================');
    console.log(`✅ Successfully processed: ${results.success}`);
    console.log(`❌ Failed to process: ${results.failed}`);
    console.log(`⏭️  Skipped: ${results.skipped}`);
    console.log(`📝 Total evermarks checked: ${castEvermarks.length}`);
    
    if (dryRun && results.success > 0) {
      console.log('\n💡 To apply these changes, run:');
      console.log('   node migrate-cast-authors.js --execute');
    }

    if (!dryRun && results.success > 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('💡 You may want to clear any frontend caches to see the updated authors.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (verbose) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);