// src/features/leaderboard/components/SeasonSelector.tsx
import React, { useState, useEffect } from 'react';
import { ChevronDown, Calendar, Trophy, Users, Clock } from 'lucide-react';
import { cn } from '../../../utils/responsive';
import { themeClasses } from '../../../utils/theme';
import { useTheme } from '../../../providers/ThemeProvider';
import { Formatters } from '../../../utils/formatters';
import { type FinalizedSeason } from '../services/LeaderboardService';

interface SeasonSelectorProps {
  selectedSeason?: number;
  onSeasonChange: (seasonNumber: number) => void;
  className?: string;
  disabled?: boolean;
}

export function SeasonSelector({
  selectedSeason,
  onSeasonChange,
  className = '',
  disabled = false
}: SeasonSelectorProps) {
  const { isDark } = useTheme();
  const [seasons, setSeasons] = useState<FinalizedSeason[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available finalized seasons
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/.netlify/functions/finalized-seasons');
        if (!response.ok) {
          throw new Error(`Failed to fetch seasons: ${response.status}`);
        }

        const data = await response.json();
        if (data.seasons && Array.isArray(data.seasons)) {
          setSeasons(data.seasons);
        } else {
          setSeasons([]);
        }
      } catch (err) {
        console.error('Error fetching finalized seasons:', err);
        setError(err instanceof Error ? err.message : 'Failed to load seasons');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSeasons();
  }, []);

  const selectedSeasonData = seasons.find(s => s.seasonNumber === selectedSeason);

  const handleSeasonSelect = (seasonNumber: number) => {
    onSeasonChange(seasonNumber);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className={cn('animate-pulse', className)}>
        <div className="h-10 bg-app-bg-secondary rounded-lg border border-app-border"></div>
      </div>
    );
  }

  if (error || seasons.length === 0) {
    return (
      <div className={cn(
        'p-3 rounded-lg border text-center text-sm',
        isDark 
          ? 'bg-red-900/30 border-red-500/50 text-red-300' 
          : 'bg-red-100/80 border-red-300 text-red-700',
        className
      )}>
        {error || 'No finalized seasons available'}
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {/* Dropdown button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between p-3 rounded-lg border transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-app-brand-primary/50',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-app-text-accent',
          themeClasses.card,
          className
        )}
      >
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <Trophy className="h-4 w-4 text-app-brand-warning flex-shrink-0" />
          <div className="text-left min-w-0 flex-1">
            <div className="font-medium text-app-text-primary">
              {selectedSeasonData ? selectedSeasonData.label : 'Select Season'}
            </div>
            {selectedSeasonData && (
              <div className="text-xs text-app-text-secondary truncate">
                {selectedSeasonData.description}
              </div>
            )}
          </div>
        </div>
        <ChevronDown 
          className={cn(
            'h-4 w-4 text-app-text-secondary transition-transform flex-shrink-0',
            isOpen && 'rotate-180'
          )} 
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className={cn(
          'absolute top-full left-0 right-0 mt-1 z-50',
          'rounded-lg border shadow-lg max-h-80 overflow-y-auto',
          themeClasses.card
        )}>
          {seasons.map((season) => (
            <button
              key={season.seasonNumber}
              onClick={() => handleSeasonSelect(season.seasonNumber)}
              className={cn(
                'w-full p-3 text-left transition-colors border-b border-app-border last:border-b-0',
                'hover:bg-app-bg-secondary focus:outline-none focus:bg-app-bg-secondary',
                selectedSeason === season.seasonNumber && 'bg-app-bg-secondary'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* Season header */}
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-medium text-app-text-primary">
                      {season.label}
                    </h4>
                    {selectedSeason === season.seasonNumber && (
                      <div className="w-2 h-2 bg-app-brand-primary rounded-full"></div>
                    )}
                  </div>

                  {/* Season stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-app-text-secondary">
                    <div className="flex items-center space-x-1">
                      <Users className="h-3 w-3" />
                      <span>{season.totalEvermarksCount} evermarks</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Trophy className="h-3 w-3" />
                      <span>{parseInt(season.totalVotes).toLocaleString()} votes</span>
                    </div>
                  </div>

                  {/* Season timing */}
                  <div className="flex items-center space-x-1 mt-1 text-xs text-app-text-muted">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {Formatters.formatDate(new Date(season.startTime))} - {Formatters.formatDate(new Date(season.endTime))}
                    </span>
                  </div>

                  {/* Finalized timestamp */}
                  <div className="flex items-center space-x-1 mt-1 text-xs text-app-text-muted">
                    <Clock className="h-3 w-3" />
                    <span>
                      Finalized {Formatters.formatRelativeTime(new Date(season.finalizedAt))}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}