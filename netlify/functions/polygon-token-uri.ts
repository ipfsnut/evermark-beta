import { Handler } from '@netlify/functions';
import { createPublicClient, http } from 'viem';
import { polygon } from 'viem/chains';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

// ERC1155 ABI - just the uri function we need
const ERC1155_ABI = [
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'uri',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  }
] as const;

// Polygon RPC endpoints
const POLYGON_RPC_URLS = [
  'https://polygon-rpc.com',
  'https://rpc-mainnet.maticvigil.com',
  'https://polygon.llamarpc.com',
  'https://polygon.drpc.org',
];

export const handler: Handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { contract, tokenId } = event.queryStringParameters || {};
    
    if (!contract || !tokenId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing contract or tokenId parameter' })
      };
    }

    console.log(`🔍 Fetching tokenURI from Polygon contract ${contract} for token ${tokenId}`);

    // Try multiple RPC endpoints in case one fails
    let tokenUri = null;
    let lastError = null;

    for (const rpcUrl of POLYGON_RPC_URLS) {
      try {
        console.log(`📡 Trying RPC: ${rpcUrl}`);
        
        // Create viem client
        const client = createPublicClient({
          chain: polygon,
          transport: http(rpcUrl),
        });
        
        // Call uri() function (ERC1155 standard)
        tokenUri = await client.readContract({
          address: contract as `0x${string}`,
          abi: ERC1155_ABI,
          functionName: 'uri',
          args: [BigInt(tokenId)],
        });
        
        console.log(`✅ Got tokenURI: ${tokenUri}`);
        
        // Replace {id} placeholder with actual token ID (ERC1155 standard)
        if (tokenUri.includes('{id}')) {
          // Convert tokenId to hex and pad to 64 characters
          const hexId = BigInt(tokenId).toString(16).padStart(64, '0');
          tokenUri = tokenUri.replace('{id}', hexId);
          console.log(`📝 Replaced {id} placeholder: ${tokenUri}`);
        }
        
        break; // Success, exit loop
      } catch (error) {
        console.warn(`⚠️ RPC ${rpcUrl} failed:`, error);
        lastError = error;
        continue;
      }
    }

    if (!tokenUri) {
      throw lastError || new Error('Failed to fetch tokenURI from all RPC endpoints');
    }

    // Fetch the metadata from IPFS
    let metadata = null;
    if (tokenUri.startsWith('ipfs://')) {
      const ipfsHash = tokenUri.replace('ipfs://', '');
      const ipfsGateways = [
        `https://ipfs.nftbookbazaar.com/ipfs/${ipfsHash}`,
        `https://ipfs.io/ipfs/${ipfsHash}`,
        `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
      ];

      for (const gateway of ipfsGateways) {
        try {
          console.log(`📥 Fetching metadata from: ${gateway}`);
          const response = await fetch(gateway);
          if (response.ok) {
            metadata = await response.json();
            console.log(`✅ Got metadata from IPFS`);
            break;
          }
        } catch (error) {
          console.warn(`⚠️ Failed to fetch from ${gateway}:`, error);
          continue;
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        contract,
        tokenId,
        tokenUri,
        metadata,
        imageUrl: metadata?.image,
        name: metadata?.name,
        description: metadata?.description
      })
    };

  } catch (error) {
    console.error('❌ Failed to fetch tokenURI:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    };
  }
};