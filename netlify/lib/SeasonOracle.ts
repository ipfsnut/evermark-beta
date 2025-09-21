// src/services/SeasonOracle.ts
// Central season management and time-based calculations

export interface SeasonInfo {
  number: number;
  year: number;
  week: string;
  startTimestamp: number;
  endTimestamp: number;
  status: 'preparing' | 'active' | 'finalizing' | 'completed';
  phase?: 'idle' | 'voting' | 'tallying' | 'rewarding';
}

export interface SeasonState {
  current: SeasonInfo;
  previous: SeasonInfo;
  next: SeasonInfo;
  system: {
    lastChecked: number;
    lastTransition: number;
    autoTransition: boolean;
    maintenanceMode: boolean;
  };
  sync: {
    smartContracts: {
      voting: boolean;
      leaderboard: boolean;
      rewards: boolean;
      lastSyncBlock: number;
    };
    arDrive: {
      currentFolderReady: boolean;
      previousFolderFinalized: boolean;
      lastUpload: number;
    };
    database: {
      inSync: boolean;
      lastUpdate: number;
    };
  };
}

export interface SeasonBoundaries {
  start: Date;
  end: Date;
}

/**
 * Season Oracle Service - Central authority for season timing and state
 * Handles all season-related calculations and state management
 */
export class SeasonOracle {
  private readonly SEASON_START = new Date('2024-01-01T00:00:00Z'); // Platform launch
  private readonly NONCE_WINDOW_MINUTES = 5;
  private cachedState: SeasonState | null = null;
  private lastCacheTime = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds

  /**
   * Calculate absolute season number from platform genesis
   */
  calculateSeasonNumber(date: Date = new Date()): number {
    const weeksSinceStart = Math.floor(
      (date.getTime() - this.SEASON_START.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    return Math.max(1, weeksSinceStart + 1);
  }

  /**
   * Get ISO week number and year for a given date
   */
  getISOWeek(date: Date): { year: number; week: string } {
    // Create a copy to avoid modifying the original
    const thursday = new Date(date);
    
    // Move to Thursday of the same week (ISO week definition)
    thursday.setDate(date.getDate() - ((date.getDay() + 6) % 7) + 3);
    
    // Get the year of the Thursday
    const year = thursday.getFullYear();
    
    // Get January 1st of that year
    const yearStart = new Date(year, 0, 1);
    
    // Calculate week number
    const weekNumber = Math.ceil(
      ((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
    );
    
    return {
      year,
      week: `W${weekNumber.toString().padStart(2, '0')}`
    };
  }

  /**
   * Get season boundaries (Monday 00:00 UTC to Sunday 23:59:59 UTC)
   */
  getSeasonBoundaries(seasonNumber: number): SeasonBoundaries {
    const weeksFromStart = seasonNumber - 1;
    const start = new Date(this.SEASON_START);
    start.setDate(start.getDate() + (weeksFromStart * 7));
    
    // Adjust to Monday if needed (Monday = 1, Sunday = 0)
    const dayOfWeek = start.getDay();
    if (dayOfWeek !== 1) {
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start.setDate(start.getDate() - daysToSubtract);
    }
    start.setUTCHours(0, 0, 0, 0);
    
    // End is Sunday 23:59:59 UTC
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setUTCHours(23, 59, 59, 999);
    
    return { start, end };
  }

  /**
   * Determine current phase within a season
   */
  getCurrentPhase(date: Date = new Date()): SeasonInfo['phase'] {
    const seasonNumber = this.calculateSeasonNumber(date);
    const boundaries = this.getSeasonBoundaries(seasonNumber);
    
    // Calculate hours since season start
    const hoursSinceStart = (date.getTime() - boundaries.start.getTime()) / (1000 * 60 * 60);
    
    // Phase logic based on time within season
    if (hoursSinceStart < 1) {
      return 'idle'; // First hour: system preparation
    } else if (date.getUTCDay() === 0 && date.getUTCHours() >= 22) {
      return 'tallying'; // Sunday 22:00-23:59: vote tallying
    } else if (date.getUTCDay() === 1 && date.getUTCHours() < 2) {
      return 'rewarding'; // Monday 00:00-02:00: rewards distribution
    } else {
      return 'voting'; // Normal voting period
    }
  }

  /**
   * Get comprehensive current season state
   */
  async getCurrentState(): Promise<SeasonState> {
    const now = Date.now();
    
    // Use cache if recent
    if (this.cachedState && (now - this.lastCacheTime) < this.CACHE_TTL) {
      return this.cachedState;
    }

    const currentDate = new Date(now);
    const currentNumber = this.calculateSeasonNumber(currentDate);
    const { year, week } = this.getISOWeek(currentDate);
    const boundaries = this.getSeasonBoundaries(currentNumber);
    const phase = this.getCurrentPhase(currentDate);
    
    // Get previous and next season info
    const prevBoundaries = this.getSeasonBoundaries(currentNumber - 1);
    const nextBoundaries = this.getSeasonBoundaries(currentNumber + 1);
    const nextWeekInfo = this.getISOWeek(nextBoundaries.start);
    const prevWeekInfo = this.getISOWeek(prevBoundaries.start);
    
    // Check sync status (would be actual checks in production)
    const syncStatus = await this.checkSyncStatus(currentNumber);
    
    const state: SeasonState = {
      current: {
        number: currentNumber,
        year,
        week,
        startTimestamp: boundaries.start.getTime(),
        endTimestamp: boundaries.end.getTime(),
        status: 'active',
        phase
      },
      previous: {
        number: currentNumber - 1,
        year: prevWeekInfo.year,
        week: prevWeekInfo.week,
        startTimestamp: prevBoundaries.start.getTime(),
        endTimestamp: prevBoundaries.end.getTime(),
        status: syncStatus.arDrive.previousFolderFinalized ? 'completed' : 'finalizing'
      },
      next: {
        number: currentNumber + 1,
        year: nextWeekInfo.year,
        week: nextWeekInfo.week,
        startTimestamp: nextBoundaries.start.getTime(),
        endTimestamp: nextBoundaries.end.getTime(),
        status: 'preparing'
      },
      system: {
        lastChecked: now,
        lastTransition: Date.now() - (7 * 24 * 60 * 60 * 1000), // 1 week ago as fallback
        autoTransition: true,
        maintenanceMode: false
      },
      sync: syncStatus
    };
    
    // Cache the result
    this.cachedState = state;
    this.lastCacheTime = now;
    
    return state;
  }

  /**
   * Check if we should transition to next season
   */
  shouldTransition(date: Date = new Date()): boolean {
    const currentNumber = this.calculateSeasonNumber(date);
    const boundaries = this.getSeasonBoundaries(currentNumber);
    
    return date > boundaries.end;
  }

  /**
   * Check if we're in transition window (Sunday 23:00-23:59 UTC)
   */
  isTransitionWindow(date: Date = new Date()): boolean {
    return date.getUTCDay() === 0 && date.getUTCHours() === 23;
  }

  /**
   * Get time remaining in current season
   */
  getTimeRemaining(date: Date = new Date()): number {
    const seasonNumber = this.calculateSeasonNumber(date);
    const boundaries = this.getSeasonBoundaries(seasonNumber);
    
    return Math.max(0, boundaries.end.getTime() - date.getTime());
  }

  /**
   * Get season info for a specific season number
   */
  getSeasonInfo(seasonNumber: number): SeasonInfo {
    const boundaries = this.getSeasonBoundaries(seasonNumber);
    const { year, week } = this.getISOWeek(boundaries.start);
    const now = Date.now();
    
    let status: SeasonInfo['status'] = 'completed';
    if (boundaries.start.getTime() > now) {
      status = 'preparing';
    } else if (boundaries.end.getTime() > now) {
      status = 'active';
    }
    
    return {
      number: seasonNumber,
      year,
      week,
      startTimestamp: boundaries.start.getTime(),
      endTimestamp: boundaries.end.getTime(),
      status
    };
  }

  /**
   * Get season number for a specific date
   */
  getSeasonForDate(date: Date): SeasonInfo {
    const seasonNumber = this.calculateSeasonNumber(date);
    return this.getSeasonInfo(seasonNumber);
  }

  /**
   * Generate season folder path for ArDrive
   */
  getSeasonFolderPath(seasonInfo: SeasonInfo): string {
    return `seasons/season-${seasonInfo.number}-${seasonInfo.year}-${seasonInfo.week}`;
  }

  /**
   * Get next transition time
   */
  getNextTransitionTime(): Date {
    const now = new Date();
    const currentSeason = this.calculateSeasonNumber(now);
    const boundaries = this.getSeasonBoundaries(currentSeason);
    
    // If we're past the end, next transition is immediate
    if (now > boundaries.end) {
      return now;
    }
    
    // Otherwise, next transition is at end of current season
    return boundaries.end;
  }

  /**
   * Validate season data consistency
   */
  validateSeasonData(seasonInfo: SeasonInfo): boolean {
    try {
      // Check season number is positive
      if (seasonInfo.number < 1) return false;
      
      // Check year is reasonable
      if (seasonInfo.year < 2024 || seasonInfo.year > 2050) return false;
      
      // Check week format
      if (!/^W\d{2}$/.test(seasonInfo.week)) return false;
      
      // Check timestamps are consistent
      if (seasonInfo.startTimestamp >= seasonInfo.endTimestamp) return false;
      
      // Check status is valid
      const validStatuses: SeasonInfo['status'][] = ['preparing', 'active', 'finalizing', 'completed'];
      if (!validStatuses.includes(seasonInfo.status)) return false;
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cachedState = null;
    this.lastCacheTime = 0;
  }

  /**
   * Check synchronization status across systems
   * (This would be implemented with actual checks in production)
   */
  private async checkSyncStatus(seasonNumber: number): Promise<SeasonState['sync']> {
    try {
      // In production, this would check:
      // - Smart contract current season
      // - Database season records
      // - ArDrive folder existence
      // - etc.
      
      return {
        smartContracts: {
          voting: true,
          leaderboard: true,
          rewards: true,
          lastSyncBlock: 0
        },
        arDrive: {
          currentFolderReady: true,
          previousFolderFinalized: true,
          lastUpload: Date.now()
        },
        database: {
          inSync: true,
          lastUpdate: Date.now()
        }
      };
    } catch (error) {
      console.error('Failed to check sync status:', error);
      
      // Return safe defaults on error
      return {
        smartContracts: {
          voting: false,
          leaderboard: false,
          rewards: false,
          lastSyncBlock: 0
        },
        arDrive: {
          currentFolderReady: false,
          previousFolderFinalized: false,
          lastUpload: 0
        },
        database: {
          inSync: false,
          lastUpdate: 0
        }
      };
    }
  }
}

// Export singleton instance
export const seasonOracle = new SeasonOracle();