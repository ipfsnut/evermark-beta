#!/usr/bin/env node

/**
 * Script to update README book image sources in the database
 * 
 * This will:
 * 1. Find all README books in the database
 * 2. Analyze their metadata for better image sources
 * 3. Update IPFS hashes to point to higher quality images
 * 4. Clear cached images so they get re-processed with correct aspect ratios
 */

const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://evermarks.net'
  : 'http://localhost:8888';

async function updateReadmeImageSources() {
  console.log('🔧 Starting README book image source update...');
  console.log(`📡 Using API base: ${API_BASE}`);

  try {
    console.log('📤 Triggering README image source update...');
    
    const response = await fetch(`${API_BASE}/.netlify/functions/update-readme-images`, {
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
      throw new Error(`Update request failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    console.log('📊 Update Results:');
    console.log(`   📚 Total README books analyzed: ${result.totalBooks}`);
    console.log(`   ✅ Image sources updated: ${result.updated}`);
    console.log(`   ❌ Failed: ${result.failed}`);
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    if (result.updated > 0) {
      console.log('\n✅ README book image sources have been updated!');
      console.log('   Next steps:');
      console.log('   1. Run the cache-images function to process the new images');
      console.log('   2. The images should now display with proper book cover aspect ratios');
    } else {
      console.log('\n⚠️  No image sources were updated. This might mean:');
      console.log('   - All README books already have the best available image sources');
      console.log('   - No better quality images were found in the metadata');
    }

  } catch (error) {
    console.error('❌ Failed to update README image sources:', error.message);
    process.exit(1);
  }
}

// Run the update if this script is executed directly
updateReadmeImageSources().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});