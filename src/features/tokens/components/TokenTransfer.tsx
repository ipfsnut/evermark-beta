// src/features/tokens/components/TokenTransfer.tsx - Fixed contract integration

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  Send,
  
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { prepareContractCall, getContract } from 'thirdweb';
import { useSendTransaction } from 'thirdweb/react';
import { client } from '@/lib/thirdweb';
import { base } from 'thirdweb/chains';

// Local contract constants to avoid @/lib/contracts dependency
const CHAIN = base;
const LOCAL_CONTRACTS = {
  EMARK_TOKEN: import.meta.env.VITE_EMARK_TOKEN_ADDRESS || '',
} as const;

// Import ABI from the actual JSON file
import EMARK_ABI from '@/features/tokens/abis/EMARK.json';

import { TokenService } from '../services/TokenService';
import type { UseTokenStateReturn } from '../types';

interface TokenTransferProps {
  tokenState: UseTokenStateReturn;
  className?: string;
}

export function TokenTransfer({ tokenState, className = '' }: TokenTransferProps) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);

  const { mutateAsync: sendTransaction } = useSendTransaction();
  const { tokenBalance, formatTokenAmount, parseTokenAmount, validateAmount, isConnected, userAddress } = tokenState;

  // Contract instance for transfers with proper error handling
  const emarkToken = useMemo(() => {
    try {
      return getContract({
        client,
        chain: CHAIN,
        address: LOCAL_CONTRACTS.EMARK_TOKEN,
        abi: EMARK_ABI as any // Cast to any to avoid TypeScript ABI issues
      });
    } catch (error) {
      console.error('Failed to create token contract for transfers:', error);
      return null;
    }
  }, []);

  const validation = useMemo(() => {
    if (!amount || !recipient) return { isValid: false, errors: [] };
    
    const amountValidation = validateAmount(amount, tokenBalance?.emarkBalance);
    const errors = [...amountValidation.errors];
    
    // Validate recipient address
    if (!TokenService.isValidAddress(recipient)) {
      errors.push('Invalid recipient address');
    }
    
    if (recipient.toLowerCase() === userAddress?.toLowerCase()) {
      errors.push('Cannot send tokens to yourself');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [amount, recipient, validateAmount, tokenBalance, userAddress]);

  const handleMaxClick = useCallback(() => {
    if (tokenBalance?.emarkBalance) {
      // Reserve some for gas fees - use a more conservative amount
      const gasReserve = BigInt('100000000000000000'); // 0.1 EMARK
      const maxAmount = tokenBalance.emarkBalance > gasReserve 
        ? tokenBalance.emarkBalance - gasReserve 
        : BigInt(0);
      setAmount(formatTokenAmount(maxAmount, 2));
    }
  }, [tokenBalance, formatTokenAmount]);

  const handleTransfer = useCallback(async () => {
    if (!validation.isValid || !emarkToken) return;
    
    setLocalError(null);
    
    try {
      const amountWei = parseTokenAmount(amount);
      
      const transaction = prepareContractCall({
        contract: emarkToken,
        method: "function transfer(address to, uint256 amount) returns (bool)",
        params: [recipient, amountWei]
      });

      await sendTransaction(transaction);
      
      setLocalSuccess(`Successfully sent ${amount} EMARK to ${recipient.slice(0, 6)}...${recipient.slice(-4)}`);
      setAmount('');
      setRecipient('');
      setShowConfirmation(false);
      
      // Refresh token balance
      await tokenState.refetch();
    } catch (error: unknown) {
      console.error('Transfer failed:', error);
      const parsedError = TokenService.parseContractError(error);
      setLocalError(TokenService.getUserFriendlyError(parsedError));
    }
  }, [validation.isValid, amount, recipient, parseTokenAmount, emarkToken, sendTransaction, tokenState]);

  // Clear messages after delay
  useEffect(() => {
    if (localError || localSuccess) {
      const timer = setTimeout(() => {
        setLocalError(null);
        setLocalSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
    return
  }, [localError, localSuccess]);

  if (!isConnected) {
    return (
      <div className={`bg-gray-800/50 border border-gray-700 rounded-lg p-6 ${className}`}>
        <div className="text-center py-8">
          <Send className="mx-auto h-12 w-12 text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Connect Wallet</h3>
          <p className="text-gray-400">Connect your wallet to send EMARK tokens</p>
        </div>
      </div>
    );
  }

  if (!emarkToken) {
    return (
      <div className={`bg-gray-800/50 border border-gray-700 rounded-lg p-6 ${className}`}>
        <div className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Contract Error</h3>
          <p className="text-gray-400">Unable to load token contract. Please check configuration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800/50 border border-gray-700 rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <h3 className="text-lg font-bold text-white flex items-center">
          <Send className="h-5 w-5 mr-2 text-blue-400" />
          Send EMARK
        </h3>
        <p className="text-sm text-gray-400 mt-1">Transfer tokens to another address</p>
      </div>

      {/* Status Messages */}
      {(localError || localSuccess) && (
        <div className="p-4 border-b border-gray-700">
          {localError && (
            <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-lg flex items-start">
              <AlertCircle className="h-4 w-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-red-200 text-sm">{localError}</span>
            </div>
          )}
          {localSuccess && (
            <div className="p-3 bg-green-900/30 border border-green-500/30 rounded-lg flex items-start">
              <CheckCircle className="h-4 w-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-green-200 text-sm">{localSuccess}</span>
            </div>
          )}
        </div>
      )}

      {/* Transfer Form */}
      <div className="p-6">
        <div className="space-y-4">
          {/* Recipient Address */}
          <div>
            <label htmlFor="recipient" className="block text-sm font-medium text-gray-300 mb-2">
              Recipient Address
            </label>
            <input
              id="recipient"
              type="text"
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value);
                setLocalError(null);
              }}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20 transition-colors"
              placeholder="0x..."
            />
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-2">
              Amount
            </label>
            <div className="relative">
              <input
                id="amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setAmount(value);
                    setLocalError(null);
                  }
                }}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20 transition-colors pr-20"
                placeholder="0.0"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                <span className="text-sm text-gray-400">EMARK</span>
                <button
                  type="button"
                  onClick={handleMaxClick}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  MAX
                </button>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              Available: {tokenBalance ? formatTokenAmount(tokenBalance.emarkBalance, 2) : '0'} EMARK
            </div>
          </div>

          {/* Validation Errors */}
          {validation.errors.length > 0 && (
            <div className="space-y-1">
              {validation.errors.map((error, index) => (
                <div key={index} className="flex items-center text-red-400 text-sm">
                  <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                  {error}
                </div>
              ))}
            </div>
          )}

          {/* Transfer Button */}
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={!validation.isValid}
            className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <Send className="h-4 w-4 mr-2" />
            Send EMARK
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-white mb-4">Confirm Transfer</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-400">Amount:</span>
                <span className="text-white font-medium">{amount} EMARK</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">To:</span>
                <span className="text-white font-mono text-sm">
                  {recipient.slice(0, 6)}...{recipient.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Estimated Gas:</span>
                <span className="text-white">~$0.50 USD</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}