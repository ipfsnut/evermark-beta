// netlify/lib/ContractSeasonOracle.ts
// Season Oracle that uses smart contracts as source of truth

import { createThirdwebClient, getContract, readContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { SeasonOracle, type SeasonInfo, type SeasonState } from './SeasonOracle';

/**
 * Contract-first Season Oracle
 * Uses voting contract as the authoritative source for seasons
 * Falls back to calculated seasons if contract is unavailable
 */
export class ContractSeasonOracle extends SeasonOracle {
  private client: any;
  private votingContract: any;
  private contractAddress: string;

  constructor() {
    super();
    
    // Initialize Thirdweb client
    this.client = createThirdwebClient({
      clientId: process.env.THIRDWEB_CLIENT_ID || process.env.VITE_THIRDWEB_CLIENT_ID!
    });

    this.contractAddress = process.env.VITE_EVERMARK_VOTING_ADDRESS!;
    
    if (!this.contractAddress) {
      throw new Error('VITE_EVERMARK_VOTING_ADDRESS not configured');
    }

    this.votingContract = getContract({
      client: this.client,
      chain: base,
      address: this.contractAddress
    });
  }

  /**
   * Get current season from voting contract first, fallback to calculation
   */
  override async getCurrentState(): Promise<SeasonState> {
    try {
      // Try to get from contract first
      const contractSeason = await this.getContractCurrentSeason();
      
      if (contractSeason) {
        console.log('🎯 Using contract season:', contractSeason.number);
        
        // Build full state using contract season as current
        const next = super.getSeasonInfo(contractSeason.number + 1);
        const previous = super.getSeasonInfo(Math.max(1, contractSeason.number - 1));
        const now = Date.now();

        return {
          current: contractSeason,
          next,
          previous,
          system: {
            lastChecked: now,
            lastTransition: contractSeason.startTimestamp,
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
      } else {
        console.log('⚠️ Contract unavailable, falling back to calculated season');
      }
    } catch (error) {
      console.error('⚠️ Contract season query failed:', error instanceof Error ? error.message : String(error));
      console.log('📊 Falling back to calculated season');
    }

    // Fallback to parent implementation (calculated seasons)
    return super.getCurrentState();
  }

  /**
   * Get season info - prefer contract data when available
   */
  async getSeasonInfoAsync(seasonNumber: number): Promise<SeasonInfo> {
    try {
      // If this is the current season according to contract, get live data
      const contractCurrentSeason = await this.getContractCurrentSeasonNumber();
      
      if (contractCurrentSeason && contractCurrentSeason === seasonNumber) {
        const contractSeason = await this.getContractCurrentSeason();
        if (contractSeason) {
          return contractSeason;
        }
      }
    } catch (error) {
      console.log('Contract season info unavailable for season', seasonNumber);
    }

    // Fallback to calculated season
    return super.getSeasonInfo(seasonNumber);
  }

  /**
   * Get season folder path - uses contract season numbering
   */
  async getSeasonFolderPathAsync(seasonInfo?: SeasonInfo): Promise<string> {
    if (!seasonInfo) {
      const state = await this.getCurrentState();
      seasonInfo = state.current;
    }
    
    return `season-${seasonInfo.number.toString().padStart(2, '0')}`;
  }

  /**
   * Get current season from voting contract
   */
  private async getContractCurrentSeason(): Promise<SeasonInfo | null> {
    try {
      // Get current season number
      const currentSeasonNumber = await readContract({
        contract: this.votingContract,
        method: "function getCurrentSeason() view returns (uint256)",
        params: []
      });

      if (!currentSeasonNumber) {
        return null;
      }

      // Get season details
      const seasonInfo = await readContract({
        contract: this.votingContract,
        method: "function getSeasonInfo(uint256 season) view returns (uint256 startTime, uint256 endTime, bool active, uint256 totalVotes)",
        params: [currentSeasonNumber]
      });

      if (!seasonInfo) {
        return null;
      }

      const [startTime, endTime, active, totalVotes] = seasonInfo as [bigint, bigint, boolean, bigint];
      
      // Convert to SeasonInfo format
      const startDate = new Date(Number(startTime) * 1000);
      const endDate = new Date(Number(endTime) * 1000);
      const now = new Date();
      
      // Determine actual status based on timestamps
      let status: SeasonInfo['status'];
      if (now < startDate) {
        status = 'preparing';
      } else if (now > endDate) {
        status = 'completed';
      } else {
        status = 'active';
      }

      // Get ISO week info
      const { year, week } = this.getISOWeek(startDate);

      return {
        number: Number(currentSeasonNumber),
        year,
        week,
        startTimestamp: Number(startTime) * 1000,
        endTimestamp: Number(endTime) * 1000,
        status,
        phase: 'voting'
      };

    } catch (error) {
      console.error('Failed to get contract season:', error);
      return null;
    }
  }

  /**
   * Get just the current season number from contract
   */
  private async getContractCurrentSeasonNumber(): Promise<number | null> {
    try {
      const currentSeasonNumber = await readContract({
        contract: this.votingContract,
        method: "function getCurrentSeason() view returns (uint256)",
        params: []
      });

      return currentSeasonNumber ? Number(currentSeasonNumber) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if contract seasons are available
   */
  async isContractAvailable(): Promise<boolean> {
    try {
      const seasonNumber = await this.getContractCurrentSeasonNumber();
      return seasonNumber !== null && seasonNumber > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get season comparison between contract and calculated
   */
  async getSeasonComparison(): Promise<{
    contract: { season: number; available: boolean };
    calculated: { season: number };
    aligned: boolean;
  }> {
    const calculatedState = await super.getCurrentState();
    const calculatedSeason = calculatedState.current.number;
    
    let contractSeason = 0;
    let contractAvailable = false;
    
    try {
      const contractSeasonNumber = await this.getContractCurrentSeasonNumber();
      if (contractSeasonNumber) {
        contractSeason = contractSeasonNumber;
        contractAvailable = true;
      }
    } catch (error) {
      console.log('Contract not available for comparison');
    }

    return {
      contract: { season: contractSeason, available: contractAvailable },
      calculated: { season: calculatedSeason },
      aligned: contractAvailable && contractSeason === calculatedSeason
    };
  }
}

// Export singleton
export const contractSeasonOracle = new ContractSeasonOracle();