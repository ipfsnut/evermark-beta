// netlify/functions/season-transition-cron.ts
// Automated season transition cron job

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { SeasonOracle } from '../lib/SeasonOracle';
import { ArDriveSeasonService } from '../lib/ArDriveSeasonService';
import { createClient } from '@supabase/supabase-js';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TransitionPhase {
  name: string;
  description: string;
  startMinute: number;
  endMinute: number;
  execute: () => Promise<void>;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    console.log('🕒 Season transition cron job triggered');

    const oracle = new SeasonOracle();
    const state = await oracle.getCurrentState();
    const now = new Date();

    // Check if we're in transition window (Sunday 23:00-23:59 UTC)
    const isTransitionWindow = 
      now.getUTCDay() === 0 && // Sunday
      now.getUTCHours() === 23; // 23:00-23:59

    if (!isTransitionWindow) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Not in transition window',
          currentTime: now.toISOString(),
          currentSeason: state.current.number,
          nextTransition: oracle.getNextTransitionTime().toISOString(),
          isTransitionWindow: false
        }),
      };
    }

    // Check if season transition is needed
    if (!oracle.shouldTransition(now)) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Season transition not needed',
          currentSeason: state.current.number,
          seasonEnds: new Date(state.current.endTimestamp).toISOString(),
          isTransitionWindow: true
        }),
      };
    }

    console.log(`🔄 Starting season transition from #${state.current.number} to #${state.next.number}`);

    // Define transition phases
    const phases: TransitionPhase[] = [
      {
        name: 'prepare_next_season',
        description: 'Prepare next season folder and database records',
        startMinute: 0,
        endMinute: 15,
        execute: () => prepareNextSeason(state.next.number)
      },
      {
        name: 'tally_votes',
        description: 'Snapshot and tally current season votes',
        startMinute: 15,
        endMinute: 30,
        execute: () => tallyCurrentSeasonVotes(state.current.number)
      },
      {
        name: 'finalize_season',
        description: 'Finalize current season and upload final data',
        startMinute: 30,
        endMinute: 45,
        execute: () => finalizeCurrentSeason(state.current.number)
      },
      {
        name: 'transition_complete',
        description: 'Complete transition and update system state',
        startMinute: 45,
        endMinute: 59,
        execute: () => completeTransition(state.current.number, state.next.number)
      }
    ];

    // Determine current phase based on minute
    const currentMinute = now.getUTCMinutes();
    const currentPhase = phases.find(
      phase => currentMinute >= phase.startMinute && currentMinute < phase.endMinute
    );

    if (!currentPhase) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'No active transition phase',
          currentMinute,
          nextPhase: phases.find(p => p.startMinute > currentMinute)?.name || 'transition_complete'
        }),
      };
    }

    // Record transition attempt
    const transitionId = await recordTransitionAttempt(
      state.current.number,
      state.next.number,
      currentPhase.name
    );

    try {
      console.log(`🔄 Executing phase: ${currentPhase.name}`);
      
      // Execute the current phase
      await currentPhase.execute();
      
      // Record successful completion
      await recordTransitionSuccess(transitionId, currentPhase.name);

      console.log(`✅ Phase completed: ${currentPhase.name}`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          phase: currentPhase.name,
          description: currentPhase.description,
          transitionId,
          currentSeason: state.current.number,
          nextSeason: state.next.number,
          timestamp: now.toISOString()
        }),
      };

    } catch (phaseError) {
      console.error(`❌ Phase execution failed: ${currentPhase.name}`, phaseError);
      
      // Record failure
      await recordTransitionError(transitionId, currentPhase.name, phaseError);
      
      // Send alert to admin
      await sendTransitionAlert({
        type: 'phase_failure',
        phase: currentPhase.name,
        error: phaseError,
        transitionId,
        currentSeason: state.current.number
      });

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Transition phase failed',
          phase: currentPhase.name,
          message: phaseError instanceof Error ? phaseError.message : 'Unknown error',
          transitionId
        }),
      };
    }

  } catch (error) {
    console.error('❌ Season transition cron failed:', error);
    
    // Send critical alert
    await sendTransitionAlert({
      type: 'critical_failure',
      error,
      timestamp: new Date().toISOString()
    });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Transition cron failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
    };
  }
};

/**
 * Phase 1: Prepare next season
 */
async function prepareNextSeason(seasonNumber: number): Promise<void> {
  console.log(`📁 Preparing season #${seasonNumber}`);
  
  const oracle = new SeasonOracle();
  const ardriveService = new ArDriveSeasonService();
  
  // Get season info
  const seasonInfo = oracle.getSeasonInfo(seasonNumber);
  
  // 1. Create ArDrive folder structure
  await ardriveService.prepareSeasonFolder(seasonInfo);
  
  // 2. Initialize database record
  const { error } = await supabase
    .from('seasons')
    .insert({
      number: seasonNumber,
      year: seasonInfo.year,
      week: seasonInfo.week,
      start_timestamp: new Date(seasonInfo.startTimestamp).toISOString(),
      end_timestamp: new Date(seasonInfo.endTimestamp).toISOString(),
      status: 'preparing'
    });
  
  if (error && !error.message.includes('duplicate key')) {
    throw new Error(`Failed to create season record: ${error.message}`);
  }
  
  console.log(`✅ Season #${seasonNumber} prepared`);
}

/**
 * Phase 2: Tally current season votes
 */
async function tallyCurrentSeasonVotes(seasonNumber: number): Promise<void> {
  console.log(`📊 Tallying votes for season #${seasonNumber}`);
  
  // 1. Get vote snapshot from database
  const { data: voteData, error } = await supabase
    .from('beta_evermarks')
    .select('token_id, title, creator_address, created_at')
    .eq('season_number', seasonNumber)
    .order('created_at', { ascending: true });
  
  if (error) {
    throw new Error(`Failed to get vote data: ${error.message}`);
  }
  
  // 2. Create vote snapshot record
  const voteSnapshot = {
    season_number: seasonNumber,
    snapshot_time: new Date().toISOString(),
    vote_data: voteData,
    total_evermarks: voteData?.length || 0
  };
  
  // 3. Store vote snapshot
  const { error: snapshotError } = await supabase
    .from('vote_snapshots')
    .insert(voteSnapshot);
  
  if (snapshotError) {
    console.warn('Failed to store vote snapshot:', snapshotError);
    // Don't throw - this isn't critical
  }
  
  console.log(`✅ Votes tallied for season #${seasonNumber}: ${voteData?.length || 0} evermarks`);
}

/**
 * Phase 3: Finalize current season
 */
async function finalizeCurrentSeason(seasonNumber: number): Promise<void> {
  console.log(`🏁 Finalizing season #${seasonNumber}`);
  
  const ardriveService = new ArDriveSeasonService();
  
  // 1. Finalize ArDrive folder
  await ardriveService.finalizeSeasonFolder(seasonNumber);
  
  // 2. Update season status in database
  const { error } = await supabase
    .from('seasons')
    .update({
      status: 'completed',
      finalized_at: new Date().toISOString()
    })
    .eq('number', seasonNumber);
  
  if (error) {
    throw new Error(`Failed to finalize season: ${error.message}`);
  }
  
  console.log(`✅ Season #${seasonNumber} finalized`);
}

/**
 * Phase 4: Complete transition
 */
async function completeTransition(fromSeason: number, toSeason: number): Promise<void> {
  console.log(`🔄 Completing transition from #${fromSeason} to #${toSeason}`);
  
  // 1. Activate new season
  const { error: activateError } = await supabase
    .from('seasons')
    .update({ status: 'active' })
    .eq('number', toSeason);
  
  if (activateError) {
    throw new Error(`Failed to activate season ${toSeason}: ${activateError.message}`);
  }
  
  // 2. Archive old season
  const { error: archiveError } = await supabase
    .from('seasons')
    .update({ status: 'archived' })
    .eq('number', fromSeason);
  
  if (archiveError) {
    console.warn(`Failed to archive season ${fromSeason}:`, archiveError);
    // Don't throw - new season is active
  }
  
  // 3. Clear oracle cache to pick up new season
  const oracle = new SeasonOracle();
  oracle.clearCache();
  
  console.log(`✅ Transition completed: #${fromSeason} → #${toSeason}`);
}

/**
 * Record transition attempt
 */
async function recordTransitionAttempt(
  fromSeason: number,
  toSeason: number,
  phase: string
): Promise<string> {
  const { data, error } = await supabase
    .from('season_transitions')
    .insert({
      from_season: fromSeason,
      to_season: toSeason,
      transition_type: 'automatic',
      current_phase: phase,
      initiated_by: 'system'
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Failed to record transition attempt:', error);
    return 'unknown';
  }
  
  return data.id;
}

/**
 * Record successful phase completion
 */
async function recordTransitionSuccess(transitionId: string, phase: string): Promise<void> {
  const { error } = await supabase
    .from('season_transitions')
    .update({
      phases_completed: supabase.rpc('array_append', {
        array_col: 'phases_completed',
        new_value: phase
      }),
      current_phase: `${phase}_completed`
    })
    .eq('id', transitionId);
  
  if (error) {
    console.error('Failed to record transition success:', error);
  }
}

/**
 * Record transition error
 */
async function recordTransitionError(
  transitionId: string,
  phase: string,
  error: any
): Promise<void> {
  const { error: updateError } = await supabase
    .from('season_transitions')
    .update({
      status: 'failed',
      error_message: error instanceof Error ? error.message : String(error),
      current_phase: `${phase}_failed`
    })
    .eq('id', transitionId);
  
  if (updateError) {
    console.error('Failed to record transition error:', updateError);
  }
}

/**
 * Send transition alert (placeholder - implement with actual notification service)
 */
async function sendTransitionAlert(alert: any): Promise<void> {
  console.log('🚨 TRANSITION ALERT:', alert);
  
  // TODO: Implement actual alerting
  // - Discord webhook
  // - Email notification
  // - Slack webhook
  // - Admin dashboard notification
}