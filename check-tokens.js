// Simple script to retrieve and display metadata for tokens 8-17
// Just fetches and shows - no database operations

import { createThirdwebClient, defineChain, getContract } from 'thirdweb';
import { tokenURI } from 'thirdweb/extensions/erc721';

const client = createThirdwebClient({ 
  clientId: process.env.VITE_THIRDWEB_CLIENT_ID || "your_client_id_here"
});

const chain = defineChain(8453); // Base
const contract = getContract({
  client,
  chain,
  address: "0x504a0BDC3aea29237a6f8E53D0ECDA8e4c9009F2"
});

async function getTokenMetadata(tokenId) {
  try {
    console.log(`\n=== TOKEN ${tokenId} ===`);
    
    // Get tokenURI
    const uri = await tokenURI({ contract, tokenId: BigInt(tokenId) });
    console.log(`TokenURI: ${uri}`);
    
    // Fetch metadata from IPFS
    if (uri.startsWith('ipfs://')) {
      const ipfsHash = uri.replace('ipfs://', '');
      const metadataUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
      
      console.log(`Fetching metadata from: ${metadataUrl}`);
      
      const response = await fetch(metadataUrl);
      if (response.ok) {
        const metadata = await response.json();
        
        // Display key information
        console.log(`Title: ${metadata.name}`);
        console.log(`Description: ${metadata.description}`);
        console.log(`Content Type: ${metadata.evermark?.contentType || 'Unknown'}`);
        console.log(`Source URL: ${metadata.external_url || metadata.evermark?.sourceUrl || 'None'}`);
        console.log(`Author: ${metadata.evermark?.castData?.author || metadata.attributes?.find(a => a.trait_type === 'Creator')?.value || 'Unknown'}`);
        
        // Show if it has cast data
        if (metadata.evermark?.castData) {
          console.log(`Cast Author: ${metadata.evermark.castData.author}`);
          console.log(`Cast Content: ${metadata.evermark.castData.content?.substring(0, 100)}...`);
          console.log(`Cast Hash: ${metadata.evermark.castData.hash}`);
        }
        
        // Show if it has image
        if (metadata.image) {
          console.log(`Image: ${metadata.image}`);
        }
        
      } else {
        console.log(`Failed to fetch metadata: ${response.status}`);
      }
    }
  } catch (error) {
    console.error(`Error getting token ${tokenId}:`, error.message);
  }
}

// Check tokens 8-17
async function main() {
  console.log('🔍 Checking metadata for tokens 8-17...');
  
  for (const tokenId of [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]) {
    await getTokenMetadata(tokenId);
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n✅ Metadata check completed');
}

main().catch(console.error);