import React from 'react';

export default function MiniAppExplore() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-center">Explore</h1>
      <p className="text-gray-400 text-center">Browse all evermarks in the mini app</p>
      
      <div className="grid gap-4">
        {[1, 2, 3, 4, 5].map((id) => (
          <div key={id} className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded"></div>
              <div className="flex-1">
                <h3 className="font-medium">Evermark #{id}</h3>
                <p className="text-sm text-gray-400">Sample content preview</p>
                <div className="flex items-center mt-2 text-xs text-gray-500 space-x-3">
                  <span>🗳️ {Math.floor(Math.random() * 100)} votes</span>
                  <span>💎 {(Math.random() * 5).toFixed(1)} EMARK</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}