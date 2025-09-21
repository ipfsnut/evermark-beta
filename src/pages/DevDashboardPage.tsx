// src/pages/DevDashboardPage_updated.tsx
// Updated development dashboard with season management and storage status
// This replaces the existing DevDashboardPage.tsx file

import React from 'react';
import { Navigate } from 'react-router-dom';
import { WalletBalanceDashboard } from '../components/dev/WalletBalanceTracker';
import { ProtocolBalancesDashboard } from '../components/dev/ProtocolBalancesDashboard';
import { TreasuryHistoryAnalyzer } from '../components/dev/TreasuryHistoryAnalyzer';
import { useWalletAddress } from '../hooks/core/useWalletAccount';

// NEW IMPORTS
import { SeasonControlPanel } from '../features/admin/components/SeasonControlPanel';
import { StorageStatusPanel } from '../components/StorageStatusPanel';

// Development wallet address
const DEVELOPMENT_WALLET_ADDRESS = '0x3427b4716B90C11F9971e43999a48A47Cf5B571E';

function DevDashboardPage() {
  const walletAddress = useWalletAddress();
  
  // Check if connected wallet is the development wallet
  const isDevWallet = walletAddress?.toLowerCase() === DEVELOPMENT_WALLET_ADDRESS.toLowerCase();
  
  // Redirect to home if not connected with development wallet
  if (!isDevWallet) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Development Dashboard</h1>
        <p className="text-gray-600">
          Real-time monitoring of Evermark protocol, season management, and storage systems.
        </p>
      </div>

      {/* NEW: Season Management and Storage Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <SeasonControlPanel />
        <StorageStatusPanel />
      </div>

      {/* Existing Protocol Monitoring */}
      <WalletBalanceDashboard />
      <ProtocolBalancesDashboard />

      {/* Treasury History and Transaction Analysis */}
      <div className="mt-12">
        <TreasuryHistoryAnalyzer />
      </div>

      {/* Quick Actions and Tools */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Minting Stats - Keep as placeholder for now */}
        <div className="bg-white rounded-lg shadow p-6 border">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Minting Stats</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Evermarks:</span>
              <span className="font-mono">--</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Today's Mints:</span>
              <span className="font-mono">--</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Fees Collected Today:</span>
              <span className="font-mono">-- ETH</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Connect to database for live stats
          </p>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-lg shadow p-6 border">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">System Health</h3>
          <div className="space-y-3">
            <SystemHealthIndicator 
              label="Season Oracle"
              status="healthy"
              endpoint="/.netlify/functions/season-oracle"
            />
            <SystemHealthIndicator 
              label="Storage Service"
              status="healthy"
              endpoint="/.netlify/functions/ardrive-estimate"
            />
            <SystemHealthIndicator 
              label="Database"
              status="healthy"
              endpoint="/.netlify/functions/evermarks"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6 border">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick Actions</h3>
          <div className="space-y-3">
            <a 
              href="https://basescan.org/address/0x504a0BDC3aea29237a6f8E53D0ECDA8e4c9009F2"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 text-sm"
            >
              EvermarkNFT Contract
            </a>
            <a 
              href="https://basescan.org/address/0xaab93405679576ec743fDAA57AA603D949850604"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700 text-sm"
            >
              Voting Contract
            </a>
            <button
              onClick={() => window.open('/.netlify/functions/season-oracle?transition=true', '_blank')}
              className="block w-full text-center bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 text-sm"
            >
              Season Transition Status
            </button>
          </div>
        </div>
      </div>

      {/* NEW: Development Tools */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Development Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Season Tools */}
          <div className="bg-gray-50 rounded-lg p-6 border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Season Tools</h3>
            <div className="space-y-3">
              <DevActionButton
                label="View Season State"
                endpoint="/.netlify/functions/season-oracle"
                method="GET"
              />
              <DevActionButton
                label="Clear Season Cache"
                endpoint="/.netlify/functions/season-oracle"
                method="POST"
                body={{ action: 'clear_cache' }}
              />
              <DevActionButton
                label="Calculate Current Season"
                endpoint="/.netlify/functions/season-oracle"
                method="POST"
                body={{ action: 'calculate_season' }}
              />
            </div>
          </div>

          {/* Storage Tools */}
          <div className="bg-gray-50 rounded-lg p-6 border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Storage Tools</h3>
            <div className="space-y-3">
              <DevActionButton
                label="Test ArDrive Connection"
                endpoint="/.netlify/functions/ardrive-estimate"
                method="POST"
                body={{ size: 1024 }}
              />
              <DevActionButton
                label="Storage Cost (1MB)"
                endpoint="/.netlify/functions/ardrive-estimate"
                method="POST"
                body={{ size: 1048576 }}
              />
              <DevActionButton
                label="Storage Metrics"
                endpoint="/.netlify/functions/storage-metrics"
                method="GET"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Feature Flags Status */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Feature Flags</h2>
        <FeatureFlagsPanel />
      </div>
    </div>
  );
}

// Helper Components

interface SystemHealthIndicatorProps {
  label: string;
  status: 'healthy' | 'warning' | 'error';
  endpoint?: string;
}

function SystemHealthIndicator({ label, status, endpoint }: SystemHealthIndicatorProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✓';
      case 'warning': return '⚠';
      case 'error': return '✗';
      default: return '?';
    }
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-700 text-sm">{label}</span>
      <div className="flex items-center space-x-2">
        <span className={`text-sm font-medium ${getStatusColor(status)}`}>
          {getStatusIcon(status)} {status}
        </span>
        {endpoint && (
          <button
            onClick={() => window.open(endpoint, '_blank')}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            test
          </button>
        )}
      </div>
    </div>
  );
}

interface DevActionButtonProps {
  label: string;
  endpoint: string;
  method: 'GET' | 'POST';
  body?: any;
}

function DevActionButton({ label, endpoint, method, body }: DevActionButtonProps) {
  const handleClick = async () => {
    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };
      
      if (body) {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(endpoint, options);
      const data = await response.json();
      
      // Open result in new window
      const resultWindow = window.open('', '_blank');
      if (resultWindow) {
        resultWindow.document.write(`
          <pre style="font-family: monospace; white-space: pre-wrap; padding: 20px;">
            ${JSON.stringify(data, null, 2)}
          </pre>
        `);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-full text-left bg-white border border-gray-300 rounded px-3 py-2 text-sm hover:bg-gray-50 hover:border-gray-400 transition-colors"
    >
      {label}
    </button>
  );
}

function FeatureFlagsPanel() {
  // We'll import FEATURES inside the component to avoid build issues
  const [features, setFeatures] = React.useState<any>(null);
  
  React.useEffect(() => {
    import('@/config/features').then(({ FEATURES }) => {
      setFeatures(FEATURES);
    }).catch(console.error);
  }, []);

  if (!features) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-32 mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-3 bg-gray-300 rounded w-full"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const featureFlags = [
    { name: 'ArDrive Enabled', value: features.isArDriveEnabled(), key: 'ARDRIVE_ENABLED' },
    { name: 'Dual Storage', value: features.shouldUseDualStorage(), key: 'DUAL_STORAGE' },
    { name: 'Season Management', value: process.env.VITE_SEASON_MANAGEMENT === 'true', key: 'SEASON_MANAGEMENT' },
    { name: 'Storage Backend', value: features.getStorageBackend(), key: 'STORAGE_BACKEND' },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6 border">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Feature Flags</h3>
      <div className="space-y-3">
        {featureFlags.map((flag, index) => (
          <div key={index} className="flex items-center justify-between">
            <span className="text-gray-700">{flag.name}</span>
            <span className={`text-sm font-mono px-2 py-1 rounded ${
              typeof flag.value === 'boolean' 
                ? flag.value 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {String(flag.value)}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-4">
        Feature flags are read from environment variables. Restart required for changes.
      </p>
    </div>
  );
}

export default DevDashboardPage;