// src/components/AuthStatusComponent.tsx
// Debug component to show auth status and manual authentication

import React from 'react';
import { useUserForEvermarks } from '../providers/IntegratedUserProvider';
import { useActiveAccount } from 'thirdweb/react';

interface AuthStatusComponentProps {
  showDebugInfo?: boolean;
  className?: string;
}

export function AuthStatusComponent({ 
  showDebugInfo = true, 
  className = '' 
}: AuthStatusComponentProps) {
  const account = useActiveAccount();
  const {
    isAuthenticated,
    isWalletAuthenticated,
    canCreate,
    ensureWalletAuth,
    authenticateWallet,
    authError,
    isAuthenticating,
    user
  } = useUserForEvermarks();

  const handleAuthenticate = async () => {
    try {
      const success = await authenticateWallet();
      if (success) {
        console.log('✅ Manual authentication successful');
      }
    } catch (error) {
      console.error('❌ Manual authentication failed:', error);
    }
  };

  const handleEnsureAuth = async () => {
    try {
      const success = await ensureWalletAuth();
      if (success) {
        console.log('✅ Auth ensured successfully');
      }
    } catch (error) {
      console.error('❌ Ensure auth failed:', error);
    }
  };

  if (!showDebugInfo && canCreate) {
    return null; // Hide when everything is working
  }

  return (
    <div className={`bg-gray-800 border border-gray-600 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-3">
        🔐 Authentication Status
      </h3>
      
      {/* Status Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${account?.address ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm text-gray-300">
              Wallet: {account?.address ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isAuthenticated ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm text-gray-300">
              App Auth: {isAuthenticated ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isWalletAuthenticated ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span className="text-sm text-gray-300">
              Wallet Auth: {isWalletAuthenticated ? 'Authenticated' : 'Not Authenticated'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${canCreate ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm text-gray-300">
              Can Create: {canCreate ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {authError && (
        <div className="bg-red-900/30 border border-red-500/50 rounded p-3 mb-4">
          <p className="text-red-300 text-sm">{authError}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 mb-4">
        {account?.address && !isWalletAuthenticated && (
          <button
            onClick={handleAuthenticate}
            disabled={isAuthenticating}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded text-sm transition-colors"
          >
            {isAuthenticating ? 'Authenticating...' : '🔐 Sign Message'}
          </button>
        )}
        
        {account?.address && (
          <button
            onClick={handleEnsureAuth}
            disabled={isAuthenticating}
            className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded text-sm transition-colors"
          >
            {isAuthenticating ? 'Checking...' : '✅ Ensure Auth'}
          </button>
        )}
      </div>

      {/* Debug Info */}
      {showDebugInfo && (
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer hover:text-gray-300">Debug Info</summary>
          <div className="mt-2 p-2 bg-gray-900 rounded font-mono">
            <div>Wallet: {account?.address}</div>
            <div>User ID: {user?.id || 'None'}</div>
            <div>Auth Method: {user?.source || 'None'}</div>
            <div>Is Authenticating: {isAuthenticating.toString()}</div>
            <div>Timestamp: {new Date().toISOString()}</div>
          </div>
        </details>
      )}

      {/* Success State */}
      {canCreate && (
        <div className="bg-green-900/30 border border-green-500/50 rounded p-3">
          <p className="text-green-300 text-sm">
            ✅ Ready to create Evermarks! Authentication is complete.
          </p>
        </div>
      )}
    </div>
  );
}