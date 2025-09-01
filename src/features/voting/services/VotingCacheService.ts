import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

interface VotingCacheEntry {
  evermark_id: string;
  cycle_number: number;
  total_votes: bigint;
  voter_count: number;
  last_updated: string;
}

interface UserVoteEntry {
  user_address: string;
  evermark_id: string;
  cycle_number: number;
  vote_amount: bigint;
  transaction_hash?: string;
  block_number?: bigint;
}

interface VotingCycleEntry {
  cycle_number: number;
  start_time: string;
  end_time: string;
  total_votes: bigint;
  total_voters: number;
  active_evermarks_count: number;
  is_active: boolean;
  finalized: boolean;
}

export class VotingCacheService {
  
  /**
   * Get cached voting data for an evermark, returns 0s if not cached
   */
  static async getCachedVotingData(evermarkId: string, cycle?: number): Promise<{votes: bigint; voterCount: number}> {
    try {
      if (!cycle) {
        const currentCycle = await this.getCurrentCycle();
        if (!currentCycle) {
          return { votes: BigInt(0), voterCount: 0 };
        }
        cycle = currentCycle.cycle_number;
      }

      const { data, error } = await supabase
        .from('voting_cache')
        .select('total_votes, voter_count')
        .eq('evermark_id', evermarkId)
        .eq('cycle_number', cycle)
        .single();

      if (error || !data) {
        return { votes: BigInt(0), voterCount: 0 };
      }

      return {
        votes: BigInt(data.total_votes),
        voterCount: data.voter_count
      };
    } catch (error) {
      console.error('Failed to get cached voting data:', error);
      return { votes: BigInt(0), voterCount: 0 };
    }
  }

  /**
   * Update voting cache for a specific evermark and cycle
   */
  static async updateVotingCache(
    evermarkId: string, 
    cycle: number, 
    totalVotes: bigint, 
    voterCount: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('voting_cache')
        .upsert({
          evermark_id: evermarkId,
          cycle_number: cycle,
          total_votes: totalVotes.toString(),
          voter_count: voterCount,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'evermark_id,cycle_number'
        });

      if (error) {
        console.error('Failed to update voting cache:', error);
      }
    } catch (error) {
      console.error('Failed to update voting cache:', error);
    }
  }

  /**
   * Add or update a user's vote in the cache
   */
  static async cacheUserVote(
    userAddress: string,
    evermarkId: string,
    cycle: number,
    voteAmount: bigint,
    transactionHash?: string,
    blockNumber?: bigint
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_votes_cache')
        .upsert({
          user_address: userAddress.toLowerCase(),
          evermark_id: evermarkId,
          cycle_number: cycle,
          vote_amount: voteAmount.toString(),
          transaction_hash: transactionHash,
          block_number: blockNumber?.toString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_address,evermark_id,cycle_number'
        });

      if (error) {
        console.error('Failed to cache user vote:', error);
      }
    } catch (error) {
      console.error('Failed to cache user vote:', error);
    }
  }

  /**
   * Get cached user votes for a specific user and cycle
   */
  static async getCachedUserVotes(userAddress: string, cycle?: number): Promise<UserVoteEntry[]> {
    try {
      let query = supabase
        .from('user_votes_cache')
        .select('*')
        .eq('user_address', userAddress.toLowerCase());

      if (cycle) {
        query = query.eq('cycle_number', cycle);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to get cached user votes:', error);
        return [];
      }

      return (data || []).map(row => ({
        user_address: row.user_address,
        evermark_id: row.evermark_id,
        cycle_number: row.cycle_number,
        vote_amount: BigInt(row.vote_amount),
        transaction_hash: row.transaction_hash,
        block_number: row.block_number ? BigInt(row.block_number) : undefined
      }));
    } catch (error) {
      console.error('Failed to get cached user votes:', error);
      return [];
    }
  }

  /**
   * Get current voting cycle from cache
   */
  static async getCurrentCycle(): Promise<VotingCycleEntry | null> {
    try {
      const { data, error } = await supabase
        .from('voting_cycles_cache')
        .select('*')
        .eq('is_active', true)
        .order('cycle_number', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        cycle_number: data.cycle_number,
        start_time: data.start_time,
        end_time: data.end_time,
        total_votes: BigInt(data.total_votes),
        total_voters: data.total_voters,
        active_evermarks_count: data.active_evermarks_count,
        is_active: data.is_active,
        finalized: data.finalized
      };
    } catch (error) {
      console.error('Failed to get current cycle from cache:', error);
      return null;
    }
  }

  /**
   * Update voting cycle cache
   */
  static async updateVotingCycle(
    cycleNumber: number,
    startTime: Date,
    endTime: Date,
    isActive: boolean,
    finalized: boolean,
    totalVotes?: bigint,
    totalVoters?: number,
    activeEvermarksCount?: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('voting_cycles_cache')
        .upsert({
          cycle_number: cycleNumber,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          total_votes: totalVotes?.toString() || '0',
          total_voters: totalVoters || 0,
          active_evermarks_count: activeEvermarksCount || 0,
          is_active: isActive,
          finalized: finalized,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'cycle_number'
        });

      if (error) {
        console.error('Failed to update voting cycle cache:', error);
      }
    } catch (error) {
      console.error('Failed to update voting cycle cache:', error);
    }
  }

  /**
   * Get cached voting data for multiple evermarks efficiently
   */
  static async getBulkVotingData(evermarkIds: string[], cycle?: number): Promise<Map<string, {votes: bigint; voterCount: number}>> {
    try {
      if (!cycle) {
        const currentCycle = await this.getCurrentCycle();
        if (!currentCycle) {
          return new Map();
        }
        cycle = currentCycle.cycle_number;
      }

      const { data, error } = await supabase
        .from('voting_cache')
        .select('evermark_id, total_votes, voter_count')
        .in('evermark_id', evermarkIds)
        .eq('cycle_number', cycle);

      if (error) {
        console.error('Failed to get bulk voting data:', error);
        return new Map();
      }

      const result = new Map<string, {votes: bigint; voterCount: number}>();
      
      (data || []).forEach(row => {
        result.set(row.evermark_id, {
          votes: BigInt(row.total_votes),
          voterCount: row.voter_count
        });
      });

      // Fill in missing entries with zeros
      evermarkIds.forEach(id => {
        if (!result.has(id)) {
          result.set(id, { votes: BigInt(0), voterCount: 0 });
        }
      });

      return result;
    } catch (error) {
      console.error('Failed to get bulk voting data:', error);
      return new Map();
    }
  }

  /**
   * Check if voting cache is stale and needs refresh
   */
  static async isCacheStale(evermarkId: string, cycle?: number, maxAgeSeconds: number = 30): Promise<boolean> {
    try {
      if (!cycle) {
        const currentCycle = await this.getCurrentCycle();
        if (!currentCycle) {
          return true; // No cycle data, consider stale
        }
        cycle = currentCycle.cycle_number;
      }

      const { data, error } = await supabase
        .from('voting_cache')
        .select('last_updated')
        .eq('evermark_id', evermarkId)
        .eq('cycle_number', cycle)
        .single();

      if (error || !data) {
        return true; // No cache entry, consider stale
      }

      const lastUpdated = new Date(data.last_updated);
      const ageSeconds = (Date.now() - lastUpdated.getTime()) / 1000;
      
      return ageSeconds > maxAgeSeconds;
    } catch (error) {
      console.error('Failed to check cache staleness:', error);
      return true; // Default to stale on error
    }
  }

  /**
   * Clear voting cache for a specific evermark and cycle
   */
  static async clearCache(evermarkId?: string, cycle?: number): Promise<void> {
    try {
      let query = supabase.from('voting_cache').delete();

      if (evermarkId) {
        query = query.eq('evermark_id', evermarkId);
      }
      if (cycle) {
        query = query.eq('cycle_number', cycle);
      }

      const { error } = await query;

      if (error) {
        console.error('Failed to clear voting cache:', error);
      }
    } catch (error) {
      console.error('Failed to clear voting cache:', error);
    }
  }

  /**
   * Get voting cache statistics
   */
  static async getCacheStats(): Promise<{
    totalEntries: number;
    lastUpdated: Date | null;
    activeCycles: number;
  }> {
    try {
      const [entriesResult, lastUpdatedResult, cyclesResult] = await Promise.all([
        supabase.from('voting_cache').select('id', { count: 'exact', head: true }),
        supabase.from('voting_cache').select('last_updated').order('last_updated', { ascending: false }).limit(1).single(),
        supabase.from('voting_cycles_cache').select('cycle_number', { count: 'exact', head: true }).eq('is_active', true)
      ]);

      return {
        totalEntries: entriesResult.count || 0,
        lastUpdated: lastUpdatedResult.data ? new Date(lastUpdatedResult.data.last_updated) : null,
        activeCycles: cyclesResult.count || 0
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        totalEntries: 0,
        lastUpdated: null,
        activeCycles: 0
      };
    }
  }

  /**
   * Sync blockchain data to cache for a specific evermark
   */
  static async syncEvermarkToCache(evermarkId: string, cycle?: number): Promise<void> {
    try {
      // This would integrate with VotingService to fetch fresh blockchain data
      // and update the cache. For now, this is a placeholder for the sync mechanism.
      
      if (!cycle) {
        const currentCycle = await this.getCurrentCycle();
        if (!currentCycle) return;
        cycle = currentCycle.cycle_number;
      }

      // Import VotingService dynamically to avoid circular dependencies
      const { VotingService } = await import('./VotingService');
      
      // Fetch fresh data from blockchain
      const [votes, voterCount] = await Promise.all([
        VotingService.getEvermarkVotes(evermarkId, cycle),
        VotingService.getEvermarkVoterCount(evermarkId, cycle)
      ]);

      // Update cache
      await this.updateVotingCache(evermarkId, cycle, votes, voterCount);
    } catch (error) {
      console.error('Failed to sync evermark to cache:', error);
    }
  }

  /**
   * Batch sync multiple evermarks to cache
   */
  static async batchSyncToCache(evermarkIds: string[], cycle?: number): Promise<void> {
    try {
      if (!cycle) {
        const currentCycle = await this.getCurrentCycle();
        if (!currentCycle) return;
        cycle = currentCycle.cycle_number;
      }

      // Process in chunks to avoid overwhelming the RPC
      const chunkSize = 5;
      for (let i = 0; i < evermarkIds.length; i += chunkSize) {
        const chunk = evermarkIds.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(evermarkId => this.syncEvermarkToCache(evermarkId, cycle))
        );
        
        // Small delay between chunks to be RPC-friendly
        if (i + chunkSize < evermarkIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('Failed to batch sync to cache:', error);
    }
  }
}