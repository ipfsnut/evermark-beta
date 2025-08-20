// src/features/leaderboard/types/index.ts
// Fixed types with consistent pagination

export const LEADERBOARD_CONSTANTS = {
  DEFAULT_PERIOD: 'season',
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 10
} as const;

export interface LeaderboardEntry {
  id: string;
  evermarkId: string;
  rank: number;
  totalVotes: bigint;
  voteCount: number;
  percentageOfTotal: number;
  title: string;
  description: string;
  creator: string;
  createdAt: string;
  sourceUrl?: string;
  image?: string;
  contentType: 'Cast' | 'DOI' | 'ISBN' | 'URL' | 'Custom';
  tags: string[];
  verified: boolean;
  change: RankingChange;
}

export interface RankingChange {
  direction: 'up' | 'down' | 'same' | 'new';
  positions: number;
}

export interface RankingPeriod {
  id: string;
  label: string;
  duration: number; // seconds
  description: string;
}

export interface LeaderboardFilters {
  period?: string;
  contentType?: LeaderboardEntry['contentType'];
  minVotes?: string;
  searchQuery?: string;
}

// Fixed: Make sortBy and sortOrder required with defaults
export interface LeaderboardPagination {
  page: number;
  pageSize: number;
  sortBy: 'rank' | 'votes' | 'title' | 'creator' | 'createdAt' | 'change';
  sortOrder: 'asc' | 'desc';
}

// Optional versions for partial updates
export interface LeaderboardFeedOptions {
  page?: number;
  pageSize?: number;
  filters?: LeaderboardFilters;
  sortBy?: LeaderboardPagination['sortBy'];
  sortOrder?: LeaderboardPagination['sortOrder'];
}

export interface LeaderboardFeedResult {
  entries: LeaderboardEntry[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  lastUpdated: Date;
  filters: LeaderboardFilters;
}

export interface LeaderboardStats {
  totalEvermarks: number;
  totalVotes: bigint;
  activeVoters: number;
  participationRate: number;
  averageVotesPerEvermark: bigint;
  topEvermarkVotes: bigint;
  period: string;
}

export interface LeaderboardError extends Error {
  code: LeaderboardErrorCode;
  timestamp: number;
  recoverable: boolean;
  details?: Record<string, any>;
}

// Hook return types
export interface UseLeaderboardStateReturn {
  // Data
  entries: LeaderboardEntry[];
  stats: LeaderboardStats | null;
  currentPeriod: RankingPeriod;
  availablePeriods: RankingPeriod[];
  
  // Pagination & filtering
  pagination: LeaderboardPagination;
  filters: LeaderboardFilters;
  totalCount: number;
  totalPages: number;
  
  // UI State
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  
  // Actions
  loadLeaderboard: (options?: Partial<LeaderboardFeedOptions>) => Promise<void>;
  refresh: () => Promise<void>;
  
  // Filtering & pagination
  setPeriod: (periodId: string) => void;
  setFilters: (filters: Partial<LeaderboardFilters>) => void;
  setPagination: (pagination: Partial<LeaderboardPagination>) => void;
  clearFilters: () => void;
  
  // Entry actions
  getEntryByEvermarkId: (evermarkId: string) => LeaderboardEntry | null;
  getEntryRank: (evermarkId: string) => number | null;
  
  // Computed properties
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isEmpty: boolean;
  isFiltered: boolean;
}

// Constants
export const RANKING_PERIODS: RankingPeriod[] = [
  {
    id: '1',
    label: 'Cycle 1',
    duration: 0,
    description: 'First voting cycle'
  },
  {
    id: '2',
    label: 'Cycle 2',
    duration: 0,
    description: 'Second voting cycle'
  },
  {
    id: '3',
    label: 'Cycle 3',
    duration: 0,
    description: 'Third voting cycle'
  }
];


export const LEADERBOARD_ERRORS = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  FETCH_ERROR: 'FETCH_ERROR',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  NO_DATA: 'NO_DATA'
} as const;

export type LeaderboardErrorCode = typeof LEADERBOARD_ERRORS[keyof typeof LEADERBOARD_ERRORS];