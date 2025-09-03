import React from 'react';
import { Trophy, Users, TrendingUp, Calendar, CheckCircle } from 'lucide-react';

interface SeasonOverviewProps {
  seasonNumber: number;
  endTime: Date;
  totalVotes: bigint;
  isValidated: boolean;
  onProceed: () => void;
  onValidate: () => void;
  isValidating: boolean;
}

export function SeasonOverview({ 
  seasonNumber, 
  endTime, 
  totalVotes, 
  isValidated,
  onProceed,
  onValidate,
  isValidating 
}: SeasonOverviewProps) {
  const formatEther = (value: bigint): string => {
    return (Number(value) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeElapsed = (): string => {
    const elapsed = Date.now() - endTime.getTime();
    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} days ago`;
    if (hours > 0) return `${hours} hours ago`;
    return 'Recently';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <Trophy className="w-12 h-12 text-yellow-400 mr-3" />
          <div>
            <h2 className="text-3xl font-bold text-white">Season {seasonNumber}</h2>
            <p className="text-gray-400">Ready for Finalization</p>
          </div>
        </div>
      </div>

      {/* Season Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* End Time Card */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <div className="flex items-center mb-3">
            <Calendar className="w-6 h-6 text-blue-400 mr-3" />
            <h3 className="text-lg font-semibold text-white">Season Ended</h3>
          </div>
          <p className="text-gray-300 text-sm mb-2">{formatDate(endTime)}</p>
          <p className="text-blue-400 font-medium">{getTimeElapsed()}</p>
        </div>

        {/* Total Votes Card */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <div className="flex items-center mb-3">
            <TrendingUp className="w-6 h-6 text-green-400 mr-3" />
            <h3 className="text-lg font-semibold text-white">Total Votes</h3>
          </div>
          <p className="text-2xl font-bold text-green-400">{formatEther(totalVotes)}</p>
          <p className="text-gray-400 text-sm">WEMARK tokens voted</p>
        </div>

        {/* Validation Status Card */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <div className="flex items-center mb-3">
            <Users className="w-6 h-6 text-purple-400 mr-3" />
            <h3 className="text-lg font-semibold text-white">Data Status</h3>
          </div>
          <div className="flex items-center">
            {isValidated ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                <p className="text-green-400 font-medium">Validated</p>
              </>
            ) : (
              <>
                <div className="w-5 h-5 bg-yellow-400 rounded-full mr-2 animate-pulse" />
                <p className="text-yellow-400 font-medium">Needs Validation</p>
              </>
            )}
          </div>
          <p className="text-gray-400 text-sm mt-1">
            {isValidated ? 'All data synced and verified' : 'Click validate to check data integrity'}
          </p>
        </div>
      </div>

      {/* Validation Details */}
      {!isValidated && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-400 mb-3">Pre-Finalization Checks</h3>
          <ul className="space-y-2 text-yellow-300 text-sm">
            <li>• Verify season end time has passed</li>
            <li>• Check all votes are synced from blockchain</li>
            <li>• Validate database consistency</li>
            <li>• Confirm no pending transactions</li>
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 pt-6">
        <button
          onClick={onValidate}
          disabled={isValidating || isValidated}
          className={`flex-1 flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-all ${
            isValidated 
              ? 'bg-green-600 text-white cursor-default'
              : isValidating
              ? 'bg-blue-600 text-white cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isValidating ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Validating...
            </>
          ) : isValidated ? (
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              Validated
            </>
          ) : (
            'Run Validation Checks'
          )}
        </button>

        <button
          onClick={onProceed}
          disabled={!isValidated}
          className={`flex-1 flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-all ${
            isValidated
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          Proceed to Data Sync
        </button>
      </div>
    </div>
  );
}