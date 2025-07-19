/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Blockchain
  readonly VITE_THIRDWEB_CLIENT_ID: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_TESTNET_CHAIN_ID: string;

  // Database
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;

  // Farcaster
  readonly VITE_FARCASTER_DEVELOPER_FID?: string;
  readonly VITE_FARCASTER_DEVELOPER_MNEMONIC?: string;

  // Application
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_URL: string;
  readonly VITE_APP_VERSION: string;

  // Development
  readonly VITE_DEBUG_MODE?: string;
  readonly VITE_ENABLE_DEVTOOLS?: string;

  // Contract Addresses
  readonly VITE_EVERMARK_CONTRACT_ADDRESS: string;
  readonly VITE_EMARK_TOKEN_ADDRESS: string;
  readonly VITE_WEMARK_TOKEN_ADDRESS: string;
  readonly VITE_STAKING_CONTRACT_ADDRESS: string;
  readonly VITE_VOTING_CONTRACT_ADDRESS: string;

  // IPFS
  readonly VITE_PINATA_JWT?: string;
  readonly VITE_IPFS_GATEWAY: string;

  // Analytics
  readonly VITE_ANALYTICS_ID?: string;

  // Feature Flags
  readonly VITE_ENABLE_STAKING?: string;
  readonly VITE_ENABLE_VOTING?: string;
  readonly VITE_ENABLE_FARCASTER?: string;
  readonly VITE_ENABLE_SWAP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Global declarations
declare global {
  interface Window {
    __evermark_farcaster_detected?: boolean;
    FrameSDK?: any;
  }
}

export {};