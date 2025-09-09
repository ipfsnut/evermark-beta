// src/pages/TransactionTestPage.tsx - Test page for transaction functionality
import React, { useState } from 'react';
import { TransactionTestComponent } from '../components/TransactionTestComponent';

export default function TransactionTestPage() {
  const [testResults, setTestResults] = useState<Array<{
    timestamp: Date;
    success: boolean;
    message: string;
    details?: any;
  }>>([]);

  const handleTestResult = (result: { success: boolean; message: string; details?: any }) => {
    setTestResults(prev => [...prev, {
      timestamp: new Date(),
      ...result
    }]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-center mb-2 text-gray-900 dark:text-white">
            🧪 Evermark Transaction Testing
          </h1>
          <p className="text-center text-gray-600 dark:text-gray-400">
            Test the fixed transaction confirmation flow in both Farcaster and browser contexts
          </p>
        </div>

        <TransactionTestComponent onTestResult={handleTestResult} />

        {testResults.length > 0 && (
          <div className="mt-8 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                📊 Test Results History
              </h2>
              <button
                onClick={clearResults}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
              >
                Clear Results
              </button>
            </div>

            <div className="space-y-4">
              {testResults.slice().reverse().map((result, index) => (
                <div
                  key={testResults.length - index}
                  className={`p-4 rounded-lg border-2 ${
                    result.success
                      ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                      : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className={`font-semibold ${
                      result.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                    }`}>
                      {result.success ? '✅ Success' : '❌ Failed'} - Test #{testResults.length - index}
                    </h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {result.timestamp.toLocaleString()}
                    </span>
                  </div>
                  
                  <p className={`mb-3 ${
                    result.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                  }`}>
                    {result.message}
                  </p>

                  {result.details && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                        Show Details
                      </summary>
                      <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 max-w-4xl mx-auto p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-blue-800 dark:text-blue-200">
            🔧 How to Use This Test
          </h3>
          <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
            <p><strong>1. In Farcaster Mini-App:</strong></p>
            <ul className="ml-4 space-y-1">
              <li>• Open this app within Farcaster (mobile or web)</li>
              <li>• Navigate to this test page (/transaction-test)</li>
              <li>• Your Farcaster wallet should be automatically connected</li>
              <li>• Click "Run Transaction Test" - it should prompt for signature confirmation</li>
              <li>• Previously: ❌ Signature would appear but confirmation would fail</li>
              <li>• Now: ✅ Both signature prompt AND confirmation should work</li>
            </ul>
            
            <p className="pt-2"><strong>2. In Regular Browser:</strong></p>
            <ul className="ml-4 space-y-1">
              <li>• Open this app in a regular browser (Chrome, Safari, etc.)</li>
              <li>• Connect your wallet (MetaMask, Coinbase Wallet, etc.)</li>
              <li>• Run the same test to verify browser flow still works</li>
            </ul>

            <p className="pt-2"><strong>3. What We Fixed:</strong></p>
            <ul className="ml-4 space-y-1">
              <li>• Eliminated React hook violations in useContextualTransactions</li>
              <li>• Used proper service function pattern for Farcaster SDK calls</li>
              <li>• Maintained full compatibility with both contexts</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}