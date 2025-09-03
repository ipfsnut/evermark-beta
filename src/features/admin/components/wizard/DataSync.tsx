import React, { useState, useEffect } from 'react';
import { RefreshCw, Database, AlertTriangle, CheckCircle, BarChart3 } from 'lucide-react';

interface DataSyncProps {
  seasonNumber: number;
  onSyncComplete: (leaderboard: any[]) => void;
  onProceed: () => void;
  isSyncing: boolean;
  setSyncing: (syncing: boolean) => void;
}

interface SyncProgress {
  phase: 'blockchain' | 'aggregation' | 'validation' | 'complete';
  evermarksSynced: number;
  totalEvermarks: number;
  votesProcessed: number;
  discrepancies: string[];
  leaderboard: any[];
}

export function DataSync({ 
  seasonNumber, 
  onSyncComplete, 
  onProceed, 
  isSyncing, 
  setSyncing 
}: DataSyncProps) {
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    phase: 'blockchain',
    evermarksSynced: 0,
    totalEvermarks: 0,
    votesProcessed: 0,
    discrepancies: [],
    leaderboard: []
  });
  
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  const startDataSync = async () => {
    setSyncing(true);
    setSyncProgress({
      phase: 'blockchain',
      evermarksSynced: 0,
      totalEvermarks: 0,
      votesProcessed: 0,
      discrepancies: [],
      leaderboard: []
    });

    try {
      // Phase 1: Blockchain sync
      setSyncProgress(prev => ({ ...prev, phase: 'blockchain' }));
      
      const syncResponse = await fetch(`/.netlify/functions/voting-sync?action=sync-cycle&cycle=${seasonNumber}`);
      if (!syncResponse.ok) {
        throw new Error('Failed to sync blockchain data');
      }
      
      const syncResult = await syncResponse.json();
      setSyncProgress(prev => ({
        ...prev,
        evermarksSynced: syncResult.evermarksSynced || 0
      }));

      // Phase 2: Aggregation
      setSyncProgress(prev => ({ ...prev, phase: 'aggregation' }));
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing

      // Phase 3: Validation  
      setSyncProgress(prev => ({ ...prev, phase: 'validation' }));
      
      // Get finalized leaderboard
      const finalizationResponse = await fetch(`/.netlify/functions/season-finalization?action=finalize-season&season_number=${seasonNumber}`);
      if (!finalizationResponse.ok) {
        throw new Error('Failed to finalize season data');
      }

      // Get final leaderboard data
      const { data: leaderboard, error } = await fetch('/.netlify/functions/evermarks').then(res => res.json());
      if (error) {
        throw new Error('Failed to get leaderboard data');
      }

      setSyncProgress(prev => ({ 
        ...prev, 
        phase: 'complete',
        leaderboard: leaderboard?.slice(0, 10) || []
      }));

      onSyncComplete(leaderboard || []);

    } catch (error) {
      console.error('Data sync failed:', error);
      setSyncProgress(prev => ({
        ...prev,
        discrepancies: [...prev.discrepancies, error instanceof Error ? error.message : 'Unknown sync error']
      }));
    } finally {
      setSyncing(false);
    }
  };

  // Auto-start sync if enabled
  useEffect(() => {
    if (autoSyncEnabled && !isSyncing && syncProgress.phase === 'blockchain') {
      startDataSync();
    }
  }, [autoSyncEnabled, isSyncing]);

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'blockchain':
        return <Database className={`w-6 h-6 ${isSyncing && syncProgress.phase === 'blockchain' ? 'text-blue-400 animate-pulse' : 'text-gray-400'}`} />;
      case 'aggregation':
        return <BarChart3 className={`w-6 h-6 ${isSyncing && syncProgress.phase === 'aggregation' ? 'text-yellow-400 animate-pulse' : 'text-gray-400'}`} />;
      case 'validation':
        return <CheckCircle className={`w-6 h-6 ${isSyncing && syncProgress.phase === 'validation' ? 'text-green-400 animate-pulse' : 'text-gray-400'}`} />;
      case 'complete':
        return <CheckCircle className="w-6 h-6 text-green-400" />;
      default:
        return <RefreshCw className="w-6 h-6 text-gray-400" />;
    }
  };

  const getPhaseStatus = (phase: string) => {
    if (syncProgress.phase === phase && isSyncing) return 'in_progress';
    
    const phaseOrder = ['blockchain', 'aggregation', 'validation', 'complete'];
    const currentPhaseIndex = phaseOrder.indexOf(syncProgress.phase);
    const targetPhaseIndex = phaseOrder.indexOf(phase);
    
    if (currentPhaseIndex > targetPhaseIndex) {
      return 'completed';
    }
    return 'pending';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Data Sync & Final Ranking</h2>
        <p className="text-gray-400">Synchronizing blockchain data and computing final leaderboard</p>
      </div>

      {/* Sync Phases */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { key: 'blockchain', name: 'Blockchain Sync', desc: 'Fetch latest votes from chain' },
          { key: 'aggregation', name: 'Data Aggregation', desc: 'Compute vote totals and rankings' },
          { key: 'validation', name: 'Validation', desc: 'Verify data consistency' }
        ].map(phase => {
          const status = getPhaseStatus(phase.key);
          return (
            <div key={phase.key} className={`p-4 rounded-lg border transition-all ${
              status === 'completed' ? 'bg-green-900/20 border-green-500/50' :
              status === 'in_progress' ? 'bg-blue-900/20 border-blue-500/50' :
              'bg-gray-800 border-gray-700'
            }`}>
              <div className="flex items-center mb-2">
                {getPhaseIcon(phase.key)}
                <span className={`ml-2 font-medium ${
                  status === 'completed' ? 'text-green-400' :
                  status === 'in_progress' ? 'text-blue-400' :
                  'text-gray-400'
                }`}>
                  {phase.name}
                </span>
              </div>
              <p className="text-sm text-gray-400">{phase.desc}</p>
              {status === 'completed' && (
                <div className="mt-2 text-xs text-green-400">✓ Complete</div>
              )}
              {status === 'in_progress' && (
                <div className="mt-2 text-xs text-blue-400">⟳ Processing...</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Details */}
      {isSyncing && (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <div className="flex items-center mb-4">
            <RefreshCw className="w-5 h-5 text-blue-400 animate-spin mr-2" />
            <h3 className="text-lg font-semibold text-white">Sync Progress</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Current Phase:</span>
              <span className="text-blue-400 capitalize">{syncProgress.phase}</span>
            </div>
            
            {syncProgress.evermarksSynced > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Evermarks Synced:</span>
                <span className="text-green-400">{syncProgress.evermarksSynced}</span>
              </div>
            )}
            
            {syncProgress.votesProcessed > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Votes Processed:</span>
                <span className="text-green-400">{syncProgress.votesProcessed.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard Preview */}
      {syncProgress.leaderboard.length > 0 && (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Final Leaderboard Preview</h3>
          <div className="space-y-2">
            {syncProgress.leaderboard.slice(0, 5).map((evermark: any, index: number) => (
              <div key={evermark.id} className="flex items-center justify-between p-3 bg-gray-700 rounded">
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-3 ${
                    index === 0 ? 'bg-yellow-400 text-black' :
                    index === 1 ? 'bg-gray-400 text-black' :
                    index === 2 ? 'bg-orange-400 text-black' :
                    'bg-gray-600 text-white'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-white font-medium">{evermark.title || 'Untitled'}</p>
                    <p className="text-gray-400 text-sm">{evermark.author}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-medium">{evermark.vote_count?.toLocaleString() || '0'} votes</p>
                </div>
              </div>
            ))}
            {syncProgress.leaderboard.length > 5 && (
              <p className="text-center text-gray-400 text-sm">
                And {syncProgress.leaderboard.length - 5} more...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Discrepancies */}
      {syncProgress.discrepancies.length > 0 && (
        <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-lg">
          <div className="flex items-center mb-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mr-2" />
            <h3 className="text-lg font-semibold text-red-400">Data Discrepancies Found</h3>
          </div>
          <ul className="space-y-1 text-red-300 text-sm">
            {syncProgress.discrepancies.map((discrepancy, index) => (
              <li key={index}>• {discrepancy}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 pt-6">
        <button
          onClick={startDataSync}
          disabled={isSyncing}
          className="flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
        >
          <RefreshCw className={`w-5 h-5 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Manual Sync'}
        </button>

        <button
          onClick={onProceed}
          disabled={isSyncing || syncProgress.phase !== 'complete' || syncProgress.discrepancies.length > 0}
          className="flex-1 flex items-center justify-center px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
        >
          Proceed to Winner Selection
        </button>
      </div>
    </div>
  );
}