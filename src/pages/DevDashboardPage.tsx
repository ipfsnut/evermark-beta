import React from 'react';
import { Navigate } from 'react-router-dom';
import { WalletBalanceDashboard } from '../components/dev/WalletBalanceTracker';
import { useWalletAddress } from '../hooks/core/useWalletAccount';

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
          Real-time monitoring of Evermark protocol fee flows and development funding.
        </p>
      </div>

      <WalletBalanceDashboard />

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

        <div className="bg-white rounded-lg shadow p-6 border">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Referral Activity</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Active Referrers:</span>
              <span className="font-mono">--</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Referral Rate:</span>
              <span className="font-mono">--%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Referral Fees Paid:</span>
              <span className="font-mono">-- ETH</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Based on on-chain referral events
          </p>
        </div>

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
              FeeCollector Contract
            </a>
            <a 
              href="https://basescan.org/address/0x3427b4716B90C11F9971e43999a48A47Cf5B571E"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 text-sm"
            >
              Development Wallet
            </a>
          </div>
        </div>
      </div>

      <div className="mt-12 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-yellow-900 mb-2">Fee Structure Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-medium text-yellow-900 mb-2">Minting Fee (0.00007 ETH)</h4>
            <ul className="space-y-1 text-yellow-800">
              <li>• Anti-spam mechanism</li>
              <li>• Development cost funding</li>
              <li>• Server maintenance</li>
              <li>• Infrastructure improvements</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-yellow-900 mb-2">Important Notes</h4>
            <ul className="space-y-1 text-yellow-800">
              <li>• Separate from staking rewards</li>
              <li>• Not part of community treasury</li>
              <li>• Direct development funding</li>
              <li>• Transparent on-chain flow</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DevDashboardPage;
export { DevDashboardPage };