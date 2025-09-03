import React, { useState, useEffect } from 'react';
import { Trophy, Crown, Medal, Users, DollarSign, RefreshCw } from 'lucide-react';

interface Winner {
  evermarkId: string;
  creator: string;
  title: string;
  totalVotes: bigint;
  creatorReward: bigint;
  supporterPool: bigint;
  supporterCount: number;
  image?: string;
}

interface WinnerSelectionProps {
  seasonNumber: number;
  onRewardsCalculated: (calculation: any) => void;
  onProceed: () => void;
  poolSize: bigint;
}

export function WinnerSelection({ 
  seasonNumber, 
  onRewardsCalculated, 
  onProceed, 
  poolSize 
}: WinnerSelectionProps) {
  const [winners, setWinners] = useState<{first?: Winner; second?: Winner; third?: Winner}>({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationComplete, setCalculationComplete] = useState(false);

  const formatEther = (value: bigint): string => {
    return (Number(value) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const loadWinners = async () => {
    setIsCalculating(true);
    
    try {
      // Get top 3 winners
      const winnersResponse = await fetch(`/.netlify/functions/admin-compute-rewards?action=get-top-winners&season=${seasonNumber}`);
      if (!winnersResponse.ok) {
        throw new Error('Failed to get winners');
      }
      
      const winnersData = await winnersResponse.json();
      
      // Calculate rewards
      const rewardsResponse = await fetch(`/.netlify/functions/admin-compute-rewards?action=calculate-rewards&season=${seasonNumber}&pool=${poolSize.toString()}`);
      if (!rewardsResponse.ok) {
        throw new Error('Failed to calculate rewards');
      }
      
      const calculation = await rewardsResponse.json();
      
      // Map winners with reward data
      const mappedWinners: any = {};
      
      if (winnersData[0]) {
        mappedWinners.first = {
          evermarkId: winnersData[0].evermark_id,
          creator: winnersData[0].beta_evermarks.creator_address,
          title: winnersData[0].beta_evermarks.title || 'Untitled',
          totalVotes: BigInt(winnersData[0].total_votes),
          creatorReward: calculation.creatorRewards.first.amount,
          supporterPool: calculation.distributionBreakdown.firstPlaceTotal - calculation.creatorRewards.first.amount,
          supporterCount: calculation.supporterRewards.filter((s: any) => s.evermarkId === winnersData[0].evermark_id).length,
          image: winnersData[0].beta_evermarks.supabase_image_url
        };
      }
      
      if (winnersData[1]) {
        mappedWinners.second = {
          evermarkId: winnersData[1].evermark_id,
          creator: winnersData[1].beta_evermarks.creator_address,
          title: winnersData[1].beta_evermarks.title || 'Untitled',
          totalVotes: BigInt(winnersData[1].total_votes),
          creatorReward: calculation.creatorRewards.second.amount,
          supporterPool: calculation.distributionBreakdown.secondPlaceTotal - calculation.creatorRewards.second.amount,
          supporterCount: calculation.supporterRewards.filter((s: any) => s.evermarkId === winnersData[1].evermark_id).length,
          image: winnersData[1].beta_evermarks.supabase_image_url
        };
      }
      
      if (winnersData[2]) {
        mappedWinners.third = {
          evermarkId: winnersData[2].evermark_id,
          creator: winnersData[2].beta_evermarks.creator_address,
          title: winnersData[2].beta_evermarks.title || 'Untitled',
          totalVotes: BigInt(winnersData[2].total_votes),
          creatorReward: calculation.creatorRewards.third.amount,
          supporterPool: calculation.distributionBreakdown.thirdPlaceTotal - calculation.creatorRewards.third.amount,
          supporterCount: calculation.supporterRewards.filter((s: any) => s.evermarkId === winnersData[2].evermark_id).length,
          image: winnersData[2].beta_evermarks.supabase_image_url
        };
      }

      setWinners(mappedWinners);
      setCalculationComplete(true);
      onRewardsCalculated(calculation);

    } catch (error) {
      console.error('Failed to load winners:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    loadWinners();
  }, [seasonNumber, poolSize]);

  const WinnerCard = ({ winner, rank, icon }: { winner: Winner; rank: string; icon: React.ReactNode }) => (
    <div className={`p-6 rounded-lg border transition-all ${
      rank === '1st' ? 'bg-yellow-900/20 border-yellow-500/50' :
      rank === '2nd' ? 'bg-gray-600/20 border-gray-400/50' :
      'bg-orange-900/20 border-orange-500/50'
    }`}>
      <div className="flex items-center mb-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${
          rank === '1st' ? 'bg-yellow-400 text-black' :
          rank === '2nd' ? 'bg-gray-400 text-black' :
          'bg-orange-400 text-black'
        }`}>
          {icon}
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">{rank} Place</h3>
          <p className="text-gray-400 text-sm">Season {seasonNumber} Winner</p>
        </div>
      </div>

      {/* Evermark Info */}
      <div className="mb-4">
        <h4 className="font-semibold text-white mb-2">{winner.title}</h4>
        <p className="text-gray-400 text-sm">Creator: {formatAddress(winner.creator)}</p>
        <p className="text-green-400 text-sm font-medium">{formatEther(winner.totalVotes)} votes</p>
      </div>

      {/* Reward Breakdown */}
      <div className="space-y-2 pt-4 border-t border-gray-700">
        <div className="flex justify-between">
          <span className="text-gray-400 text-sm">Creator Reward:</span>
          <span className="text-yellow-400 font-medium">{formatEther(winner.creatorReward)} EMARK</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400 text-sm">Supporter Pool:</span>
          <span className="text-blue-400 font-medium">{formatEther(winner.supporterPool)} EMARK</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400 text-sm">Supporters:</span>
          <span className="text-purple-400 font-medium">{winner.supporterCount} users</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Winner Selection & Reward Calculation</h2>
        <p className="text-gray-400">Top 3 winners and their reward allocations</p>
      </div>

      {/* Pool Summary */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-green-400" />
            Season {seasonNumber} Reward Pool
          </h3>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-400">{formatEther(poolSize)} EMARK</p>
            <p className="text-gray-400 text-sm">Total Distribution</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-blue-900/20 rounded">
            <p className="text-blue-400 font-medium">{formatEther((poolSize * BigInt(60)) / BigInt(100))} EMARK</p>
            <p className="text-gray-400 text-sm">Creator Rewards (60%)</p>
          </div>
          <div className="text-center p-3 bg-purple-900/20 rounded">
            <p className="text-purple-400 font-medium">{formatEther((poolSize * BigInt(40)) / BigInt(100))} EMARK</p>
            <p className="text-gray-400 text-sm">Supporter Rewards (40%)</p>
          </div>
        </div>
      </div>

      {/* Winners Display */}
      {isCalculating ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Calculating winner rewards...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {winners.first && (
            <WinnerCard 
              winner={winners.first} 
              rank="1st" 
              icon={<Crown className="w-6 h-6" />} 
            />
          )}
          {winners.second && (
            <WinnerCard 
              winner={winners.second} 
              rank="2nd" 
              icon={<Trophy className="w-6 h-6" />} 
            />
          )}
          {winners.third && (
            <WinnerCard 
              winner={winners.third} 
              rank="3rd" 
              icon={<Medal className="w-6 h-6" />} 
            />
          )}
        </div>
      )}

      {/* Supporter Summary */}
      {calculationComplete && (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <div className="flex items-center mb-4">
            <Users className="w-5 h-5 mr-2 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Supporter Distributions</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {winners.first && (
              <div className="text-center">
                <p className="text-yellow-400 font-medium">{winners.first.supporterCount} supporters</p>
                <p className="text-gray-400 text-sm">1st place supporters</p>
              </div>
            )}
            {winners.second && (
              <div className="text-center">
                <p className="text-gray-400 font-medium">{winners.second.supporterCount} supporters</p>
                <p className="text-gray-400 text-sm">2nd place supporters</p>
              </div>
            )}
            {winners.third && (
              <div className="text-center">
                <p className="text-orange-400 font-medium">{winners.third.supporterCount} supporters</p>
                <p className="text-gray-400 text-sm">3rd place supporters</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 pt-6">
        <button
          onClick={loadWinners}
          disabled={isCalculating}
          className="flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
        >
          <RefreshCw className={`w-5 h-5 mr-2 ${isCalculating ? 'animate-spin' : ''}`} />
          Recalculate Rewards
        </button>

        <button
          onClick={onProceed}
          disabled={!calculationComplete || isCalculating}
          className="flex-1 flex items-center justify-center px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
        >
          Proceed to Review & Approval
        </button>
      </div>
    </div>
  );
}