#!/usr/bin/env node

/**
 * Simple script to run the cast author migration via Netlify function
 * 
 * Usage:
 *   node run-migration.js --dry-run      # Preview changes
 *   node run-migration.js --execute      # Apply changes
 */

import https from 'https';

const ADMIN_WALLET = '0x3427b4716B90C11F9971e43999a48A47Cf5B571E';
const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8888/.netlify/functions' 
  : 'https://evermarks.net/.netlify/functions';

function makeRequest(url, options = {}) {
  const urlObj = new URL(url);
  const isHttps = urlObj.protocol === 'https:';
  const client = isHttps ? https : require('http');

  return new Promise((resolve, reject) => {
    const req = client.request(url, options, (res) => {
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

async function runMigration(dryRun = true) {
  console.log('🔧 Cast Author Migration');
  console.log('========================');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('💡 Use --execute to apply changes');
  } else {
    console.log('⚡ EXECUTE MODE - Changes will be applied!');
  }
  console.log();

  try {
    console.log('📡 Calling migration function...');
    
    const response = await makeRequest(`${API_BASE}/migrate-cast-authors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Wallet-Address': ADMIN_WALLET
      },
      body: JSON.stringify({
        action: 'migrate',
        dryRun: dryRun
      })
    });

    if (response.status === 200 && response.data?.success) {
      const result = response.data;
      console.log('✅ Migration completed!');
      console.log();
      console.log('📊 Results:');
      console.log(`   📝 Processed: ${result.processed}`);
      console.log(`   ✅ Updated: ${result.updated}`);
      console.log(`   ⏭️  Skipped: ${result.skipped}`);
      console.log(`   ❌ Errors: ${result.errors?.length || 0}`);

      if (result.errors && result.errors.length > 0) {
        console.log();
        console.log('❌ Errors encountered:');
        result.errors.forEach(error => console.log(`   • ${error}`));
      }

      if (dryRun && result.processed > 0) {
        console.log();
        console.log('💡 To apply these changes, run:');
        console.log('   node run-migration.js --execute');
      }

    } else {
      console.error('❌ Migration failed:');
      console.error('Status:', response.status);
      console.error('Response:', response.data);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error calling migration function:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');

// Run migration
runMigration(dryRun).catch(console.error);