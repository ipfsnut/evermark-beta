import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, AlertCircle, ExternalLink, RefreshCw, Archive, AlertTriangle } from 'lucide-react';

interface ExecutionMonitorProps {
  seasonNumber: number;
  distributions: any[];
  onComplete: () => void;
}

interface ExecutionProgress {
  season: number;
  totalRecipients: number;
  processed: number;
  successful: number;
  failed: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  currentBatch: number;
  totalBatches: number;
  transactionHashes: string[];
  errorDetails: Array<{ recipient: string; error: string; amount: string }>;
}

export function ExecutionMonitor({ 
  seasonNumber, 
  distributions, 
  onComplete 
}: ExecutionMonitorProps) {
  const [progress, setProgress] = useState<ExecutionProgress | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStarted, setExecutionStarted] = useState(false);

  const formatEther = (value: string): string => {
    return (Number(value) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const startExecution = async () => {
    setIsExecuting(true);
    setExecutionStarted(true);
    
    try {
      // Start distribution execution
      const response = await fetch(`/.netlify/functions/admin-execute-distribution?action=start-distribution&season=${seasonNumber}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to start distribution');
      }
      
      const result = await response.json();
      console.log('Distribution started:', result);
      
      // Start polling for progress
      pollProgress();

    } catch (error) {
      console.error('Execution failed:', error);
      setIsExecuting(false);
    }
  };

  const pollProgress = async () => {
    try {
      const response = await fetch(`/.netlify/functions/admin-execute-distribution?action=get-progress&season=${seasonNumber}`);
      if (!response.ok) {
        throw new Error('Failed to get progress');
      }
      
      const progressData = await response.json();
      setProgress(progressData);
      
      if (progressData.status === 'completed') {
        setIsExecuting(false);
        setTimeout(() => {
          onComplete();
        }, 2000);
      } else if (progressData.status === 'failed') {
        setIsExecuting(false);
      } else if (progressData.status === 'in_progress') {
        // Continue polling
        setTimeout(pollProgress, 2000);
      }

    } catch (error) {
      console.error('Failed to poll progress:', error);
      setIsExecuting(false);
    }
  };

  const getStatusIcon = () => {
    if (!progress) return <Play className="w-6 h-6 text-blue-400" />;
    
    switch (progress.status) {
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-400" />;
      case 'failed':
        return <AlertCircle className="w-6 h-6 text-red-400" />;
      case 'in_progress':
        return <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />;
      default:
        return <Play className="w-6 h-6 text-blue-400" />;
    }
  };

  const getProgressPercentage = (): number => {
    if (!progress || progress.totalRecipients === 0) return 0;
    return (progress.processed / progress.totalRecipients) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Execution & Monitoring</h2>
        <p className="text-gray-400">Execute reward distribution and monitor progress</p>
      </div>

      {/* Execution Status */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            {getStatusIcon()}
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-white">Distribution Status</h3>
              <p className="text-gray-400 text-sm">
                {!progress ? 'Ready to execute' : 
                 progress.status === 'in_progress' ? 'Executing distributions...' :
                 progress.status === 'completed' ? 'All distributions completed' :
                 progress.status === 'failed' ? 'Execution failed' :
                 'Pending execution'}
              </p>
            </div>
          </div>
          
          {progress?.status === 'completed' && (
            <div className="text-right">
              <p className="text-green-400 font-medium">{progress.successful} successful</p>
              <p className="text-red-400 text-sm">{progress.failed} failed</p>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {progress && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Progress:</span>
              <span className="text-blue-400">{progress.processed}/{progress.totalRecipients}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>0%</span>
              <span className="text-blue-400">{getProgressPercentage().toFixed(1)}%</span>
              <span>100%</span>
            </div>
          </div>
        )}
      </div>

      {/* Batch Progress */}
      {progress && progress.status === 'in_progress' && (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Batch Execution</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex justify-between">
              <span className="text-gray-400">Current Batch:</span>
              <span className="text-blue-400">{progress.currentBatch}/{progress.totalBatches}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Successful Txns:</span>
              <span className="text-green-400">{progress.successful}</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {progress && progress.transactionHashes.length > 0 && (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Transactions</h3>
          <div className="space-y-2">
            {progress.transactionHashes.slice(-3).map((hash, index) => (
              <div key={hash} className="flex items-center justify-between p-2 bg-gray-700 rounded">
                <span className="text-gray-300 text-sm font-mono">{formatAddress(hash)}</span>
                <a
                  href={`https://basescan.org/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 flex items-center text-sm"
                >
                  View <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Details */}
      {progress && progress.errorDetails.length > 0 && (
        <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-lg">
          <div className="flex items-center mb-4">
            <AlertTriangle className="w-5 h-5 text-red-400 mr-2" />
            <h3 className="text-lg font-semibold text-red-400">Failed Distributions</h3>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {progress.errorDetails.slice(0, 10).map((error, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-red-900/30 rounded text-sm">
                <span className="text-red-300">{formatAddress(error.recipient)}</span>
                <span className="text-red-400">{formatEther(error.amount)} EMARK</span>
                <span className="text-red-300 text-xs max-w-32 truncate">{error.error}</span>
              </div>
            ))}
          </div>
          {progress.errorDetails.length > 10 && (
            <p className="text-red-400 text-sm mt-2">
              And {progress.errorDetails.length - 10} more failed distributions...
            </p>
          )}
        </div>
      )}

      {/* Completion Status */}
      {progress?.status === 'completed' && (
        <div className="bg-green-900/20 border border-green-500/50 p-6 rounded-lg">
          <div className="flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-400 mr-3" />
            <div>
              <h3 className="text-xl font-semibold text-green-400">Season {seasonNumber} Finalized!</h3>
              <p className="text-green-300 text-sm">
                Successfully distributed rewards to {progress.successful} recipients
              </p>
            </div>
          </div>
          
          <div className="text-center">
            <button
              onClick={onComplete}
              className="flex items-center justify-center px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all mx-auto"
            >
              <Archive className="w-5 h-5 mr-2" />
              Complete Season Finalization
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!executionStarted && (
        <div className="flex gap-4 pt-6">
          <button
            onClick={startExecution}
            disabled={isExecuting}
            className="flex-1 flex items-center justify-center px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
          >
            <Play className="w-5 h-5 mr-2" />
            Execute Distribution
          </button>
        </div>
      )}
    </div>
  );
}