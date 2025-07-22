import { createThirdwebClient } from 'thirdweb';
import { ThirdwebProvider } from 'thirdweb/react';
import type { ReactNode } from 'react';

// Create the Thirdweb client with proper v5 syntax
export const client = createThirdwebClient({
  clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID || ''
});

// Verify client configuration
if (!import.meta.env.VITE_THIRDWEB_CLIENT_ID) {
  console.warn('⚠️ VITE_THIRDWEB_CLIENT_ID not configured - some features may not work');
}

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