# Season Management System

## Overview

A centralized control system that manages the weekly season progression across all Evermark components: smart contracts, ArDrive storage, voting systems, and reward distributions. This system acts as the "clock" for the entire platform.

## Architecture

### Core Components

```
Season Management System
│
├── Season Oracle Service (source of truth)
├── Dev Dashboard Integration (UI control)
├── Smart Contract Synchronizer
├── ArDrive Folder Manager
├── Database State Manager
└── Webhook Notification System
```

## Season Oracle Service

### Purpose
Single source of truth for what season the platform is currently in, handling all time-based calculations and transitions.

### Implementation

```typescript
// netlify/functions/season-oracle.ts
interface SeasonState {
  // Current season info
  current: {
    number: number;           // Absolute season number (e.g., 142)
    year: number;             // 2024
    week: string;             // ISO week "W52"
    startTimestamp: number;   // Monday 00:00 UTC
    endTimestamp: number;     // Sunday 23:59:59 UTC
    status: 'active' | 'finalizing' | 'transitioning';
    phase: 'voting' | 'tallying' | 'rewarding' | 'idle';
  };
  
  // Previous season (for finalization)
  previous: {
    number: number;
    status: 'completed' | 'pending_finalization';
    finalizedAt?: number;
    rewardsDistributed?: boolean;
  };
  
  // Next season (for preparation)
  next: {
    number: number;
    startsIn: number;         // Seconds until next season
    preparedAt?: number;      // When folders were created
  };
  
  // System state
  system: {
    lastChecked: number;
    lastTransition: number;
    autoTransition: boolean;
    maintenanceMode: boolean;
  };
  
  // Component sync status
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

class SeasonOracle {
  private state: SeasonState;
  private readonly SEASON_START = new Date('2024-01-01T00:00:00Z'); // Platform launch
  
  /**
   * Calculate current season number from genesis
   */
  calculateSeasonNumber(date: Date = new Date()): number {
    const weeksSinceStart = Math.floor(
      (date.getTime() - this.SEASON_START.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    return weeksSinceStart + 1;
  }
  
  /**
   * Get ISO week number and year
   */
  getISOWeek(date: Date): { year: number; week: string } {
    const thursday = new Date(date);
    thursday.setDate(date.getDate() - ((date.getDay() + 6) % 7) + 3);
    const yearStart = new Date(thursday.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(
      ((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
    );
    
    return {
      year: thursday.getFullYear(),
      week: `W${weekNumber.toString().padStart(2, '0')}`
    };
  }
  
  /**
   * Get season boundaries (Monday-Sunday UTC)
   */
  getSeasonBoundaries(seasonNumber: number): { start: Date; end: Date } {
    const weeksFromStart = seasonNumber - 1;
    const start = new Date(this.SEASON_START);
    start.setDate(start.getDate() + (weeksFromStart * 7));
    
    // Adjust to Monday if needed
    const dayOfWeek = start.getDay();
    if (dayOfWeek !== 1) {
      start.setDate(start.getDate() - ((dayOfWeek + 6) % 7));
    }
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  }
  
  /**
   * Check if we should transition seasons
   */
  shouldTransition(): boolean {
    const now = new Date();
    const currentBoundaries = this.getSeasonBoundaries(this.state.current.number);
    
    return now > currentBoundaries.end;
  }
  
  /**
   * Get current season state
   */
  async getCurrentState(): Promise<SeasonState> {
    const now = new Date();
    const currentNumber = this.calculateSeasonNumber(now);
    const { year, week } = this.getISOWeek(now);
    const boundaries = this.getSeasonBoundaries(currentNumber);
    
    // Determine phase based on time within season
    const hoursSinceStart = (now.getTime() - boundaries.start.getTime()) / (1000 * 60 * 60);
    let phase: SeasonState['current']['phase'] = 'voting';
    
    if (hoursSinceStart < 1) {
      phase = 'idle'; // First hour: system preparation
    } else if (now.getDay() === 0 && now.getHours() >= 22) {
      phase = 'tallying'; // Sunday 22:00-23:59: vote tallying
    } else if (now.getDay() === 1 && now.getHours() < 2) {
      phase = 'rewarding'; // Monday 00:00-02:00: rewards distribution
    }
    
    // Check sync status with external systems
    const syncStatus = await this.checkSyncStatus(currentNumber);
    
    return {
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
        status: syncStatus.previousFinalized ? 'completed' : 'pending_finalization'
      },
      next: {
        number: currentNumber + 1,
        startsIn: Math.floor((boundaries.end.getTime() - now.getTime()) / 1000)
      },
      system: {
        lastChecked: now.getTime(),
        lastTransition: this.state?.system?.lastTransition || 0,
        autoTransition: true,
        maintenanceMode: false
      },
      sync: syncStatus
    };
  }
  
  /**
   * Force season transition (manual override)
   */
  async forceTransition(targetSeason?: number): Promise<void> {
    console.log(`⚠️ Force transitioning to season ${targetSeason || 'next'}`);
    
    // Finalize current season
    await this.finalizeSeason(this.state.current.number);
    
    // Calculate new season
    const newSeasonNumber = targetSeason || (this.state.current.number + 1);
    const boundaries = this.getSeasonBoundaries(newSeasonNumber);
    const { year, week } = this.getISOWeek(boundaries.start);
    
    // Initialize new season
    await this.initializeSeason({
      number: newSeasonNumber,
      year,
      week,
      boundaries
    });
    
    // Update state
    this.state = await this.getCurrentState();
  }
}
```

## Dev Dashboard Integration

### Season Control Panel

```typescript
// src/features/admin/components/SeasonControlPanel.tsx
import { useSeasonOracle } from '../hooks/useSeasonOracle';
import { useSeasonTransition } from '../hooks/useSeasonTransition';

export function SeasonControlPanel() {
  const { season, loading, refetch } = useSeasonOracle();
  const { transition, isTransitioning } = useSeasonTransition();
  
  if (loading) return <div>Loading season data...</div>;
  
  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-4">
        Season Management System
      </h2>
      
      {/* Current Season Status */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-sm text-gray-400">Current Season</h3>
          <p className="text-2xl font-bold text-white">
            #{season.current.number}
          </p>
          <p className="text-xs text-gray-500">
            {season.current.year}-{season.current.week}
          </p>
        </div>
        
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-sm text-gray-400">Phase</h3>
          <p className="text-lg font-semibold text-green-400">
            {season.current.phase}
          </p>
          <p className="text-xs text-gray-500">
            {season.current.status}
          </p>
        </div>
        
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-sm text-gray-400">Time Remaining</h3>
          <CountdownTimer seconds={season.next.startsIn} />
        </div>
      </div>
      
      {/* Sync Status Grid */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">
          System Synchronization
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <SyncIndicator 
            label="Smart Contracts"
            status={season.sync.smartContracts}
          />
          <SyncIndicator 
            label="ArDrive Storage"
            status={season.sync.arDrive}
          />
          <SyncIndicator 
            label="Database"
            status={season.sync.database}
          />
        </div>
      </div>
      
      {/* Manual Controls */}
      <div className="flex gap-4">
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh Status
        </button>
        
        <button
          onClick={() => transition('finalize')}
          disabled={isTransitioning}
          className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
        >
          Finalize Current Season
        </button>
        
        <button
          onClick={() => transition('force')}
          disabled={isTransitioning}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          Force Transition
        </button>
      </div>
      
      {/* Season Timeline */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">
          Season Timeline
        </h3>
        <SeasonTimeline 
          current={season.current}
          previous={season.previous}
          next={season.next}
        />
      </div>
      
      {/* Automated Tasks */}
      <div className="mt-6 p-4 bg-gray-800 rounded">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">
          Automated Tasks
        </h3>
        <div className="space-y-2 text-sm">
          <TaskStatus 
            task="Season Folder Creation"
            scheduled="Sunday 23:00 UTC"
            lastRun={season.system.lastTransition}
          />
          <TaskStatus 
            task="Vote Tallying"
            scheduled="Sunday 23:30 UTC"
            status={season.current.phase === 'tallying' ? 'running' : 'idle'}
          />
          <TaskStatus 
            task="Rewards Distribution"
            scheduled="Monday 00:30 UTC"
            status={season.current.phase === 'rewarding' ? 'running' : 'idle'}
          />
          <TaskStatus 
            task="ArDrive Finalization"
            scheduled="Monday 01:00 UTC"
            lastRun={season.previous.finalizedAt}
          />
        </div>
      </div>
    </div>
  );
}
```

## Season Transition Workflow

### Automated Sunday Night Process

```typescript
// netlify/functions/season-transition-cron.ts
// Runs every hour, but only acts on Sunday 23:00 UTC

export const handler = async () => {
  const oracle = new SeasonOracle();
  const state = await oracle.getCurrentState();
  
  // Check if it's transition time (Sunday 23:00-23:59 UTC)
  const now = new Date();
  const isTransitionWindow = 
    now.getUTCDay() === 0 && // Sunday
    now.getUTCHours() === 23; // 23:00-23:59
  
  if (!isTransitionWindow) {
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Not transition time',
        nextCheck: getNextTransitionTime()
      })
    };
  }
  
  console.log(`🔄 Starting season transition from #${state.current.number} to #${state.next.number}`);
  
  try {
    // Phase 1: Prepare next season (23:00)
    if (now.getUTCMinutes() < 15) {
      await prepareNextSeason(state.next.number);
    }
    
    // Phase 2: Start vote tallying (23:15)
    else if (now.getUTCMinutes() < 30) {
      await startVoteTallying(state.current.number);
    }
    
    // Phase 3: Finalize current season (23:30)
    else if (now.getUTCMinutes() < 45) {
      await finalizeCurrentSeason(state.current.number);
    }
    
    // Phase 4: Prepare for transition (23:45)
    else {
      await prepareForTransition(state);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Transition step completed',
        phase: getCurrentPhase(now),
        state
      })
    };
    
  } catch (error) {
    // Send alert to admin
    await notifyAdminOfTransitionError(error, state);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Transition failed',
        details: error.message,
        state
      })
    };
  }
};

async function prepareNextSeason(seasonNumber: number) {
  // 1. Create ArDrive folders
  const arDrive = new ArDriveSeasonService();
  const seasonInfo = calculateSeasonInfo(seasonNumber);
  await arDrive.prepareSeasonFolder(seasonInfo);
  
  // 2. Initialize database records
  await supabase.from('seasons').insert({
    number: seasonNumber,
    year: seasonInfo.year,
    week: seasonInfo.week,
    status: 'preparing',
    created_at: new Date().toISOString()
  });
  
  // 3. Prepare smart contract for new season
  // (Contract automatically transitions at block timestamp)
  
  console.log(`✅ Season #${seasonNumber} prepared`);
}

async function startVoteTallying(seasonNumber: number) {
  // 1. Snapshot current vote counts
  const votingContract = getVotingContract();
  const voteData = await votingContract.getCurrentSeasonVotes();
  
  // 2. Store snapshot in database
  await supabase.from('vote_snapshots').insert({
    season_number: seasonNumber,
    snapshot_time: new Date().toISOString(),
    vote_data: voteData
  });
  
  // 3. Start calculating final rankings
  const rankings = calculateFinalRankings(voteData);
  await supabase.from('season_rankings').insert({
    season_number: seasonNumber,
    rankings: rankings,
    status: 'preliminary'
  });
  
  console.log(`📊 Vote tallying started for season #${seasonNumber}`);
}

async function finalizeCurrentSeason(seasonNumber: number) {
  // 1. Finalize vote counts on-chain
  const votingContract = getVotingContract();
  await votingContract.finalizeseason(seasonNumber);
  
  // 2. Update leaderboard contract
  const leaderboardContract = getLeaderboardContract();
  const rankings = await supabase
    .from('season_rankings')
    .select('rankings')
    .eq('season_number', seasonNumber)
    .single();
  
  await leaderboardContract.updateRankings(seasonNumber, rankings.data.rankings);
  
  // 3. Upload final data to ArDrive
  const arDrive = new ArDriveSeasonService();
  await arDrive.finalizeSeasonData(seasonNumber, {
    votes: voteData,
    rankings: rankings.data.rankings,
    timestamp: new Date().toISOString()
  });
  
  // 4. Mark season as finalized in database
  await supabase
    .from('seasons')
    .update({ status: 'finalized' })
    .eq('number', seasonNumber);
  
  console.log(`🏁 Season #${seasonNumber} finalized`);
}
```

## Database Schema for Season Management

```sql
-- Season tracking table
CREATE TABLE seasons (
  number INTEGER PRIMARY KEY,
  year INTEGER NOT NULL,
  week VARCHAR(4) NOT NULL, -- W01-W52
  start_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  end_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'preparing',
  
  -- ArDrive references
  ardrive_folder_id TEXT,
  ardrive_manifest_tx TEXT,
  
  -- Smart contract references
  voting_period_id INTEGER,
  leaderboard_snapshot_block INTEGER,
  rewards_distribution_tx TEXT,
  
  -- Statistics
  total_evermarks INTEGER DEFAULT 0,
  total_votes INTEGER DEFAULT 0,
  unique_voters INTEGER DEFAULT 0,
  total_rewards_distributed NUMERIC DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  finalized_at TIMESTAMP WITH TIME ZONE,
  rewards_distributed_at TIMESTAMP WITH TIME ZONE
);

-- Season transition log
CREATE TABLE season_transitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_season INTEGER,
  to_season INTEGER,
  transition_type TEXT, -- 'automatic', 'manual', 'forced'
  initiated_by TEXT, -- wallet address or 'system'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'in_progress',
  error_message TEXT,
  
  -- Phase tracking
  phases_completed JSONB DEFAULT '[]',
  current_phase TEXT,
  
  FOREIGN KEY (from_season) REFERENCES seasons(number),
  FOREIGN KEY (to_season) REFERENCES seasons(number)
);

-- Season sync status
CREATE TABLE season_sync_status (
  season_number INTEGER PRIMARY KEY,
  smart_contracts_synced BOOLEAN DEFAULT FALSE,
  ardrive_synced BOOLEAN DEFAULT FALSE,
  database_synced BOOLEAN DEFAULT FALSE,
  last_sync_attempt TIMESTAMP WITH TIME ZONE,
  sync_errors JSONB DEFAULT '[]',
  
  FOREIGN KEY (season_number) REFERENCES seasons(number)
);
```

## Integration Points

### 1. Smart Contract Integration

```typescript
// src/services/SeasonContractService.ts
class SeasonContractService {
  async syncWithContracts(seasonNumber: number) {
    // Get current season from voting contract
    const votingSeason = await this.votingContract.getCurrentSeason();
    
    // Verify alignment
    if (votingSeason !== seasonNumber) {
      throw new Error(`Season mismatch: Oracle=${seasonNumber}, Contract=${votingSeason}`);
    }
    
    // Sync leaderboard state
    const leaderboardSeason = await this.leaderboardContract.getCurrentSeason();
    
    // Sync rewards state
    const rewardsSeason = await this.rewardsContract.getCurrentDistributionSeason();
    
    return {
      aligned: votingSeason === leaderboardSeason === rewardsSeason === seasonNumber,
      voting: votingSeason,
      leaderboard: leaderboardSeason,
      rewards: rewardsSeason
    };
  }
}
```

### 2. ArDrive Integration

```typescript
// Automated folder creation and finalization
class SeasonArDriveManager {
  async createSeasonStructure(season: SeasonInfo) {
    const structure = {
      root: `season-${season.number}-${season.year}-${season.week}`,
      subfolders: ['evermarks', 'votes', 'leaderboard', 'rewards']
    };
    
    // Create all folders
    for (const folder of structure.subfolders) {
      await this.createFolder(`${structure.root}/${folder}`);
    }
    
    // Upload initial manifest
    await this.uploadManifest(structure.root, {
      season,
      created: new Date().toISOString(),
      status: 'active'
    });
  }
}
```

### 3. Notification System

```typescript
// Webhook notifications for season events
class SeasonNotificationService {
  async notifySeasonTransition(event: SeasonTransitionEvent) {
    const webhooks = [
      process.env.DISCORD_WEBHOOK_URL,
      process.env.SLACK_WEBHOOK_URL,
      process.env.ADMIN_EMAIL_WEBHOOK
    ];
    
    const message = {
      type: 'season_transition',
      from: event.fromSeason,
      to: event.toSeason,
      timestamp: event.timestamp,
      status: event.status
    };
    
    await Promise.all(
      webhooks.map(url => this.sendWebhook(url, message))
    );
  }
}
```

## Monitoring & Alerts

### Health Checks

```typescript
// netlify/functions/season-health-check.ts
export const handler = async () => {
  const checks = {
    oracleAlive: false,
    contractsInSync: false,
    arDriveAccessible: false,
    databaseConsistent: false,
    lastTransitionSuccessful: false
  };
  
  // Run health checks
  const oracle = new SeasonOracle();
  const state = await oracle.getCurrentState();
  
  checks.oracleAlive = !!state;
  checks.contractsInSync = state.sync.smartContracts.voting && 
                           state.sync.smartContracts.leaderboard;
  checks.arDriveAccessible = state.sync.arDrive.currentFolderReady;
  checks.databaseConsistent = state.sync.database.inSync;
  
  // Check last transition
  const lastTransition = await getLastTransition();
  checks.lastTransitionSuccessful = lastTransition?.status === 'completed';
  
  const healthy = Object.values(checks).every(v => v === true);
  
  return {
    statusCode: healthy ? 200 : 503,
    body: JSON.stringify({
      healthy,
      checks,
      currentSeason: state.current.number,
      nextTransition: getNextTransitionTime()
    })
  };
};
```

## Benefits of Centralized Season Management

1. **Single Source of Truth**: No more season mismatches between components
2. **Automated Transitions**: Reduces manual intervention and errors
3. **Comprehensive Monitoring**: Real-time visibility into system state
4. **Disaster Recovery**: Can manually override and fix stuck seasons
5. **Audit Trail**: Complete log of all season transitions
6. **Developer Friendly**: Simple API to get current season from anywhere

## Implementation Priority

1. **1**: Build Season Oracle service and database schema
2. **2**: Integrate with smart contracts and ArDrive
3. **3**: Add Dev Dashboard UI and manual controls
4. **4**: Implement automated transition cron jobs
5. **5**: Add monitoring, alerts, and health checks
6. **6**: Testing and production deployment

This system ensures perfect synchronization across all components while providing manual override capabilities for emergency situations.