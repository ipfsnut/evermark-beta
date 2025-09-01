// src/features/leaderboard/services/FinalizationService.ts
// Handles season finalization and leaderboard snapshots

import { createClient } from '@supabase/supabase-js';
import { readContract } from 'thirdweb';
import { getEvermarkVotingContract } from '@/lib/contracts';
import { VotingService } from '../../voting/services/VotingService';
import { LeaderboardService } from './LeaderboardService';
import type { Evermark } from '../../evermarks/types';
import type { LeaderboardEntry } from '../types';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

interface FinalizedLeaderboardEntry {
  season_number: number;
  evermark_id: string;
  final_rank: number;
  total_votes: string; // BigInt as string for database
  percentage_of_total: number;
  finalized_at: string;
  snapshot_hash?: string;
}

interface FinalizedSeason {
  season_number: number;
  start_time: string;
  end_time: string;
  total_votes: string; // BigInt as string for database
  total_evermarks_count: number;
  top_evermark_id?: string;
  top_evermark_votes: string; // BigInt as string for database
  finalized_at: string;
  snapshot_hash?: string;
}

export class FinalizationService {
  
  /**
   * Check if a season is finalized on the blockchain
   */
  static async isSeasonFinalized(seasonNumber: number): Promise<boolean> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      const cycleInfo = await readContract({
        contract: votingContract,
        method: "function getCycleInfo(uint256 cycle) view returns (uint256 startTime, uint256 endTime, uint256 totalVotes, uint256 totalDelegations, bool finalized, uint256 activeEvermarksCount)",
        params: [BigInt(seasonNumber)]
      });
      
      if (!cycleInfo) return false;
      
      const [, , , , finalized] = cycleInfo as [bigint, bigint, bigint, bigint, boolean, bigint];
      return finalized;
    } catch (error) {
      console.error(`Failed to check if season ${seasonNumber} is finalized:`, error);
      return false;
    }
  }
  
  /**
   * Check if we have a finalized leaderboard stored for a season
   */
  static async hasStoredFinalization(seasonNumber: number): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('finalized_seasons')
        .select('season_number')
        .eq('season_number', seasonNumber)
        .single();
        
      return !error && !!data;
    } catch (error) {
      console.error(`Failed to check stored finalization for season ${seasonNumber}:`, error);
      return false;
    }
  }
  
  /**
   * Store finalized leaderboard snapshot for a season
   */
  static async finalizeSeasonLeaderboard(
    seasonNumber: number, 
    evermarks: Evermark[]
  ): Promise<void> {
    try {
      console.log(`🏆 Finalizing leaderboard for season ${seasonNumber}...`);
      
      // Check if already finalized
      const alreadyStored = await this.hasStoredFinalization(seasonNumber);
      if (alreadyStored) {
        console.log(`⚠️ Season ${seasonNumber} already finalized in database`);
        return;
      }
      
      // Verify season is finalized on blockchain
      const isBlockchainFinalized = await this.isSeasonFinalized(seasonNumber);
      if (!isBlockchainFinalized) {
        throw new Error(`Season ${seasonNumber} is not finalized on blockchain yet`);
      }
      
      // Get season info from blockchain
      const votingContract = getEvermarkVotingContract();
      const cycleInfo = await readContract({
        contract: votingContract,
        method: "function getCycleInfo(uint256 cycle) view returns (uint256 startTime, uint256 endTime, uint256 totalVotes, uint256 totalDelegations, bool finalized, uint256 activeEvermarksCount)",
        params: [BigInt(seasonNumber)]
      });
      
      if (!cycleInfo) {
        throw new Error(`Failed to get cycle info for season ${seasonNumber}`);
      }
      
      const [startTime, endTime, totalVotes, totalDelegations, finalized, activeEvermarksCount] = cycleInfo as [bigint, bigint, bigint, bigint, boolean, bigint];
      
      if (!finalized) {
        throw new Error(`Season ${seasonNumber} is not finalized according to contract`);
      }
      
      // Calculate final leaderboard with season-specific data
      const leaderboardEntries = await LeaderboardService.calculateLeaderboard(
        evermarks, 
        `season-${seasonNumber}`
      );
      
      if (leaderboardEntries.length === 0) {
        console.log(`⚠️ No leaderboard entries found for season ${seasonNumber}`);
        return;
      }
      
      // Calculate total votes for percentage calculations
      const seasonTotalVotes = leaderboardEntries.reduce((sum, entry) => sum + entry.totalVotes, BigInt(0));
      
      // Prepare finalized entries data
      const finalizedEntries: FinalizedLeaderboardEntry[] = leaderboardEntries.map(entry => ({
        season_number: seasonNumber,
        evermark_id: entry.evermarkId,
        final_rank: entry.rank,
        total_votes: entry.totalVotes.toString(),
        percentage_of_total: seasonTotalVotes > BigInt(0) 
          ? Number((entry.totalVotes * BigInt(10000)) / seasonTotalVotes) / 100 // Convert to percentage with 2 decimal precision
          : 0,
        finalized_at: new Date().toISOString()
      }));
      
      // Calculate snapshot hash for integrity
      const snapshotData = finalizedEntries
        .map(e => `${e.evermark_id}:${e.final_rank}:${e.total_votes}`)
        .join('|');
      const snapshotHash = await this.calculateHash(snapshotData);
      
      // Add hash to entries
      finalizedEntries.forEach(entry => {
        entry.snapshot_hash = snapshotHash;
      });
      
      // Prepare season metadata
      const finalizedSeason: FinalizedSeason = {
        season_number: seasonNumber,
        start_time: new Date(Number(startTime) * 1000).toISOString(),
        end_time: new Date(Number(endTime) * 1000).toISOString(),
        total_votes: seasonTotalVotes.toString(),
        total_evermarks_count: leaderboardEntries.length,
        top_evermark_id: leaderboardEntries[0]?.evermarkId,
        top_evermark_votes: leaderboardEntries[0]?.totalVotes.toString() || '0',
        finalized_at: new Date().toISOString(),
        snapshot_hash: snapshotHash
      };
      
      // Store in database with transaction for consistency
      const { error: seasonError } = await supabase
        .from('finalized_seasons')
        .insert(finalizedSeason);
        
      if (seasonError) {
        throw new Error(`Failed to store finalized season: ${seasonError.message}`);
      }
      
      // Store leaderboard entries in batches for better performance
      const batchSize = 50;
      for (let i = 0; i < finalizedEntries.length; i += batchSize) {
        const batch = finalizedEntries.slice(i, i + batchSize);
        
        const { error: entriesError } = await supabase
          .from('finalized_leaderboards')
          .insert(batch);
          
        if (entriesError) {
          throw new Error(`Failed to store finalized entries batch ${i}: ${entriesError.message}`);
        }
      }
      
      console.log(`✅ Successfully finalized season ${seasonNumber}:`, {
        totalEntries: finalizedEntries.length,
        totalVotes: seasonTotalVotes.toString(),
        topEvermark: leaderboardEntries[0]?.evermarkId,
        snapshotHash
      });
      
    } catch (error) {
      console.error(`Failed to finalize season ${seasonNumber}:`, error);
      throw error;
    }
  }
  
  /**
   * Get finalized leaderboard for a specific season
   */
  static async getFinalizedLeaderboard(seasonNumber: number): Promise<LeaderboardEntry[]> {
    try {
      const { data, error } = await supabase
        .from('finalized_leaderboards')
        .select('*')
        .eq('season_number', seasonNumber)
        .order('final_rank', { ascending: true });
        
      if (error) {
        throw new Error(`Failed to get finalized leaderboard: ${error.message}`);
      }
      
      if (!data || data.length === 0) {
        return [];
      }
      
      // Convert to LeaderboardEntry format
      return data.map(entry => ({
        id: entry.evermark_id,
        evermarkId: entry.evermark_id,
        rank: entry.final_rank,
        totalVotes: BigInt(entry.total_votes),
        voteCount: 0, // We don't store individual voter counts
        percentageOfTotal: entry.percentage_of_total,
        title: 'Loading...', // Will be populated from evermarks data
        description: '',
        creator: 'Loading...',
        createdAt: new Date().toISOString(),
        sourceUrl: undefined,
        image: undefined,
        contentType: 'Custom' as const,
        tags: [],
        verified: false,
        change: {
          direction: 'same' as const,
          positions: 0
        }
      }));
      
    } catch (error) {
      console.error(`Failed to get finalized leaderboard for season ${seasonNumber}:`, error);
      return [];
    }
  }
  
  /**
   * Get metadata for a finalized season
   */
  static async getFinalizedSeasonMetadata(seasonNumber: number): Promise<FinalizedSeason | null> {
    try {
      const { data, error } = await supabase
        .from('finalized_seasons')
        .select('*')
        .eq('season_number', seasonNumber)
        .single();
        
      if (error || !data) {
        return null;
      }
      
      return data;
    } catch (error) {
      console.error(`Failed to get finalized season metadata for ${seasonNumber}:`, error);
      return null;
    }
  }
  
  /**
   * Get all finalized seasons (for period selection)
   */
  static async getAllFinalizedSeasons(): Promise<FinalizedSeason[]> {
    try {
      const { data, error } = await supabase
        .from('finalized_seasons')
        .select('*')
        .order('season_number', { ascending: false });
        
      if (error) {
        console.error('Failed to get finalized seasons:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Failed to get finalized seasons:', error);
      return [];
    }
  }
  
  /**
   * Detect newly finalized seasons and store them
   */
  static async detectAndStoreNewFinalizations(evermarks: Evermark[]): Promise<number[]> {
    try {
      // Get current season from blockchain
      const currentSeason = await VotingService.getCurrentSeason();
      if (!currentSeason) {
        return [];
      }
      
      const finalizedSeasons: number[] = [];
      
      // Check last 5 seasons for finalization (in case we missed any)
      const seasonsToCheck = Array.from(
        { length: Math.min(5, currentSeason.seasonNumber) }, 
        (_, i) => currentSeason.seasonNumber - i
      ).filter(season => season > 0);
      
      for (const seasonNumber of seasonsToCheck) {
        // Skip current active season
        if (seasonNumber === currentSeason.seasonNumber && currentSeason.isActive) {
          continue;
        }
        
        // Check if already stored
        const alreadyStored = await this.hasStoredFinalization(seasonNumber);
        if (alreadyStored) {
          continue;
        }
        
        // Check if finalized on blockchain
        const isFinalized = await this.isSeasonFinalized(seasonNumber);
        if (isFinalized) {
          console.log(`🔔 Detected newly finalized season: ${seasonNumber}`);
          await this.finalizeSeasonLeaderboard(seasonNumber, evermarks);
          finalizedSeasons.push(seasonNumber);
        }
      }
      
      return finalizedSeasons;
    } catch (error) {
      console.error('Failed to detect new finalizations:', error);
      return [];
    }
  }
  
  /**
   * Calculate SHA256 hash of a string (simple implementation)
   */
  private static async calculateHash(data: string): Promise<string> {
    try {
      // Use Web Crypto API if available (browser)
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const encoder = new TextEncoder();
        const dataBytes = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
      
      // Fallback: simple hash function for Node.js environments
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash).toString(16);
    } catch (error) {
      console.error('Failed to calculate hash:', error);
      return Date.now().toString(16);
    }
  }
  
  /**
   * Verify integrity of a finalized leaderboard
   */
  static async verifyLeaderboardIntegrity(seasonNumber: number): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('finalized_leaderboards')
        .select('evermark_id, final_rank, total_votes, snapshot_hash')
        .eq('season_number', seasonNumber)
        .order('final_rank', { ascending: true });
        
      if (error || !data || data.length === 0) {
        return false;
      }
      
      // Recalculate hash
      const snapshotData = data
        .map(entry => `${entry.evermark_id}:${entry.final_rank}:${entry.total_votes}`)
        .join('|');
      const calculatedHash = await this.calculateHash(snapshotData);
      
      // Compare with stored hash
      const storedHash = data[0]?.snapshot_hash;
      const isValid = calculatedHash === storedHash;
      
      if (!isValid) {
        console.warn(`⚠️ Integrity check failed for season ${seasonNumber}:`, {
          stored: storedHash,
          calculated: calculatedHash
        });
      }
      
      return isValid;
    } catch (error) {
      console.error(`Failed to verify integrity for season ${seasonNumber}:`, error);
      return false;
    }
  }
  
  /**
   * Get leaderboard statistics for a finalized season
   */
  static async getFinalizedSeasonStats(seasonNumber: number): Promise<{
    totalVotes: bigint;
    totalEvermarks: number;
    topEvermarkVotes: bigint;
    averageVotes: bigint;
  } | null> {
    try {
      const seasonMeta = await this.getFinalizedSeasonMetadata(seasonNumber);
      if (!seasonMeta) return null;
      
      return {
        totalVotes: BigInt(seasonMeta.total_votes),
        totalEvermarks: seasonMeta.total_evermarks_count,
        topEvermarkVotes: BigInt(seasonMeta.top_evermark_votes),
        averageVotes: seasonMeta.total_evermarks_count > 0 
          ? BigInt(seasonMeta.total_votes) / BigInt(seasonMeta.total_evermarks_count)
          : BigInt(0)
      };
    } catch (error) {
      console.error(`Failed to get finalized season stats for ${seasonNumber}:`, error);
      return null;
    }
  }
  
  /**
   * Clean up old finalized data (keep last N seasons)
   */
  static async cleanupOldFinalizations(keepSeasons: number = 10): Promise<void> {
    try {
      // Get current season
      const currentSeason = await VotingService.getCurrentSeason();
      if (!currentSeason) return;
      
      const cutoffSeason = Math.max(1, currentSeason.seasonNumber - keepSeasons);
      
      // Remove old entries
      const { error: entriesError } = await supabase
        .from('finalized_leaderboards')
        .delete()
        .lt('season_number', cutoffSeason);
        
      if (entriesError) {
        console.error('Failed to cleanup old finalized entries:', entriesError);
      }
      
      const { error: seasonsError } = await supabase
        .from('finalized_seasons')
        .delete()
        .lt('season_number', cutoffSeason);
        
      if (seasonsError) {
        console.error('Failed to cleanup old finalized seasons:', seasonsError);
      }
      
      console.log(`🧹 Cleaned up finalized data older than season ${cutoffSeason}`);
    } catch (error) {
      console.error('Failed to cleanup old finalizations:', error);
    }
  }
}