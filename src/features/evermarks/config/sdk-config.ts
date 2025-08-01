import { createDefaultStorageConfig } from '@ipfsnut/evermark-sdk-core';
import { HybridStorageService } from '@ipfsnut/evermark-sdk-storage';
import { BrowserUtils } from '@ipfsnut/evermark-sdk-browser';
import type { HybridStorageConfig } from '@ipfsnut/evermark-sdk-core';

export function createEvermarkStorageConfig(): HybridStorageConfig {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const pinataJwt = import.meta.env.VITE_PINATA_JWT;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  const baseConfig = createDefaultStorageConfig(supabaseUrl, supabaseKey, 'evermark-images');

  return {
    ...baseConfig,
    ipfs: {
      enabled: !!pinataJwt,
      pinataJwt: pinataJwt || '',
      gateway: import.meta.env.VITE_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs',
      uploadEndpoint: 'https://api.pinata.cloud/pinning/pinFileToIPFS'
    },
    hybrid: {
      primaryStorage: 'supabase',
      backupStorage: 'ipfs',
      autoTransfer: true,
      transferDelay: 5000,
      fallbackStrategy: 'cascade'
    },
    browser: {
      enableCompression: true,
      maxFileSize: 10 * 1024 * 1024,
      supportedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      compressionQuality: 0.9
    }
  };
}

let storageConfigInstance: HybridStorageConfig | null = null;
let hybridStorageInstance: HybridStorageService | null = null;

export function getEvermarkStorageConfig(): HybridStorageConfig {
  if (!storageConfigInstance) {
    storageConfigInstance = createEvermarkStorageConfig();
  }
  return storageConfigInstance;
}

export function getEvermarkHybridStorage(): HybridStorageService {
  if (!hybridStorageInstance) {
    hybridStorageInstance = new HybridStorageService(createEvermarkStorageConfig());
  }
  return hybridStorageInstance;
}

export function getBrowserCapabilities() {
  return {
    supportsWebP: BrowserUtils.supportsWebP(),
    supportsCompression: BrowserUtils.supportsCanvasCompression(),
    supportsDragDrop: BrowserUtils.supportsDragAndDrop(),
    supportsFileApi: BrowserUtils.supportsFileAPI(),
    deviceInfo: BrowserUtils.getDeviceInfo(),
    connectionInfo: BrowserUtils.getConnectionInfo()
  };
}