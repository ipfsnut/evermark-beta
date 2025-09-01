// Simple script to repair author fields for evermarks #6 and #7
// Uses the local netlify dev server to make updates

async function repairAuthors() {
  console.log('🔧 Repairing author fields for evermarks #6 and #7...');
  
  // First, let's check if we can look up Farcaster usernames for these addresses
  const addresses = [
    '0x18a85ad341b2d6a2bd67fbb104b4827b922a2a3c', // #6
    '0x58e5c387c541ba7c4b04f126adb778fb02715afa'  // #7
  ];
  
  for (let i = 0; i < addresses.length; i++) {
    const tokenId = 6 + i;
    const address = addresses[i];
    const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
    
    console.log(`\n📍 Evermark #${tokenId}: ${truncated}`);
    
    try {
      // For now, let's just update with proper truncated address format
      // Later we can enhance this to check Farcaster/ENS
      
      const updateResponse = await fetch(`http://localhost:8888/.netlify/functions/evermarks/${tokenId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Wallet-Address': address
        },
        body: JSON.stringify({
          author: truncated,
          metadata_json: JSON.stringify({
            tags: tokenId === 6 ? ['doi', 'academic'] : ['twitter', 'social'],
            customFields: [
              { key: 'content_type', value: tokenId === 6 ? 'DOI' : 'URL' },
              { key: 'creator_address', value: address }
            ]
          })
        })
      });
      
      if (updateResponse.ok) {
        console.log(`✅ Updated evermark #${tokenId} author to: ${truncated}`);
      } else {
        const error = await updateResponse.text();
        console.log(`❌ Failed to update #${tokenId}: ${error}`);
      }
      
    } catch (error) {
      console.log(`❌ Error updating #${tokenId}:`, error.message);
    }
  }
}

repairAuthors().catch(console.error);