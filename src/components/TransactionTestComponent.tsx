// src/components/TransactionTestComponent.tsx - Manual test component for transaction flow
import React, { useState } from 'react';
import { useContextualTransactions } from '../hooks/core/useContextualTransactions';
import { useWallet } from '../providers/WalletProvider';
import { getEvermarkNFTContract } from '../lib/contracts';

interface TransactionTestComponentProps {
  onTestResult: (result: { success: boolean; message: string; details?: any }) => void;
}

export function TransactionTestComponent({ onTestResult }: TransactionTestComponentProps) {
  const { context, address, isConnected } = useWallet();
  const { sendTransaction, isTransactionSupported, getTransactionCapabilities } = useContextualTransactions();
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testLog, setTestLog] = useState<string[]>([]);

  const addToLog = (message: string) => {
    setTestLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runTransactionTest = async () => {
    setIsTestRunning(true);
    setTestLog([]);
    addToLog('🧪 Starting transaction test...');

    try {
      // Test 1: Check context detection
      addToLog(`📍 Context detected: ${context}`);
      addToLog(`💳 Wallet connected: ${isConnected ? 'Yes' : 'No'}`);
      addToLog(`📧 Address: ${address || 'None'}`);

      if (!isConnected || !address) {
        throw new Error('Wallet not connected - please connect wallet first');
      }

      // Test 2: Check transaction support
      const isSupported = isTransactionSupported();
      addToLog(`🔧 Transaction supported: ${isSupported ? 'Yes' : 'No'}`);

      if (!isSupported) {
        throw new Error('Transactions not supported in current context');
      }

      // Test 3: Get transaction capabilities
      const capabilities = getTransactionCapabilities();
      addToLog(`⚙️ Capabilities: ${JSON.stringify(capabilities, null, 2)}`);

      // Test 4: Prepare a test transaction (mint to self with 0 value)
      addToLog('🔧 Preparing test transaction...');
      const contract = getEvermarkNFTContract();
      
      const testTransaction = {
        contract,
        method: 'function mint(address to, string memory tokenURI)',
        params: [
          address, // mint to self
          'https://example.com/test-metadata.json' // test metadata
        ],
        value: BigInt(0)
      };

      addToLog('📤 Sending test transaction (this will prompt for signature)...');
      addToLog('⏳ Please confirm the transaction in your wallet...');

      // Test 5: Send transaction
      const result = await sendTransaction(testTransaction);
      
      addToLog(`✅ Transaction successful!`);
      addToLog(`📜 Transaction hash: ${result.transactionHash}`);
      if (result.blockNumber) {
        addToLog(`📦 Block number: ${result.blockNumber}`);
      }

      onTestResult({
        success: true,
        message: 'Transaction test completed successfully! ✅',
        details: {
          context,
          address,
          capabilities,
          transactionResult: result
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addToLog(`❌ Test failed: ${errorMessage}`);
      
      onTestResult({
        success: false,
        message: `Transaction test failed: ${errorMessage}`,
        details: {
          context,
          address,
          error: errorMessage
        }
      });
    } finally {
      setIsTestRunning(false);
      addToLog('🏁 Test completed');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        🧪 Transaction Flow Test
      </h2>
      
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Current Status</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Context:</strong> <span className="font-mono">{context}</span>
          </div>
          <div>
            <strong>Wallet:</strong> <span className="font-mono">{isConnected ? '✅ Connected' : '❌ Not Connected'}</span>
          </div>
          <div className="col-span-2">
            <strong>Address:</strong> <span className="font-mono text-xs">{address || 'None'}</span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <button
          onClick={runTransactionTest}
          disabled={isTestRunning || !isConnected}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTestRunning ? '🔄 Running Test...' : '🧪 Run Transaction Test'}
        </button>
        
        {!isConnected && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            ⚠️ Please connect your wallet first
          </p>
        )}
      </div>

      {testLog.length > 0 && (
        <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
          <h3 className="text-white mb-2">📋 Test Log:</h3>
          {testLog.map((log, index) => (
            <div key={index} className="mb-1">
              {log}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
        <h3 className="text-lg font-semibold mb-2 text-yellow-800 dark:text-yellow-200">
          ℹ️ Test Information
        </h3>
        <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
          <li>• This test will attempt to mint a test NFT to your wallet</li>
          <li>• The transaction will require your signature confirmation</li>
          <li>• In Farcaster context: Uses SDK provider for signing</li>
          <li>• In browser context: Uses your connected wallet (MetaMask, etc.)</li>
          <li>• The test validates that our hook violation fix is working correctly</li>
        </ul>
      </div>
    </div>
  );
}

// Hook for easier testing in development
export function useTransactionTest() {
  const [lastTestResult, setLastTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  return {
    lastTestResult,
    setLastTestResult,
    TestComponent: (props: Omit<TransactionTestComponentProps, 'onTestResult'>) => (
      <TransactionTestComponent 
        {...props} 
        onTestResult={setLastTestResult}
      />
    )
  };
}