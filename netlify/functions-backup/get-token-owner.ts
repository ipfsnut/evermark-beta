import { Handler } from '@netlify/functions';
import { createThirdwebClient, defineChain, getContract } from 'thirdweb';
import { ownerOf } from 'thirdweb/extensions/erc721';

const client = createThirdwebClient({ 
  clientId: process.env.VITE_THIRDWEB_CLIENT_ID! 
});

const chain = defineChain(8453); // Base

const contract = getContract({
  client,
  chain,
  address: process.env.VITE_EVERMARK_NFT_ADDRESS!
});

export const handler: Handler = async (event, context) => {
  try {
    const tokenId = event.queryStringParameters?.tokenId;
    
    if (!tokenId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Missing tokenId parameter'
        })
      };
    }

    console.log(`🔍 Looking up owner for token #${tokenId}`);

    const owner = await ownerOf({
      contract,
      tokenId: BigInt(tokenId)
    });

    console.log(`✅ Token #${tokenId} owner: ${owner}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        tokenId: parseInt(tokenId),
        owner
      })
    };

  } catch (error) {
    console.error('❌ Failed to get token owner:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to get token owner',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};