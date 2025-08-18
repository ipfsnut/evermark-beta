// src/features/leaderboard/services/LeaderboardSyncService.ts
// Service to sync voting data to leaderboard contract

import { readContract, prepareContractCall } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { base } from 'thirdweb/chains';
import EvermarkLeaderboardABI from '../abis/EvermarkLeaderboard.json';
import EvermarkVotingABI from '../../voting/abis/EvermarkVoting.json';

const CHAIN = base;

export class LeaderboardSyncService {
  
  /**
   * Check if a cycle is finalized in the leaderboard
   */
  static async isCycleInitialized(cycle: number): Promise<boolean> {
    try {
      const leaderboardContract = {
        client,
        chain: CHAIN,
        address: import.meta.env.VITE_EVERMARK_LEADERBOARD_ADDRESS || '',
        abi: EvermarkLeaderboardABI
      };

      const finalized = await readContract({
        contract: leaderboardContract,
        method: "isLeaderboardFinalized",
        params: [BigInt(cycle)]
      });

      return finalized;
    } catch (error) {
      console.error('Failed to check cycle finalization:', error);
      return false;
    }
  }

  /**
   * Get voting data from voting contract for a specific cycle
   */
  static async getVotingDataForCycle(cycle: number): Promise<Array<{
    evermarkId: string;
    totalVotes: bigint;
    creator: string;
  }>> {
    try {
      const votingContract = {
        client,
        chain: CHAIN,
        address: import.meta.env.VITE_EVERMARK_VOTING_ADDRESS || '',
        abi: EvermarkVotingABI
      };

      console.log('🔍 Fetching voting data for cycle', cycle);

      // First, let's see what methods are available in the voting contract
      // We need to query evermarks that have received votes
      
      // For now, let's try to get some sample evermark data
      // In a real implementation, we'd query events or have a method to get all voted evermarks
      
      const sampleEvermarkIds = [1, 2, 3, 4, 5]; // This would be replaced with actual data
      const votingData = [];

      for (const evermarkId of sampleEvermarkIds) {
        try {
          const votes = await readContract({
            contract: votingContract,
            method: "getEvermarkVotesInCycle",
            params: [BigInt(cycle), BigInt(evermarkId)]
          });

          if (votes > BigInt(0)) {
            // Get evermark creator (would need NFT contract call)
            votingData.push({
              evermarkId: evermarkId.toString(),
              totalVotes: votes,
              creator: '0x0000000000000000000000000000000000000000' // Placeholder
            });
          }
        } catch (error) {
          console.log(`No data for evermark ${evermarkId} in cycle ${cycle}`);
        }
      }

      return votingData;
    } catch (error) {
      console.error('Failed to get voting data for cycle:', error);
      return [];
    }
  }

  /**
   * Prepare transaction to update leaderboard with voting data
   */
  static async prepareLeaderboardUpdate(
    cycle: number,
    evermarkIds: string[]
  ) {
    try {
      const leaderboardContract = {
        client,
        chain: CHAIN,
        address: import.meta.env.VITE_EVERMARK_LEADERBOARD_ADDRESS || '',
        abi: EvermarkLeaderboardABI
      };

      const transaction = prepareContractCall({
        contract: leaderboardContract,
        method: "batchUpdateLeaderboard",
        params: [BigInt(cycle), evermarkIds.map(id => BigInt(id))]
      });

      return transaction;
    } catch (error) {
      console.error('Failed to prepare leaderboard update:', error);
      throw error;
    }
  }

  /**
   * Check the current voting cycle
   */
  static async getCurrentVotingCycle(): Promise<number> {
    try {
      const votingContract = {
        client,
        chain: CHAIN,
        address: import.meta.env.VITE_EVERMARK_VOTING_ADDRESS || '',
        abi: EvermarkVotingABI
      };

      // Try to get current cycle from voting contract
      const currentCycle = await readContract({
        contract: votingContract,
        method: "getCurrentCycle",
        params: []
      });

      return Number(currentCycle);
    } catch (error) {
      console.log('Could not get current cycle from voting contract, defaulting to 1');
      return 1;
    }
  }

  /**
   * Sync voting data to leaderboard for development
   */
  static async createDevelopmentData(): Promise<void> {
    console.log('🔄 Creating development voting data...');
    
    try {
      // For development, we'll manually create some sample votes
      // This simulates what would happen when users actually vote

      const votingContract = {
        client,
        chain: CHAIN,
        address: import.meta.env.VITE_EVERMARK_VOTING_ADDRESS || '',
        abi: EvermarkVotingABI
      };

      // Check if we can interact with the voting contract
      const currentCycle = await this.getCurrentVotingCycle();
      console.log('📊 Current voting cycle:', currentCycle);

      // Get sample voting data
      const votingData = await this.getVotingDataForCycle(currentCycle);
      console.log('📊 Voting data for cycle:', votingData);

      if (votingData.length === 0) {
        console.log('⚠️ No voting data found. Users need to vote first.');
        console.log('💡 To populate the leaderboard:');
        console.log('   1. Users need to stake EMARK tokens');
        console.log('   2. Users need to delegate votes to evermarks');
        console.log('   3. The leaderboard will be updated with voting results');
      }

    } catch (error) {
      console.error('Failed to sync development data:', error);
    }
  }

  /**
   * Get leaderboard status summary
   */
  static async getLeaderboardStatus(): Promise<{
    cycleInitialized: boolean;
    hasVotingData: boolean;
    currentCycle: number;
    suggestions: string[];
  }> {
    const currentCycle = await this.getCurrentVotingCycle();
    const cycleInitialized = await this.isCycleInitialized(currentCycle);
    const votingData = await this.getVotingDataForCycle(currentCycle);
    
    const suggestions: string[] = [];
    
    if (!cycleInitialized) {
      suggestions.push('Cycle needs to be initialized by contract admin');
    }
    
    if (votingData.length === 0) {
      suggestions.push('No voting data found - users need to vote on evermarks');
      suggestions.push('Users need to stake EMARK tokens to get voting power');
      suggestions.push('Users can then delegate votes to evermarks they want to support');
    }

    return {
      cycleInitialized,
      hasVotingData: votingData.length > 0,
      currentCycle,
      suggestions
    };
  }
}