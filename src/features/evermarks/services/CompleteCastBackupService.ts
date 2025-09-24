import type { FarcasterCastData, CastVerification } from '../types';
import { MediaPreservationService } from './MediaPreservationService';
import { ThreadPreservationService } from './ThreadPreservationService';
import { FramePreservationService } from './FramePreservationService';
import { FarcasterService } from './FarcasterService';

const BACKUP_CONFIG = {
  API_BASE: import.meta.env.VITE_API_URL || '/.netlify/functions',
  BACKUP_VERSION: '2.0.0',
};

export interface CompleteCastBackup extends FarcasterCastData {
  backup_metadata: {
    version: string;
    preserved_at: string;
    preservation_id: string;
    storage: {
      ardrive?: string;
      ipfs?: string;
      supabase?: string;
    };
    completeness: {
      text: boolean;
      media: boolean;
      thread: boolean;
      frames: boolean;
      profiles: boolean;
    };
  };
}

export class CompleteCastBackupService {
  /**
   * Create a complete backup of a Farcaster cast
   */
  static async createCompleteBackup(
    castInput: string,
    options: {
      preserveMedia?: boolean;
      preserveThread?: boolean;
      preserveFrames?: boolean;
      preserveProfiles?: boolean;
    } = {}
  ): Promise<CompleteCastBackup> {
    const {
      preserveMedia = true,
      preserveThread = true,
      preserveFrames = true,
      preserveProfiles: _preserveProfiles = true,
    } = options;

    console.log('🚀 Starting complete cast backup for:', castInput);

    // Step 1: Fetch basic cast data
    const basicCastData = await FarcasterService.fetchCastMetadata(castInput);
    if (!basicCastData) {
      throw new Error('Failed to fetch cast metadata');
    }

    // Initialize complete backup object
    const backup: CompleteCastBackup = {
      ...basicCastData,
      preserved_at: new Date().toISOString(),
      backup_version: BACKUP_CONFIG.BACKUP_VERSION,
      backup_metadata: {
        version: BACKUP_CONFIG.BACKUP_VERSION,
        preserved_at: new Date().toISOString(),
        preservation_id: this.generatePreservationId(),
        storage: {},
        completeness: {
          text: true,
          media: false,
          thread: false,
          frames: false,
          profiles: false,
        },
      },
    };

    // Step 2: Preserve media content
    if (preserveMedia && basicCastData.embeds && basicCastData.embeds.length > 0) {
      console.log('📸 Preserving media content...');
      const preservedEmbeds = await this.preserveEmbeds(basicCastData.embeds);
      backup.embeds = preservedEmbeds;
      backup.backup_metadata.completeness.media = true;
    }

    // Step 3: Preserve thread and relationships
    if (preserveThread && basicCastData.castHash) {
      console.log('🧵 Preserving thread context...');
      const context = await ThreadPreservationService.buildConversationContext(
        basicCastData.castHash
      );
      
      backup.thread = context.thread || undefined;
      backup.parent_cast = context.parent || undefined;
      backup.mentioned_profiles = context.mentioned_profiles;
      backup.backup_metadata.completeness.thread = !!context.thread;
      backup.backup_metadata.completeness.profiles = context.mentioned_profiles.length > 0;
    }

    // Step 4: Preserve Frames
    if (preserveFrames && basicCastData.embeds) {
      console.log('🖼️ Preserving Frames...');
      const frames = await FramePreservationService.preserveFrames(basicCastData.embeds);
      if (frames.length > 0) {
        backup.frames = frames;
        backup.backup_metadata.completeness.frames = true;
      }
    }

    // Step 5: Generate verification data
    backup.verification = await this.generateVerification(backup);

    // Step 6: Store complete backup
    const storageResult = await this.storeBackup(backup);
    backup.backup_metadata.storage = storageResult;

    console.log('✅ Complete cast backup created:', backup.backup_metadata.preservation_id);
    return backup;
  }

  /**
   * Preserve embeds with media content
   */
  private static async preserveEmbeds(embeds: any[]): Promise<typeof embeds> {
    const preservedEmbeds: any[] = [];
    
    for (const embed of embeds) {
      const preservedEmbed = { ...embed };
      
      // Extract metadata
      if (embed.url) {
        preservedEmbed.metadata = await MediaPreservationService.extractEmbedMetadata(
          embed.url
        );
        
        // Preserve actual media content
        if (preservedEmbed.metadata?.type === 'image' || 
            preservedEmbed.metadata?.type === 'video' ||
            preservedEmbed.metadata?.type === 'gif') {
          preservedEmbed.preserved_content = await MediaPreservationService.preserveMedia(
            embed.url
          );
        }
      }
      
      preservedEmbeds.push(preservedEmbed);
    }
    
    return preservedEmbeds;
  }

  /**
   * Generate verification data for cast
   */
  private static async generateVerification(
    backup: CompleteCastBackup
  ): Promise<CastVerification> {
    // Calculate content hash
    const contentHash = await this.calculateContentHash(backup);
    
    return {
      content_hash: contentHash,
      blockchain_timestamp: new Date().toISOString(),
      // Additional verification data would be added here
      // such as signatures, merkle proofs, etc.
    };
  }

  /**
   * Calculate SHA-256 hash of cast content
   */
  private static async calculateContentHash(backup: CompleteCastBackup): Promise<string> {
    const content = JSON.stringify({
      castHash: backup.castHash,
      author: backup.author,
      content: backup.content,
      timestamp: backup.timestamp,
      embeds: backup.embeds?.map(e => e.url),
    });
    
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Store complete backup to storage systems
   */
  private static async storeBackup(
    backup: CompleteCastBackup
  ): Promise<CompleteCastBackup['backup_metadata']['storage']> {
    try {
      const response = await fetch(`${BACKUP_CONFIG.API_BASE}/store-cast-backup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backup),
      });

      if (!response.ok) {
        console.error('Failed to store backup:', response.statusText);
        return {};
      }

      const result = await response.json();
      return {
        ardrive: result.ardrive_tx,
        ipfs: result.ipfs_hash,
        supabase: result.supabase_id,
      };
    } catch (error) {
      console.error('Error storing backup:', error);
      return {};
    }
  }

  /**
   * Generate unique preservation ID
   */
  private static generatePreservationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `cast_${timestamp}_${random}`;
  }

  /**
   * Restore cast from backup
   */
  static async restoreFromBackup(
    preservationId: string
  ): Promise<CompleteCastBackup | null> {
    try {
      const response = await fetch(
        `${BACKUP_CONFIG.API_BASE}/restore-cast-backup?id=${preservationId}`
      );

      if (!response.ok) {
        console.error('Failed to restore backup:', response.statusText);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error restoring backup:', error);
      return null;
    }
  }

  /**
   * Check backup integrity
   */
  static async verifyBackupIntegrity(
    backup: CompleteCastBackup
  ): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Verify content hash
    if (backup.verification?.content_hash) {
      const calculatedHash = await this.calculateContentHash(backup);
      if (calculatedHash !== backup.verification.content_hash) {
        issues.push('Content hash mismatch');
      }
    }

    // Check media preservation
    if (backup.embeds) {
      for (const embed of backup.embeds) {
        if (embed.preserved_content && !embed.preserved_content.ardrive_tx) {
          issues.push(`Media not preserved: ${embed.url}`);
        }
      }
    }

    // Check completeness claims
    const metadata = backup.backup_metadata;
    if (metadata.completeness.thread && !backup.thread) {
      issues.push('Thread marked complete but missing data');
    }
    
    if (metadata.completeness.frames && (!backup.frames || backup.frames.length === 0)) {
      issues.push('Frames marked complete but missing data');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Create bulk backup for multiple casts
   */
  static async createBulkBackup(
    castInputs: string[],
    options?: Parameters<typeof CompleteCastBackupService.createCompleteBackup>[1]
  ): Promise<CompleteCastBackup[]> {
    const backups: CompleteCastBackup[] = [];
    
    // Process in batches to avoid overwhelming the API
    const BATCH_SIZE = 3;
    for (let i = 0; i < castInputs.length; i += BATCH_SIZE) {
      const batch = castInputs.slice(i, i + BATCH_SIZE);
      const batchBackups = await Promise.all(
        batch.map(input => 
          this.createCompleteBackup(input, options).catch(error => {
            console.error(`Failed to backup ${input}:`, error);
            return null;
          })
        )
      );
      
      backups.push(...batchBackups.filter(Boolean) as CompleteCastBackup[]);
    }
    
    return backups;
  }
}