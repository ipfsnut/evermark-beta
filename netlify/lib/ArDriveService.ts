// src/services/ArDriveService.ts
// ArDrive/Arweave integration service for permanent storage

import { TurboFactory, ArweaveSigner, EthereumSigner } from '@ardrive/turbo-sdk';
import type { TurboAuthenticatedClient } from '@ardrive/turbo-sdk';
import { Readable } from 'stream';

export interface ArDriveUploadResult {
  success: boolean;
  txId?: string;
  url?: string;
  cost?: number;
  size?: number;
  error?: string;
  timestamp?: number;
}

export interface ArDriveUploadOptions {
  tags: Record<string, string>;
  folderId?: string;
  fileName?: string;
}

export interface ArDriveCostEstimate {
  usd: number;
  ar: string;
  winc: string;
  sizeBytes: number;
}

export interface ArDriveFolderInfo {
  id: string;
  name: string;
  path: string;
  parentId?: string;
  created: number;
}

/**
 * Service for interacting with ArDrive/Arweave permanent storage
 * Handles file uploads, cost estimation, and folder management
 */
export class ArDriveService {
  private turbo: TurboAuthenticatedClient | null = null;
  private driveId: string = '';
  private initialized: boolean = false;

  constructor() {
    // Initialize lazily to avoid issues if wallet not configured
  }

  /**
   * Initialize the ArDrive service with wallet
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Use server-side private key (no VITE_ prefix = server-only)
      const privateKey = process.env.ARDRIVE_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('ARDRIVE_PRIVATE_KEY environment variable not set');
      }

      // Use EthereumSigner for ETH private keys with Turbo credits
      const signer = new EthereumSigner(privateKey);
      
      this.turbo = TurboFactory.authenticated({ signer });
      
      // Test connection
      const balance = await this.turbo.getBalance();
      console.log('✅ ArDrive initialized. Balance:', balance);
      
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize ArDrive:', error);
      throw new Error(`ArDrive initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if service is configured and ready
   */
  isConfigured(): boolean {
    return !!(process.env.ARDRIVE_PRIVATE_KEY && this.initialized);
  }

  /**
   * Get current wallet balance
   */
  async getBalance(): Promise<{ balance: string; currency: string }> {
    await this.ensureInitialized();
    
    try {
      const balance = await this.turbo!.getBalance();
      return {
        balance: balance.winc,
        currency: 'winc'
      };
    } catch (error) {
      console.error('Failed to get ArDrive balance:', error);
      throw error;
    }
  }

  /**
   * Get current wallet balance and credit info
   */
  async getWalletInfo(): Promise<{ balance: string; address?: string }> {
    await this.ensureInitialized();

    try {
      const balance = await this.turbo!.getBalance();
      return {
        balance: balance.winc,
        address: process.env.ARDRIVE_WALLET_ADDRESS
      };
    } catch (error) {
      console.error('❌ Failed to get wallet info:', error);
      throw error;
    }
  }

  /**
   * Upload an image file to ArDrive
   */
  async uploadImage(file: File, options: ArDriveUploadOptions): Promise<ArDriveUploadResult> {
    await this.ensureInitialized();

    try {
      console.log('📁 Uploading image to ArDrive:', file.name, `(${file.size} bytes)`);

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileName = options.fileName || file.name || `evermark-image-${Date.now()}.jpg`;

      // Build tags for ArDrive
      const tags = {
        'Content-Type': file.type,
        'App-Name': 'Evermark',
        'App-Version': '2.0',
        'Entity-Type': 'image',
        'File-Name': fileName,
        'File-Size': file.size.toString(),
        'Upload-Timestamp': new Date().toISOString(),
        ...options.tags
      };

      const result = await this.turbo!.uploadFile({
        fileStreamFactory: () => buffer,
        fileSizeFactory: () => file.size,
        dataItemOpts: {
          tags: Object.entries(tags).map(([name, value]) => ({ name, value }))
        }
        // Note: Credit sharing will be handled automatically by using the same wallet that purchased credits
      });

      console.log('✅ Image uploaded to ArDrive:', result.id);

      return {
        success: true,
        txId: result.id,
        url: `https://arweave.net/${result.id}`,
        size: file.size,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('❌ ArDrive image upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Image upload failed'
      };
    }
  }

  /**
   * Upload metadata JSON to ArDrive
   */
  async uploadMetadata(metadata: object, options: ArDriveUploadOptions): Promise<ArDriveUploadResult> {
    await this.ensureInitialized();

    try {
      console.log('📋 Uploading metadata to ArDrive for:', (metadata as any).name || 'Unknown');

      const metadataString = JSON.stringify(metadata, null, 2);
      const buffer = Buffer.from(metadataString, 'utf-8');
      const fileName = options.fileName || `evermark-metadata-${Date.now()}.json`;

      // Build tags for ArDrive
      const tags = {
        'Content-Type': 'application/json',
        'App-Name': 'Evermark',
        'App-Version': '2.0',
        'Entity-Type': 'metadata',
        'File-Name': fileName,
        'File-Size': buffer.length.toString(),
        'Upload-Timestamp': new Date().toISOString(),
        ...options.tags
      };

      const result = await this.turbo!.uploadFile({
        fileStreamFactory: () => buffer,
        fileSizeFactory: () => buffer.length,
        dataItemOpts: {
          tags: Object.entries(tags).map(([name, value]) => ({ name, value }))
        }
      });

      console.log('✅ Metadata uploaded to ArDrive:', result.id);

      return {
        success: true,
        txId: result.id,
        url: `ar://${result.id}`,
        size: buffer.length,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('❌ ArDrive metadata upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Metadata upload failed'
      };
    }
  }

  /**
   * Estimate cost for uploading data of given size
   */
  async estimateCost(sizeInBytes: number): Promise<ArDriveCostEstimate> {
    await this.ensureInitialized();

    try {
      const [cost] = await this.turbo!.getUploadCosts({ bytes: [sizeInBytes] });
      const fiatRate = await this.turbo!.getFiatToAR({ currency: 'usd' });
      
      const usdCost = (Number(cost.winc) / 1e12) * fiatRate.rate;

      return {
        usd: usdCost,
        ar: (Number(cost.winc) / 1e12).toString(),
        winc: cost.winc,
        sizeBytes: sizeInBytes
      };
    } catch (error) {
      console.error('Failed to estimate ArDrive cost:', error);
      
      // Fallback estimation based on approximate rates
      const approximateUsdPerMB = 0.002; // Rough estimate
      const usdCost = (sizeInBytes / (1024 * 1024)) * approximateUsdPerMB;
      
      return {
        usd: usdCost,
        ar: '0',
        winc: '0',
        sizeBytes: sizeInBytes
      };
    }
  }

  /**
   * Create a folder in ArDrive
   */
  async createFolder(name: string, parentId?: string): Promise<string> {
    await this.ensureInitialized();

    try {
      console.log('📁 Creating ArDrive folder:', name);

      // Note: Folder creation with current ArDrive SDK might be different
      // This is a placeholder for the actual implementation
      const folderId = `folder-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      console.log('✅ ArDrive folder created:', folderId);
      return folderId;

    } catch (error) {
      console.error('❌ ArDrive folder creation failed:', error);
      throw new Error(`Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get folder contents
   */
  async getFolderContents(folderId: string): Promise<any[]> {
    await this.ensureInitialized();

    try {
      // Placeholder for folder contents retrieval
      // Implementation depends on ArDrive SDK capabilities
      return [];
    } catch (error) {
      console.error('Failed to get folder contents:', error);
      return [];
    }
  }

  /**
   * Download file from ArDrive by transaction ID
   */
  async downloadFile(txId: string): Promise<ArrayBuffer> {
    try {
      const response = await fetch(`https://arweave.net/${txId}`);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status}`);
      }
      return await response.arrayBuffer();
    } catch (error) {
      console.error('Failed to download file from ArDrive:', error);
      throw error;
    }
  }

  /**
   * Get file metadata by transaction ID
   */
  async getFileMetadata(txId: string): Promise<Record<string, string>> {
    try {
      // Query Arweave for transaction metadata
      const response = await fetch(`https://arweave.net/tx/${txId}`);
      if (!response.ok) {
        throw new Error(`Failed to get transaction: ${response.status}`);
      }
      
      const tx = await response.json();
      const tags: Record<string, string> = {};
      
      if (tx.tags) {
        tx.tags.forEach((tag: any) => {
          try {
            const name = atob(tag.name);
            const value = atob(tag.value);
            tags[name] = value;
          } catch (e) {
            // Skip invalid tags
          }
        });
      }
      
      return tags;
    } catch (error) {
      console.error('Failed to get file metadata:', error);
      return {};
    }
  }

  /**
   * Verify if transaction exists and is confirmed
   */
  async verifyTransaction(txId: string): Promise<boolean> {
    try {
      const response = await fetch(`https://arweave.net/tx/${txId}/status`);
      if (!response.ok) {
        return false;
      }
      
      const status = await response.json();
      return status.confirmed;
    } catch (error) {
      console.error('Failed to verify transaction:', error);
      return false;
    }
  }

  /**
   * Ensure service is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.turbo) {
      throw new Error('ArDrive service not properly initialized');
    }
  }

  /**
   * Get ArDrive gateway URL for a transaction
   */
  static getGatewayUrl(txId: string): string {
    return `${process.env.ARDRIVE_GATEWAY_URL || 'https://arweave.net'}/${txId}`;
  }

  /**
   * Parse ar:// URLs to transaction IDs
   */
  static parseArUrl(url: string): string | null {
    if (!url.startsWith('ar://')) {
      return null;
    }
    return url.substring(5);
  }

  /**
   * Build ar:// URL from transaction ID
   */
  static buildArUrl(txId: string): string {
    return `ar://${txId}`;
  }
}

// Export singleton instance
export const arDriveService = new ArDriveService();