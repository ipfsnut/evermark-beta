import React, { useEffect, ReactNode } from 'react';
import { useFarcasterSDK } from './hooks/useFarcasterSDK';

interface MiniAppLayoutProps {
  children: ReactNode;
}

export function MiniAppLayout({ children }: MiniAppLayoutProps) {
  const { isSDKReady, context, error } = useFarcasterSDK();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Mini App specific header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-2 text-center">
        <h1 className="text-sm font-bold">Evermark Mini App</h1>
        {context?.user && (
          <p className="text-xs opacity-75">Welcome, @{context.user.username}</p>
        )}
      </div>

      {/* Error state for SDK issues */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/20 p-3 m-2 rounded">
          <p className="text-red-400 text-sm">Farcaster SDK Error: {error}</p>
        </div>
      )}

      {/* Main content */}
      <div className="p-4">
        {children}
      </div>

      {/* Mini App specific footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/80 backdrop-blur-sm p-2">
        <div className="flex justify-around">
          <button className="text-xs text-gray-400">Home</button>
          <button className="text-xs text-gray-400">Explore</button>
          <button className="text-xs text-gray-400">Create</button>
        </div>
      </div>
    </div>
  );
}