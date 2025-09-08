// shared/services/VotingDataService.ts
// THE source of truth for voting data - works in both frontend and backend

import { createClient } from '@supabase/supabase-js';
import type { 
  UserWemark, 
  VotingValidationResult
} from './DatabaseTypes';

// Environment-aware Supabase client
function createSupabaseClient() {
  // Works in both Vite and Node.js contexts
  const url = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ?? 
              (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ?? 
              '';
  const key = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ?? 
              (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ?? 
              '';
  
  if (!url || !key) {
    throw new Error('Supabase configuration missing');
  }
  
  return createClient(url, key);
}

export class VotingDataService {
  private static supabase = createSupabaseClient();
  
  /**
   * THE method everyone calls for evermark voting data
   * Ported from VotingCacheService.getCachedVotingData()
   */
  static async getEvermarkVotingData(evermarkId: string, cycle?: number): Promise<{
    total_votes: number;      // EMARK tokens (human readable)
    total_votes_wei: string;  // Raw wei
    voter_count: number;
    last_updated: Date;
  }> {
    try {
      // Use current cycle if not specified
      if (!cycle) {
        const currentSeason = await this.getCurrentSeason();
        if (!currentSeason) {
          return { 
            total_votes: 0, 
            total_votes_wei: '0', 
            voter_count: 0, 
            last_updated: new Date() 
          };
        }
        cycle = currentSeason.cycle_number;
      }

      const { data, error } = await this.supabase
        .from('voting_cache')
        .select('total_votes, voter_count, last_updated')
        .eq('evermark_id', evermarkId)
        .eq('cycle_number', cycle)
        .single();

      if (error || !data) {
        return { 
          total_votes: 0, 
          total_votes_wei: '0', 
          voter_count: 0, 
          last_updated: new Date() 
        };
      }

      const totalVotesWei = BigInt(data.total_votes || 0);
      const totalVotesEmark = Number(totalVotesWei) / (10 ** 18);

      return {
        total_votes: totalVotesEmark,
        total_votes_wei: totalVotesWei.toString(),
        voter_count: data.voter_count || 0,
        last_updated: new Date(data.last_updated || Date.now())
      };
    } catch (error) {
      console.error('Failed to get evermark voting data:', error);
      return { 
        total_votes: 0, 
        total_votes_wei: '0', 
        voter_count: 0, 
        last_updated: new Date() 
      };
    }
  }

  /**
   * Get user's complete wemark history (their personal library)
   */
  static async getUserWemarkHistory(address: string): Promise<UserWemark[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_wemarks')  // This view needs to be created
        .select('*')
        .eq('user_address', address.toLowerCase())
        .order('voted_at', { ascending: false });

      if (error) {
        console.error('Failed to get user wemark history:', error);
        
        // Fallback: manual join
        return await this.getUserWemarkHistoryFallback(address);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get user wemark history:', error);
      return [];
    }
  }

  /**
   * Fallback method using manual join
   */
  private static async getUserWemarkHistoryFallback(address: string): Promise<UserWemark[]> {
    try {
      const { data: votes, error: votesError } = await this.supabase
        .from('votes')
        .select(`
          evermark_id,
          amount,
          metadata,
          created_at,
          action
        `)
        .eq('user_id', address.toLowerCase())
        .eq('action', 'vote')
        .order('created_at', { ascending: false });

      if (votesError || !votes) {
        return [];
      }

      // Get evermark details for each vote
      const wemarks: UserWemark[] = [];
      for (const vote of votes) {
        const { data: evermark } = await this.supabase
          .from('beta_evermarks')
          .select('title, content_url, description, owner, created_at')
          .eq('token_id', parseInt(vote.evermark_id))
          .single();

        if (evermark) {
          wemarks.push({
            evermark_id: vote.evermark_id,
            evermark_title: evermark.title || 'Untitled',
            content_url: evermark.content_url || '',
            description: evermark.description || '',
            creator_address: evermark.owner || '',
            vote_amount_emark: Number(vote.amount) / (10 ** 18),
            vote_amount_wei: vote.amount,
            transaction_hash: vote.metadata?.transaction_hash || '',
            voted_at: vote.created_at,
            evermark_created_at: evermark.created_at
          });
        }
      }

      return wemarks;
    } catch (error) {
      console.error('Fallback query failed:', error);
      return [];
    }
  }

  /**
   * Validate vote to prevent self-voting
   */
  static async validateVote(voterAddress: string, evermarkId: string): Promise<VotingValidationResult> {
    try {
      const { data: evermark } = await this.supabase
        .from('beta_evermarks')
        .select('owner')
        .eq('token_id', parseInt(evermarkId))
        .single();

      if (!evermark) {
        return { valid: false, reason: 'Evermark not found' };
      }

      if (evermark.owner?.toLowerCase() === voterAddress.toLowerCase()) {
        return { valid: false, reason: 'Cannot wemark your own content' };
      }

      return { valid: true };
    } catch (error) {
      console.error('Vote validation failed:', error);
      return { valid: false, reason: 'Validation error' };
    }
  }

  /**
   * Update voting cache for an evermark
   * Ported from VotingCacheService.updateVotingCache()
   */
  static async updateVotingCache(
    evermarkId: string,
    cycle: number,
    totalVotes: bigint,
    voterCount: number
  ): Promise<void> {
    try {
      const { error } = await this.supabase
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
        throw error;
      }
    } catch (error) {
      console.error('Cache update failed:', error);
      throw error;
    }
  }

  /**
   * Get current season info
   * Ported from VotingCacheService.getCurrentSeason()
   */
  private static async getCurrentSeason(): Promise<{ cycle_number: number } | null> {
    try {
      const { data, error } = await this.supabase
        .from('voting_seasons')
        .select('cycle_number')
        .eq('is_active', true)
        .single();

      if (error || !data) {
        // Default to cycle 3 if no active season found
        return { cycle_number: 3 };
      }

      return data;
    } catch (error) {
      console.error('Failed to get current season:', error);
      return { cycle_number: 3 };
    }
  }

  /**
   * Batch get voting data for multiple evermarks
   * For efficient leaderboard/feed queries
   */
  static async getBulkVotingData(evermarkIds: string[]): Promise<Map<string, {votes: bigint; voterCount: number}>> {
    try {
      const currentSeason = await this.getCurrentSeason();
      if (!currentSeason) {
        return new Map();
      }

      const { data, error } = await this.supabase
        .from('voting_cache')
        .select('evermark_id, total_votes, voter_count')
        .in('evermark_id', evermarkIds)
        .eq('cycle_number', currentSeason.cycle_number);

      if (error || !data) {
        return new Map();
      }

      const result = new Map();
      for (const item of data) {
        result.set(item.evermark_id, {
          votes: BigInt(item.total_votes || 0),
          voterCount: item.voter_count || 0
        });
      }

      return result;
    } catch (error) {
      console.error('Failed to get bulk voting data:', error);
      return new Map();
    }
  }
}