// src/services/ArDriveSeasonService.ts
// Season-aware ArDrive service for organized permanent storage

import { ArDriveService, type ArDriveUploadResult, type ArDriveUploadOptions } from './ArDriveService';
import { type SeasonInfo } from './SeasonOracle';
import { ContractSeasonOracle } from './ContractSeasonOracle';

export interface SeasonUploadResult extends ArDriveUploadResult {
  season: SeasonInfo;
  folderPath: string;
  manifestUpdated?: boolean;
}

export interface SeasonManifest {
  season: SeasonInfo;
  created: string;
  status: 'active' | 'finalized';
  stats: {
    totalEvermarks: number;
    totalVotes: number;
    totalStorageCost: number;
    lastUpdated: string;
  };
  files: {
    evermarks: string[];
    votes: string[];
    leaderboard: string[];
  };
  arDrive: {
    folderId: string;
    manifestTx?: string;
    finalizedTx?: string;
  };
}

/**
 * Season-aware ArDrive service that organizes uploads by season
 * Handles folder creation, season manifests, and automated organization
 */
export class ArDriveSeasonService extends ArDriveService {
  private seasonOracle: ContractSeasonOracle;
  private folderCache: Map<string, string> = new Map();
  private manifestCache: Map<number, SeasonManifest> = new Map();

  constructor() {
    super();
    this.seasonOracle = new ContractSeasonOracle();
  }

  /**
   * Upload to current season with automatic folder management
   */
  async uploadToCurrentSeason(
    file: File, 
    type: 'image' | 'metadata' | 'thumbnail',
    additionalTags: Record<string, string> = {}
  ): Promise<SeasonUploadResult> {
    const seasonState = await this.seasonOracle.getCurrentState();
    return this.uploadToSeason(file, seasonState.current, type, additionalTags);
  }

  /**
   * Upload to specific season
   */
  async uploadToSeason(
    file: File,
    season: SeasonInfo,
    type: 'image' | 'metadata' | 'thumbnail',
    additionalTags: Record<string, string> = {}
  ): Promise<SeasonUploadResult> {
    try {
      // Ensure season folder structure exists
      const folderPath = await this.prepareSeasonFolder(season);
      
      // Get appropriate subfolder for content type
      const subfolderPath = `${folderPath}/${this.getSubfolderForType(type)}`;
      const subfolderId = await this.ensureFolderExists(subfolderPath);
      
      // Build comprehensive tags
      const tags = this.buildSeasonTags(season, type, additionalTags);
      
      // Generate season-aware filename
      const fileName = this.generateSeasonFileName(season, type, file);
      
      // Upload based on type
      let uploadResult: ArDriveUploadResult;
      if (type === 'metadata') {
        // Assume file contains metadata JSON
        const metadata = JSON.parse(await file.text());
        uploadResult = await this.uploadMetadata(metadata, {
          tags,
          folderId: subfolderId,
          fileName
        });
      } else {
        uploadResult = await this.uploadImage(file, {
          tags,
          folderId: subfolderId,
          fileName
        });
      }

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      // Update season manifest
      await this.updateSeasonManifest(season.number, {
        type,
        txId: uploadResult.txId!,
        size: uploadResult.size || 0,
        cost: uploadResult.cost || 0
      });

      return {
        ...uploadResult,
        season,
        folderPath: subfolderPath,
        manifestUpdated: true
      };

    } catch (error) {
      console.error('Season upload failed:', error);
      throw new Error(`Season upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Prepare season folder structure
   */
  async prepareSeasonFolder(season: SeasonInfo): Promise<string> {
    const folderPath = await this.seasonOracle.getSeasonFolderPathAsync(season);
    
    // Check cache first
    if (this.folderCache.has(folderPath)) {
      return folderPath;
    }

    try {
      // Create main season folder
      const seasonFolderId = await this.ensureFolderExists(folderPath);
      
      // Create subfolders
      const subfolders = ['evermarks', 'votes', 'leaderboard', 'rewards'];
      for (const subfolder of subfolders) {
        await this.ensureFolderExists(`${folderPath}/${subfolder}`);
      }

      // Initialize season manifest if it doesn't exist
      await this.initializeSeasonManifest(season, seasonFolderId);

      // Cache the folder path
      this.folderCache.set(folderPath, seasonFolderId);
      
      console.log(`✅ Season folder prepared: ${folderPath}`);
      return folderPath;

    } catch (error) {
      console.error('Failed to prepare season folder:', error);
      throw error;
    }
  }

  /**
   * Finalize season folder (called at end of season)
   */
  async finalizeSeasonFolder(seasonNumber: number): Promise<void> {
    try {
      const season = await this.seasonOracle.getSeasonInfoAsync(seasonNumber);
      const manifest = await this.getSeasonManifest(seasonNumber);
      
      if (!manifest) {
        throw new Error(`No manifest found for season ${seasonNumber}`);
      }

      // Update manifest status
      manifest.status = 'finalized';
      manifest.stats.lastUpdated = new Date().toISOString();

      // Upload final manifest
      const manifestData = JSON.stringify(manifest, null, 2);
      const manifestFile = new File([manifestData], `season-${seasonNumber}-final-manifest.json`, {
        type: 'application/json'
      });

      const finalManifestResult = await this.uploadToSeason(
        manifestFile,
        season,
        'metadata',
        { 'Entity-Subtype': 'final-manifest' }
      );

      if (finalManifestResult.success) {
        manifest.arDrive.finalizedTx = finalManifestResult.txId;
        this.manifestCache.set(seasonNumber, manifest);
      }

      console.log(`✅ Season ${seasonNumber} folder finalized`);

    } catch (error) {
      console.error(`Failed to finalize season ${seasonNumber}:`, error);
      throw error;
    }
  }

  /**
   * Update season manifest with new upload
   */
  async updateSeasonManifest(
    seasonNumber: number,
    update: {
      type: string;
      txId: string;
      size: number;
      cost: number;
    }
  ): Promise<void> {
    try {
      let manifest = await this.getSeasonManifest(seasonNumber);
      
      if (!manifest) {
        const season = await this.seasonOracle.getSeasonInfoAsync(seasonNumber);
        manifest = await this.createDefaultManifest(season);
      }

      // Update stats
      manifest.stats.totalStorageCost += update.cost;
      manifest.stats.lastUpdated = new Date().toISOString();

      // Add to appropriate file list
      if (update.type === 'image' || update.type === 'metadata') {
        manifest.files.evermarks.push(update.txId);
        manifest.stats.totalEvermarks++;
      } else if (update.type === 'vote') {
        manifest.files.votes.push(update.txId);
      } else if (update.type === 'leaderboard') {
        manifest.files.leaderboard.push(update.txId);
      }

      // Cache updated manifest
      this.manifestCache.set(seasonNumber, manifest);

      console.log(`📋 Season ${seasonNumber} manifest updated`);

    } catch (error) {
      console.error('Failed to update season manifest:', error);
      // Don't throw - manifest updates shouldn't block uploads
    }
  }

  /**
   * Get season manifest
   */
  async getSeasonManifest(seasonNumber: number): Promise<SeasonManifest | null> {
    // Check cache first
    if (this.manifestCache.has(seasonNumber)) {
      return this.manifestCache.get(seasonNumber)!;
    }

    try {
      // TODO: Implement manifest retrieval from ArDrive
      // This would query ArDrive for the manifest file
      return null;
    } catch (error) {
      console.error('Failed to get season manifest:', error);
      return null;
    }
  }

  /**
   * Initialize season manifest
   */
  private async initializeSeasonManifest(season: SeasonInfo, folderId: string): Promise<void> {
    try {
      const manifest = await this.createDefaultManifest(season);
      manifest.arDrive.folderId = folderId;

      // Upload initial manifest
      const manifestData = JSON.stringify(manifest, null, 2);
      const manifestFile = new File([manifestData], `season-${season.number}-manifest.json`, {
        type: 'application/json'
      });

      const manifestResult = await this.uploadMetadata(manifest, {
        tags: this.buildSeasonTags(season, 'metadata', { 'Entity-Subtype': 'season-manifest' }),
        folderId,
        fileName: `season-${season.number}-manifest.json`
      });

      if (manifestResult.success) {
        manifest.arDrive.manifestTx = manifestResult.txId;
        this.manifestCache.set(season.number, manifest);
      }

    } catch (error) {
      console.error('Failed to initialize season manifest:', error);
      // Don't throw - this shouldn't block folder creation
    }
  }

  /**
   * Create default manifest structure
   */
  private async createDefaultManifest(season: SeasonInfo): Promise<SeasonManifest> {
    return {
      season,
      created: new Date().toISOString(),
      status: 'active',
      stats: {
        totalEvermarks: 0,
        totalVotes: 0,
        totalStorageCost: 0,
        lastUpdated: new Date().toISOString()
      },
      files: {
        evermarks: [],
        votes: [],
        leaderboard: []
      },
      arDrive: {
        folderId: ''
      }
    };
  }

  /**
   * Build comprehensive tags for season uploads
   */
  private buildSeasonTags(
    season: SeasonInfo,
    type: string,
    additionalTags: Record<string, string> = {}
  ): Record<string, string> {
    return {
      // Season identification
      'Season-Number': season.number.toString(),
      'Season-Year': season.year.toString(),
      'Season-Week': season.week,
      'Season-Status': season.status,
      
      // Content classification
      'Entity-Type': type,
      'Entity-Category': this.getSubfolderForType(type),
      
      // Timestamps
      'Season-Start': new Date(season.startTimestamp).toISOString(),
      'Season-End': new Date(season.endTimestamp).toISOString(),
      
      // Additional tags
      ...additionalTags
    };
  }

  /**
   * Generate season-aware filename
   */
  private generateSeasonFileName(season: SeasonInfo, type: string, file: File): string {
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'dat';
    
    // Extract token ID if present in filename or tags
    const tokenIdMatch = file.name.match(/(\d+)/);
    const tokenId = tokenIdMatch ? tokenIdMatch[1].padStart(5, '0') : 'XXXXX';
    
    return `${tokenId}_S${season.number}_${timestamp}_${type}.${extension}`;
  }

  /**
   * Get subfolder name for content type
   */
  private getSubfolderForType(type: string): string {
    switch (type) {
      case 'image':
      case 'metadata':
      case 'thumbnail':
        return 'evermarks';
      case 'vote':
        return 'votes';
      case 'leaderboard':
        return 'leaderboard';
      case 'reward':
        return 'rewards';
      default:
        return 'evermarks';
    }
  }

  /**
   * Ensure folder exists, create if not
   */
  private async ensureFolderExists(folderPath: string): Promise<string> {
    // Check cache
    if (this.folderCache.has(folderPath)) {
      return this.folderCache.get(folderPath)!;
    }

    try {
      // For now, generate a deterministic folder ID
      // In production, this would use ArDrive folder APIs
      const folderId = `folder-${folderPath.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;
      
      // Cache the folder ID
      this.folderCache.set(folderPath, folderId);
      
      return folderId;
    } catch (error) {
      console.error('Failed to ensure folder exists:', error);
      throw error;
    }
  }

  /**
   * Get season statistics
   */
  async getSeasonStats(seasonNumber: number): Promise<SeasonManifest['stats'] | null> {
    const manifest = await this.getSeasonManifest(seasonNumber);
    return manifest?.stats || null;
  }

  /**
   * List all files in a season
   */
  async listSeasonFiles(seasonNumber: number): Promise<string[]> {
    const manifest = await this.getSeasonManifest(seasonNumber);
    if (!manifest) return [];

    return [
      ...manifest.files.evermarks,
      ...manifest.files.votes,
      ...manifest.files.leaderboard
    ];
  }

  /**
   * Clear caches (useful for testing)
   */
  clearCaches(): void {
    this.folderCache.clear();
    this.manifestCache.clear();
    this.seasonOracle.clearCache();
  }
}

// Export singleton instance
export const arDriveSeasonService = new ArDriveSeasonService();