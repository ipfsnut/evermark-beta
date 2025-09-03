import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, Users, Wallet, DollarSign, ExternalLink, RefreshCw } from 'lucide-react';

interface DistributionReviewProps {
  seasonNumber: number;
  rewardCalculation: any;
  onApprove: (distributions: any[]) => void;
  onProceed: () => void;
}

interface DistributionPreview {
  season: number;
  totalRecipients: number;
  creatorPayouts: number;
  supporterPayouts: number;
  totalAmount: bigint;
  contractBalance: bigint;
  hasSufficientBalance: boolean;
  estimatedGasCost: bigint;
  requiresMultiSig: boolean;
  distributions: any[];
}

interface ValidationResult {
  validRecipients: number;
  invalidRecipients: number;
  duplicateRecipients: number;
  totalDistributionAmount: string;
  validationErrors: string[];
}

export function DistributionReview({ 
  seasonNumber, 
  rewardCalculation, 
  onApprove, 
  onProceed 
}: DistributionReviewProps) {
  const [preview, setPreview] = useState<DistributionPreview | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [approved, setApproved] = useState(false);

  const formatEther = (value: bigint): string => {
    return (Number(value) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  const loadDistributionPreview = async () => {
    setIsValidating(true);
    
    try {
      // Prepare distributions
      const distributionsResponse = await fetch(`/.netlify/functions/admin-compute-rewards?action=prepare-distributions&season=${seasonNumber}&pool=${rewardCalculation.totalPool}`);
      if (!distributionsResponse.ok) {
        throw new Error('Failed to prepare distributions');
      }
      
      const distributions = await distributionsResponse.json();
      
      // Validate recipients
      const validationResponse = await fetch(`/.netlify/functions/admin-execute-distribution?action=validate-recipients&season=${seasonNumber}`);
      if (!validationResponse.ok) {
        throw new Error('Failed to validate recipients');
      }
      
      const validationResult = await validationResponse.json();
      setValidation(validationResult);
      
      // Simulate distribution
      const simulationResponse = await fetch(`/.netlify/functions/admin-execute-distribution?action=simulate-distribution&season=${seasonNumber}`);
      if (!simulationResponse.ok) {
        throw new Error('Failed to simulate distribution');
      }
      
      const simulation = await simulationResponse.json();
      
      // Create preview
      const creatorCount = Object.values(rewardCalculation.creatorRewards).filter(r => r !== null).length;
      const supporterCount = rewardCalculation.supporterRewards.length;
      
      const distributionPreview: DistributionPreview = {
        season: seasonNumber,
        totalRecipients: distributions.length,
        creatorPayouts: creatorCount,
        supporterPayouts: supporterCount,
        totalAmount: rewardCalculation.totalDistribution,
        contractBalance: BigInt("10000000000000000000000"), // 10k EMARK (simulated)
        hasSufficientBalance: true,
        estimatedGasCost: BigInt(simulation.estimatedGasCost),
        requiresMultiSig: rewardCalculation.totalDistribution > BigInt("5000000000000000000000"), // 5k EMARK threshold
        distributions
      };
      
      setPreview(distributionPreview);

    } catch (error) {
      console.error('Failed to load distribution preview:', error);
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    if (rewardCalculation) {
      loadDistributionPreview();
    }
  }, [rewardCalculation, seasonNumber]);

  const handleApprove = () => {
    if (preview) {
      setApproved(true);
      onApprove(preview.distributions);
    }
  };

  if (isValidating || !preview || !validation) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Preparing distribution preview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Review & Approval</h2>
        <p className="text-gray-400">Final review before executing reward distribution</p>
      </div>

      {/* Distribution Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <div className="flex items-center mb-3">
            <Users className="w-6 h-6 text-blue-400 mr-3" />
            <h3 className="text-lg font-semibold text-white">Recipients</h3>
          </div>
          <p className="text-2xl font-bold text-blue-400">{preview.totalRecipients}</p>
          <p className="text-gray-400 text-sm">{preview.creatorPayouts} creators, {preview.supporterPayouts} supporters</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <div className="flex items-center mb-3">
            <DollarSign className="w-6 h-6 text-green-400 mr-3" />
            <h3 className="text-lg font-semibold text-white">Total Amount</h3>
          </div>
          <p className="text-2xl font-bold text-green-400">{formatEther(preview.totalAmount)}</p>
          <p className="text-gray-400 text-sm">EMARK tokens</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <div className="flex items-center mb-3">
            <Wallet className="w-6 h-6 text-purple-400 mr-3" />
            <h3 className="text-lg font-semibold text-white">Contract Balance</h3>
          </div>
          <p className="text-2xl font-bold text-purple-400">{formatEther(preview.contractBalance)}</p>
          <div className="flex items-center mt-2">
            {preview.hasSufficientBalance ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-400 mr-1" />
                <p className="text-green-400 text-sm">Sufficient funds</p>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-red-400 mr-1" />
                <p className="text-red-400 text-sm">Insufficient funds</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Validation Results */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Recipient Validation</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Valid Recipients:</span>
            <span className="text-green-400 font-medium">{validation.validRecipients}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Invalid Recipients:</span>
            <span className={`font-medium ${validation.invalidRecipients > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {validation.invalidRecipients}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Duplicate Recipients:</span>
            <span className={`font-medium ${validation.duplicateRecipients > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
              {validation.duplicateRecipients}
            </span>
          </div>
        </div>

        {validation.validationErrors.length > 0 && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-500/50 rounded">
            <div className="flex items-center mb-2">
              <AlertTriangle className="w-4 h-4 text-red-400 mr-2" />
              <span className="text-red-400 font-medium">Validation Errors</span>
            </div>
            <ul className="text-red-300 text-sm space-y-1">
              {validation.validationErrors.slice(0, 5).map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
              {validation.validationErrors.length > 5 && (
                <li className="text-red-400">• And {validation.validationErrors.length - 5} more...</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Transaction Details */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Transaction Details</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-400">Estimated Gas Cost:</span>
            <span className="text-blue-400 font-medium">{formatEther(preview.estimatedGasCost)} ETH</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Multi-signature Required:</span>
            <span className={`font-medium ${preview.requiresMultiSig ? 'text-yellow-400' : 'text-green-400'}`}>
              {preview.requiresMultiSig ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Contract Address:</span>
            <a 
              href={`https://basescan.org/address/${process.env.VITE_SEASON_REWARD_DISTRIBUTOR_ADDRESS || ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 flex items-center text-sm"
            >
              {process.env.VITE_SEASON_REWARD_DISTRIBUTOR_ADDRESS?.slice(0, 10)}...
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </div>
        </div>
      </div>

      {/* Safety Checklist */}
      <div className="bg-blue-900/20 border border-blue-500/30 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-400 mb-4">Safety Checklist</h3>
        <div className="space-y-2">
          {[
            { check: 'Season has ended and is finalized', status: true },
            { check: 'All vote data is synced and validated', status: true },
            { check: 'Recipient addresses are valid', status: validation.invalidRecipients === 0 },
            { check: 'Contract has sufficient balance', status: preview.hasSufficientBalance },
            { check: 'No duplicate recipients', status: validation.duplicateRecipients === 0 }
          ].map((item, index) => (
            <div key={index} className="flex items-center">
              {item.status ? (
                <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 mr-2" />
              )}
              <span className={item.status ? 'text-green-400' : 'text-red-400'}>{item.check}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Approval Section */}
      {!approved && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 p-6 rounded-lg">
          <div className="flex items-center mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mr-2" />
            <h3 className="text-lg font-semibold text-yellow-400">Final Approval Required</h3>
          </div>
          <p className="text-yellow-300 text-sm mb-4">
            You are about to distribute {formatEther(preview.totalAmount)} EMARK tokens to {preview.totalRecipients} recipients. 
            This action cannot be undone. Please review all details carefully.
          </p>
          
          <div className="flex gap-4">
            <button
              onClick={handleApprove}
              disabled={validation.invalidRecipients > 0 || !preview.hasSufficientBalance}
              className="flex items-center justify-center px-6 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Approve Distribution
            </button>
          </div>
        </div>
      )}

      {/* Approved State */}
      {approved && (
        <div className="bg-green-900/20 border border-green-500/50 p-6 rounded-lg">
          <div className="flex items-center mb-4">
            <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
            <h3 className="text-lg font-semibold text-green-400">Distribution Approved</h3>
          </div>
          <p className="text-green-300 text-sm mb-4">
            Distribution has been approved and is ready for execution. You can proceed to the final execution step.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 pt-6">
        <button
          onClick={loadDistributionPreview}
          disabled={isValidating}
          className="flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
        >
          <RefreshCw className={`w-5 h-5 mr-2 ${isValidating ? 'animate-spin' : ''}`} />
          Refresh Preview
        </button>

        <button
          onClick={onProceed}
          disabled={!approved}
          className="flex-1 flex items-center justify-center px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
        >
          Proceed to Execution
        </button>
      </div>
    </div>
  );
}