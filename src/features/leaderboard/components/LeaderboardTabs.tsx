// src/features/leaderboard/components/LeaderboardTabs.tsx
import React, { useState, useEffect } from 'react';
import { Trophy, Clock, ChevronDown } from 'lucide-react';
import { cn } from '../../../utils/responsive';
import { themeClasses } from '../../../utils/theme';
import { useTheme } from '../../../providers/ThemeProvider';
import { LeaderboardTable } from './LeaderboardTable';
import { SeasonSelector } from './SeasonSelector';
import { LeaderboardService, type FinalizedSeason } from '../services/LeaderboardService';
import { VotingService } from '../../voting/services/VotingService';
import type { LeaderboardEntry } from '../types';

interface LeaderboardTabsProps {
  className?: string;
  onEvermarkClick?: (entry: LeaderboardEntry) => void;
}

type TabType = 'current' | 'final';

export function LeaderboardTabs({ 
  className = '',
  onEvermarkClick 
}: LeaderboardTabsProps) {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('current');
  const [currentSeasonNumber, setCurrentSeasonNumber] = useState<number>(4); // Default fallback
  const [selectedFinalizedSeason, setSelectedFinalizedSeason] = useState<number | undefined>();
  const [availableSeasons, setAvailableSeasons] = useState<FinalizedSeason[]>([]);
  const [isLoadingCurrentSeason, setIsLoadingCurrentSeason] = useState(true);

  // Get current season number from voting contract
  useEffect(() => {
    const fetchCurrentSeason = async () => {
      try {
        setIsLoadingCurrentSeason(true);
        const currentSeason = await VotingService.getCurrentSeason();
        if (currentSeason) {
          setCurrentSeasonNumber(currentSeason.seasonNumber);
        }
      } catch (error) {
        console.error('Failed to fetch current season:', error);
        // Keep default value of 4
      } finally {
        setIsLoadingCurrentSeason(false);
      }
    };

    fetchCurrentSeason();
  }, []);

  // Get available finalized seasons
  useEffect(() => {
    const fetchFinalizedSeasons = async () => {
      try {
        const seasons = await LeaderboardService.getAvailableFinalizedSeasons();
        setAvailableSeasons(seasons);
        
        // Auto-select the most recent finalized season if none selected
        if (seasons.length > 0 && !selectedFinalizedSeason) {
          setSelectedFinalizedSeason(seasons[0].seasonNumber);
        }
      } catch (error) {
        console.error('Failed to fetch finalized seasons:', error);
      }
    };

    fetchFinalizedSeasons();
  }, [selectedFinalizedSeason]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleSeasonChange = (seasonNumber: number) => {
    setSelectedFinalizedSeason(seasonNumber);
  };

  const currentSeasonLabel = isLoadingCurrentSeason 
    ? 'Current Season'
    : `Current Season: ${currentSeasonNumber}`;

  return (
    <div className={cn('space-y-4 md:space-y-6', className)}>
      {/* Tab Navigation */}
      <div className="space-y-4">
        {/* Tab buttons */}
        <div className="flex gap-1 p-1 rounded-lg bg-app-bg-secondary border border-app-border">
          <button
            onClick={() => handleTabChange('current')}
            className={cn(
              'flex items-center justify-center space-x-2 px-3 py-2 rounded-md transition-all text-sm font-medium flex-1',
              activeTab === 'current'
                ? 'bg-app-bg-primary shadow-sm text-app-text-primary border border-app-border'
                : 'text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-primary/50'
            )}
          >
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">{currentSeasonLabel}</span>
            <span className="sm:hidden">Current</span>
            {activeTab === 'current' && !isLoadingCurrentSeason && (
              <div className="w-2 h-2 bg-app-brand-success rounded-full animate-pulse" />
            )}
          </button>

          <button
            onClick={() => handleTabChange('final')}
            className={cn(
              'flex items-center justify-center space-x-2 px-3 py-2 rounded-md transition-all text-sm font-medium flex-1',
              activeTab === 'final'
                ? 'bg-app-bg-primary shadow-sm text-app-text-primary border border-app-border'
                : 'text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-primary/50'
            )}
          >
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Final Results</span>
            <span className="sm:hidden">Final</span>
            {availableSeasons.length > 0 && (
              <span className="text-xs bg-app-brand-primary text-white rounded-full px-2 py-0.5 ml-1">
                {availableSeasons.length}
              </span>
            )}
          </button>
        </div>

        {/* Season selector for Final Results tab */}
        {activeTab === 'final' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-app-text-primary">
                Select Finalized Season
              </h3>
              {availableSeasons.length > 0 && (
                <span className="text-xs text-app-text-muted">
                  {availableSeasons.length} season{availableSeasons.length !== 1 ? 's' : ''} available
                </span>
              )}
            </div>

            {availableSeasons.length > 0 ? (
              <SeasonSelector
                selectedSeason={selectedFinalizedSeason}
                onSeasonChange={handleSeasonChange}
                className="max-w-md"
              />
            ) : (
              <div className={cn(
                'p-4 rounded-lg border text-center',
                isDark 
                  ? 'bg-yellow-900/30 border-yellow-500/50 text-yellow-300' 
                  : 'bg-yellow-100/80 border-yellow-300 text-yellow-700'
              )}>
                <Trophy className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm font-medium mb-1">No finalized seasons yet</p>
                <p className="text-xs opacity-75">
                  Final results will appear here when seasons are completed and finalized
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'current' && (
          <div>
            {/* Current season leaderboard */}
            <LeaderboardTable
              onEvermarkClick={onEvermarkClick}
              showFilters={true}
              showPagination={true}
              compactMode={false}
            />
          </div>
        )}

        {activeTab === 'final' && (
          <div>
            {availableSeasons.length > 0 && selectedFinalizedSeason ? (
              <FinalizedLeaderboardView
                seasonNumber={selectedFinalizedSeason}
                onEvermarkClick={onEvermarkClick}
              />
            ) : (
              <div className="text-center py-12">
                <Trophy className="mx-auto h-12 w-12 text-app-text-muted mb-4" />
                <h3 className="text-lg font-medium text-app-text-primary mb-2">
                  No finalized seasons available
                </h3>
                <p className="text-app-text-secondary">
                  Final season results will appear here once seasons are completed
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Component for displaying finalized leaderboard data
interface FinalizedLeaderboardViewProps {
  seasonNumber: number;
  onEvermarkClick?: (entry: LeaderboardEntry) => void;
}

function FinalizedLeaderboardView({ 
  seasonNumber, 
  onEvermarkClick 
}: FinalizedLeaderboardViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [seasonInfo, setSeasonInfo] = useState<any>(null);

  useEffect(() => {
    const fetchFinalizedData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const result = await LeaderboardService.getFinalizedLeaderboard(seasonNumber);
        setLeaderboardData(result.entries);
        setSeasonInfo(result.seasonInfo || null);
        
      } catch (err) {
        console.error('Failed to fetch finalized leaderboard:', err);
        setError(err instanceof Error ? err.message : 'Failed to load finalized leaderboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFinalizedData();
  }, [seasonNumber]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Loading skeleton */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-app-bg-card border border-app-border rounded-lg p-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-app-bg-secondary rounded-lg"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-app-bg-secondary rounded w-3/4"></div>
                <div className="h-3 bg-app-bg-secondary rounded w-1/2"></div>
              </div>
              <div className="text-right space-y-2">
                <div className="h-6 bg-app-bg-secondary rounded w-16"></div>
                <div className="h-3 bg-app-bg-secondary rounded w-12"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Trophy className="mx-auto h-12 w-12 text-app-brand-error mb-4" />
        <h3 className="text-lg font-medium text-app-brand-error mb-2">
          Error Loading Season Data
        </h3>
        <p className="text-app-text-secondary mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className={themeClasses.btnSecondary}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (leaderboardData.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy className="mx-auto h-12 w-12 text-app-text-muted mb-4" />
        <h3 className="text-lg font-medium text-app-text-primary mb-2">
          No data for Season {seasonNumber}
        </h3>
        <p className="text-app-text-secondary">
          This season may not have been finalized yet or had no votes
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Season info header */}
      {seasonInfo && (
        <div className={cn(themeClasses.card, "p-4")}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-app-text-primary mb-1">
                Season {seasonNumber} Final Results
              </h3>
              <div className="text-sm text-app-text-secondary">
                {seasonInfo.totalEvermarksCount} evermarks • {parseInt(seasonInfo.totalVotes).toLocaleString()} total votes
              </div>
            </div>
            <div className="text-right text-sm text-app-text-muted">
              <div>Finalized</div>
              <div>{new Date(seasonInfo.finalizedAt).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Finalized leaderboard entries */}
      <div className="space-y-3">
        {leaderboardData.map((entry) => (
          <div
            key={entry.id}
            onClick={() => onEvermarkClick?.(entry)}
            className={cn(
              themeClasses.cardInteractive,
              "cursor-pointer group backdrop-blur-sm p-4"
            )}
          >
            <div className="flex items-center gap-4">
              {/* Rank badge */}
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm",
                entry.rank === 1 && "bg-yellow-500 text-white",
                entry.rank === 2 && "bg-gray-400 text-white", 
                entry.rank === 3 && "bg-amber-600 text-white",
                entry.rank > 3 && "bg-app-bg-secondary text-app-text-primary border border-app-border"
              )}>
                {entry.rank}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-app-text-primary truncate group-hover:text-app-text-accent transition-colors">
                  {entry.title}
                </h4>
                <div className="text-sm text-app-text-secondary">
                  by {entry.creator}
                </div>
                {entry.percentageOfTotal > 0 && (
                  <div className="text-xs text-app-text-muted">
                    {entry.percentageOfTotal.toFixed(1)}% of total votes
                  </div>
                )}
              </div>

              {/* Vote stats */}
              <div className="text-right">
                <div className="font-bold text-app-text-accent">
                  {LeaderboardService.formatVoteAmount(entry.totalVotes)}
                </div>
                <div className="text-xs text-app-text-muted">
                  votes
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}