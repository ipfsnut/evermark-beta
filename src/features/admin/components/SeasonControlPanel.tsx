// src/features/admin/components/SeasonControlPanel.tsx
// Season management control panel for admin dashboard

import React, { useState } from 'react';
import { 
  useSeasonState, 
  useSeasonActions, 
  useSeasonSync, 
  useSeasonCountdown,
  useSeasonTransition 
} from '@/hooks/useSeasonState';

interface SeasonControlPanelProps {
  className?: string;
}

export function SeasonControlPanel({ className = '' }: SeasonControlPanelProps) {
  const { data: seasonData, isLoading, error, refetch } = useSeasonState();
  const { sync, allInSync, getSyncIssues } = useSeasonSync();
  const { displayString, isEndingSoon } = useSeasonCountdown();
  const { data: transitionData } = useSeasonTransition();
  const {
    clearCache,
    forceTransition,
    validateSeason,
    calculateSeason,
    getBoundaries,
    isExecuting,
    error: actionError
  } = useSeasonActions();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-800 p-4 rounded">
                <div className="h-4 bg-gray-700 rounded w-20 mb-2"></div>
                <div className="h-8 bg-gray-700 rounded w-16 mb-1"></div>
                <div className="h-3 bg-gray-700 rounded w-24"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !seasonData) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Season Management</h2>
          <button
            onClick={() => refetch()}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
        <div className="bg-red-900/20 border border-red-800 rounded p-4">
          <p className="text-red-400">
            Failed to load season data: {error?.message || 'Unknown error'}
          </p>
        </div>
      </div>
    );
  }

  const { state } = seasonData;
  const syncIssues = getSyncIssues ? getSyncIssues() : [];

  return (
    <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">
          Season Management System
        </h2>
        <div className="flex items-center space-x-2">
          <StatusIndicator isHealthy={allInSync() || false} />
          <button
            onClick={() => refetch()}
            className="px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Current Season Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <SeasonCard
          title="Current Season"
          seasonNumber={state.current.number}
          year={state.current.year}
          week={state.current.week}
          status={state.current.status}
          phase={state.current.phase}
          isPrimary
        />
        
        <SeasonCard
          title="Previous Season"
          seasonNumber={state.previous.number}
          year={state.previous.year}
          week={state.previous.week}
          status={state.previous.status}
        />
        
        <SeasonCard
          title="Next Season"
          seasonNumber={state.next.number}
          year={state.next.year}
          week={state.next.week}
          status={state.next.status}
          countdown={displayString}
          isEndingSoon={isEndingSoon}
        />
      </div>

      {/* Sync Status */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">
          System Synchronization
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SyncIndicator
            label="Smart Contracts"
            status={sync?.smartContracts}
            details={[
              { name: 'Voting', status: sync?.smartContracts?.voting },
              { name: 'Leaderboard', status: sync?.smartContracts?.leaderboard },
              { name: 'Rewards', status: sync?.smartContracts?.rewards }
            ]}
          />
          <SyncIndicator
            label="ArDrive Storage"
            status={sync?.arDrive}
            details={[
              { name: 'Current Folder', status: sync?.arDrive?.currentFolderReady },
              { name: 'Previous Finalized', status: sync?.arDrive?.previousFolderFinalized }
            ]}
          />
          <SyncIndicator
            label="Database"
            status={sync?.database}
            details={[
              { name: 'In Sync', status: sync?.database?.inSync }
            ]}
          />
        </div>
        
        {syncIssues.length > 0 && (
          <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-800 rounded">
            <p className="text-yellow-400 text-sm font-medium mb-1">Sync Issues:</p>
            <ul className="text-yellow-300 text-sm space-y-1">
              {syncIssues.map((issue, index) => (
                <li key={index}>• {issue}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Transition Status */}
      {transitionData?.transition && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">
            Transition Status
          </h3>
          <div className="bg-gray-800 rounded p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Should Transition:</span>
                <span className={`ml-2 ${transitionData.transition.shouldTransition ? 'text-yellow-400' : 'text-green-400'}`}>
                  {transitionData.transition.shouldTransition ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Transition Window:</span>
                <span className={`ml-2 ${transitionData.transition.isTransitionWindow ? 'text-yellow-400' : 'text-gray-300'}`}>
                  {transitionData.transition.isTransitionWindow ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div className="mt-2 text-sm">
              <span className="text-gray-400">Next Transition:</span>
              <span className="ml-2 text-gray-300">
                {new Date(transitionData.transition.nextTransition).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={clearCache}
          disabled={isExecuting}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          Refresh Cache
        </button>
        
        <button
          onClick={() => calculateSeason()}
          disabled={isExecuting}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
        >
          Recalculate Season
        </button>
        
        <button
          onClick={() => validateSeason(state.current)}
          disabled={isExecuting}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm"
        >
          Validate Current
        </button>
        
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
        >
          {showAdvanced ? 'Hide' : 'Show'} Advanced
        </button>
      </div>

      {/* Advanced Controls */}
      {showAdvanced && (
        <div className="border-t border-gray-700 pt-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">
            Advanced Controls
          </h3>
          
          <div className="space-y-4">
            {/* Force Transition */}
            <div className="bg-red-900/20 border border-red-800 rounded p-4">
              <h4 className="text-red-400 font-medium mb-2">⚠️ Force Season Transition</h4>
              <p className="text-red-300 text-sm mb-3">
                Manually trigger season transition. This should only be used in emergency situations.
              </p>
              
              {confirmAction === 'force_transition' ? (
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      forceTransition();
                      setConfirmAction(null);
                    }}
                    disabled={isExecuting}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    Confirm Force Transition
                  </button>
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmAction('force_transition')}
                  disabled={isExecuting}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  Force Transition
                </button>
              )}
            </div>

            {/* Season Boundaries */}
            <div className="bg-gray-800 rounded p-4">
              <h4 className="text-gray-300 font-medium mb-2">Season Boundaries</h4>
              <button
                onClick={() => getBoundaries(state.current.number)}
                disabled={isExecuting}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 disabled:opacity-50"
              >
                Get Current Season Boundaries
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Error */}
      {actionError && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded">
          <p className="text-red-400 text-sm">
            Action failed: {actionError.message}
          </p>
        </div>
      )}

      {/* Loading Overlay */}
      {isExecuting && (
        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
          <div className="bg-gray-800 rounded-lg p-4 flex items-center space-x-3">
            <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full"></div>
            <span className="text-white">Executing action...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components

function StatusIndicator({ isHealthy }: { isHealthy: boolean }) {
  return (
    <div className="flex items-center space-x-2">
      <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-green-400' : 'bg-red-400'}`}></div>
      <span className={`text-sm ${isHealthy ? 'text-green-400' : 'text-red-400'}`}>
        {isHealthy ? 'Healthy' : 'Issues'}
      </span>
    </div>
  );
}

interface SeasonCardProps {
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

function SeasonCard({ 
  title, 
  seasonNumber, 
  year, 
  week, 
  status, 
  phase,
  isPrimary = false,
  countdown,
  isEndingSoon = false
}: SeasonCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'completed': return 'text-blue-400';
      case 'preparing': return 'text-yellow-400';
      case 'finalizing': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className={`bg-gray-800 p-4 rounded ${isPrimary ? 'ring-2 ring-blue-500' : ''}`}>
      <h3 className="text-sm text-gray-400 mb-2">{title}</h3>
      <p className="text-2xl font-bold text-white mb-1">
        #{seasonNumber}
      </p>
      <p className="text-xs text-gray-500 mb-2">
        {year}-{week}
      </p>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${getStatusColor(status)}`}>
          {status}
        </span>
        {phase && (
          <span className="text-xs text-gray-400">
            {phase}
          </span>
        )}
      </div>
      {countdown && (
        <p className={`text-xs mt-2 ${isEndingSoon ? 'text-orange-400' : 'text-gray-400'}`}>
          {countdown} remaining
        </p>
      )}
    </div>
  );
}

interface SyncIndicatorProps {
  label: string;
  status: any;
  details?: Array<{ name: string; status: boolean | undefined }>;
}

function SyncIndicator({ label, status, details }: SyncIndicatorProps) {
  const isHealthy = typeof status === 'object' 
    ? Object.values(status || {}).every(v => v === true)
    : status === true;

  return (
    <div className="bg-gray-800 p-3 rounded">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-300">{label}</span>
        <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-green-400' : 'bg-red-400'}`}></div>
      </div>
      
      {details && (
        <div className="space-y-1">
          {details.map((detail, index) => (
            <div key={index} className="flex items-center justify-between text-xs">
              <span className="text-gray-400">{detail.name}</span>
              <span className={detail.status ? 'text-green-400' : 'text-red-400'}>
                {detail.status ? '✓' : '✗'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}