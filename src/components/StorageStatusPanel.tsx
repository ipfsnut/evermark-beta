// src/components/StorageStatusPanel.tsx
// Storage system monitoring panel for development dashboard

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FEATURES } from '@/config/features';

interface StorageStatusPanelProps {
  className?: string;
}

interface StorageMetrics {
  ipfs: {
    status: 'healthy' | 'warning' | 'error';
    totalUploads: number;
    successRate: number;
    avgUploadTime: number;
    lastUpload: string | null;
  };
  ardrive: {
    status: 'healthy' | 'warning' | 'error' | 'disabled';
    totalUploads: number;
    successRate: number;
    avgUploadTime: number;
    lastUpload: string | null;
    totalCostUSD: number;
    avgCostPerMB: number;
  };
  backend: {
    current: 'ipfs' | 'ardrive' | 'dual';
    featureFlags: {
      ardriveEnabled: boolean;
      dualStorage: boolean;
    };
  };
  season: {
    currentFolder: string | null;
    folderStatus: 'ready' | 'preparing' | 'error';
    manifestExists: boolean;
  };
}

export function StorageStatusPanel({ className = '' }: StorageStatusPanelProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Fetch storage metrics
  const { data: metrics, isLoading, error, refetch } = useQuery<StorageMetrics>({
    queryKey: ['storage', 'metrics'],
    queryFn: async () => {
      const response = await fetch('/.netlify/functions/storage-metrics');
      if (!response.ok) {
        throw new Error(`Failed to fetch storage metrics: ${response.status}`);
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000 // Consider data stale after 15 seconds
  });

  // Test storage connections
  const [testResults, setTestResults] = useState<{[key: string]: any}>({});
  const [testing, setTesting] = useState<string | null>(null);

  const testStorage = async (backend: 'ipfs' | 'ardrive') => {
    setTesting(backend);
    try {
      const endpoint = backend === 'ipfs' 
        ? '/.netlify/functions/test-ipfs' 
        : '/.netlify/functions/ardrive-estimate';
      
      const body = backend === 'ardrive' 
        ? JSON.stringify({ size: 1024 }) // 1KB test
        : undefined;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(body && { body })
      });

      const result = await response.json();
      setTestResults(prev => ({
        ...prev,
        [backend]: {
          success: response.ok,
          result,
          timestamp: new Date().toISOString()
        }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [backend]: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      }));
    } finally {
      setTesting(null);
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="bg-gray-800 p-4 rounded">
                <div className="h-4 bg-gray-700 rounded w-20 mb-2"></div>
                <div className="h-8 bg-gray-700 rounded w-16 mb-1"></div>
                <div className="h-3 bg-gray-700 rounded w-24"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Storage System Status</h2>
          <button
            onClick={() => refetch()}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
        <div className="bg-red-900/20 border border-red-800 rounded p-4">
          <p className="text-red-400">
            Failed to load storage metrics: {error?.message || 'Unknown error'}
          </p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'disabled': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✓';
      case 'warning': return '⚠';
      case 'error': return '✗';
      case 'disabled': return '○';
      default: return '?';
    }
  };

  return (
    <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">
          Storage System Status
        </h2>
        <div className="flex items-center space-x-2">
          <BackendIndicator backend={metrics.backend.current} />
          <button
            onClick={() => refetch()}
            className="px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Storage Backends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* IPFS Status */}
        <StorageBackendCard
          title="IPFS (Pinata)"
          status={metrics.ipfs.status}
          metrics={{
            'Total Uploads': metrics.ipfs.totalUploads.toLocaleString(),
            'Success Rate': `${metrics.ipfs.successRate.toFixed(1)}%`,
            'Avg Upload Time': `${metrics.ipfs.avgUploadTime.toFixed(1)}s`,
            'Last Upload': metrics.ipfs.lastUpload 
              ? new Date(metrics.ipfs.lastUpload).toLocaleDateString()
              : 'Never'
          }}
          testResult={testResults.ipfs}
          onTest={() => testStorage('ipfs')}
          testing={testing === 'ipfs'}
        />

        {/* ArDrive Status */}
        <StorageBackendCard
          title="ArDrive (Arweave)"
          status={metrics.ardrive.status}
          metrics={{
            'Total Uploads': metrics.ardrive.totalUploads.toLocaleString(),
            'Success Rate': `${metrics.ardrive.successRate.toFixed(1)}%`,
            'Avg Upload Time': `${metrics.ardrive.avgUploadTime.toFixed(1)}s`,
            'Total Cost': `$${metrics.ardrive.totalCostUSD.toFixed(2)}`,
            'Avg Cost/MB': `$${metrics.ardrive.avgCostPerMB.toFixed(4)}`,
            'Last Upload': metrics.ardrive.lastUpload 
              ? new Date(metrics.ardrive.lastUpload).toLocaleDateString()
              : 'Never'
          }}
          testResult={testResults.ardrive}
          onTest={() => testStorage('ardrive')}
          testing={testing === 'ardrive'}
          isDisabled={metrics.ardrive.status === 'disabled'}
        />
      </div>

      {/* Feature Flags */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">
          Storage Configuration
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FeatureFlagIndicator
            label="ArDrive Enabled"
            value={metrics.backend.featureFlags.ardriveEnabled}
            description="ArDrive storage backend available"
          />
          <FeatureFlagIndicator
            label="Dual Storage"
            value={metrics.backend.featureFlags.dualStorage}
            description="Upload to both IPFS and ArDrive"
          />
          <FeatureFlagIndicator
            label="Current Backend"
            value={metrics.backend.current}
            description="Active storage backend"
            isString
          />
          <FeatureFlagIndicator
            label="Season Management"
            value={process.env.VITE_SEASON_MANAGEMENT === 'true'}
            description="Season-based folder organization"
          />
        </div>
      </div>

      {/* Season Folder Status */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">
          Season Storage Status
        </h3>
        <div className="bg-gray-800 rounded p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Current Folder:</span>
              <p className="text-white font-mono text-xs mt-1">
                {metrics.season.currentFolder || 'Not set'}
              </p>
            </div>
            <div>
              <span className="text-gray-400">Folder Status:</span>
              <span className={`ml-2 ${getStatusColor(metrics.season.folderStatus)}`}>
                {getStatusIcon(metrics.season.folderStatus)} {metrics.season.folderStatus}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Season Manifest:</span>
              <span className={`ml-2 ${metrics.season.manifestExists ? 'text-green-400' : 'text-red-400'}`}>
                {metrics.season.manifestExists ? '✓ Present' : '✗ Missing'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Details */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm"
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </button>
        
        <div className="flex space-x-2">
          <button
            onClick={() => window.open('/.netlify/functions/storage-metrics', '_blank')}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            View Raw Metrics
          </button>
        </div>
      </div>

      {/* Detailed Information */}
      {showDetails && (
        <div className="mt-4 border-t border-gray-700 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <h4 className="text-gray-400 font-medium mb-2">Test Results</h4>
              <div className="space-y-2">
                {Object.entries(testResults).map(([backend, result]) => (
                  <div key={backend} className="bg-gray-800 p-2 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-300 capitalize">{backend}</span>
                      <span className={result.success ? 'text-green-400' : 'text-red-400'}>
                        {result.success ? '✓' : '✗'}
                      </span>
                    </div>
                    <p className="text-gray-500">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </p>
                    {result.error && (
                      <p className="text-red-400 mt-1">{result.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-gray-400 font-medium mb-2">Environment Variables</h4>
              <div className="space-y-1 font-mono">
                <EnvVarIndicator name="VITE_PINATA_JWT" />
                <EnvVarIndicator name="VITE_ARDRIVE_PRIVATE_KEY" />
                <EnvVarIndicator name="VITE_ARDRIVE_ENABLED" />
                <EnvVarIndicator name="VITE_DUAL_STORAGE" />
                <EnvVarIndicator name="VITE_STORAGE_BACKEND" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components

function BackendIndicator({ backend }: { backend: string }) {
  const getBackendColor = (backend: string) => {
    switch (backend) {
      case 'ipfs': return 'bg-blue-500';
      case 'ardrive': return 'bg-green-500';
      case 'dual': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <div className={`w-2 h-2 rounded-full ${getBackendColor(backend)}`}></div>
      <span className="text-sm text-gray-300 capitalize">{backend}</span>
    </div>
  );
}

interface StorageBackendCardProps {
  title: string;
  status: string;
  metrics: Record<string, string>;
  testResult?: any;
  onTest: () => void;
  testing: boolean;
  isDisabled?: boolean;
}

function StorageBackendCard({ 
  title, 
  status, 
  metrics, 
  testResult, 
  onTest, 
  testing, 
  isDisabled = false 
}: StorageBackendCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'disabled': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✓';
      case 'warning': return '⚠';
      case 'error': return '✗';
      case 'disabled': return '○';
      default: return '?';
    }
  };

  return (
    <div className={`bg-gray-800 p-4 rounded ${isDisabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-medium">{title}</h3>
        <span className={`text-sm ${getStatusColor(status)}`}>
          {getStatusIcon(status)} {status}
        </span>
      </div>
      
      <div className="space-y-2 mb-4">
        {Object.entries(metrics).map(([key, value]) => (
          <div key={key} className="flex justify-between text-sm">
            <span className="text-gray-400">{key}:</span>
            <span className="text-gray-300">{value}</span>
          </div>
        ))}
      </div>
      
      <div className="flex items-center justify-between">
        <button
          onClick={onTest}
          disabled={testing || isDisabled}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        
        {testResult && (
          <span className={`text-xs ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
            {testResult.success ? '✓ Pass' : '✗ Fail'}
          </span>
        )}
      </div>
    </div>
  );
}

interface FeatureFlagIndicatorProps {
  label: string;
  value: boolean | string;
  description: string;
  isString?: boolean;
}

function FeatureFlagIndicator({ label, value, description, isString = false }: FeatureFlagIndicatorProps) {
  return (
    <div className="bg-gray-800 p-3 rounded">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-300">{label}</span>
        <span className={`text-xs px-2 py-1 rounded ${
          isString 
            ? 'bg-blue-100 text-blue-800'
            : value 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
        }`}>
          {String(value)}
        </span>
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

function EnvVarIndicator({ name }: { name: string }) {
  const value = process.env[name];
  const isSet = Boolean(value);
  
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400">{name}:</span>
      <span className={isSet ? 'text-green-400' : 'text-red-400'}>
        {isSet ? '✓ Set' : '✗ Missing'}
      </span>
    </div>
  );
}