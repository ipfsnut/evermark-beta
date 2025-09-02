// Quick script to fetch missing token metadata
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
        console.log('Metadata:', JSON.stringify(metadata, null, 2));
      } else {
        console.log(`Failed to fetch metadata: ${response.status}`);
      }
    }
  } catch (error) {
    console.error(`Error getting token ${tokenId}:`, error.message);
  }
}

// Get metadata for missing tokens
async function main() {
  console.log('Fetching metadata for missing tokens...');
  
  for (const tokenId of [8, 9, 10, 11]) {
    await getTokenMetadata(tokenId);
  }
}

main().catch(console.error);