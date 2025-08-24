import React from 'react';
import { useFarcasterSDK } from './hooks/useFarcasterSDK';

export default function MiniAppHome() {
  const { isSDKReady, context, error } = useFarcasterSDK();

  if (error) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-bold text-red-400 mb-4">SDK Error</h2>
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  if (!isSDKReady) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Initializing Mini App...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="text-center">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          Welcome to Evermark
        </h1>
        {context?.user && (
          <div className="mt-4 p-4 bg-gray-800 rounded-lg">
            <div className="flex items-center justify-center space-x-3">
              {context.user.pfpUrl && (
                <img 
                  src={context.user.pfpUrl} 
                  alt="Profile" 
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div>
                <p className="font-medium">{context.user.displayName}</p>
                <p className="text-sm text-gray-400">@{context.user.username}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4">
        <button className="bg-purple-600 hover:bg-purple-700 p-4 rounded-lg text-center transition-colors">
          <div className="text-2xl mb-2">📖</div>
          <div className="font-medium">Browse</div>
          <div className="text-xs text-purple-200">Explore evermarks</div>
        </button>
        
        <button className="bg-blue-600 hover:bg-blue-700 p-4 rounded-lg text-center transition-colors">
          <div className="text-2xl mb-2">✨</div>
          <div className="font-medium">Create</div>
          <div className="text-xs text-blue-200">New evermark</div>
        </button>
      </div>

      {/* Recent evermarks preview */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Evermarks</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((id) => (
            <div key={id} className="bg-gray-800 p-3 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">Sample Evermark #{id}</h3>
                  <p className="text-sm text-gray-400 mt-1">Preserved content example...</p>
                  <div className="flex items-center mt-2 text-xs text-gray-500 space-x-3">
                    <span>🗳️ 42 votes</span>
                    <span>💎 0.1 EMARK</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}