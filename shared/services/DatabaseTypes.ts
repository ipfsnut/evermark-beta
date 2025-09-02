// shared/services/DatabaseTypes.ts
// Export existing types for backend use

// Re-export existing voting types for backend functions
export type {
  Vote,
  VotingSeason,
  VotingCycle,
  VotingPower,
  VotingStats,
  VotingValidation,
  VotingError,
  VotingTransaction,
  EvermarkRanking,
  LeaderboardEntry
} from '../../src/features/voting/types';

export { VOTING_CONSTANTS, VOTING_ERRORS } from '../../src/features/voting/types';

// Additional types for backend-specific operations
export interface VoteRecord {
  user_id: string;
  evermark_id: string;
  cycle: number;
  amount: string;           // Wei as string
  action: 'vote' | 'unvote' | 'delegate' | 'recall';
  metadata: {
    transaction_hash?: string;
    block_number?: string;
    log_index?: number;
    note?: string;
    created_via?: string;
  };
  created_at?: string;
}

export interface VotingCache {
  evermark_id: string;
  total_votes: number;      // Human readable EMARK
  total_votes_wei: string;  // Raw wei amount
  voter_count: number;
  current_cycle: number;
  last_block_synced: string;
  last_synced_at: string;
}

export interface ContractEvent {
  args: {
    voter?: string;
    delegator?: string;
    evermarkId?: bigint;
    amount?: bigint;
  };
  transactionHash: string;
  blockNumber: bigint;
  logIndex: number;
}

export interface UserWemark {
  evermark_id: string;
  evermark_title: string;
  content_url: string;
  description: string;
  creator_address: string;
  vote_amount_emark: number;
  vote_amount_wei: string;
  transaction_hash: string;
  voted_at: string;
  evermark_created_at: string;
}

export interface VotingValidationResult {
  valid: boolean;
  reason?: string;
}