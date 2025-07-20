// src/lib/thirdweb.ts - Thirdweb client and provider setup

import { createThirdwebClient } from 'thirdweb';
import { ThirdwebProvider } from 'thirdweb/react';
import type { ReactNode } from 'react';

// Create the Thirdweb client
export const client = createThirdwebClient({
  clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID || 'your-client-id'
});

// Thirdweb Provider component
interface AppThirdwebProviderProps {
  children: ReactNode;
}

export function AppThirdwebProvider({ children }: AppThirdwebProviderProps) {
  return (
    <ThirdwebProvider>
      {children}
    </ThirdwebProvider>
  );
}