// Generate cast images for recovered tokens 8-17
// Calls the generate-cast-image endpoint for each Cast token

async function generateCastImage(tokenId) {
  try {
    console.log(`🎨 Generating image for token ${tokenId}...`);
    
    const response = await fetch('http://localhost:8888/.netlify/functions/generate-cast-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token_id: parseInt(tokenId) })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Image generated for token ${tokenId}:`, result.message || 'Success');
      return true;
    } else {
      const error = await response.text();
      console.log(`❌ Image generation failed for token ${tokenId}:`, error);
      return false;
    }
  } catch (error) {
    console.log(`❌ Image generation error for token ${tokenId}:`, error.message);
    return false;
  }
}

async function generateImages() {
  console.log('🎨 Generating cast images for recovered tokens...\n');
  
  // All recovered tokens are Cast type, so generate images for all
  const tokens = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const results = [];
  
  for (const tokenId of tokens) {
    const success = await generateCastImage(tokenId);
    results.push({ tokenId, success });
    
    // Brief delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success);
  
  console.log('\n📊 Image Generation Summary:');
  console.log('='.repeat(40));
  console.log(`✅ Successful: ${successful}/${tokens.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  if (failed.length > 0) {
    console.log('\n❌ Failed tokens:');
    failed.forEach(r => console.log(`  Token ${r.tokenId}`));
  }
  
  console.log('\n✅ Image generation completed');
}

generateImages().catch(console.error);