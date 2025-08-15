import { createThirdwebClient, defineChain } from 'thirdweb';

export const client = createThirdwebClient({
  clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID || "your_client_id_here",
  // Removed secretKey to prevent auto-admin access in frontend
  // secretKey should only be used in backend/server environments
});

// Use Thirdweb's RPC for Base instead of public RPC
export const chain = defineChain({
  id: 8453,
  name: 'Base',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [`https://8453.rpc.thirdweb.com/${import.meta.env.VITE_THIRDWEB_CLIENT_ID}`],
    },
  },
  blockExplorers: {
    default: {
      name: 'BaseScan',
      url: 'https://basescan.org',
      apiUrl: 'https://api.basescan.org',
    },
  },
  testnet: false,
});

export const thirdwebConfig = {
  client,
  chain,
  
  wallets: [
    'io.metamask',
    'com.coinbase.wallet',
    'me.rainbow',
    'io.rabby',
    'io.zerion.wallet'
  ],
  
  appMetadata: {
    name: "Evermark Beta",
    description: "Content preservation on blockchain",
    url: typeof window !== 'undefined' ? window.location.origin : "https://evermark.app",
    icons: ["/logo.png"]
  },
  
  enableSocial: false, 
  
  enableAnalytics: false 
};

export const isThirdwebConfigured = (): boolean => {
  try {
    const hasClientId = !!import.meta.env.VITE_THIRDWEB_CLIENT_ID;
    const hasValidClient = !!client;
    
    console.log('🔧 Thirdweb config check:', {
      hasClientId,
      hasValidClient,
      clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID ? 'Set' : 'Missing'
    });
    
    return hasClientId && hasValidClient;
  } catch (error) {
    console.error('Thirdweb configuration check failed:', error);
    return false;
  }
};

export default client;