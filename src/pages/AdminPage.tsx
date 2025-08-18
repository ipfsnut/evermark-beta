// src/pages/AdminPage.tsx
// Admin interface for managing Evermark contracts

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Play, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Users,
  BarChart3,
  Clock,
  Shield
} from 'lucide-react';
import { prepareContractCall, sendTransaction } from 'thirdweb';
import { useSendTransaction } from 'thirdweb/react';
import { client } from '@/lib/thirdweb';
import { base } from 'thirdweb/chains';
import { useActiveAccount } from 'thirdweb/react';
import EvermarkLeaderboardABI from '@/features/leaderboard/abis/EvermarkLeaderboard.json';
import { LeaderboardSyncService } from '@/features/leaderboard/services/LeaderboardSyncService';

interface CycleStatus {
  cycle: number;
  initialized: boolean;
  totalUpdates: number;
  leaderboardSize: number;
  lastUpdate: number;
}

interface AdminRoles {
  hasDefaultAdminRole: boolean;
  hasAdminRole: boolean;
  hasLeaderboardManagerRole: boolean;
  contractOwner?: string;
}

export default function AdminPage() {
  const account = useActiveAccount();
  const { mutate: sendTx, isPending } = useSendTransaction();
  
  const [cycleStatuses, setCycleStatuses] = useState<CycleStatus[]>([]);
  const [adminRoles, setAdminRoles] = useState<AdminRoles | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState(1);
  const [logs, setLogs] = useState<string[]>([]);

  const LEADERBOARD_CONTRACT = {
    client,
    chain: base,
    address: import.meta.env.VITE_EVERMARK_LEADERBOARD_ADDRESS || '',
    abi: EvermarkLeaderboardABI
  };

  // Add log entry
  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
    setLogs(prev => [logEntry, ...prev].slice(0, 50)); // Keep last 50 logs
    console.log(logEntry);
  };

  // Check admin roles for connected wallet
  const checkAdminRoles = async (): Promise<AdminRoles> => {
    if (!account) {
      return {
        hasDefaultAdminRole: false,
        hasAdminRole: false,
        hasLeaderboardManagerRole: false
      };
    }

    try {
      addLog('Checking admin roles for connected wallet...');

      const [defaultAdminRole, adminRole, managerRole, hasDefaultAdmin, hasAdmin, hasManager] = await Promise.all([
        // Get role constants
        readContract({
          contract: LEADERBOARD_CONTRACT,
          method: "DEFAULT_ADMIN_ROLE",
          params: []
        }),
        readContract({
          contract: LEADERBOARD_CONTRACT,
          method: "ADMIN_ROLE", 
          params: []
        }),
        readContract({
          contract: LEADERBOARD_CONTRACT,
          method: "LEADERBOARD_MANAGER_ROLE",
          params: []
        }),
        // Check if wallet has roles
        readContract({
          contract: LEADERBOARD_CONTRACT,
          method: "hasRole",
          params: [0x0000000000000000000000000000000000000000000000000000000000000000n, account.address] // DEFAULT_ADMIN_ROLE is bytes32(0)
        }),
        readContract({
          contract: LEADERBOARD_CONTRACT,
          method: "hasRole",
          params: [defaultAdminRole, account.address]
        }),
        readContract({
          contract: LEADERBOARD_CONTRACT,
          method: "hasRole",
          params: [managerRole, account.address]
        })
      ]);

      const roles = {
        hasDefaultAdminRole: hasDefaultAdmin,
        hasAdminRole: hasAdmin,
        hasLeaderboardManagerRole: hasManager
      };

      addLog(`Admin roles: DEFAULT_ADMIN=${hasDefaultAdmin}, ADMIN=${hasAdmin}, MANAGER=${hasManager}`);
      
      if (!hasDefaultAdmin && !hasAdmin && !hasManager) {
        addLog('⚠️ Wallet has no admin roles - transactions will fail', 'error');
      }

      return roles;
    } catch (error) {
      addLog(`Failed to check admin roles: ${error}`, 'error');
      return {
        hasDefaultAdminRole: false,
        hasAdminRole: false,
        hasLeaderboardManagerRole: false
      };
    }
  };

  // Check cycle status
  const checkCycleStatus = async (cycle: number): Promise<CycleStatus> => {
    try {
      const isInitialized = await LeaderboardSyncService.isCycleInitialized(cycle);
      
      // If initialized, try to get stats
      let totalUpdates = 0;
      let leaderboardSize = 0;
      let lastUpdate = 0;
      
      if (isInitialized) {
        // TODO: Add stats fetching when cycle is initialized
      }

      return {
        cycle,
        initialized: isInitialized,
        totalUpdates,
        leaderboardSize,
        lastUpdate
      };
    } catch (error) {
      console.error(`Failed to check cycle ${cycle}:`, error);
      return {
        cycle,
        initialized: false,
        totalUpdates: 0,
        leaderboardSize: 0,
        lastUpdate: 0
      };
    }
  };

  // Load cycle statuses
  const loadCycleStatuses = async () => {
    setIsLoading(true);
    addLog('Loading cycle statuses...');
    
    try {
      // Check admin roles and cycle statuses in parallel
      const [roles, ...statuses] = await Promise.all([
        checkAdminRoles(),
        ...([1, 2, 3].map(cycle => checkCycleStatus(cycle)))
      ]);
      
      setAdminRoles(roles);
      setCycleStatuses(statuses);
      addLog(`Loaded status for ${statuses.length} cycles`);
      
      const initializedCount = statuses.filter(s => s.initialized).length;
      addLog(`Found ${initializedCount} initialized cycles`, 'success');
    } catch (error) {
      addLog(`Failed to load cycle statuses: ${error}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize a cycle
  const initializeCycle = async (cycle: number) => {
    if (!account) {
      addLog('Please connect your wallet first', 'error');
      return;
    }

    addLog(`Initializing cycle ${cycle}...`);

    try {
      const transaction = prepareContractCall({
        contract: LEADERBOARD_CONTRACT,
        method: "function initializeCycle(uint256 cycle)",
        params: [BigInt(cycle)]
      });

      sendTx(transaction, {
        onSuccess: (result) => {
          addLog(`Cycle ${cycle} initialized successfully!`, 'success');
          addLog(`Transaction hash: ${result.transactionHash}`, 'info');
          setTimeout(() => loadCycleStatuses(), 3000); // Reload after 3 seconds
        },
        onError: (error) => {
          addLog(`Failed to initialize cycle ${cycle}: ${error.message}`, 'error');
        }
      });
    } catch (error) {
      addLog(`Failed to prepare transaction: ${error}`, 'error');
    }
  };

  // Update leaderboard with voting data
  const updateLeaderboard = async (cycle: number) => {
    if (!account) {
      addLog('Please connect your wallet first', 'error');
      return;
    }

    addLog(`Updating leaderboard for cycle ${cycle}...`);

    try {
      // Get voting data for this cycle
      const votingData = await LeaderboardSyncService.getVotingDataForCycle(cycle);
      
      if (votingData.length === 0) {
        addLog(`No voting data found for cycle ${cycle}`, 'error');
        return;
      }

      const evermarkIds = votingData.map(v => v.evermarkId);
      addLog(`Found ${evermarkIds.length} evermarks with votes`);

      const transaction = prepareContractCall({
        contract: LEADERBOARD_CONTRACT,
        method: "function batchUpdateLeaderboard(uint256 cycle, uint256[] evermarkIds)",
        params: [BigInt(cycle), evermarkIds.map(id => BigInt(id))]
      });

      sendTx(transaction, {
        onSuccess: (result) => {
          addLog(`Leaderboard updated successfully for cycle ${cycle}!`, 'success');
          addLog(`Transaction hash: ${result.transactionHash}`, 'info');
          setTimeout(() => loadCycleStatuses(), 3000);
        },
        onError: (error) => {
          addLog(`Failed to update leaderboard: ${error.message}`, 'error');
        }
      });
    } catch (error) {
      addLog(`Failed to update leaderboard: ${error}`, 'error');
    }
  };

  // Load data on mount
  useEffect(() => {
    if (account) {
      loadCycleStatuses();
    }
  }, [account]);

  if (!account) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <Shield className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-4">Evermark Admin Panel</h1>
            <p className="text-gray-400 mb-6">
              Please connect your wallet to access admin functions
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <Settings className="h-8 w-8 text-cyan-400" />
            <div>
              <h1 className="text-3xl font-bold">Evermark Admin Panel</h1>
              <p className="text-gray-400">Manage leaderboard cycles and contract state</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={loadCycleStatuses}
              disabled={isLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            
            <div className="text-sm text-gray-400">
              <div>Connected: {account.address.slice(0, 6)}...{account.address.slice(-4)}</div>
            </div>
          </div>
        </div>

        {/* Admin Permissions Status */}
        {adminRoles && (
          <div className={`mb-6 p-4 rounded-lg border ${
            adminRoles.hasDefaultAdminRole || adminRoles.hasAdminRole || adminRoles.hasLeaderboardManagerRole
              ? 'bg-green-900/20 border-green-500/50'
              : 'bg-red-900/20 border-red-500/50'
          }`}>
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="h-5 w-5" />
              <h3 className="font-semibold">Admin Permissions</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                {adminRoles.hasDefaultAdminRole ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                )}
                <span>Default Admin</span>
              </div>
              <div className="flex items-center space-x-2">
                {adminRoles.hasAdminRole ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                )}
                <span>Admin Role</span>
              </div>
              <div className="flex items-center space-x-2">
                {adminRoles.hasLeaderboardManagerRole ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                )}
                <span>Manager Role</span>
              </div>
            </div>
            {!adminRoles.hasDefaultAdminRole && !adminRoles.hasAdminRole && !adminRoles.hasLeaderboardManagerRole && (
              <div className="mt-3 p-3 bg-red-900/30 rounded text-sm">
                <p className="text-red-300">
                  ⚠️ Your wallet does not have admin permissions on this contract. 
                  You need to use an admin wallet or request admin access to initialize cycles.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Cycle Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {cycleStatuses.map((status) => (
            <div key={status.cycle} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-blue-400" />
                  <h3 className="text-lg font-semibold">Cycle {status.cycle}</h3>
                </div>
                
                <div className="flex items-center">
                  {status.initialized ? (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                  )}
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-gray-300">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={status.initialized ? 'text-green-400' : 'text-red-400'}>
                    {status.initialized ? 'Initialized' : 'Not Initialized'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Updates:</span>
                  <span>{status.totalUpdates}</span>
                </div>
                <div className="flex justify-between">
                  <span>Entries:</span>
                  <span>{status.leaderboardSize}</span>
                </div>
              </div>
              
              <div className="flex space-x-2 mt-4">
                {!status.initialized ? (
                  <button
                    onClick={() => initializeCycle(status.cycle)}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Play className="h-3 w-3" />
                    <span>Initialize</span>
                  </button>
                ) : (
                  <button
                    onClick={() => updateLeaderboard(status.cycle)}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <BarChart3 className="h-3 w-3" />
                    <span>Update Data</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
            <Users className="h-5 w-5 text-purple-400" />
            <span>Quick Actions</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-300">Initialize New Cycle</h3>
              <div className="flex space-x-2">
                <select
                  value={selectedCycle}
                  onChange={(e) => setSelectedCycle(Number(e.target.value))}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-cyan-400"
                >
                  {[1, 2, 3, 4, 5].map(cycle => (
                    <option key={cycle} value={cycle}>Cycle {cycle}</option>
                  ))}
                </select>
                <button
                  onClick={() => initializeCycle(selectedCycle)}
                  disabled={isPending}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors disabled:opacity-50"
                >
                  Initialize Cycle {selectedCycle}
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-300">Beta Setup</h3>
              <div className="text-sm text-gray-400">
                <p>For beta launch:</p>
                <ol className="list-decimal list-inside space-y-1 mt-2">
                  <li>Initialize Cycle 1</li>
                  <li>Check for existing voting data</li>
                  <li>Update leaderboard if data exists</li>
                  <li>Test leaderboard display</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Activity Log</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  const logText = logs.join('\n');
                  navigator.clipboard.writeText(logText);
                  addLog('Console log copied to clipboard', 'success');
                }}
                disabled={logs.length === 0}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Copy All
              </button>
              <button
                onClick={() => setLogs([])}
                disabled={logs.length === 0}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="bg-gray-900 rounded p-4 max-h-64 overflow-y-auto select-text">
            {logs.length === 0 ? (
              <p className="text-gray-500 text-sm">No activity yet...</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="text-xs font-mono text-gray-300 select-text cursor-text">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Export buttons for sharing */}
          {logs.length > 0 && (
            <div className="mt-4 p-3 bg-gray-700 rounded text-sm">
              <p className="text-gray-300 mb-2">Share logs with developer:</p>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    const logText = `# Evermark Admin Console Log\n` +
                      `Timestamp: ${new Date().toISOString()}\n` +
                      `Wallet: ${account?.address}\n\n` +
                      logs.join('\n');
                    navigator.clipboard.writeText(logText);
                    addLog('Formatted log copied for sharing', 'success');
                  }}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                >
                  Copy for Sharing
                </button>
                <button
                  onClick={() => {
                    const logData = {
                      timestamp: new Date().toISOString(),
                      wallet: account?.address,
                      logs: logs,
                      cycleStatuses: cycleStatuses
                    };
                    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `evermark-admin-log-${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    addLog('Log data exported as JSON file', 'success');
                  }}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
                >
                  Export JSON
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}