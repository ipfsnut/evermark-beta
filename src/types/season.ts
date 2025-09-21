// src/types/season.ts
// Type definitions for season management system

// Core season interfaces
export interface Season {
  number: number;
  year: number;
  week: string; // ISO week format (W01-W53)
  startDate: Date;
  endDate: Date;
  phase: SeasonPhase;
  status: SeasonStatus;
}

export type SeasonPhase = 'preparing' | 'active' | 'finalizing' | 'completed';
export type SeasonStatus = 'pending' | 'current' | 'past' | 'future';

// Season state management
export interface SeasonState {
  current: Season;
  previous: Season;
  next: Season;
  isTransitioning: boolean;
  lastUpdated: string;
}

export interface SeasonTransition {
  shouldTransition: boolean;
  isTransitionWindow: boolean;
  nextTransition: string; // ISO date string
  remainingTime?: number; // milliseconds until next transition
  gracePeriod: number; // milliseconds
}

export interface SeasonStateResponse {
  success: boolean;
  state: SeasonState;
  transition: SeasonTransition;
  server_time: string;
  season_boundaries: {
    current: SeasonBoundaries;
    previous: SeasonBoundaries;
    next: SeasonBoundaries;
  };
}

// Season boundaries and calculations
export interface SeasonBoundaries {
  start: Date;
  end: Date;
  isoWeek: number;
  weekString: string; // "W01", "W52", etc.
}

export interface SeasonCalculation {
  seasonNumber: number;
  year: number;
  week: string;
  boundaries: SeasonBoundaries;
  dayOfSeason: number; // 1-7
  isFirstWeek: boolean;
  isLastWeek: boolean;
}

// Season folder management for ArDrive
export interface SeasonFolder {
  seasonNumber: number;
  year: number;
  week: string;
  folderId: string;
  folderName: string;
  path: string;
  status: 'preparing' | 'active' | 'finalized';
  manifestTxId?: string;
  createdAt: string;
  finalizedAt?: string;
}

export interface SeasonManifest {
  season: Season;
  folder: SeasonFolder;
  contents: SeasonContentEntry[];
  stats: SeasonStats;
  createdAt: string;
  updatedAt: string;
}

export interface SeasonContentEntry {
  txId: string;
  name: string;
  type: 'image' | 'metadata' | 'thumbnail';
  size: number;
  uploadedAt: string;
  evermarkId?: number;
  contentHash?: string;
}

// Season statistics
export interface SeasonStats {
  totalEvermarks: number;
  totalUploads: number;
  totalSize: number;
  totalCost: number;
  averageCostPerEvermark: number;
  contentTypes: Record<string, number>;
  dailyActivity: Array<{
    date: string;
    evermarks: number;
    uploads: number;
    cost: number;
  }>;
}

// Season synchronization
export interface SeasonSyncStatus {
  smartContracts?: {
    voting?: boolean;
    leaderboard?: boolean;
    rewards?: boolean;
  };
  arDrive?: {
    currentFolderReady?: boolean;
    previousFolderFinalized?: boolean;
  };
  database?: {
    inSync?: boolean;
    lastSync?: string;
  };
}

export interface SeasonSyncResult {
  success: boolean;
  synced: string[];
  failed: string[];
  errors: string[];
  timestamp: string;
}

// Season actions and management
export interface SeasonAction {
  type: 'calculate_season' | 'clear_cache' | 'force_transition' | 'validate_season' | 'get_boundaries';
  payload?: any;
  timestamp: string;
  source: 'admin' | 'automatic' | 'api';
}

export interface SeasonActionResult {
  success: boolean;
  action: SeasonAction;
  result?: any;
  error?: string;
  duration: number;
}

// Season Oracle API responses
export interface SeasonOracleResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
  server_time: string;
}

export interface SeasonCalculationResponse extends SeasonOracleResponse {
  data: {
    season: Season;
    calculation: SeasonCalculation;
    boundaries: SeasonBoundaries;
  };
}

export interface SeasonBoundariesResponse extends SeasonOracleResponse {
  data: {
    seasonNumber: number;
    boundaries: SeasonBoundaries;
    previous?: SeasonBoundaries;
    next?: SeasonBoundaries;
  };
}

// Database season tracking
export interface SeasonRecord {
  id: string;
  season_number: number;
  year: number;
  week: string;
  start_date: string;
  end_date: string;
  phase: SeasonPhase;
  status: SeasonStatus;
  ardrive_folder_id?: string;
  manifest_tx_id?: string;
  stats?: SeasonStats;
  created_at: string;
  updated_at: string;
}

export interface SeasonTransitionRecord {
  id: string;
  from_season: number;
  to_season: number;
  started_at: string;
  completed_at?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  actions_completed: string[];
  errors?: string[];
  metadata?: Record<string, any>;
}

// Season-related evermark fields
export interface SeasonEvermarkData {
  season_number: number;
  season_year: number;
  season_week: string;
  season_created_at: string;
  ardrive_folder_path?: string;
  season_day?: number; // 1-7, day within the season
  season_phase?: SeasonPhase; // Phase when created
}

// Hook return types
export interface UseSeasonStateReturn {
  data: SeasonStateResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface UseSeasonSyncReturn {
  sync: SeasonSyncStatus | null;
  allInSync: () => boolean;
  getSyncIssues: () => string[];
  triggerSync: () => Promise<SeasonSyncResult>;
}

export interface UseSeasonCountdownReturn {
  timeRemaining: number; // milliseconds
  displayString: string; // "2 days, 3 hours"
  isEndingSoon: boolean; // less than 24 hours
  isInTransitionWindow: boolean;
}

export interface UseSeasonTransitionReturn {
  data: { transition: SeasonTransition } | null;
  isLoading: boolean;
  error: Error | null;
}

export interface UseSeasonActionsReturn {
  clearCache: () => Promise<void>;
  forceTransition: () => Promise<void>;
  validateSeason: (season: Season) => Promise<void>;
  calculateSeason: (date?: Date) => Promise<void>;
  getBoundaries: (seasonNumber: number) => Promise<void>;
  isExecuting: boolean;
  error: Error | null;
}

// Season utilities and helpers
export interface SeasonUtils {
  calculateSeasonNumber(date: Date): number;
  getSeasonBoundaries(seasonNumber: number): SeasonBoundaries;
  getCurrentSeason(): Season;
  getSeasonFromDate(date: Date): Season;
  formatSeasonWeek(isoWeek: number): string;
  isValidSeasonNumber(seasonNumber: number): boolean;
  getSeasonFolderPath(season: Season): string;
  getSeasonDisplayName(season: Season): string;
}

// Season configuration
export interface SeasonConfig {
  startDate: Date; // When Season 1 started
  weekDuration: number; // milliseconds in a week
  transitionGracePeriod: number; // milliseconds
  timeZone: string; // UTC for consistency
  enableAutoTransition: boolean;
  enableManualOverride: boolean;
}

// Season events for monitoring
export interface SeasonEvent {
  type: 'transition_start' | 'transition_complete' | 'folder_created' | 'manifest_updated' | 'sync_required';
  seasonNumber: number;
  data: any;
  timestamp: string;
  source: string;
}

export interface SeasonTransitionEvent extends SeasonEvent {
  type: 'transition_start' | 'transition_complete';
  data: {
    fromSeason: number;
    toSeason: number;
    automatic: boolean;
    triggeredBy?: string;
  };
}

// Error types
export interface SeasonError extends Error {
  code: 'INVALID_SEASON' | 'TRANSITION_FAILED' | 'SYNC_ERROR' | 'FOLDER_ERROR' | 'CALCULATION_ERROR';
  seasonNumber?: number;
  details?: any;
}

// Admin panel types
export interface SeasonControlPanelProps {
  className?: string;
}

export interface SeasonCardProps {
  title: string;
  seasonNumber: number;
  year: number;
  week: string;
  status: string;
  phase?: string;
  isPrimary?: boolean;
  countdown?: string;
  isEndingSoon?: boolean;
}

export interface SyncIndicatorProps {
  label: string;
  status: any;
  details?: Array<{ name: string; status: boolean | undefined }>;
}