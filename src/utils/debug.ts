// src/utils/debug.ts - Dev-wallet-only logging utility
// Only show debug logs for the development wallet address

const DEV_WALLET = '0x3427b4716B90C11F9971e43999a48A47Cf5B571E'.toLowerCase();

// Get current wallet address from various sources
function getCurrentWallet(): string | null {
  // Try to get from window context or localStorage
  if (typeof window !== 'undefined') {
    try {
      // Check localStorage for cached wallet
      const cached = localStorage.getItem('evermark-wallet-address');
      if (cached) return cached.toLowerCase();
      
      // Check if wallet is available in global context (set by providers)
      if ((window as any).__evermark_current_wallet) {
        return (window as any).__evermark_current_wallet.toLowerCase();
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }
  
  return null;
}

// Dev-only logging functions
export const devLog = (...args: any[]) => {
  const currentWallet = getCurrentWallet();
  if (currentWallet === DEV_WALLET) {
    console.log('🔧 [DEV]', ...args);
  }
};

export const devWarn = (...args: any[]) => {
  const currentWallet = getCurrentWallet();
  if (currentWallet === DEV_WALLET) {
    console.warn('⚠️ [DEV]', ...args);
  }
};

export const devError = (...args: any[]) => {
  const currentWallet = getCurrentWallet();
  if (currentWallet === DEV_WALLET) {
    console.error('❌ [DEV]', ...args);
  }
};

export const devInfo = (...args: any[]) => {
  const currentWallet = getCurrentWallet();
  if (currentWallet === DEV_WALLET) {
    console.info('ℹ️ [DEV]', ...args);
  }
};

// Set current wallet (called by wallet providers)
export const setCurrentWallet = (address: string | null) => {
  if (typeof window !== 'undefined') {
    try {
      if (address) {
        localStorage.setItem('evermark-wallet-address', address.toLowerCase());
        (window as any).__evermark_current_wallet = address.toLowerCase();
      } else {
        localStorage.removeItem('evermark-wallet-address');
        delete (window as any).__evermark_current_wallet;
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }
};

// Check if current user is dev
export const isDevWallet = (): boolean => {
  return getCurrentWallet() === DEV_WALLET;
};

// Production-safe logging (always shows, but with clear prefixes)
export const prodLog = (...args: any[]) => {
  console.log('🔵 [EVERMARK]', ...args);
};

export const prodWarn = (...args: any[]) => {
  console.warn('🟡 [EVERMARK]', ...args);
};

export const prodError = (...args: any[]) => {
  console.error('🔴 [EVERMARK]', ...args);
};