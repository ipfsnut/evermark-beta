// src/pages/AdminPage.tsx
// Admin interface for managing Evermark contracts - New Architecture

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Play, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Users,
  BarChart3,
  Clock,
  Shield,
  DollarSign,
  Pause,
  PlayCircle
} from 'lucide-react';
import { useActiveAccount, useReadContract, useSendTransaction } from 'thirdweb/react';
import { prepareContractCall } from 'thirdweb';
import { 
  getEvermarkVotingContract, 
  getWEMARKContract, 
  getEvermarkNFTContract, 
  getFeeCollectorContract,
  getEvermarkRewardsContract 
} from '@/lib/contracts';

interface SeasonInfo {
  seasonNumber: number;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  totalVotes: bigint;
}

interface ContractBalances {
  feeCollectorWeth: bigint;
  feeCollectorEmark: bigint;
  rewardsWeth: bigint;
  rewardsEmark: bigint;
}

interface RewardsPeriodInfo {
  currentPeriod: number;
  periodEnd: Date;
  wethRate: bigint;
  emarkRate: bigint;
  timeRemaining: number;
}

interface ContractStatus {
  voting: { currentSeason: number; isActive: boolean };
  nft: { totalSupply: number; isPaused: boolean };
  wemark: { totalStaked: bigint };
  rewards: { totalRewards: bigint };
}

export default function AdminPage() {
  const account = useActiveAccount();
  const { mutate: sendTransaction, isPending } = useSendTransaction();
  
  const [seasonInfo, setSeasonInfo] = useState<SeasonInfo | null>(null);
  const [balances, setBalances] = useState<ContractBalances | null>(null);
  const [contractStatus, setContractStatus] = useState<ContractStatus | null>(null);
  const [rewardsPeriod, setRewardsPeriod] = useState<RewardsPeriodInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState<string>('');

  // Contract instances
  const votingContract = getEvermarkVotingContract();
  const wemarkContract = getWEMARKContract();
  const nftContract = getEvermarkNFTContract();
  const feeCollectorContract = getFeeCollectorContract();
  const rewardsContract = getEvermarkRewardsContract();

  // Read current season info
  const { data: currentSeason } = useReadContract({
    contract: votingContract,
    method: "function getCurrentSeason() view returns (uint256)",
    params: []
  });

  // Read season details if we have current season
  const { data: seasonDetails } = useReadContract({
    contract: votingContract,
    method: "function getSeasonInfo(uint256 season) view returns (uint256 startTime, uint256 endTime, bool active, uint256 totalVotes)",
    params: currentSeason ? [currentSeason] : [BigInt(0)],
    queryOptions: {
      enabled: !!currentSeason
    }
  });

  // Read NFT total supply
  const { data: nftTotalSupply } = useReadContract({
    contract: nftContract,
    method: "function totalSupply() view returns (uint256)",
    params: []
  });

  // Read WEMARK total staked
  const { data: wemarkTotalStaked } = useReadContract({
    contract: wemarkContract,
    method: "function getTotalStaked() view returns (uint256)",
    params: []
  });

  // Read FeeCollector balances
  const { data: feeCollectorBalances } = useReadContract({
    contract: feeCollectorContract,
    method: "function getTokenBalances() view returns (uint256 wethBalance, uint256 emarkBalance)",
    params: []
  });

  // Read rewards period status
  const { data: rewardsPeriodStatus } = useReadContract({
    contract: rewardsContract,
    method: "function getPeriodStatus() view returns (uint256 currentPeriod, uint256 periodEnd, uint256 wethRate, uint256 emarkRate)",
    params: []
  });

  // Read rewards contract balances
  const { data: rewardsBalances } = useReadContract({
    contract: rewardsContract,
    method: "function getBalances() view returns (uint256 wethBalance, uint256 emarkBalance)",
    params: []
  });

  // Load all data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Set season info
        if (currentSeason && seasonDetails) {
          const [startTime, endTime, active, totalVotes] = seasonDetails as [bigint, bigint, boolean, bigint];
          setSeasonInfo({
            seasonNumber: Number(currentSeason),
            startTime: new Date(Number(startTime) * 1000),
            endTime: new Date(Number(endTime) * 1000),
            isActive: active,
            totalVotes
          });
        }

        // Set balances
        if (feeCollectorBalances) {
          const [wethBalance, emarkBalance] = feeCollectorBalances as [bigint, bigint];
          const rewardsWeth = rewardsBalances ? (rewardsBalances as [bigint, bigint])[0] : BigInt(0);
          const rewardsEmark = rewardsBalances ? (rewardsBalances as [bigint, bigint])[1] : BigInt(0);
          
          setBalances({
            feeCollectorWeth: wethBalance,
            feeCollectorEmark: emarkBalance,
            rewardsWeth,
            rewardsEmark
          });
        }

        // Set rewards period info
        if (rewardsPeriodStatus) {
          const [currentPeriod, periodEnd, wethRate, emarkRate] = rewardsPeriodStatus as [bigint, bigint, bigint, bigint];
          const periodEndDate = new Date(Number(periodEnd) * 1000);
          const timeRemaining = Math.max(0, Math.floor((periodEndDate.getTime() - Date.now()) / 1000));
          
          setRewardsPeriod({
            currentPeriod: Number(currentPeriod),
            periodEnd: periodEndDate,
            wethRate,
            emarkRate,
            timeRemaining
          });
        }

        // Set contract status
        setContractStatus({
          voting: { 
            currentSeason: Number(currentSeason || 0), 
            isActive: seasonDetails ? (seasonDetails as any)[2] : false 
          },
          nft: { 
            totalSupply: Number(nftTotalSupply || 0), 
            isPaused: false // Would need to read paused state
          },
          wemark: { 
            totalStaked: wemarkTotalStaked || BigInt(0) 
          },
          rewards: { 
            totalRewards: BigInt(0) // Would need to read from rewards contract
          }
        });

      } catch (error) {
        console.error('Failed to load admin data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentSeason, seasonDetails, nftTotalSupply, wemarkTotalStaked, feeCollectorBalances, rewardsPeriodStatus, rewardsBalances]);

  // Admin Actions
  const startNewSeason = async () => {
    if (!account) return;
    
    try {
      setActionStatus('Starting new voting season...');
      
      const transaction = prepareContractCall({
        contract: votingContract,
        method: "function startNewSeason()",
        params: []
      });

      sendTransaction(transaction, {
        onSuccess: (result) => {
          setActionStatus('New season started successfully!');
          setTimeout(() => setActionStatus(''), 3000);
          // Trigger data refresh
          window.location.reload();
        },
        onError: (error) => {
          setActionStatus(`Failed to start season: ${error.message}`);
          setTimeout(() => setActionStatus(''), 5000);
        }
      });
    } catch (error) {
      setActionStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setActionStatus(''), 5000);
    }
  };

  const forwardWethToRewards = async () => {
    if (!account) return;
    
    try {
      setActionStatus('Forwarding WETH to rewards...');
      
      const transaction = prepareContractCall({
        contract: feeCollectorContract,
        method: "function forwardAllWethToRewards()",
        params: []
      });

      sendTransaction(transaction, {
        onSuccess: (result) => {
          setActionStatus('WETH forwarded to rewards successfully!');
          setTimeout(() => setActionStatus(''), 3000);
          // Trigger data refresh
          window.location.reload();
        },
        onError: (error) => {
          setActionStatus(`Failed to forward WETH: ${error.message}`);
          setTimeout(() => setActionStatus(''), 5000);
        }
      });
    } catch (error) {
      setActionStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setActionStatus(''), 5000);
    }
  };

  const forwardEmarkToRewards = async () => {
    if (!account) return;
    
    try {
      setActionStatus('Forwarding EMARK to rewards...');
      
      const transaction = prepareContractCall({
        contract: feeCollectorContract,
        method: "function forwardAllEmarkToRewards()",
        params: []
      });

      sendTransaction(transaction, {
        onSuccess: (result) => {
          setActionStatus('EMARK forwarded to rewards successfully!');
          setTimeout(() => setActionStatus(''), 3000);
          // Trigger data refresh
          window.location.reload();
        },
        onError: (error) => {
          setActionStatus(`Failed to forward EMARK: ${error.message}`);
          setTimeout(() => setActionStatus(''), 5000);
        }
      });
    } catch (error) {
      setActionStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setActionStatus(''), 5000);
    }
  };

  const syncFromChain = async () => {
    try {
      setActionStatus('Syncing recent Evermarks from chain...');
      
      const response = await fetch('/sync?count=20');
      const result = await response.json();
      
      if (result.success) {
        setActionStatus(`Sync completed! Added ${result.synced} Evermarks to database.`);
        setTimeout(() => setActionStatus(''), 5000);
      } else {
        setActionStatus(`Sync failed: ${result.message}`);
        setTimeout(() => setActionStatus(''), 5000);
      }
    } catch (error) {
      setActionStatus(`Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setActionStatus(''), 5000);
    }
  };

  const startNewRewardsPeriod = async () => {
    if (!account) return;
    
    try {
      setActionStatus('Starting new rewards period...');
      
      const transaction = prepareContractCall({
        contract: rewardsContract,
        method: "function startNewPeriod()",
        params: []
      });

      sendTransaction(transaction, {
        onSuccess: (result) => {
          setActionStatus('New rewards period started successfully!');
          setTimeout(() => setActionStatus(''), 3000);
          // Trigger data refresh
          window.location.reload();
        },
        onError: (error) => {
          setActionStatus(`Failed to start rewards period: ${error.message}`);
          setTimeout(() => setActionStatus(''), 5000);
        }
      });
    } catch (error) {
      setActionStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setActionStatus(''), 5000);
    }
  };

  const distributeRewards = async () => {
    if (!account) return;
    
    try {
      setActionStatus('Distributing rewards...');
      
      const transaction = prepareContractCall({
        contract: rewardsContract,
        method: "function distributeRewards()",
        params: []
      });

      sendTransaction(transaction, {
        onSuccess: (result) => {
          setActionStatus('Rewards distributed successfully!');
          setTimeout(() => setActionStatus(''), 3000);
          // Trigger data refresh
          window.location.reload();
        },
        onError: (error) => {
          setActionStatus(`Failed to distribute rewards: ${error.message}`);
          setTimeout(() => setActionStatus(''), 5000);
        }
      });
    } catch (error) {
      setActionStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setActionStatus(''), 5000);
    }
  };

  const formatEther = (value: bigint, decimals: number = 4): string => {
    const ether = Number(value) / 1e18;
    return ether.toFixed(decimals);
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleString();
  };

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return 'Expired';
    
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (!account) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-blue-400" />
          <h1 className="text-2xl font-bold mb-2">Admin Access Required</h1>
          <p className="text-gray-400">Please connect your wallet to access the admin panel.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-4 text-blue-400 animate-spin" />
          <p className="text-gray-400">Loading admin data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center mb-8">
          <Settings className="w-8 h-8 mr-3 text-blue-400" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>

        {/* Action Status */}
        {actionStatus && (
          <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
            <p className="text-blue-400">{actionStatus}</p>
          </div>
        )}

        {/* Current Season Info */}
        {seasonInfo && (
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center">
                <Clock className="w-6 h-6 mr-2 text-blue-400" />
                Current Voting Season
              </h2>
              <div className={`px-3 py-1 rounded-full text-sm ${
                seasonInfo.isActive ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
              }`}>
                {seasonInfo.isActive ? 'Active' : 'Inactive'}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Season Number</p>
                <p className="text-2xl font-bold text-blue-400">{seasonInfo.seasonNumber}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Total Votes</p>
                <p className="text-2xl font-bold text-green-400">{formatEther(seasonInfo.totalVotes)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Start Time</p>
                <p className="text-sm text-gray-300">{formatDate(seasonInfo.startTime)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">End Time</p>
                <p className="text-sm text-gray-300">{formatDate(seasonInfo.endTime)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Contract Status */}
        {contractStatus && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center mb-4">
                <Users className="w-6 h-6 mr-2 text-green-400" />
                <h3 className="text-lg font-semibold">Voting</h3>
              </div>
              <p className="text-gray-400 text-sm">Season {contractStatus.voting.currentSeason}</p>
              <div className={`mt-2 text-sm ${contractStatus.voting.isActive ? 'text-green-400' : 'text-yellow-400'}`}>
                {contractStatus.voting.isActive ? '✓ Active' : '⚠ Inactive'}
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center mb-4">
                <BarChart3 className="w-6 h-6 mr-2 text-blue-400" />
                <h3 className="text-lg font-semibold">NFTs</h3>
              </div>
              <p className="text-gray-400 text-sm">{contractStatus.nft.totalSupply} minted</p>
              <div className="mt-2 text-sm text-green-400">✓ Operational</div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center mb-4">
                <Shield className="w-6 h-6 mr-2 text-yellow-400" />
                <h3 className="text-lg font-semibold">WEMARK</h3>
              </div>
              <p className="text-gray-400 text-sm">{formatEther(contractStatus.wemark.totalStaked)} staked</p>
              <div className="mt-2 text-sm text-green-400">✓ Active</div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center mb-4">
                <DollarSign className="w-6 h-6 mr-2 text-purple-400" />
                <h3 className="text-lg font-semibold">Rewards</h3>
              </div>
              <p className="text-gray-400 text-sm">Dual token system</p>
              <div className="mt-2 text-sm text-green-400">✓ Active</div>
            </div>
          </div>
        )}

        {/* Current Rewards Period */}
        {rewardsPeriod && (
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center">
                <Clock className="w-6 h-6 mr-2 text-purple-400" />
                Current Rewards Period
              </h2>
              <div className={`px-3 py-1 rounded-full text-sm ${
                rewardsPeriod.timeRemaining > 0 ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
              }`}>
                {rewardsPeriod.timeRemaining > 0 ? 'Active' : 'Expired'}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Period Number</p>
                <p className="text-2xl font-bold text-purple-400">{rewardsPeriod.currentPeriod}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Time Remaining</p>
                <p className="text-2xl font-bold text-blue-400">{formatTimeRemaining(rewardsPeriod.timeRemaining)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">WETH Rate</p>
                <p className="text-lg font-bold text-green-400">{formatEther(rewardsPeriod.wethRate)} per token</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">EMARK Rate</p>
                <p className="text-lg font-bold text-yellow-400">{formatEther(rewardsPeriod.emarkRate)} per token</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-gray-400 text-sm">Period End Time</p>
              <p className="text-sm text-gray-300">{formatDate(rewardsPeriod.periodEnd)}</p>
            </div>
          </div>
        )}

        {/* Treasury Balances */}
        {balances && (
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-8">
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <DollarSign className="w-6 h-6 mr-2 text-green-400" />
              Treasury Balances
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Fee Collector */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-blue-400">Fee Collector</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-2">WETH Balance</p>
                    <p className="text-xl font-bold text-blue-400">{formatEther(balances.feeCollectorWeth)} WETH</p>
                    <button
                      onClick={forwardWethToRewards}
                      disabled={isPending || balances.feeCollectorWeth === BigInt(0)}
                      className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm transition-colors"
                    >
                      Forward to Rewards
                    </button>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-2">EMARK Balance</p>
                    <p className="text-xl font-bold text-purple-400">{formatEther(balances.feeCollectorEmark)} EMARK</p>
                    <button
                      onClick={forwardEmarkToRewards}
                      disabled={isPending || balances.feeCollectorEmark === BigInt(0)}
                      className="mt-2 px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm transition-colors"
                    >
                      Forward to Rewards
                    </button>
                  </div>
                </div>
              </div>

              {/* Rewards Contract */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-green-400">Rewards Contract</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Available WETH</p>
                    <p className="text-xl font-bold text-blue-400">{formatEther(balances.rewardsWeth)} WETH</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Available EMARK</p>
                    <p className="text-xl font-bold text-purple-400">{formatEther(balances.rewardsEmark)} EMARK</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin Actions */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-8">
          <h2 className="text-xl font-bold mb-6">Admin Actions</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Season Management */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-blue-400">Season Management</h3>
              
              <button
                onClick={startNewSeason}
                disabled={isPending}
                className="w-full flex items-center justify-center px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <PlayCircle className="w-5 h-5 mr-2" />
                Start New Season
              </button>
              
              <p className="text-sm text-gray-400">
                Starts a new 7-day voting season. Current season will end automatically.
              </p>
            </div>

            {/* Treasury Management */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-green-400">Treasury Management</h3>
              
              <div className="space-y-2">
                <button
                  onClick={forwardWethToRewards}
                  disabled={isPending || !balances || balances.feeCollectorWeth === BigInt(0)}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
                >
                  Forward All WETH
                </button>
                
                <button
                  onClick={forwardEmarkToRewards}
                  disabled={isPending || !balances || balances.feeCollectorEmark === BigInt(0)}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
                >
                  Forward All EMARK
                </button>
              </div>
              
              <p className="text-sm text-gray-400">
                Forward collected trading fees to the rewards contract for distribution.
              </p>
            </div>

            {/* Rewards Management */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-purple-400">Rewards Management</h3>
              
              <div className="space-y-2">
                <button
                  onClick={startNewRewardsPeriod}
                  disabled={isPending}
                  className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start New Period
                </button>
                
                <button
                  onClick={distributeRewards}
                  disabled={isPending || !balances || (balances.rewardsWeth === BigInt(0) && balances.rewardsEmark === BigInt(0))}
                  className="w-full flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Distribute Rewards
                </button>
              </div>
              
              <p className="text-sm text-gray-400">
                Manually trigger new rewards periods and distribute accumulated rewards.
              </p>
            </div>
          </div>
          
          {/* Database Management - Second Row */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-cyan-400">Database Management</h3>
                
                <button
                  onClick={syncFromChain}
                  disabled={isPending}
                  className="w-full flex items-center justify-center px-6 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Sync from Chain
                </button>
                
                <p className="text-sm text-gray-400">
                  Manually sync the last 20 Evermarks from blockchain to database. Use this if any Evermarks are missing.
                </p>
              </div>
              
              {/* Placeholder for future tools */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-orange-400">Contract Status</h3>
                <div className="text-sm text-gray-400">
                  <p>NFT Contract: {contractStatus?.nft.totalSupply || 0} minted</p>
                  <p>WEMARK Staked: {contractStatus?.wemark.totalStaked ? `${(Number(contractStatus.wemark.totalStaked) / 1e18).toFixed(2)} EMARK` : '0'}</p>
                  <p>Season: {contractStatus?.voting.currentSeason || 'N/A'} {contractStatus?.voting.isActive ? '(Active)' : '(Inactive)'}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-red-400">Emergency Controls</h3>
                <p className="text-sm text-gray-400">
                  Emergency pause/unpause functions will be available here when needed.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Connected Account Info */}
        <div className="text-center text-sm text-gray-400">
          <p>Connected as: {account.address}</p>
        </div>
      </div>
    </div>
  );
}