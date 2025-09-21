// src/services/SeasonOracle.ts
// Client-side Season Oracle for time-based season calculations
// Simplified version of server-side implementation

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

export interface SeasonStats {
  totalSeasons: number;
  currentSeason: SeasonInfo;
  nextTransition: Date;
  weeksSinceStart: number;
  daysUntilTransition: number;
}

/**
 * Client-side Season Oracle for calculating season information
 * Uses ISO week dates for consistent season boundaries
 */
export class SeasonOracle {
  private readonly SEASON_LENGTH_WEEKS = 13; // 13 weeks = 1 quarter
  private readonly FIRST_SEASON_START = new Date('2024-01-01'); // Start of Season 1

  /**
   * Get current season information
   */
  getCurrentSeason(): SeasonInfo {
    const now = new Date();
    const seasonNumber = this.calculateSeasonNumber(now);
    const seasonStartDate = this.getSeasonStartDate(seasonNumber);
    const seasonEndDate = this.getSeasonEndDate(seasonNumber);

    return {
      number: seasonNumber,
      year: now.getFullYear(),
      week: this.getISOWeek(now).toString().padStart(2, '0'),
      startTimestamp: seasonStartDate.getTime(),
      endTimestamp: seasonEndDate.getTime(),
      status: this.getSeasonStatus(seasonNumber),
      phase: 'voting'
    };
  }

  /**
   * Get season by number
   */
  getSeason(seasonNumber: number): SeasonInfo {
    const seasonStartDate = this.getSeasonStartDate(seasonNumber);
    const seasonEndDate = this.getSeasonEndDate(seasonNumber);

    return {
      number: seasonNumber,
      year: seasonStartDate.getFullYear(),
      week: this.getISOWeek(seasonStartDate).toString().padStart(2, '0'),
      startTimestamp: seasonStartDate.getTime(),
      endTimestamp: seasonEndDate.getTime(),
      status: this.getSeasonStatus(seasonNumber),
      phase: 'voting'
    };
  }

  /**
   * Get current season state (async for API compatibility)
   */
  async getCurrentState(): Promise<SeasonState> {
    const current = this.getCurrentSeason();
    const next = this.getSeason(current.number + 1);
    const previous = this.getSeason(Math.max(1, current.number - 1));
    const now = Date.now();

    return {
      current,
      next,
      previous,
      system: {
        lastChecked: now,
        lastTransition: current.startTimestamp,
        autoTransition: true,
        maintenanceMode: false
      },
      sync: {
        smartContracts: {
          voting: true,
          leaderboard: true,
          rewards: true,
          lastSyncBlock: 0
        },
        arDrive: {
          currentFolderReady: true,
          previousFolderFinalized: true,
          lastUpload: now
        },
        database: {
          inSync: true,
          lastUpdate: now
        }
      }
    };
  }

  /**
   * Get season folder path for storage organization
   */
  getSeasonFolderPath(seasonInfo: SeasonInfo): string {
    return `season-${seasonInfo.number.toString().padStart(2, '0')}`;
  }

  /**
   * Get comprehensive season statistics
   */
  getSeasonStats(): SeasonStats {
    const currentSeason = this.getCurrentSeason();
    const now = new Date();

    const weeksSinceStart = Math.floor(
      (now.getTime() - currentSeason.startTimestamp) / (7 * 24 * 60 * 60 * 1000)
    );

    const nextSeason = this.getSeason(currentSeason.number + 1);
    const daysUntilTransition = Math.ceil(
      (nextSeason.startTimestamp - now.getTime()) / (24 * 60 * 60 * 1000)
    );

    return {
      totalSeasons: currentSeason.number,
      currentSeason,
      nextTransition: new Date(nextSeason.startTimestamp),
      weeksSinceStart,
      daysUntilTransition
    };
  }

  /**
   * Check if a specific date falls within a season
   */
  isDateInSeason(date: Date, seasonNumber: number): boolean {
    const season = this.getSeason(seasonNumber);
    return date.getTime() >= season.startTimestamp && date.getTime() <= season.endTimestamp;
  }

  /**
   * Get season number for a specific date
   */
  getSeasonForDate(date: Date): SeasonInfo {
    const seasonNumber = this.calculateSeasonNumber(date);
    return this.getSeason(seasonNumber);
  }

  /**
   * Calculate season number based on date
   */
  private calculateSeasonNumber(date: Date): number {
    const weeksSinceFirstSeason = Math.floor(
      (date.getTime() - this.FIRST_SEASON_START.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    
    return Math.floor(weeksSinceFirstSeason / this.SEASON_LENGTH_WEEKS) + 1;
  }

  /**
   * Get season start date
   */
  private getSeasonStartDate(seasonNumber: number): Date {
    const weeksFromStart = (seasonNumber - 1) * this.SEASON_LENGTH_WEEKS;
    const startDate = new Date(this.FIRST_SEASON_START);
    startDate.setDate(startDate.getDate() + (weeksFromStart * 7));
    return startDate;
  }

  /**
   * Get season end date
   */
  private getSeasonEndDate(seasonNumber: number): Date {
    const startDate = this.getSeasonStartDate(seasonNumber);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (this.SEASON_LENGTH_WEEKS * 7) - 1);
    return endDate;
  }

  /**
   * Get season status
   */
  private getSeasonStatus(seasonNumber: number): SeasonInfo['status'] {
    const currentSeasonNumber = this.calculateSeasonNumber(new Date());
    
    if (seasonNumber < currentSeasonNumber) {
      return 'completed';
    } else if (seasonNumber > currentSeasonNumber) {
      return 'preparing';
    } else {
      return 'active';
    }
  }

  /**
   * Get ISO week number
   */
  private getISOWeek(date: Date): number {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  }
}

// Singleton instance for client use
export const seasonOracle = new SeasonOracle();