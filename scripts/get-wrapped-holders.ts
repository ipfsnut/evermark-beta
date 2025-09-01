// Script to get all holders and balances for the wrapped evermark contract
// Contract: 0xfdc28dbd5417e363909e091aa26b00ca4d281607

import { createPublicClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';

const CONTRACT_ADDRESS = '0xfdc28dbd5417e363909e091aa26b00ca4d281607';
const BLOCK_RANGE = 10000; // Process blocks in chunks to avoid rate limits

// Standard ERC20 ABI with Transfer events
const ERC20_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "from", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "to", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "value", "type": "uint256"}
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// Create public client for Base network
const publicClient = createPublicClient({
  chain: base,
  transport: http()
});

interface HolderInfo {
  address: string;
  balance: bigint;
  formattedBalance: string;
}

async function getTokenInfo() {
  try {
    console.log('🔍 Getting token information...');
    
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'name'
      }),
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'symbol'
      }),
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'decimals'
      }),
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'totalSupply'
      })
    ]);

    console.log(`📋 Token: ${name} (${symbol})`);
    console.log(`🔢 Decimals: ${decimals}`);
    console.log(`💰 Total Supply: ${formatUnits(totalSupply as bigint, decimals as number)}`);
    
    return { name, symbol, decimals: decimals as number, totalSupply: totalSupply as bigint };
  } catch (error) {
    console.error('❌ Error getting token info:', error);
    throw error;
  }
}

async function getAllHolders(): Promise<HolderInfo[]> {
  try {
    const tokenInfo = await getTokenInfo();
    console.log('\n🔍 Scanning for all holders via Transfer events...');
    
    // Get the current block number
    const currentBlock = await publicClient.getBlockNumber();
    console.log(`📊 Current block: ${currentBlock}`);
    
    // Get all transfer events from contract deployment to current block
    // We'll process in chunks to avoid rate limits
    const uniqueAddresses = new Set<string>();
    let fromBlock = 0n; // Start from genesis block
    
    console.log('📡 Fetching Transfer events...');
    
    while (fromBlock < currentBlock) {
      const toBlock = fromBlock + BigInt(BLOCK_RANGE) > currentBlock 
        ? currentBlock 
        : fromBlock + BigInt(BLOCK_RANGE);
      
      try {
        const logs = await publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          event: {
            name: 'Transfer',
            type: 'event',
            inputs: [
              { name: 'from', type: 'address', indexed: true },
              { name: 'to', type: 'address', indexed: true },
              { name: 'value', type: 'uint256', indexed: false }
            ]
          },
          fromBlock,
          toBlock
        });
        
        // Extract unique addresses from Transfer events
        logs.forEach(log => {
          const args = log.args as { from: string; to: string; value: bigint };
          if (args.from !== '0x0000000000000000000000000000000000000000') {
            uniqueAddresses.add(args.from);
          }
          if (args.to !== '0x0000000000000000000000000000000000000000') {
            uniqueAddresses.add(args.to);
          }
        });
        
        console.log(`✅ Processed blocks ${fromBlock} to ${toBlock}, found ${logs.length} transfers, total unique addresses: ${uniqueAddresses.size}`);
      } catch (error) {
        console.error(`❌ Error fetching logs for blocks ${fromBlock}-${toBlock}:`, error);
        // If we hit rate limits, try smaller chunks
        if (fromBlock + 1000n < toBlock) {
          fromBlock += 1000n;
          continue;
        }
      }
      
      fromBlock = toBlock + 1n;
    }
    
    console.log(`\n🎯 Found ${uniqueAddresses.size} unique addresses, checking balances...`);
    
    // Get current balances for all unique addresses
    const holders: HolderInfo[] = [];
    const addressArray = Array.from(uniqueAddresses);
    
    // Process addresses in batches to avoid overwhelming the RPC
    const batchSize = 50;
    for (let i = 0; i < addressArray.length; i += batchSize) {
      const batch = addressArray.slice(i, i + batchSize);
      
      try {
        const balancePromises = batch.map(address => 
          publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address as `0x${string}`]
          }).then(balance => ({ address, balance: balance as bigint }))
        );
        
        const batchResults = await Promise.allSettled(balancePromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const { address, balance } = result.value;
            if (balance > 0n) {
              holders.push({
                address,
                balance,
                formattedBalance: formatUnits(balance, tokenInfo.decimals)
              });
            }
          } else {
            console.warn(`⚠️ Failed to get balance for ${batch[index]}:`, result.reason);
          }
        });
        
        console.log(`✅ Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(addressArray.length/batchSize)}, current holders: ${holders.length}`);
      } catch (error) {
        console.error(`❌ Error processing batch starting at index ${i}:`, error);
      }
    }
    
    // Sort by balance (highest first)
    holders.sort((a, b) => a.balance > b.balance ? -1 : 1);
    
    return holders;
  } catch (error) {
    console.error('❌ Error scanning for holders:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log(`🚀 Getting all holders for wrapped evermark contract: ${CONTRACT_ADDRESS}\n`);
    
    const holders = await getAllHolders();
    
    console.log(`\n📊 RESULTS: Found ${holders.length} holders with non-zero balances\n`);
    console.log('=' * 80);
    console.log('RANK | ADDRESS                                    | BALANCE');
    console.log('=' * 80);
    
    holders.forEach((holder, index) => {
      const rank = (index + 1).toString().padStart(4, ' ');
      const balance = parseFloat(holder.formattedBalance).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
      });
      console.log(`${rank} | ${holder.address} | ${balance.padStart(15, ' ')}`);
    });
    
    console.log('=' * 80);
    
    // Calculate some statistics
    const totalBalance = holders.reduce((sum, holder) => sum + holder.balance, 0n);
    const averageBalance = holders.length > 0 ? totalBalance / BigInt(holders.length) : 0n;
    const tokenInfo = await getTokenInfo();
    
    console.log(`\n📈 STATISTICS:`);
    console.log(`Total Holders: ${holders.length}`);
    console.log(`Total Distributed: ${formatUnits(totalBalance, tokenInfo.decimals)} ${tokenInfo.symbol}`);
    console.log(`Average Balance: ${formatUnits(averageBalance, tokenInfo.decimals)} ${tokenInfo.symbol}`);
    console.log(`Largest Holder: ${holders[0]?.formattedBalance || '0'} ${tokenInfo.symbol} (${holders[0]?.address || 'N/A'})`);
    
  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main();