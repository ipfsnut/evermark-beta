import React, { useState, useCallback } from 'react';
import { 
  LayersIcon, 
  TrophyIcon, 
  LoaderIcon, 
  ClockIcon,
  CoinsIcon,
  AlertCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useWalletAccount } from '@/hooks/core/useWalletAccount';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/utils/responsive';
import { useNFTStaking } from '../hooks/useNFTStaking';

interface NFT {
  token_id: number;
  title?: string;
  description?: string;
  image?: string;
  [key: string]: unknown;
}

interface NFTStakingPanelProps {
  className?: string;
}

export function NFTStakingPanel({ className = '' }: NFTStakingPanelProps) {
  const { isDark } = useTheme();
  const account = useWalletAccount();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const {
    stakedNFTs,
    stakingStats,
    isLoading,
    error,
    isStaking,
    isUnstaking,
    stakingError,
    stakeNFT,
    unstakeNFT,
    formatStakingTime,
  } = useNFTStaking();

  // Query user's NFTs (for staking)
  const { data: userNFTs = [], isLoading: nftsLoading } = useQuery<NFT[]>({
    queryKey: ['user-nfts', account?.address],
    queryFn: async () => {
      if (!account?.address) return [];
      // TODO: Replace with actual NFT fetching from your NFT contract
      // This would typically query the EvermarkNFT contract for tokens owned by the user
      try {
        const response = await fetch(`/api/evermarks?owner=${account.address}`);
        const data = await response.json();
        return data.evermarks || [];
      } catch (error) {
        console.error('Failed to fetch user NFTs:', error);
        return [];
      }
    },
    enabled: !!account?.address,
  });

  const handleStakeNFT = useCallback(async (tokenId: number) => {
    try {
      await stakeNFT(tokenId);
    } catch (error) {
      console.error('Failed to stake NFT:', error);
    }
  }, [stakeNFT]);

  const handleUnstakeNFT = useCallback(async (tokenId: number) => {
    try {
      await unstakeNFT(tokenId);
    } catch (error) {
      console.error('Failed to unstake NFT:', error);
    }
  }, [unstakeNFT]);

  if (!account) {
    return (
      <div className={cn(
        "border rounded-lg p-6",
        isDark 
          ? "bg-gray-800/50 border-gray-700" 
          : "bg-white border-gray-300",
        className
      )}>
        <div className="text-center">
          <LayersIcon className={cn(
            "mx-auto h-12 w-12 mb-4",
            isDark ? "text-gray-600" : "text-gray-400"
          )} />
          <h3 className={cn(
            "text-lg font-medium mb-2",
            isDark ? "text-white" : "text-gray-900"
          )}>
            NFT Staking
          </h3>
          <p className={cn(
            "text-sm",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            Connect your wallet to stake your Evermark NFTs and earn rewards
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || nftsLoading) {
    return (
      <div className={cn(
        "border rounded-lg p-6",
        isDark 
          ? "bg-gray-800/50 border-gray-700" 
          : "bg-white border-gray-300",
        className
      )}>
        <div className="flex items-center gap-3">
          <LoaderIcon className="animate-spin h-5 w-5 text-blue-400" />
          <span className={cn(
            "text-sm",
            isDark ? "text-gray-300" : "text-gray-700"
          )}>
            Loading NFT staking data...
          </span>
        </div>
      </div>
    );
  }

  const availableNFTs = userNFTs.filter((nft: NFT) => !stakedNFTs.includes(nft.token_id));
  const hasStakedNFTs = stakedNFTs.length > 0;
  const hasAvailableNFTs = availableNFTs.length > 0;

  return (
    <div className={cn(
      "border rounded-lg",
      isDark 
        ? "bg-gray-800/50 border-gray-700" 
        : "bg-white border-gray-300",
      className
    )}>
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
              <LayersIcon className="h-5 w-5 text-black" />
            </div>
            <div>
              <h3 className={cn(
                "text-lg font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}>
                NFT Staking
              </h3>
              <p className={cn(
                "text-sm",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                Stake your Evermark NFTs to earn additional rewards
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "p-2 rounded transition-colors",
              isDark 
                ? "text-gray-400 hover:text-white hover:bg-gray-700" 
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            {isExpanded ? (
              <ChevronUpIcon className="h-5 w-5" />
            ) : (
              <ChevronDownIcon className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">
              {stakingStats?.userStakedCount || 0}
            </div>
            <div className={cn(
              "text-xs",
              isDark ? "text-gray-500" : "text-gray-600"
            )}>
              Staked NFTs
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-cyan-400">
              {stakingStats?.totalStakedNFTs || 0}
            </div>
            <div className={cn(
              "text-xs",
              isDark ? "text-gray-500" : "text-gray-600"
            )}>
              Total Staked
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              ~0.01
            </div>
            <div className={cn(
              "text-xs",
              isDark ? "text-gray-500" : "text-gray-600"
            )}>
              Est. Rewards/Day
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Error Display */}
          {(error || stakingError) && (
            <div className={cn(
              "p-3 rounded border flex items-start gap-2",
              isDark 
                ? "bg-red-900/30 text-red-300 border-red-500/30" 
                : "bg-red-100 text-red-700 border-red-300"
            )}>
              <AlertCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{error || stakingError}</span>
            </div>
          )}

          {/* Staked NFTs Section */}
          {hasStakedNFTs && (
            <div>
              <h4 className={cn(
                "text-sm font-medium mb-3 flex items-center gap-2",
                isDark ? "text-cyan-400" : "text-purple-600"
              )}>
                <TrophyIcon className="h-4 w-4" />
                Currently Staked ({stakedNFTs.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {stakedNFTs.map((tokenId) => {
                  const nft = userNFTs.find((n: NFT) => n.token_id === tokenId);
                  return (
                    <div
                      key={tokenId}
                      className={cn(
                        "p-4 rounded-lg border",
                        isDark 
                          ? "bg-purple-900/30 border-purple-500/50" 
                          : "bg-purple-100/50 border-purple-300"
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className={cn(
                            "font-medium",
                            isDark ? "text-white" : "text-gray-900"
                          )}>
                            {nft?.title || `NFT #${tokenId}`}
                          </div>
                          <div className={cn(
                            "text-xs flex items-center gap-1",
                            isDark ? "text-purple-300" : "text-purple-600"
                          )}>
                            <ClockIcon className="h-3 w-3" />
                            Earning rewards...
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-green-400">
                            +0.001 ETH/day
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUnstakeNFT(tokenId)}
                        disabled={isUnstaking}
                        className={cn(
                          "w-full px-3 py-2 text-xs rounded transition-colors",
                          isUnstaking
                            ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                            : "bg-orange-600 text-white hover:bg-orange-700"
                        )}
                      >
                        {isUnstaking ? 'Unstaking...' : 'Unstake'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available NFTs Section */}
          {hasAvailableNFTs && (
            <div>
              <h4 className={cn(
                "text-sm font-medium mb-3 flex items-center gap-2",
                isDark ? "text-cyan-400" : "text-purple-600"
              )}>
                <CoinsIcon className="h-4 w-4" />
                Available to Stake ({availableNFTs.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableNFTs.slice(0, 4).map((nft: NFT) => (
                  <div
                    key={nft.token_id}
                    className={cn(
                      "p-4 rounded-lg border",
                      isDark 
                        ? "bg-gray-700/50 border-gray-600" 
                        : "bg-gray-100/50 border-gray-300"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className={cn(
                          "font-medium",
                          isDark ? "text-white" : "text-gray-900"
                        )}>
                          {nft.title || `NFT #${nft.token_id}`}
                        </div>
                        <div className={cn(
                          "text-xs",
                          isDark ? "text-gray-400" : "text-gray-600"
                        )}>
                          Ready to stake
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleStakeNFT(nft.token_id)}
                      disabled={isStaking}
                      className={cn(
                        "w-full px-3 py-2 text-xs rounded transition-colors",
                        isStaking
                          ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                          : "bg-purple-600 text-white hover:bg-purple-700"
                      )}
                    >
                      {isStaking ? 'Staking...' : 'Stake NFT'}
                    </button>
                  </div>
                ))}
              </div>
              {availableNFTs.length > 4 && (
                <div className={cn(
                  "text-center mt-3 text-xs",
                  isDark ? "text-gray-500" : "text-gray-600"
                )}>
                  +{availableNFTs.length - 4} more NFTs available
                </div>
              )}
            </div>
          )}

          {/* No NFTs Message */}
          {!hasStakedNFTs && !hasAvailableNFTs && (
            <div className="text-center py-6">
              <LayersIcon className={cn(
                "mx-auto h-8 w-8 mb-2",
                isDark ? "text-gray-600" : "text-gray-400"
              )} />
              <p className={cn(
                "text-sm",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                You don&apos;t have any Evermark NFTs to stake.
              </p>
              <p className={cn(
                "text-xs mt-1",
                isDark ? "text-gray-500" : "text-gray-500"
              )}>
                Create an Evermark to get started with NFT staking!
              </p>
            </div>
          )}

          {/* Information Box */}
          <div className={cn(
            "p-4 rounded-lg border",
            isDark 
              ? "bg-blue-900/30 border-blue-500/50" 
              : "bg-blue-100/50 border-blue-300"
          )}>
            <h5 className={cn(
              "text-sm font-medium mb-2",
              isDark ? "text-blue-300" : "text-blue-700"
            )}>
              How NFT Staking Works:
            </h5>
            <ul className={cn(
              "text-xs space-y-1",
              isDark ? "text-blue-200" : "text-blue-600"
            )}>
              <li>• Stake your Evermark NFTs to earn additional EMARK rewards</li>
              <li>• Staked NFTs continue earning rewards over time</li>
              <li>• Unstake anytime to reclaim your NFTs</li>
              <li>• Higher-value NFTs may earn bonus multipliers</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}