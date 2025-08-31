// src/providers/BlockchainProvider.tsx - Simple blockchain state management
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { validateContractAddresses } from '../lib/contracts';

interface BlockchainState {
  isConnected: boolean;
  address: string | null;
  isContractsValid: boolean;
  missingContracts: string[];
  networkName: string;
  networkId: number;
}

interface BlockchainContextType {
  state: BlockchainState;
  refreshContracts: () => void;
}

const BlockchainContext = createContext<BlockchainContextType | null>(null);

interface BlockchainProviderProps {
  children: ReactNode;
}

export function BlockchainProvider({ children }: BlockchainProviderProps) {
  const account = useActiveAccount();
  
  // Validate contract configuration
  const contractValidation = validateContractAddresses();
  
  const state: BlockchainState = {
    isConnected: !!account?.address,
    address: account?.address || null,
    isContractsValid: contractValidation.isValid,
    missingContracts: contractValidation.missing,
    networkName: 'Base',
    networkId: 8453
  };

  const refreshContracts = () => {
    // This would trigger a re-validation if needed
    console.log('Contract validation refreshed');
  };

  const value: BlockchainContextType = {
    state,
    refreshContracts
  };

  return (
    <BlockchainContext.Provider value={value}>
      {children}
    </BlockchainContext.Provider>
  );
}

export function useBlockchain(): BlockchainContextType {
  const context = useContext(BlockchainContext);
  if (!context) {
    throw new Error('useBlockchain must be used within BlockchainProvider');
  }
  return context;
}

// Convenience hooks
export function useBlockchainState() {
  const { state } = useBlockchain();
  return state;
}

export function useContractValidation() {
  const { state, refreshContracts } = useBlockchain();
  return {
    isValid: state.isContractsValid,
    missing: state.missingContracts,
    refresh: refreshContracts
  };
}