// src/services/StorageService.ts
// Storage abstraction layer supporting both IPFS and ArDrive

import { pinataService, type IPFSUploadResult } from './PinataService';
import { FEATURES } from '@/config/features';

// ArDrive types (mirrored from server-side implementation)
export interface SeasonUploadResult {
  success: boolean;
  txId?: string;
  url?: string;
  cost?: number;
  size?: number;
  error?: string;
  timestamp?: number;
  season: any;
  folderPath: string;
  manifestUpdated?: boolean;
}

export interface UnifiedUploadResult {
  success: boolean;
  url: string;
  backend: 'ipfs' | 'ardrive' | 'dual';
  
  // IPFS specific
  hash?: string;
  ipfsUrl?: string;
  
  // ArDrive specific
  txId?: string;
  ardriveUrl?: string;
  season?: any;
  cost?: number;
  
  // Common
  size?: number;
  timestamp?: number;
  error?: string;
}

export interface StorageMetrics {
  backend: string;
  operation: string;
  success: boolean;
  durationMs: number;
  fileSizeBytes?: number;
  costUsd?: number;
  errorMessage?: string;
  timestamp: Date;
}

/**
 * Unified storage service that abstracts IPFS and ArDrive
 * Handles feature flags, dual storage, and metric collection
 */
export class StorageService {
  private metrics: StorageMetrics[] = [];

  constructor() {
    // Initialize based on feature flags
    console.log('🔧 StorageService initialized with backend:', FEATURES.getStorageBackend());
  }

  /**
   * Upload image with automatic backend selection
   */
  async uploadImage(file: File): Promise<UnifiedUploadResult> {
    const startTime = Date.now();
    const backend = this.getStorageBackend();
    
    console.log(`📁 Uploading image via ${backend}:`, file.name, `(${file.size} bytes)`);
    console.log('🔍 Storage backend configuration:', {
      backend,
      ardriveEnabled: FEATURES.isArDriveEnabled(),
      dualStorage: FEATURES.shouldUseDualStorage(),
      envVar: import.meta.env.VITE_STORAGE_BACKEND
    });

    try {
      if (backend === 'ardrive') {
        console.log('🚀 Calling uploadToArDrive...');
        return await this.uploadToArDrive(file, 'image');
      } else if (backend === 'dual') {
        console.log('🚀 Calling uploadDual...');
        return await this.uploadDual(file, 'image');
      } else {
        console.log('🚀 Calling uploadToIPFS...');
        return await this.uploadToIPFS(file, 'image');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      this.recordMetric({
        backend,
        operation: 'upload_image',
        success: false,
        durationMs: Date.now() - startTime,
        fileSizeBytes: file.size,
        errorMessage
      });

      console.error(`❌ Image upload failed (${backend}):`, error);
      
      return {
        success: false,
        url: '',
        backend: backend as any,
        error: errorMessage
      };
    }
  }

  /**
   * Upload metadata with automatic backend selection
   */
  async uploadMetadata(metadata: object): Promise<UnifiedUploadResult> {
    const startTime = Date.now();
    const backend = this.getStorageBackend();
    const metadataString = JSON.stringify(metadata, null, 2);
    const size = new Blob([metadataString]).size;
    
    console.log(`📋 Uploading metadata via ${backend}:`, (metadata as any).name || 'Unknown');

    try {
      if (backend === 'ardrive') {
        return await this.uploadMetadataToArDrive(metadata);
      } else if (backend === 'dual') {
        return await this.uploadMetadataDual(metadata);
      } else {
        return await this.uploadMetadataToIPFS(metadata);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Metadata upload failed';
      
      this.recordMetric({
        backend,
        operation: 'upload_metadata',
        success: false,
        durationMs: Date.now() - startTime,
        fileSizeBytes: size,
        errorMessage
      });

      console.error(`❌ Metadata upload failed (${backend}):`, error);
      
      return {
        success: false,
        url: '',
        backend: backend as any,
        error: errorMessage
      };
    }
  }

  /**
   * Estimate storage cost for given file size
   */
  async estimateCost(sizeInBytes: number): Promise<{ usd: number; ar?: string; backend: string }> {
    const backend = this.getStorageBackend();
    
    if (backend === 'ardrive' || backend === 'dual') {
      try {
        // Call ArDrive estimate API
        const response = await fetch('/.netlify/functions/ardrive-estimate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ size: sizeInBytes })
        });
        
        if (!response.ok) {
          throw new Error('Estimate failed');
        }
        
        const arDriveCost = await response.json();
        
        return {
          usd: arDriveCost.usd || 0,
          ar: arDriveCost.ar,
          backend: backend === 'dual' ? 'dual' : 'ardrive'
        };
      } catch (error) {
        console.warn('⚠️ ArDrive cost estimation failed:', error);
      }
    }
    
    // IPFS has no direct storage cost (subscription model)
    return {
      usd: 0,
      backend: 'ipfs'
    };
  }

  /**
   * Upload to ArDrive only (via API)
   */
  private async uploadToArDrive(file: File, type: 'image' | 'metadata'): Promise<UnifiedUploadResult> {
    const startTime = Date.now();
    
    console.log(`🔵 ArDrive upload started for ${type}:`, file.name);
    
    try {
      // Convert file to base64 for API transport
      const base64 = await this.fileToBase64(file);
      console.log(`🔵 Converted to base64, length: ${base64.length}`);
      
      // Call ArDrive upload API
      console.log(`🔵 Calling ArDrive API endpoint...`);
      const response = await fetch('/.netlify/functions/ardrive-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadType: type,
          image: base64,
          filename: file.name,
          contentType: file.type,
          tags: {
            'Content-Type': file.type,
            'Evermark-Type': type
          }
        })
      });
      
      console.log(`🔵 ArDrive API response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`🔴 ArDrive upload API error:`, errorText);
        throw new Error(`ArDrive upload failed: ${response.statusText}`);
      }
      
      const result = await response.json() as SeasonUploadResult;
      console.log(`🔵 ArDrive upload result:`, result);
      
      this.recordMetric({
        backend: 'ardrive',
        operation: `upload_${type}`,
        success: result.success,
        durationMs: Date.now() - startTime,
        fileSizeBytes: file.size,
        costUsd: result.cost
      });

      if (!result.success) {
        throw new Error(result.error || 'ArDrive upload failed');
      }

      return {
        success: true,
        url: result.url!,
        backend: 'ardrive',
        txId: result.txId,
        ardriveUrl: result.url,
        season: result.season,
        cost: result.cost,
        size: result.size,
        timestamp: result.timestamp
      };
    } catch (error) {
      this.recordMetric({
        backend: 'ardrive',
        operation: `upload_${type}`,
        success: false,
        durationMs: Date.now() - startTime,
        fileSizeBytes: file.size,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Upload to IPFS only
   */
  private async uploadToIPFS(file: File, type: 'image' | 'metadata'): Promise<UnifiedUploadResult> {
    const startTime = Date.now();
    
    try {
      const result = await pinataService.uploadImage(file);
      
      this.recordMetric({
        backend: 'ipfs',
        operation: `upload_${type}`,
        success: result.success,
        durationMs: Date.now() - startTime,
        fileSizeBytes: file.size
      });

      if (!result.success) {
        throw new Error(result.error || 'IPFS upload failed');
      }

      return {
        success: true,
        url: result.url!,
        backend: 'ipfs',
        hash: result.hash,
        ipfsUrl: result.url,
        size: file.size,
        timestamp: Date.now()
      };
    } catch (error) {
      this.recordMetric({
        backend: 'ipfs',
        operation: `upload_${type}`,
        success: false,
        durationMs: Date.now() - startTime,
        fileSizeBytes: file.size,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Upload metadata to ArDrive (via API)
   */
  private async uploadMetadataToArDrive(metadata: object): Promise<UnifiedUploadResult> {
    const startTime = Date.now();
    const metadataString = JSON.stringify(metadata, null, 2);
    const size = new Blob([metadataString]).size;
    
    try {
      // Call ArDrive upload API for metadata
      const response = await fetch('/.netlify/functions/ardrive-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadType: 'metadata',
          metadata: metadata,
          filename: `metadata-${Date.now()}.json`,
          contentType: 'application/json',
          tags: {
            'Content-Type': 'application/json',
            'Evermark-Type': 'metadata'
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`ArDrive metadata upload failed: ${response.statusText}`);
      }
      
      const result = await response.json() as SeasonUploadResult;
      
      this.recordMetric({
        backend: 'ardrive',
        operation: 'upload_metadata',
        success: result.success,
        durationMs: Date.now() - startTime,
        fileSizeBytes: size,
        costUsd: result.cost
      });

      if (!result.success) {
        throw new Error(result.error || 'ArDrive metadata upload failed');
      }

      return {
        success: true,
        url: result.url!,
        backend: 'ardrive',
        txId: result.txId,
        ardriveUrl: result.url,
        season: result.season,
        cost: result.cost,
        size,
        timestamp: result.timestamp
      };
    } catch (error) {
      this.recordMetric({
        backend: 'ardrive',
        operation: 'upload_metadata',
        success: false,
        durationMs: Date.now() - startTime,
        fileSizeBytes: size,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Upload metadata to IPFS
   */
  private async uploadMetadataToIPFS(metadata: object): Promise<UnifiedUploadResult> {
    const startTime = Date.now();
    const metadataString = JSON.stringify(metadata, null, 2);
    const blob = new Blob([metadataString], { type: 'application/json' });
    const file = new File([blob], 'metadata.json', { type: 'application/json' });
    
    try {
      const result = await pinataService.uploadMetadata(metadata);
      
      this.recordMetric({
        backend: 'ipfs',
        operation: 'upload_metadata',
        success: result.success,
        durationMs: Date.now() - startTime,
        fileSizeBytes: blob.size
      });

      if (!result.success) {
        throw new Error(result.error || 'IPFS metadata upload failed');
      }

      return {
        success: true,
        url: result.url!,
        backend: 'ipfs',
        hash: result.hash,
        ipfsUrl: result.url,
        size: blob.size,
        timestamp: Date.now()
      };
    } catch (error) {
      this.recordMetric({
        backend: 'ipfs',
        operation: 'upload_metadata',
        success: false,
        durationMs: Date.now() - startTime,
        fileSizeBytes: blob.size,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Dual upload to both IPFS and ArDrive
   */
  private async uploadDual(file: File, type: 'image' | 'metadata'): Promise<UnifiedUploadResult> {
    console.log(`📤 Starting dual upload for ${type}`);
    
    // Upload to both in parallel
    const [ipfsResult, ardriveResult] = await Promise.allSettled([
      type === 'metadata' 
        ? this.uploadMetadataToIPFS(file as any)
        : this.uploadToIPFS(file, type),
      type === 'metadata'
        ? this.uploadMetadataToArDrive(file as any)
        : this.uploadToArDrive(file, type)
    ]);

    // Check results
    const ipfsSuccess = ipfsResult.status === 'fulfilled' && ipfsResult.value.success;
    const ardriveSuccess = ardriveResult.status === 'fulfilled' && ardriveResult.value.success;

    // If ArDrive succeeded, use it as primary
    if (ardriveSuccess && ardriveResult.status === 'fulfilled') {
      const result = ardriveResult.value;
      return {
        ...result,
        backend: 'dual',
        ipfsUrl: ipfsSuccess && ipfsResult.status === 'fulfilled' ? ipfsResult.value.url : undefined,
        hash: ipfsSuccess && ipfsResult.status === 'fulfilled' ? ipfsResult.value.hash : undefined
      };
    }

    // Fall back to IPFS if ArDrive failed
    if (ipfsSuccess && ipfsResult.status === 'fulfilled') {
      const result = ipfsResult.value;
      return {
        ...result,
        backend: 'dual',
        error: ardriveSuccess ? undefined : 'ArDrive upload failed, using IPFS'
      };
    }

    // Both failed
    throw new Error('Both IPFS and ArDrive uploads failed');
  }

  /**
   * Dual metadata upload
   */
  private async uploadMetadataDual(metadata: object): Promise<UnifiedUploadResult> {
    const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    const file = new File([blob], 'metadata.json', { type: 'application/json' });
    return this.uploadDual(file, 'metadata');
  }

  /**
   * Get configured storage backend
   */
  private getStorageBackend(): 'ipfs' | 'ardrive' | 'dual' {
    return FEATURES.getStorageBackend();
  }

  /**
   * Record storage metric
   */
  private recordMetric(metric: Omit<StorageMetrics, 'timestamp'>) {
    this.metrics.push({
      ...metric,
      timestamp: new Date()
    });

    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  /**
   * Get storage metrics
   */
  getMetrics(): StorageMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get storage health status
   */
  async getHealthStatus(): Promise<{
    ipfs: boolean;
    ardrive: boolean;
    configured: boolean;
  }> {
    return {
      ipfs: await this.checkIPFSHealth(),
      ardrive: await this.checkArDriveHealth(),
      configured: true
    };
  }

  /**
   * Check IPFS service health
   */
  private async checkIPFSHealth(): Promise<boolean> {
    try {
      return pinataService.isConfigured();
    } catch {
      return false;
    }
  }

  /**
   * Check ArDrive service health (via API)
   */
  private async checkArDriveHealth(): Promise<boolean> {
    if (!FEATURES.isArDriveEnabled()) {
      return false;
    }

    try {
      // Check if ArDrive API is responding
      const response = await fetch('/.netlify/functions/ardrive-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size: 1024 }) // Test with 1KB
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check if storage service is configured
   */
  isConfigured(): boolean {
    const backend = this.getStorageBackend();
    if (backend === 'ipfs' || backend === 'dual') {
      return pinataService.isConfigured();
    }
    if (backend === 'ardrive') {
      return FEATURES.isArDriveEnabled();
    }
    return false;
  }

  /**
   * Convert file to base64 data URL
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }
}

// Singleton instance
export const storageService = new StorageService();