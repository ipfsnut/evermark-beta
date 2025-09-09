import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatEther } from 'viem';
import { eth_getBalance } from 'thirdweb/rpc';
import { getRpcClient } from 'thirdweb/rpc';
import { client } from '@/lib/thirdweb';
import { base } from 'thirdweb/chains';

interface WalletBalanceTrackerProps {
  walletAddress: `0x${string}`;
  walletName: string;
  description?: string;
  refreshInterval?: number;
}

export function WalletBalanceTracker({ 
  walletAddress, 
  walletName, 
  description,
  refreshInterval = 30000 // 30 seconds
}: WalletBalanceTrackerProps) {
  const { data: balance, isLoading, error, isRefetching } = useQuery({
    queryKey: ['wallet-balance', walletAddress],
    queryFn: async () => {
      const rpcRequest = getRpcClient({
        client,
        chain: base,
      });
      
      const balance = await eth_getBalance(rpcRequest, {
        address: walletAddress,
        blockTag: 'latest',
      });
      
      // eth_getBalance returns a bigint in Thirdweb v5
      return typeof balance === 'bigint' ? balance : BigInt(balance as string);
    },
    refetchInterval: refreshInterval,
    enabled: !!walletAddress,
  });

  const formatBalance = (balance: bigint) => {
    const eth = formatEther(balance);
    const numEth = parseFloat(eth);
    
    if (numEth >= 1) {
      return `${numEth.toFixed(4)} ETH`;
    } else if (numEth >= 0.001) {
      return `${numEth.toFixed(6)} ETH`;
    } else {
      return `${numEth.toFixed(8)} ETH`;
    }
  };

  const getBalanceColor = (balance: bigint) => {
    const eth = parseFloat(formatEther(balance));
    
    if (eth >= 1) return 'text-green-600';
    if (eth >= 0.1) return 'text-yellow-600';
    if (eth >= 0.01) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 border">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{walletName}</h3>
        {isRefetching && (
          <div className="flex items-center text-blue-500 text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
            Updating...
          </div>
        )}
      </div>

      {description && (
        <p className="text-sm text-gray-600 mb-3">{description}</p>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Address:</span>
          <a 
            href={`https://basescan.org/address/${walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 font-mono"
          >
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </a>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Balance:</span>
          <div className="text-right">
            {isLoading ? (
              <div className="animate-pulse bg-gray-200 h-6 w-24 rounded"></div>
            ) : error ? (
              <span className="text-red-500 text-sm">Error loading</span>
            ) : balance !== undefined ? (
              <div>
                <span className={`text-lg font-bold ${getBalanceColor(balance)}`}>
                  {formatBalance(balance)}
                </span>
                <div className="text-xs text-gray-500">
                  {balance.toString()} wei
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
          <span>Updates every {refreshInterval / 1000}s</span>
          <a 
            href={`https://basescan.org/address/${walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800"
          >
            View on BaseScan →
          </a>
        </div>
      </div>
    </div>
  );
}

// Component for tracking multiple wallets
export function WalletBalanceDashboard() {
  const developmentWallet = '0x3427b4716B90C11F9971e43999a48A47Cf5B571E' as const;
  const feeCollectorAddress = '0xaab93405679576ec743fDAA57AA603D949850604' as const;

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-xl font-bold text-blue-900 mb-2">Evermark Fee Flow Monitoring</h2>
        <p className="text-blue-700 text-sm">
          Real-time balance tracking for Evermark protocol fee collection and development funding.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <WalletBalanceTracker
          walletAddress={developmentWallet}
          walletName="Development Wallet"
          description="Final destination for minting fees (emark.base.eth). Funds development costs and anti-spam operations."
          refreshInterval={30000}
        />

        <WalletBalanceTracker
          walletAddress={feeCollectorAddress}
          walletName="Fee Collector"
          description="Temporary collection point that immediately forwards fees to development wallet."
          refreshInterval={30000}
        />
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Fee Flow Explanation</h3>
        <div className="text-sm text-gray-700 space-y-2">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            <span>User pays 0.00007 ETH minting fee</span>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span>10% goes to referrer (if applicable)</span>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            <span>90% goes to Fee Collector → Development Wallet</span>
          </div>
          <div className="flex items-center space-x-2 ml-8">
            <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
            <span>Funds development costs, server maintenance, anti-spam measures</span>
          </div>
        </div>
      </div>
    </div>
  );
}