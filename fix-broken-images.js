// Quick fix for broken evermarks 37-40
const fetch = require('node-fetch');

const BROKEN_EVERMARKS = [
  {
    token_id: 40,
    title: "An ecological theory of learning transfer in human activity",
    doi: "10.1080/10508406.2019.1702590",
    authors: ["Jurow, A. Susan", "Teeters, Lauren", "Shea, Marcus E."],
    journal: "Journal of the Learning Sciences", 
    year: "2020"
  },
  {
    token_id: 39,
    title: "An ecological theory of learning transfer in human activity", 
    doi: "10.1080/10508406.2019.1702590",
    authors: ["Jurow, A. Susan", "Teeters, Lauren", "Shea, Marcus E."],
    journal: "Journal of the Learning Sciences",
    year: "2020"
  },
  {
    token_id: 37,
    title: "An ecological theory of learning transfer in human activity",
    doi: "10.1080/10508406.2019.1702590", 
    authors: ["Jurow, A. Susan", "Teeters, Lauren", "Shea, Marcus E."],
    journal: "Journal of the Learning Sciences",
    year: "2020"
  }
];

async function fixEvermark(evermark) {
  console.log(`\n🔧 Fixing Token ${evermark.token_id}...`);
  
  try {
    // 1. Generate DOI cover
    console.log('📝 Generating DOI cover...');
    const coverResponse = await fetch('http://localhost:8888/.netlify/functions/generate-doi-cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...evermark,
        preview: true
      })
    });
    
    const coverResult = await coverResponse.json();
    if (!coverResult.success) {
      throw new Error('DOI cover generation failed');
    }
    
    // 2. Upload to ArDrive
    console.log('📁 Uploading to ArDrive...');
    const uploadResponse = await fetch('http://localhost:8888/.netlify/functions/ardrive-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadType: 'image',
        image: coverResult.imageUrl,
        filename: `doi-cover-${evermark.token_id}.svg`,
        contentType: 'image/svg+xml',
        tags: {
          'Content-Type': 'image/svg+xml',
          'Evermark-Type': 'image',
          'Token-ID': evermark.token_id.toString()
        }
      })
    });
    
    const uploadResult = await uploadResponse.json();
    if (!uploadResult.success) {
      throw new Error('ArDrive upload failed');
    }
    
    console.log(`✅ ArDrive TX: ${uploadResult.txId}`);
    console.log(`🔗 URL: ${uploadResult.url}`);
    
    // 3. Update database using Supabase REST API directly
    console.log('💾 Updating database...');
    
    // We'll need to use the Supabase REST API directly since the evermarks API doesn't support PATCH
    // For now, just log the update info
    console.log(`📋 Manual update needed for Token ${evermark.token_id}:`);
    console.log(`   SET ardrive_image_tx = '${uploadResult.txId}'`);
    console.log(`   WHERE token_id = ${evermark.token_id}`);
    
    return {
      token_id: evermark.token_id,
      ardrive_image_tx: uploadResult.txId,
      url: uploadResult.url
    };
    
  } catch (error) {
    console.error(`❌ Failed to fix Token ${evermark.token_id}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting to fix broken evermarks...\n');
  
  const results = [];
  
  for (const evermark of BROKEN_EVERMARKS) {
    const result = await fixEvermark(evermark);
    if (result) {
      results.push(result);
    }
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('\n📊 Summary:');
  results.forEach(result => {
    console.log(`Token ${result.token_id}: ${result.ardrive_image_tx}`);
  });
  
  console.log('\n✅ Done! Images uploaded to ArDrive, database updates needed.');
}

main().catch(console.error);