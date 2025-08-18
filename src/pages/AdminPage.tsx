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
import { prepareContractCall, sendTransaction, readContract } from 'thirdweb';
import { useSendTransaction } from 'thirdweb/react';
import { client } from '@/lib/thirdweb';
import { base } from 'thirdweb/chains';
import { useActiveAccount } from 'thirdweb/react';
import EvermarkLeaderboardABI from '@/features/leaderboard/abis/EvermarkLeaderboard.json';
import EvermarkVotingABI from '@/features/voting/abis/EvermarkVoting.json';
import EvermarkNFTABI from '@/features/evermarks/abis/EvermarkNFT.json';
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

interface ContractStatus {
  nft: { initialized: boolean; totalSupply: number };
  voting: { initialized: boolean; currentCycle: number; hasAddresses: boolean };
  leaderboard: { initialized: boolean; hasAddresses: boolean };
}

export default function AdminPage() {
  const account = useActiveAccount();
  const { mutate: sendTx, isPending } = useSendTransaction();
  
  const [cycleStatuses, setCycleStatuses] = useState<CycleStatus[]>([]);
  const [adminRoles, setAdminRoles] = useState<AdminRoles | null>(null);
  const [contractStatus, setContractStatus] = useState<ContractStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState(1);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(1);

  const LEADERBOARD_CONTRACT = {
    client,
    chain: base,
    address: import.meta.env.VITE_EVERMARK_LEADERBOARD_ADDRESS || '',
    abi: EvermarkLeaderboardABI
  };

  const VOTING_CONTRACT = {
    client,
    chain: base,
    address: import.meta.env.VITE_EVERMARK_VOTING_ADDRESS || '',
    abi: EvermarkVotingABI
  };

  const NFT_CONTRACT = {
    client,
    chain: base,
    address: import.meta.env.VITE_EVERMARK_NFT_ADDRESS || '',
    abi: EvermarkNFTABI
  };

  // Add log entry
  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
    setLogs(prev => [logEntry, ...prev].slice(0, 50)); // Keep last 50 logs
    console.log(logEntry);
  };

  // Check all contract statuses
  const checkAllContractStatuses = async (): Promise<ContractStatus> => {
    try {
      addLog('Checking all contract statuses...');
      
      // Check NFT contract
      const nftTotalSupply = await readContract({
        contract: NFT_CONTRACT,
        method: "totalSupply",
        params: []
      });
      
      // Check voting contract addresses
      let votingInitialized = false;
      let currentCycle = 0;
      try {
        const cycle = await readContract({
          contract: VOTING_CONTRACT,
          method: "getCurrentCycle",
          params: []
        });
        currentCycle = Number(cycle);
        votingInitialized = true; // If we can call getCurrentCycle, it's initialized
        addLog(`Voting contract responding: current cycle ${currentCycle}`);
      } catch (error) {
        addLog('Voting contract not responding', 'error');
        // Try to check if contract has cardCatalog address set as fallback
        try {
          const cardCatalog = await readContract({
            contract: VOTING_CONTRACT,
            method: "cardCatalog",
            params: []
          });
          if (cardCatalog && cardCatalog !== '0x0000000000000000000000000000000000000000') {
            votingInitialized = true;
            addLog('Voting contract has cardCatalog set, treating as initialized');
          }
        } catch (catalogError) {
          addLog('Cannot determine voting contract status', 'error');
        }
      }
      
      // Check leaderboard contract addresses
      let leaderboardInitialized = false;
      try {
        const votingAddr = await readContract({
          contract: LEADERBOARD_CONTRACT,
          method: "evermarkVoting",
          params: []
        });
        leaderboardInitialized = votingAddr && votingAddr !== '0x0000000000000000000000000000000000000000';
        if (leaderboardInitialized) {
          addLog(`Leaderboard has voting address: ${votingAddr}`);
        }
      } catch (error) {
        addLog('Leaderboard contract not responding', 'error');
      }
      
      const status = {
        nft: { 
          initialized: true, 
          totalSupply: Number(nftTotalSupply) 
        },
        voting: { 
          initialized: votingInitialized, 
          currentCycle, 
          hasAddresses: votingInitialized 
        },
        leaderboard: { 
          initialized: leaderboardInitialized, 
          hasAddresses: leaderboardInitialized 
        }
      };
      
      addLog(`Contract Status - NFT: ${status.nft.totalSupply} minted, Voting: ${status.voting.initialized ? 'initialized' : 'not initialized'}, Leaderboard: ${status.leaderboard.initialized ? 'initialized' : 'not initialized'}`);
      
      return status;
    } catch (error) {
      addLog(`Failed to check contract statuses: ${error}`, 'error');
      return {
        nft: { initialized: false, totalSupply: 0 },
        voting: { initialized: false, currentCycle: 0, hasAddresses: false },
        leaderboard: { initialized: false, hasAddresses: false }
      };
    }
  };

  // Check if contract is already initialized
  const checkContractInitialization = async (): Promise<boolean> => {
    try {
      // Try to get a role constant - if this works, contract is initialized
      await readContract({
        contract: LEADERBOARD_CONTRACT,
        method: "DEFAULT_ADMIN_ROLE",
        params: []
      });
      return true;
    } catch (error) {
      return false;
    }
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

      // First check if contract is initialized
      const isInitialized = await checkContractInitialization();
      if (!isInitialized) {
        addLog('Contract is not initialized yet', 'error');
        return {
          hasDefaultAdminRole: false,
          hasAdminRole: false,
          hasLeaderboardManagerRole: false
        };
      }

      // Get role constants first
      const [defaultAdminRole, adminRole, managerRole] = await Promise.all([
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
        })
      ]);

      // Now check if wallet has these roles
      const [hasDefaultAdmin, hasAdmin, hasManager] = await Promise.all([
        readContract({
          contract: LEADERBOARD_CONTRACT,
          method: "hasRole",
          params: [defaultAdminRole, account.address]
        }),
        readContract({
          contract: LEADERBOARD_CONTRACT,
          method: "hasRole",
          params: [adminRole, account.address]
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
      
      if (hasDefaultAdmin || hasAdmin || hasManager) {
        addLog('✅ Contract is initialized and you have admin access!', 'success');
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

  // Check cycle status using the correct contract methods
  const checkCycleStatus = async (cycle: number): Promise<CycleStatus> => {
    try {
      // First try the simple finalized check
      const finalized = await readContract({
        contract: LEADERBOARD_CONTRACT,
        method: "isLeaderboardFinalized",
        params: [BigInt(cycle)]
      });
      
      if (finalized) {
        // If finalized, try to get detailed stats
        try {
          const [totalParticipants, totalVotes, rewardPool, isFinalized, finalizedAt] = await readContract({
            contract: LEADERBOARD_CONTRACT,
            method: "getCycleStats",
            params: [BigInt(cycle)]
          });
          
          return {
            cycle,
            initialized: true,
            totalUpdates: Number(totalVotes),
            leaderboardSize: Number(totalParticipants),
            lastUpdate: Number(finalizedAt)
          };
        } catch (statsError) {
          addLog(`Cycle ${cycle} is finalized but stats unavailable: ${statsError}`, 'info');
          return {
            cycle,
            initialized: true,
            totalUpdates: 0,
            leaderboardSize: 0,
            lastUpdate: 0
          };
        }
      } else {
        return {
          cycle,
          initialized: false,
          totalUpdates: 0,
          leaderboardSize: 0,
          lastUpdate: 0
        };
      }
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

  // Load all statuses
  const loadCycleStatuses = async () => {
    setIsLoading(true);
    addLog('Loading all contract and cycle statuses...');
    
    try {
      // Check admin roles, contract statuses, and cycle statuses in parallel
      const [roles, contractStat, ...statuses] = await Promise.all([
        checkAdminRoles(),
        checkAllContractStatuses(),
        ...([1, 2, 3].map(cycle => checkCycleStatus(cycle)))
      ]);
      
      setAdminRoles(roles);
      setContractStatus(contractStat);
      setCycleStatuses(statuses);
      addLog(`Loaded status for ${statuses.length} cycles`);
      
      const initializedCount = statuses.filter(s => s.initialized).length;
      addLog(`Found ${initializedCount} initialized cycles`, 'success');
      
      // Determine current step based on contract statuses
      if (!contractStat.voting.initialized) {
        setCurrentStep(1);
      } else if (contractStat.voting.currentCycle === 0) {
        setCurrentStep(2);
      } else if (!contractStat.leaderboard.initialized) {
        setCurrentStep(3);
      } else {
        setCurrentStep(4);
      }
      
    } catch (error) {
      addLog(`Failed to load statuses: ${error}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 1: Initialize Voting Contract
  const initializeVotingContract = async () => {
    if (!account) {
      addLog('Please connect your wallet first', 'error');
      return;
    }

    addLog('Step 1: Initializing voting contract...');

    try {
      const cardCatalogAddress = import.meta.env.VITE_CARD_CATALOG_ADDRESS || '';
      const nftAddress = import.meta.env.VITE_EVERMARK_NFT_ADDRESS || '';
      
      addLog(`Using Card Catalog address: ${cardCatalogAddress}`);
      addLog(`Using NFT address: ${nftAddress}`);
      
      const transaction = prepareContractCall({
        contract: VOTING_CONTRACT,
        method: "initialize",
        params: [cardCatalogAddress, nftAddress]
      });

      sendTx(transaction, {
        onSuccess: (result) => {
          addLog('✅ Voting contract initialized successfully!', 'success');
          addLog(`Transaction hash: ${result.transactionHash}`, 'info');
          setCurrentStep(2);
          setTimeout(() => checkAllContractStatuses().then(setContractStatus), 3000);
        },
        onError: (error) => {
          addLog(`Failed to initialize voting contract: ${error.message}`, 'error');
        }
      });
    } catch (error) {
      addLog(`Failed to prepare voting initialization: ${error}`, 'error');
    }
  };

  // STEP 2: Start First Voting Cycle  
  const startFirstVotingCycle = async () => {
    if (!account) {
      addLog('Please connect your wallet first', 'error');
      return;
    }

    addLog('Step 2: Starting first voting cycle...');

    try {
      const transaction = prepareContractCall({
        contract: VOTING_CONTRACT,
        method: "startNewVotingCycle",
        params: []
      });

      sendTx(transaction, {
        onSuccess: (result) => {
          addLog('✅ First voting cycle started successfully!', 'success');
          addLog(`Transaction hash: ${result.transactionHash}`, 'info');
          setCurrentStep(3);
          setTimeout(() => checkAllContractStatuses().then(setContractStatus), 3000);
        },
        onError: (error) => {
          addLog(`Failed to start voting cycle: ${error.message}`, 'error');
        }
      });
    } catch (error) {
      addLog(`Failed to prepare voting cycle start: ${error}`, 'error');
    }
  };

  // STEP 3: Initialize Leaderboard Contract
  const initializeLeaderboardContract = async () => {
    if (!account) {
      addLog('Please connect your wallet first', 'error');
      return;
    }

    addLog('Step 3: Initializing leaderboard contract...');

    try {
      const votingAddress = import.meta.env.VITE_EVERMARK_VOTING_ADDRESS || '';
      const nftAddress = import.meta.env.VITE_EVERMARK_NFT_ADDRESS || '';
      
      addLog(`Using voting address: ${votingAddress}`);
      addLog(`Using NFT address: ${nftAddress}`);
      
      const transaction = prepareContractCall({
        contract: LEADERBOARD_CONTRACT,
        method: "initialize",
        params: [
          votingAddress,
          nftAddress,
          '0x0000000000000000000000000000000000000000' // rewards contract (can be zero address)
        ]
      });

      sendTx(transaction, {
        onSuccess: (result) => {
          addLog('✅ Leaderboard contract initialized successfully!', 'success');
          addLog(`Transaction hash: ${result.transactionHash}`, 'info');
          addLog('🎉 All contracts initialized! Ready for testing!', 'success');
          setCurrentStep(4);
          setTimeout(() => {
            checkAllContractStatuses().then(setContractStatus);
            loadCycleStatuses();
          }, 3000);
        },
        onError: (error) => {
          addLog(`Failed to initialize leaderboard: ${error.message}`, 'error');
        }
      });
    } catch (error) {
      addLog(`Failed to prepare leaderboard initialization: ${error}`, 'error');
    }
  };

  // Finalize a cycle (this is how cycles get "initialized" in this contract)
  const finalizeCycle = async (cycle: number) => {
    if (!account) {
      addLog('Please connect your wallet first', 'error');
      return;
    }

    addLog(`Finalizing cycle ${cycle}...`);

    try {
      const transaction = prepareContractCall({
        contract: LEADERBOARD_CONTRACT,
        method: "finalizeLeaderboard",
        params: [BigInt(cycle)]
      });

      sendTx(transaction, {
        onSuccess: (result) => {
          addLog(`Cycle ${cycle} finalized successfully!`, 'success');
          addLog(`Transaction hash: ${result.transactionHash}`, 'info');
          setTimeout(() => loadCycleStatuses(), 3000);
        },
        onError: (error) => {
          addLog(`Failed to finalize cycle ${cycle}: ${error.message}`, 'error');
          addLog('Trying emergency finalization instead...', 'info');
          emergencyFinalizeCycle(cycle);
        }
      });
    } catch (error) {
      addLog(`Failed to finalize cycle: ${error}`, 'error');
    }
  };

  // Emergency finalize cycle (bypasses voting requirements)
  const emergencyFinalizeCycle = async (cycle: number) => {
    if (!account) {
      addLog('Please connect your wallet first', 'error');
      return;
    }

    addLog(`Emergency finalizing cycle ${cycle}...`);

    try {
      const transaction = prepareContractCall({
        contract: LEADERBOARD_CONTRACT,
        method: "emergencyFinalizeLeaderboard",
        params: [BigInt(cycle)]
      });

      sendTx(transaction, {
        onSuccess: (result) => {
          addLog(`Cycle ${cycle} emergency finalized!`, 'success');
          addLog(`Transaction hash: ${result.transactionHash}`, 'info');
          addLog('Cycle is now finalized (empty leaderboard)', 'info');
          setTimeout(() => loadCycleStatuses(), 3000);
        },
        onError: (error) => {
          addLog(`Failed to emergency finalize cycle ${cycle}: ${error.message}`, 'error');
        }
      });
    } catch (error) {
      addLog(`Failed to emergency finalize cycle: ${error}`, 'error');
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
                    onClick={() => finalizeCycle(status.cycle)}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Play className="h-3 w-3" />
                    <span>Finalize</span>
                  </button>
                ) : (
                  <button
                    onClick={() => emergencyFinalizeCycle(status.cycle)}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <BarChart3 className="h-3 w-3" />
                    <span>Emergency Finalize</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Contract Status Overview */}
        {contractStatus && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className={`p-4 rounded-lg border ${
              contractStatus.nft.initialized ? 'bg-green-900/20 border-green-500/50' : 'bg-red-900/20 border-red-500/50'
            }`}>
              <h3 className="font-semibold mb-2 flex items-center space-x-2">
                <span>🎨 EvermarkNFT</span>
                {contractStatus.nft.initialized ? <CheckCircle className="h-4 w-4 text-green-400" /> : <AlertTriangle className="h-4 w-4 text-red-400" />}
              </h3>
              <p className="text-sm">{contractStatus.nft.totalSupply} NFTs minted</p>
            </div>
            
            <div className={`p-4 rounded-lg border ${
              contractStatus.voting.initialized ? 'bg-green-900/20 border-green-500/50' : 'bg-red-900/20 border-red-500/50'
            }`}>
              <h3 className="font-semibold mb-2 flex items-center space-x-2">
                <span>🗺️ EvermarkVoting</span>
                {contractStatus.voting.initialized ? <CheckCircle className="h-4 w-4 text-green-400" /> : <AlertTriangle className="h-4 w-4 text-red-400" />}
              </h3>
              <p className="text-sm">
                {contractStatus.voting.initialized ? `Cycle ${contractStatus.voting.currentCycle}` : 'Not initialized'}
              </p>
            </div>
            
            <div className={`p-4 rounded-lg border ${
              contractStatus.leaderboard.initialized ? 'bg-green-900/20 border-green-500/50' : 'bg-red-900/20 border-red-500/50'
            }`}>
              <h3 className="font-semibold mb-2 flex items-center space-x-2">
                <span>🏆 EvermarkLeaderboard</span>
                {contractStatus.leaderboard.initialized ? <CheckCircle className="h-4 w-4 text-green-400" /> : <AlertTriangle className="h-4 w-4 text-red-400" />}
              </h3>
              <p className="text-sm">
                {contractStatus.leaderboard.initialized ? 'Initialized' : 'Not initialized'}
              </p>
            </div>
          </div>
        )}

        {/* Step-by-Step Initialization */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-semibold mb-6 flex items-center space-x-2">
            <Settings className="h-5 w-5 text-cyan-400" />
            <span>Contract Initialization Wizard</span>
          </h2>
          
          <div className="space-y-6">
            {/* Step 1: Initialize Voting Contract */}
            <div className={`p-4 rounded-lg border ${
              currentStep === 1 ? 'border-cyan-400 bg-cyan-900/20' : 
              currentStep > 1 ? 'border-green-500 bg-green-900/20' : 
              'border-gray-600 bg-gray-700/20'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center space-x-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                    currentStep > 1 ? 'bg-green-500 text-black' : 
                    currentStep === 1 ? 'bg-cyan-400 text-black' : 
                    'bg-gray-600 text-white'
                  }`}>1</span>
                  <span>Initialize Voting Contract</span>
                </h3>
                {currentStep > 1 && <CheckCircle className="h-5 w-5 text-green-400" />}
              </div>
              <p className="text-sm text-gray-300 mb-3">
                Connect the voting contract to Card Catalog and NFT contracts
              </p>
              {currentStep === 1 && (
                <button
                  onClick={initializeVotingContract}
                  disabled={isPending}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded font-medium transition-colors disabled:opacity-50"
                >
                  🚀 Initialize Voting Contract
                </button>
              )}
            </div>

            {/* Step 2: Start Voting Cycle */}
            <div className={`p-4 rounded-lg border ${
              currentStep === 2 ? 'border-cyan-400 bg-cyan-900/20' : 
              currentStep > 2 ? 'border-green-500 bg-green-900/20' : 
              'border-gray-600 bg-gray-700/20'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center space-x-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                    currentStep > 2 ? 'bg-green-500 text-black' : 
                    currentStep === 2 ? 'bg-cyan-400 text-black' : 
                    'bg-gray-600 text-white'
                  }`}>2</span>
                  <span>Start First Voting Cycle</span>
                </h3>
                {currentStep > 2 && <CheckCircle className="h-5 w-5 text-green-400" />}
              </div>
              <p className="text-sm text-gray-300 mb-3">
                Create the first voting cycle for users to delegate votes
              </p>
              {currentStep === 2 && (
                <button
                  onClick={startFirstVotingCycle}
                  disabled={isPending}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded font-medium transition-colors disabled:opacity-50"
                >
                  🗺️ Start Voting Cycle
                </button>
              )}
            </div>

            {/* Step 3: Initialize Leaderboard */}
            <div className={`p-4 rounded-lg border ${
              currentStep === 3 ? 'border-cyan-400 bg-cyan-900/20' : 
              currentStep > 3 ? 'border-green-500 bg-green-900/20' : 
              'border-gray-600 bg-gray-700/20'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center space-x-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                    currentStep > 3 ? 'bg-green-500 text-black' : 
                    currentStep === 3 ? 'bg-cyan-400 text-black' : 
                    'bg-gray-600 text-white'
                  }`}>3</span>
                  <span>Initialize Leaderboard Contract</span>
                </h3>
                {currentStep > 3 && <CheckCircle className="h-5 w-5 text-green-400" />}
              </div>
              <p className="text-sm text-gray-300 mb-3">
                Connect leaderboard to voting and NFT contracts for final rankings
              </p>
              {currentStep === 3 && (
                <button
                  onClick={initializeLeaderboardContract}
                  disabled={isPending}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded font-medium transition-colors disabled:opacity-50"
                >
                  🏆 Initialize Leaderboard
                </button>
              )}
            </div>

            {/* Step 4: Ready for Use */}
            {currentStep >= 4 && (
              <div className="p-4 rounded-lg border border-green-500 bg-green-900/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-green-500 text-black flex items-center justify-center text-sm">4</span>
                    <span>System Ready!</span>
                  </h3>
                  <CheckCircle className="h-5 w-5 text-green-400" />
                </div>
                <p className="text-sm text-gray-300 mb-3">
                  🎉 All contracts are initialized and ready for use! You can now finalize leaderboard cycles.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
            <Users className="h-5 w-5 text-purple-400" />
            <span>Quick Actions</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-300">Finalize Cycle</h3>
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
                  onClick={() => finalizeCycle(selectedCycle)}
                  disabled={isPending}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors disabled:opacity-50"
                >
                  Finalize Cycle {selectedCycle}
                </button>
              </div>
              <div className="text-xs text-gray-400">
                ⚠️ If normal finalization fails, try emergency finalization from cycle cards above
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-300">Contract Status</h3>
              <div className="text-sm text-gray-400">
                <div className="space-y-2">
                  <div>Contract: 0x89117B7a9ef008d27443fC3845a5E2AB7C75eae0</div>
                  <div>Voting: 0x174cEA217d2331880E6c1ccA9DD9a5F59A28178D</div>
                  <div>NFT: 0x12cB9a1fAfcC389dafCd80cC0eD49739DdB4EdCc</div>
                  <div className="text-yellow-400">
                    🔧 Contract may need voting system setup first
                  </div>
                </div>
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