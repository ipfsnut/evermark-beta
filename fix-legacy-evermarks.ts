// scripts/fix-legacy-evermarks.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// IPFS gateways in order of preference
const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs',
  'https://ipfs.io/ipfs',
  'https://cloudflare-ipfs.com/ipfs',
  'https://dweb.link/ipfs'
];

interface EvermarkRecord {
  token_id: number;
  title: string;
  token_uri: string;
  ipfs_image_hash?: string;
  metadata_json?: string;
  cache_status?: string;
  ipfs_metadata_hash?: string;
}

interface FixResult {
  tokenId: number;
  success: boolean;
  imageName?: string;
  imageHash?: string;
  metadataHash?: string;
  error?: string;
  changes?: Record<string, any>;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Extract IPFS hash from various URI formats
 */
function extractIPFSHash(uri: string): string | null {
  if (!uri) return null;
  
  // Handle ipfs:// protocol
  if (uri.startsWith('ipfs://')) {
    return uri.replace('ipfs://', '');
  }
  
  // Handle gateway URLs - more robust pattern
  const ipfsPattern = /\/ipfs\/([QmZkb][a-zA-Z0-9]{44,59})/;
  const match = uri.match(ipfsPattern);
  return match ? match[1] : null;
}

/**
 * Fetch metadata from IPFS with multiple gateway fallback
 */
async function fetchMetadataFromIPFS(hash: string): Promise<any> {
  let lastError: Error | null = null;
  
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const url = `${gateway}/${hash}`;
      console.log(`    🌐 Trying: ${new URL(url).hostname}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(url, {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Evermark-Legacy-Fixer/1.0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`    ⚠️ HTTP ${response.status}: ${response.statusText}`);
        continue;
      }
      
      const text = await response.text();
      
      // Validate it's JSON
      let metadata: any;
      try {
        metadata = JSON.parse(text);
      } catch (parseError) {
        console.log(`    ⚠️ Invalid JSON from ${new URL(url).hostname}`);
        continue;
      }
      
      // Validate required fields for Evermark metadata
      if (!metadata.name && !metadata.title) {
        console.log(`    ⚠️ Missing name/title field`);
        continue;
      }
      
      if (!metadata.image) {
        console.log(`    ⚠️ Missing image field`);
        continue;
      }
      
      console.log(`    ✅ Success: ${metadata.name || metadata.title}`);
      return metadata;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.log(`    ❌ Error: ${lastError.message}`);
      continue;
    }
  }
  
  throw lastError || new Error('Could not fetch metadata from any IPFS gateway');
}

/**
 * Fix a single Evermark record
 */
async function fixSingleRecord(record: EvermarkRecord): Promise<FixResult> {
  console.log(`\n🔧 Processing Token ${record.token_id}: ${record.title}`);
  
  try {
    // Step 1: Extract metadata hash from token_uri
    const metadataHash = extractIPFSHash(record.token_uri);
    if (!metadataHash) {
      return {
        tokenId: record.token_id,
        success: false,
        error: 'Could not extract IPFS hash from token_uri'
      };
    }
    
    console.log(`  📋 Metadata hash: ${metadataHash.slice(0, 12)}...`);
    
    // Step 2: Check if already processed correctly
    if (record.ipfs_image_hash && record.metadata_json) {
      console.log(`  ✅ Already processed correctly, skipping`);
      return {
        tokenId: record.token_id,
        success: true,
        skipped: true,
        skipReason: 'Already processed correctly'
      };
    }
    
    // Step 3: Fetch metadata from IPFS
    console.log(`  📥 Fetching metadata from IPFS...`);
    const metadata = await fetchMetadataFromIPFS(metadataHash);
    
    // Step 4: Extract real image hash from metadata.image
    const imageHash = extractIPFSHash(metadata.image);
    if (!imageHash) {
      throw new Error(`Invalid image field in metadata: ${metadata.image}`);
    }
    
    console.log(`  🖼️ Found image: ${imageHash.slice(0, 12)}...`);
    
    // Step 5: Prepare database updates
    const updates: Record<string, any> = {
      ipfs_image_hash: imageHash,
      metadata_json: JSON.stringify(metadata),
      ipfs_metadata_hash: metadataHash,
      cache_status: 'metadata_parsed',
      metadata_processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Step 6: Apply updates to database
    if (DRY_RUN) {
      console.log(`  🧪 DRY RUN - Would update:`, updates);
    } else {
      console.log(`  💾 Updating database...`);
      const { error } = await supabase
        .from('evermarks')
        .update(updates)
        .eq('token_id', record.token_id);
      
      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }
    }
    
    console.log(`  ✅ Success: ${metadata.name || metadata.title}`);
    
    return {
      tokenId: record.token_id,
      success: true,
      imageName: metadata.name || metadata.title,
      imageHash: imageHash,
      metadataHash: metadataHash,
      changes: updates
    };
    
  } catch (error) {
    console.log(`  ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // Update record with error status (even in dry run for tracking)
    if (!DRY_RUN) {
      await supabase
        .from('evermarks')
        .update({
          cache_status: 'failed',
          processing_errors: error instanceof Error ? error.message : 'Unknown error',
          updated_at: new Date().toISOString()
        })
        .eq('token_id', record.token_id);
    }
    
    return {
      tokenId: record.token_id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Main function to fix all legacy Evermarks
 */
async function fixAllLegacyEvermarks(): Promise<void> {
  console.log('🚀 EVERMARK LEGACY FIXER');
  console.log('=' * 50);
  console.log(`Mode: ${DRY_RUN ? '🧪 DRY RUN (no changes will be made)' : '🔧 LIVE RUN (will update database)'}`);
  console.log('Goal: Fix metadata-as-image issues in existing records\n');
  
  try {
    // Step 1: Test Supabase connection
    console.log('🔌 Testing Supabase connection...');
    const { error: connectionError } = await supabase.from('evermarks').select('token_id').limit(1);
    if (connectionError) {
      throw new Error(`Supabase connection failed: ${connectionError.message}`);
    }
    console.log('✅ Supabase connection successful\n');
    
    // Step 2: Fetch all records that need fixing
    console.log('📥 Fetching records that need fixing...');
    
    const { data: records, error } = await supabase
      .from('evermarks')
      .select('token_id, title, token_uri, ipfs_image_hash, metadata_json, cache_status, ipfs_metadata_hash')
      .not('token_uri', 'is', null)
      .order('token_id');
    
    if (error) {
      throw new Error(`Failed to fetch records: ${error.message}`);
    }
    
    if (!records || records.length === 0) {
      console.log('📭 No records found to process');
      return;
    }
    
    console.log(`📊 Found ${records.length} total records`);
    
    // Filter to only records that actually need fixing
    const recordsToFix = records.filter(r => {
      // Skip if already properly processed
      return !(r.ipfs_image_hash && r.metadata_json);
    });
    
    console.log(`🔧 ${recordsToFix.length} records need fixing`);
    console.log(`✅ ${records.length - recordsToFix.length} records already correct\n`);
    
    if (recordsToFix.length === 0) {
      console.log('🎉 All records are already properly processed!');
      return;
    }
    
    // Step 3: Process each record
    const results: FixResult[] = [];
    
    for (let i = 0; i < recordsToFix.length; i++) {
      const record = recordsToFix[i]!;
      
      console.log(`\n[${i + 1}/${recordsToFix.length}]`);
      
      const result = await fixSingleRecord(record);
      results.push(result);
      
      // Small delay to avoid overwhelming IPFS gateways
      if (i < recordsToFix.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }
    
    // Step 4: Generate summary report
    console.log('\n' + '=' * 60);
    console.log('🎉 PROCESSING COMPLETE!');
    console.log('=' * 60);
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const skipped = results.filter(r => r.skipped);
    
    console.log(`📊 RESULTS:`);
    console.log(`  • Total Processed: ${results.length}`);
    console.log(`  • Successful: ${successful.length}`);
    console.log(`  • Skipped: ${skipped.length}`);
    console.log(`  • Failed: ${failed.length}`);
    console.log(`  • Success Rate: ${((successful.length / results.length) * 100).toFixed(1)}%`);
    
    if (successful.length > 0) {
      console.log(`\n✅ SUCCESSFULLY FIXED:`);
      successful.forEach(r => {
        if (!r.skipped) {
          console.log(`  • Token ${r.tokenId}: ${r.imageName} (${r.imageHash?.slice(0, 8)}...)`);
        }
      });
    }
    
    if (skipped.length > 0) {
      console.log(`\n⏭️ SKIPPED (already correct):`);
      skipped.forEach(r => {
        console.log(`  • Token ${r.tokenId}: ${r.skipReason}`);
      });
    }
    
    if (failed.length > 0) {
      console.log(`\n❌ FAILED TO FIX:`);
      failed.forEach(r => {
        console.log(`  • Token ${r.tokenId}: ${r.error}`);
      });
    }
    
    // Step 5: Post-processing instructions
    if (!DRY_RUN && successful.filter(r => !r.skipped).length > 0) {
      console.log(`\n🔍 VERIFICATION:`);
      console.log('Run this query in Supabase to verify the fixes:');
      console.log(`
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN ipfs_image_hash IS NOT NULL THEN 1 END) as has_image_hash,
  COUNT(CASE WHEN metadata_json IS NOT NULL THEN 1 END) as has_metadata,
  COUNT(CASE WHEN ipfs_image_hash IS NOT NULL AND metadata_json IS NOT NULL THEN 1 END) as fully_processed,
  COUNT(CASE WHEN cache_status = 'metadata_parsed' THEN 1 END) as parsed_status
FROM evermarks;
      `);
      
      console.log(`\n🧹 CLEANUP:`);
      console.log('After verifying the results work correctly:');
      console.log('  rm scripts/fix-legacy-evermarks.ts');
      
      console.log(`\n🚀 NEXT STEPS:`);
      console.log('1. Test image loading in your app');
      console.log('2. Verify SDK components work correctly');
      console.log('3. Check that images load: Supabase → IPFS → Placeholder');
    }
    
    if (DRY_RUN) {
      console.log(`\n🔧 TO APPLY CHANGES:`);
      console.log('Run: npm run migrate:legacy');
      console.log('(This will run the script with DRY_RUN=false)');
    }
    
  } catch (error) {
    console.error('\n💥 FATAL ERROR:', error);
    process.exit(1);
  }
}

/**
 * Run the script
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  fixAllLegacyEvermarks()
    .then(() => {
      console.log('\n🎯 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { fixAllLegacyEvermarks };