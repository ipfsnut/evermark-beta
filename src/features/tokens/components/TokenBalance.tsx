// features/tokens/components/TokenBalance.tsx - Token balance display component

import React, { useState, useCallback } from 'react';
import { 
  CoinsIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  InfoIcon,
  ExternalLinkIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  ShieldCheckIcon,
  ZapIcon
} from 'lucide-react';
import { useTokenState } from '../hooks/useTokenState';
import { TokenService } from '../services/TokenService';
import { useTheme } from '../../../providers/ThemeProvider';
import { cn } from '@/utils/responsive';

interface TokenBalanceProps {
  variant?: 'full' | 'compact' | 'minimal';
  showActions?: boolean;
  showApprovalStatus?: boolean;
  className?: string;
  onApprovalSuccess?: () => void;
}

export function TokenBalance({ 
  variant = 'full',
  showActions = true,
  showApprovalStatus = true,
  className = '',
  onApprovalSuccess
}: TokenBalanceProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const { isDark } = useTheme();
  
  const {
    tokenInfo,
    tokenBalance,
    isLoading,
    isApproving,
    error,
    approvalError,
    approveForStaking,
    approveUnlimited,
    needsApproval,
    refetch,
    clearErrors,
    isConnected,
    userAddress
  } = useTokenState();

  // Handle copy address
  const handleCopyAddress = useCallback(async () => {
    if (!tokenInfo?.address) return;
    
    try {
      await navigator.clipboard.writeText(tokenInfo.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  }, [tokenInfo?.address]);

  // Handle approval
  const handleApprove = useCallback(async (unlimited = false) => {
    clearErrors();
    
    try {
      const result = unlimited ? await approveUnlimited() : await approveForStaking();
      
      if (result.success) {
        onApprovalSuccess?.();
      }
    } catch (error) {
      console.error('Approval failed:', error);
    }
  }, [approveForStaking, approveUnlimited, clearErrors, onApprovalSuccess]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Get approval status
  const getApprovalStatus = useCallback(() => {
    if (!tokenBalance) return null;
    
    return TokenService.formatApprovalStatus(
      tokenBalance.allowanceForStaking,
      tokenBalance.emarkBalance
    );
  }, [tokenBalance]);

  const approvalStatus = getApprovalStatus();

  if (!isConnected) {
    return (
      <div className={cn(
        "border rounded-lg p-6",
        isDark 
          ? "bg-gray-800/50 border-gray-700" 
          : "bg-white border-gray-300",
        className
      )}>
        <div className="text-center">
          <CoinsIcon className={cn(
            "mx-auto h-12 w-12 mb-4",
            isDark ? "text-gray-500" : "text-gray-400"
          )} />
          <h3 className={cn(
            "text-lg font-medium mb-2",
            isDark ? "text-white" : "text-gray-900"
          )}>Connect Wallet</h3>
          <p className={cn(
            isDark ? "text-gray-400" : "text-gray-600"
          )}>Connect your wallet to view token balance</p>
        </div>
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <CoinsIcon className="h-4 w-4 text-purple-400" />
        <span className={cn(
          "text-sm font-medium",
          isDark ? "text-white" : "text-gray-900"
        )}>
          {isLoading ? '...' : tokenBalance?.formattedBalance || '0'} EMARK
        </span>
        {isLoading && (
          <RefreshCwIcon className={cn(
            "h-3 w-3 animate-spin",
            isDark ? "text-gray-400" : "text-gray-500"
          )} />
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn(
        "border rounded-lg p-4",
        isDark 
          ? "bg-gray-800/50 border-gray-700" 
          : "bg-white border-gray-300",
        className
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={cn(
              "p-2 border rounded-lg",
              isDark 
                ? "bg-purple-900/30 border-purple-500/30" 
                : "bg-purple-100/50 border-purple-300"
            )}>
              <CoinsIcon className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <div className={cn(
                "text-sm",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>EMARK Balance</div>
              <div className={cn(
                "text-lg font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}>
                {isLoading ? '...' : tokenBalance?.formattedBalance || '0'}
              </div>
            </div>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className={cn(
              "p-2 transition-colors",
              isDark 
                ? "text-gray-400 hover:text-white" 
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <RefreshCwIcon className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div className={cn(
      "border rounded-lg shadow-lg",
      isDark 
        ? "bg-gray-800/50 border-gray-700" 
        : "bg-white border-gray-300",
      className
    )}>
      {/* Header */}
      <div className={cn(
        "p-6 border-b",
        isDark ? "border-gray-700" : "border-gray-200"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={cn(
              "p-3 border rounded-lg",
              isDark 
                ? "bg-purple-900/30 border-purple-500/30" 
                : "bg-purple-100/50 border-purple-300"
            )}>
              <CoinsIcon className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <h3 className={cn(
                "text-lg font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}>EMARK Token</h3>
              <p className={cn(
                "text-sm",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>Evermark curation token</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Toggle details"
            >
              {showDetails ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
            
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Refresh balance"
            >
              <RefreshCwIcon className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      {/* Error Messages */}
      {(error || approvalError) && (
        <div className="p-4 border-b border-gray-700">
          {error && (
            <div className="mb-3 p-3 bg-red-900/30 border border-red-500/30 rounded-lg flex items-start">
              <AlertCircleIcon className="h-4 w-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-red-200 text-sm">{error}</span>
            </div>
          )}
          
          {approvalError && (
            <div className="p-3 bg-yellow-900/30 border border-yellow-500/30 rounded-lg flex items-start">
              <AlertCircleIcon className="h-4 w-4 text-yellow-400 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-yellow-200 text-sm">{approvalError}</span>
            </div>
          )}
        </div>
      )}

      {/* Balance Display */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Main Balance */}
          <div className="text-center md:text-left">
            <div className="text-sm text-gray-400 mb-2">Available Balance</div>
            <div className="text-3xl font-bold text-white mb-1">
              {isLoading ? (
                <div className="animate-pulse bg-gray-700 h-8 w-32 rounded"></div>
              ) : (
                `${tokenBalance?.formattedBalance || '0'}`
              )}
            </div>
            <div className="text-sm text-gray-400">EMARK</div>
          </div>

          {/* Approval Status */}
          {showApprovalStatus && tokenBalance && (
            <div className="text-center md:text-right">
              <div className="text-sm text-gray-400 mb-2">Staking Approval</div>
              <div className="flex items-center justify-center md:justify-end space-x-2">
                {approvalStatus?.status === 'sufficient' ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-400" />
                ) : (
                  <AlertCircleIcon className="h-5 w-5 text-yellow-400" />
                )}
                <span className={cn(
                  "text-sm font-medium",
                  approvalStatus?.status === 'sufficient' ? "text-green-400" : "text-yellow-400"
                )}>
                  {tokenBalance.formattedAllowance} EMARK
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {approvalStatus?.message}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {showActions && tokenBalance && (
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            {needsApproval(tokenBalance.emarkBalance) && (
              <>
                <button
                  onClick={() => handleApprove(false)}
                  disabled={isApproving}
                  className="flex-1 flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isApproving ? (
                    <>
                      <RefreshCwIcon className="animate-spin h-4 w-4 mr-2" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <ShieldCheckIcon className="h-4 w-4 mr-2" />
                      Approve for Staking
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => handleApprove(true)}
                  disabled={isApproving}
                  className="px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <ZapIcon className="h-4 w-4 inline mr-2" />
                  Unlimited
                </button>
              </>
            )}
          </div>
        )}

        {/* Details Section */}
        {showDetails && tokenInfo && (
          <div className="mt-6 pt-6 border-t border-gray-700">
            <h4 className="text-sm font-medium text-gray-300 mb-4">Token Details</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Contract Address</span>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-mono text-xs">
                    {`${tokenInfo.address.slice(0, 6)}...${tokenInfo.address.slice(-4)}`}
                  </span>
                  <button
                    onClick={handleCopyAddress}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                    title="Copy address"
                  >
                    <CopyIcon className="h-3 w-3" />
                  </button>
                  {copied && (
                    <span className="text-xs text-green-400">Copied!</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Symbol</span>
                <span className="text-white">{tokenInfo.symbol}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Decimals</span>
                <span className="text-white">{tokenInfo.decimals}</span>
              </div>

              {userAddress && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Your Address</span>
                  <span className="text-white font-mono text-xs">
                    {`${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`}
                  </span>
                </div>
              )}
            </div>

            {/* External Links */}
            <div className="mt-4 pt-4 border-t border-gray-600">
              <div className="flex items-center space-x-4 text-sm">
                <a
                  href={`https://basescan.org/token/${tokenInfo.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <ExternalLinkIcon className="h-3 w-3 mr-1" />
                  View on BaseScan
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Information Footer */}
      <div className="px-6 py-4 bg-blue-900/20 border-t border-gray-700 rounded-b-lg">
        <div className="flex items-start">
          <InfoIcon className="h-4 w-4 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-200">
            <p>
              <strong className="text-blue-300">EMARK tokens</strong> are used for staking and content curation in the Evermark protocol. 
              Approve tokens to enable staking and earn voting power for content ranking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}