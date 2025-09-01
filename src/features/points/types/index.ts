// Beta points types following feature-first architecture

export interface BetaPointsRecord {
  wallet_address: string;
  total_points: number;
  created_at: string;
  updated_at: string;
}

export interface PointTransaction {
  id: string;
  wallet_address: string;
  action_type: 'create_evermark' | 'vote' | 'stake';
  points_earned: number;
  related_id?: string;
  tx_hash?: string;
  created_at: string;
}

export interface LeaderboardEntry {
  wallet_address: string;
  total_points: number;
  rank: number;
}

export interface UseBetaPointsReturn {
  // Data
  userPoints: BetaPointsRecord | null;
  transactions: PointTransaction[];
  leaderboard: LeaderboardEntry[];
  
  // State
  isLoading: boolean;
  error: string | null;
  
  // Actions
  awardPoints: (actionType: 'create_evermark' | 'vote' | 'stake', relatedId?: string, txHash?: string, stakeAmount?: string) => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}