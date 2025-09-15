import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReadContract } from 'thirdweb/react';
import { CONTRACTS } from '@/lib/contracts';
import { getContract } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { base } from 'thirdweb/chains';

// Import ABIs
import EMARKABI from '@/features/tokens/abis/EMARK.json';
import FeeCollectorABI from '@/lib/abis/FeeCollector.abi.json';
import EvermarkRewardsABI from '@/features/tokens/abis/EvermarkRewards.abi.json';
import WEMARKABBI from '@/features/staking/abis/WEMARK.abi.json';
import type { Abi } from 'abitype';

interface ContractBalance {
  name: string;
  address: string;
  emarkBalance: string;
  wethBalance?: string;
  isLoading: boolean;
  error?: string;
}

function ContractBalanceCard({ contract }: { contract: ContractBalance }) {
  return (
    <div className="bg-white rounded-lg shadow border p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{contract.name}</h3>
          <a 
            href={`https://basescan.org/address/${contract.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 font-mono"
          >
            {contract.address.slice(0, 6)}...{contract.address.slice(-4)}
          </a>
        </div>
        {contract.isLoading && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">$EMARK:</span>
          {contract.isLoading ? (
            <div className="animate-pulse bg-gray-200 h-4 w-20 rounded"></div>
          ) : contract.error ? (
            <span className="text-red-500 text-xs">Error</span>
          ) : (
            <span className="font-mono text-sm font-medium text-green-600">
              {contract.emarkBalance}
            </span>
          )}
        </div>
        
        {contract.wethBalance !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">WETH:</span>
            {contract.isLoading ? (
              <div className="animate-pulse bg-gray-200 h-4 w-20 rounded"></div>
            ) : contract.error ? (
              <span className="text-red-500 text-xs">Error</span>
            ) : (
              <span className="font-mono text-sm font-medium text-blue-600">
                {contract.wethBalance}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProtocolTotalsCard({ contracts }: { contracts: ContractBalance[] }) {
  const totalEmark = contracts.reduce((sum, contract) => {
    if (contract.isLoading || contract.error) return sum;
    return sum + parseFloat(contract.emarkBalance.replace(/[,\s]/g, '')) || 0;
  }, 0);

  const totalWeth = contracts.reduce((sum, contract) => {
    if (contract.isLoading || contract.error || !contract.wethBalance) return sum;
    return sum + parseFloat(contract.wethBalance.replace(/[,\s]/g, '')) || 0;
  }, 0);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-lg border-2 border-blue-200 p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
        🏦 Total Protocol Treasury
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-sm text-gray-600 mb-1">Total $EMARK</div>
          <div className="text-2xl font-bold text-green-600">
            {totalEmark.toLocaleString()} EMARK
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-sm text-gray-600 mb-1">Total WETH</div>
          <div className="text-2xl font-bold text-blue-600">
            {totalWeth.toFixed(4)} WETH
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-blue-200">
        <div className="text-center text-sm text-gray-600">
          Live data from {contracts.length} protocol contracts
        </div>
      </div>
    </div>
  );
}

function APRCalculationCard() {
  // Get contract instances
  const emarkTokenContract = getContract({
    client,
    chain: base,
    address: CONTRACTS.EMARK_TOKEN,
    abi: EMARKABI as Abi,
  });

  const wemarkContract = getContract({
    client,
    chain: base,
    address: CONTRACTS.WEMARK,
    abi: WEMARKABBI as Abi,
  });

  const rewardsContract = getContract({
    client,
    chain: base,
    address: CONTRACTS.EVERMARK_REWARDS,
    abi: EvermarkRewardsABI as Abi,
  });

  // Read total staked EMARK from WEMARK contract
  const { data: totalStaked, isLoading: isLoadingStaked } = useReadContract({
    contract: wemarkContract,
    method: "function getTotalStaked() view returns (uint256)",
    params: []
  });

  // Read rewards contract EMARK balance
  const { data: rewardsEmarkBalance, isLoading: isLoadingRewards } = useReadContract({
    contract: rewardsContract,
    method: "function getBalances() view returns (uint256 wethBalance, uint256 emarkBalance)",
    params: []
  });

  // Calculate APR based on available rewards vs total staked
  const calculateAPR = () => {
    if (!totalStaked || !rewardsEmarkBalance || isLoadingStaked || isLoadingRewards) {
      return { daily: 0, weekly: 0, monthly: 0, yearly: 0 };
    }

    const [, emarkRewards] = rewardsEmarkBalance as [bigint, bigint];
    const totalStakedNum = Number(totalStaked) / 1e18;
    const availableRewardsNum = Number(emarkRewards) / 1e18;
    
    // Estimate APR based on current rewards pool size
    // Assuming rewards are distributed over 365 days
    const yearlyAPR = totalStakedNum > 0 ? (availableRewardsNum / totalStakedNum) * 100 : 0;
    
    return {
      daily: yearlyAPR / 365,
      weekly: yearlyAPR / 52,
      monthly: yearlyAPR / 12,
      yearly: yearlyAPR
    };
  };

  const apr = calculateAPR();

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border-2 border-purple-200 p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
        📊 Live APR Calculations
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-sm text-gray-600 mb-1">Daily APR</div>
          <div className="text-lg font-bold text-purple-600">
            {apr.daily.toFixed(3)}%
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-sm text-gray-600 mb-1">Weekly APR</div>
          <div className="text-lg font-bold text-purple-600">
            {apr.weekly.toFixed(2)}%
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-sm text-gray-600 mb-1">Monthly APR</div>
          <div className="text-lg font-bold text-purple-600">
            {apr.monthly.toFixed(2)}%
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-sm text-gray-600 mb-1">Yearly APR</div>
          <div className="text-lg font-bold text-purple-600">
            {apr.yearly.toFixed(1)}%
          </div>
        </div>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Total Staked:</span>
          <span className="font-mono">
            {isLoadingStaked ? 'Loading...' : totalStaked ? (Number(totalStaked) / 1e18).toLocaleString() : '0'} EMARK
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Available Rewards:</span>
          <span className="font-mono">
            {isLoadingRewards ? 'Loading...' : rewardsEmarkBalance ? (Number(rewardsEmarkBalance[1]) / 1e18).toLocaleString() : '0'} EMARK
          </span>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-purple-200">
        <div className="text-center text-xs text-gray-600">
          APR calculated from live contract data. Actual rewards may vary.
        </div>
      </div>
    </div>
  );
}

export function ProtocolBalancesDashboard() {
  // Contract addresses and names
  const contractConfigs = [
    { name: 'Voting Contract', address: CONTRACTS.EVERMARK_VOTING, hasWeth: false },
    { name: 'NFT Contract', address: CONTRACTS.EVERMARK_NFT, hasWeth: false },
    { name: 'Staking Contract', address: CONTRACTS.WEMARK, hasWeth: false },
    { name: 'Rewards Contract', address: CONTRACTS.EVERMARK_REWARDS, hasWeth: true },
    { name: 'Fee Collector', address: CONTRACTS.FEE_COLLECTOR, hasWeth: true },
    { name: 'Marketplace', address: CONTRACTS.MARKETPLACE, hasWeth: false },
  ];

  // Get EMARK token contract instance
  const emarkTokenContract = getContract({
    client,
    chain: base,
    address: CONTRACTS.EMARK_TOKEN,
    abi: EMARKABI as Abi,
  });

  // Hook to get EMARK balance for a specific contract
  const useEmarkBalance = (contractAddress: string) => {
    return useReadContract({
      contract: emarkTokenContract,
      method: "function balanceOf(address owner) view returns (uint256)",
      params: [contractAddress as `0x${string}`]
    });
  };

  // Hook to get internal contract balances (for contracts that have them)
  const useContractBalances = (contractAddress: string, contractName: string) => {
    if (contractName === 'Fee Collector') {
      const feeCollectorContract = getContract({
        client,
        chain: base,
        address: contractAddress,
        abi: FeeCollectorABI as Abi,
      });
      
      return useReadContract({
        contract: feeCollectorContract,
        method: "function getTokenBalances() view returns (uint256 wethBalance, uint256 emarkBalance)",
        params: []
      });
    } else if (contractName === 'Rewards Contract') {
      const rewardsContract = getContract({
        client,
        chain: base,
        address: contractAddress,
        abi: EvermarkRewardsABI as Abi,
      });
      
      return useReadContract({
        contract: rewardsContract,
        method: "function getBalances() view returns (uint256 wethBalance, uint256 emarkBalance)",
        params: []
      });
    }
    
    return { data: null, isLoading: false, error: null };
  };

  // Build contract balance data
  const contracts: ContractBalance[] = contractConfigs.map((config) => {
    const { data: emarkBalance, isLoading: isLoadingEmark, error: emarkError } = useEmarkBalance(config.address);
    const { data: internalBalances, isLoading: isLoadingInternal, error: internalError } = useContractBalances(config.address, config.name);
    
    const formatBalance = (balance: bigint | undefined) => {
      if (!balance) return '0';
      return (Number(balance) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 });
    };

    const wethBalance = config.hasWeth && internalBalances ? 
      formatBalance(internalBalances[0] as bigint) : undefined;

    return {
      name: config.name,
      address: config.address,
      emarkBalance: formatBalance(emarkBalance),
      wethBalance,
      isLoading: isLoadingEmark || isLoadingInternal,
      error: emarkError || internalError ? 'Failed to load' : undefined
    };
  });

  return (
    <div className="mt-12 space-y-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h2 className="text-xl font-bold text-red-900 mb-2">📊 Protocol Balances & APR</h2>
        <p className="text-red-700 text-sm">
          Real-time $EMARK and WETH balances across all protocol contracts, plus live APR calculations by period.
        </p>
      </div>

      {/* Protocol Totals */}
      <ProtocolTotalsCard contracts={contracts} />

      {/* APR Calculations */}
      <APRCalculationCard />

      {/* Individual Contract Balances */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {contracts.map((contract) => (
          <ContractBalanceCard 
            key={contract.address} 
            contract={contract} 
          />
        ))}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Balance Breakdown Explanation</h3>
        <div className="text-sm text-gray-700 space-y-2">
          <div><strong>$EMARK Balances:</strong> Shows actual EMARK token holdings for each contract address</div>
          <div><strong>WETH Balances:</strong> Internal accounting from contracts that track WETH (Fee Collector & Rewards)</div>
          <div><strong>APR Calculations:</strong> Based on current rewards pool vs total staked EMARK</div>
          <div><strong>Data Source:</strong> Live blockchain data via Thirdweb, updates every 30 seconds</div>
        </div>
      </div>
    </div>
  );
}