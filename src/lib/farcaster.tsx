// src/lib/farcaster.tsx - Farcaster integration provider

import React, { createContext, useContext, useState, useEffect } from 'react';

interface FarcasterUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  verifiedAddresses: string[];
}

interface FarcasterContextType {
  isInFarcaster: boolean;
  isAuthenticated: boolean;
  user: FarcasterUser | null;
  getPrimaryAddress: () => string | null;
  getVerifiedAddresses: () => string[];
}

const FarcasterContext = createContext<FarcasterContextType | null>(null);

export function FarcasterProvider({ children }: { children: React.ReactNode }) {
  const [isInFarcaster] = useState(() => {
    return typeof window !== 'undefined' && 
           (window as any).__evermark_farcaster_detected === true;
  });
  
  const [isAuthenticated] = useState(false);
  const [user] = useState<FarcasterUser | null>(null);

  const getPrimaryAddress = () => {
    return user?.verifiedAddresses?.[0] || null;
  };

  const getVerifiedAddresses = () => {
    return user?.verifiedAddresses || [];
  };

  const value: FarcasterContextType = {
    isInFarcaster,
    isAuthenticated,
    user,
    getPrimaryAddress,
    getVerifiedAddresses
  };

  return (
    <FarcasterContext.Provider value={value}>
      {children}
    </FarcasterContext.Provider>
  );
}

export function useFarcasterUser(): FarcasterContextType {
  const context = useContext(FarcasterContext);
  if (!context) {
    throw new Error('useFarcasterUser must be used within FarcasterProvider');
  }
  return context;
}