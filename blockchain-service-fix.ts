// Fix for BlockchainService.canAffordMint() - Correct Thirdweb v5 usage

// WRONG (current code):
const rpcRequest = getRpcClient({
  client,
  chain: getEvermarkNFTContract().chain,
});

const balance = await rpcRequest({
  method: 'eth_getBalance',
  params: [account.address, 'latest'],
});

// CORRECT (Thirdweb v5):
import { eth_getBalance } from 'thirdweb/rpc';

const balance = await eth_getBalance({
  client,
  chain: getEvermarkNFTContract().chain,
  address: account.address,
  blockTag: 'latest'
});

// OR use the RPC client correctly:
const rpcClient = getRpcClient({
  client,
  chain: getEvermarkNFTContract().chain,
});

const balance = await rpcClient.request({
  method: 'eth_getBalance',
  params: [account.address, 'latest'],
});