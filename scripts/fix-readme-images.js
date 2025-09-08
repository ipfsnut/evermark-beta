#!/usr/bin/env node

/**
 * Script to fix README book images that are currently stored as squares
 * 
 * This will:
 * 1. Find all README books in the database
 * 2. Re-fetch their images using improved IPFS extraction
 * 3. Re-cache them with proper aspect ratio preservation
 */

const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://evermarks.net'
  : 'http://localhost:8888';

async function fixReadmeImages() {
  console.log('🔧 Starting README book image fix...');
  console.log(`📡 Using API base: ${API_BASE}`);

  try {
    console.log('📤 Triggering README image fix...');
    
    const response = await fetch(`${API_BASE}/.netlify/functions/fix-readme-images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        trigger: 'manual',
        source: 'script'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fix request failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    console.log('📊 Fix Results:');
    console.log(`   📚 Total README books found: ${result.totalFound}`);
    console.log(`   ✅ Successfully processed: ${result.processed}`);
    console.log(`   ❌ Failed: ${result.failed}`);
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    if (result.processed > 0) {
      console.log('\n✅ README book images have been fixed!');
      console.log('   The images should now display with proper book cover aspect ratios.');
      console.log('   You may need to refresh your browser to see the changes.');
    } else {
      console.log('\n⚠️  No images were processed. This might mean:');
      console.log('   - No README books found in the database');
      console.log('   - All README books already have properly processed images');
      console.log('   - There was an issue with the processing');
    }

  } catch (error) {
    console.error('❌ Failed to fix README images:', error.message);
    process.exit(1);
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixReadmeImages().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { fixReadmeImages };