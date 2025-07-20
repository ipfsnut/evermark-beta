export { CHAIN } from '../lib/contracts';

// Auth constants
export const AUTH_CONSTANTS = {
  SESSION_TOKEN_KEY: 'evermark_session_token',
  SESSION_DURATION_DAYS: 7,
};

// IPFS configuration
export const IPFS_CONFIG = {
  PINATA_API_KEY: import.meta.env.VITE_PINATA_API_KEY as string,
  PINATA_SECRET_KEY: import.meta.env.VITE_PINATA_SECRET_KEY as string,
  GATEWAY_URL: import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud',
};

// Network configuration
export const NETWORK_CONFIG = {
  RPC_URL: import.meta.env.VITE_RPC_URL || 'https://mainnet.base.org',
  CHAIN_ID: 8453, // Base Mainnet
};

// UI Configuration
export const UI_CONFIG = {
  ITEMS_PER_PAGE: 12,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
};