import { createThirdwebClient } from 'thirdweb';
import { base } from 'thirdweb/chains';

export const client = createThirdwebClient({
  clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID || "your_client_id_here",
  ...(import.meta.env.VITE_THIRDWEB_SECRET_KEY && {
    secretKey: import.meta.env.VITE_THIRDWEB_SECRET_KEY
  })
});

export const chain = base;

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