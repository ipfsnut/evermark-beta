// Check what images exist in metadata vs generated
import { createThirdwebClient, defineChain, getContract } from 'thirdweb';
import { tokenURI } from 'thirdweb/extensions/erc721';

const client = createThirdwebClient({ 
  clientId: process.env.VITE_THIRDWEB_CLIENT_ID
});

const chain = defineChain(8453);
const contract = getContract({
  client,
  chain,
  address: "0x504a0BDC3aea29237a6f8E53D0ECDA8e4c9009F2"
});

async function checkTokenImages(tokenId) {
  try {
    console.log(`\n=== TOKEN ${tokenId} IMAGES ===`);
    
    // Get metadata
    const uri = await tokenURI({ contract, tokenId: BigInt(tokenId) });
    const ipfsHash = uri.replace('ipfs://', '');
    const metadataUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
    
    const response = await fetch(metadataUrl);
    const metadata = await response.json();
    
    console.log(`Title: ${metadata.name}`);
    
    // Check IPFS image in metadata
    if (metadata.image) {
      console.log(`📷 IPFS Image: ${metadata.image}`);
      
      // Test if image is accessible
      try {
        const imageUrl = metadata.image.startsWith('ipfs://') 
          ? `https://gateway.pinata.cloud/ipfs/${metadata.image.replace('ipfs://', '')}`
          : metadata.image;
        
        const imageResponse = await fetch(imageUrl, { method: 'HEAD' });
        console.log(`   Status: ${imageResponse.ok ? '✅ Accessible' : '❌ Not accessible'}`);
      } catch {
        console.log(`   Status: ❌ Error checking accessibility`);
      }
    } else {
      console.log(`📷 IPFS Image: ❌ None in metadata`);
    }
    
    // Check if this should have a generated cast image
    if (metadata.evermark?.contentType === 'Cast') {
      console.log(`🎨 Cast Image: Should be auto-generated (token #${tokenId} is Cast type)`);
    } else {
      console.log(`🎨 Cast Image: N/A (not Cast content)`);
    }
    
  } catch (error) {
    console.error(`Error checking token ${tokenId}:`, error.message);
  }
}

async function main() {
  console.log('🔍 Checking images for tokens 8-17...');
  
  for (const tokenId of [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]) {
    await checkTokenImages(tokenId);
  }
  
  console.log('\n✅ Image check completed');
}

main().catch(console.error);