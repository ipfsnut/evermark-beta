import React, { useState } from 'react';
import { useMarketplaceState } from '../hooks/useMarketplaceState';
import { verifyNFTOwnership, isApprovedForMarketplace } from '../services/MarketplaceService';

interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateListingModal({ isOpen, onClose, onSuccess }: CreateListingModalProps) {
  const {
    handleCreateListing,
    handleApproveMarketplace,
    isCreatingListing,
    isApproving,
    isConnected,
    walletAccount,
  } = useMarketplaceState();

  const [tokenId, setTokenId] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<'ETH' | 'EMARK'>('ETH');
  const [error, setError] = useState('');
  const [isCheckingOwnership, setIsCheckingOwnership] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approvalSuccess, setApprovalSuccess] = useState(false);

  const handleTokenIdChange = async (value: string) => {
    setTokenId(value);
    setError('');
    setNeedsApproval(false);
    setApprovalSuccess(false);

    if (value && walletAccount?.address) {
      setIsCheckingOwnership(true);
      try {
        // Verify ownership
        const ownsNFT = await verifyNFTOwnership(walletAccount.address, value);
        if (!ownsNFT) {
          setError(`You don't own NFT #${value}`);
          setIsCheckingOwnership(false);
          return;
        }

        // Check if approval is needed
        const isApproved = await isApprovedForMarketplace(walletAccount.address, value);
        setNeedsApproval(!isApproved);
        
      } catch (err) {
        setError('Failed to verify NFT ownership');
      }
      setIsCheckingOwnership(false);
    }
  };

  const handleApprove = async () => {
    if (!tokenId) return;
    
    try {
      setError(''); // Clear any previous errors
      const result = await handleApproveMarketplace(tokenId);
      if (result.success) {
        setNeedsApproval(false);
        setApprovalSuccess(true);
        setError('');
      }
    } catch (err) {
      setError('Failed to approve marketplace');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tokenId || !price) {
      setError('Please fill in all fields');
      return;
    }

    if (needsApproval) {
      setError('Please approve the marketplace first');
      return;
    }

    try {
      const result = await handleCreateListing(tokenId, price, currency);
      if (result.success) {
        onSuccess();
        onClose();
        // Reset form
        setTokenId('');
        setPrice('');
        setCurrency('ETH');
        setError('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create listing');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Create Listing</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {!isConnected ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🔐</div>
            <h3 className="text-lg font-semibold text-white mb-2">Connect Your Wallet</h3>
            <p className="text-gray-400">You need to connect your wallet to create listings.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Token ID *
              </label>
              <input
                type="number"
                value={tokenId}
                onChange={(e) => handleTokenIdChange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:border-cyber-primary focus:outline-none"
                placeholder="Enter the NFT token ID you want to sell"
                min="1"
                required
              />
              {isCheckingOwnership && (
                <div className="text-xs text-gray-400 mt-1">Checking ownership...</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Price *
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:border-cyber-primary focus:outline-none"
                placeholder="0.1"
                min="0"
                step="0.001"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Currency *
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'ETH' | 'EMARK')}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:border-cyber-primary focus:outline-none"
              >
                <option value="ETH">ETH</option>
                <option value="EMARK">EMARK</option>
              </select>
            </div>

            {needsApproval && (
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <span className="text-yellow-400">⚠️</span>
                  <div>
                    <p className="text-yellow-200 text-sm font-medium">Approval Required</p>
                    <p className="text-yellow-300 text-xs mt-1">
                      You need to approve the marketplace to transfer this NFT.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="mt-3 w-full bg-yellow-600 text-white py-2 px-4 rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isApproving ? 'Approving...' : 'Approve Marketplace'}
                </button>
              </div>
            )}

            {approvalSuccess && !needsApproval && (
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <span className="text-green-400">✅</span>
                  <p className="text-green-200 text-sm font-medium">Approval Successful!</p>
                </div>
                <p className="text-green-300 text-xs mt-1">
                  You can now create your listing by clicking "Create Listing" below.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingListing || needsApproval || isCheckingOwnership}
                className="flex-1 bg-cyber-primary text-black py-2 px-4 rounded-md hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCreatingListing ? 'Creating...' : approvalSuccess && !needsApproval ? 'Create Listing ✨' : 'Create Listing'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-4 text-xs text-gray-500">
          <p>• Listings are active for 10 years by default</p>
          <p>• 1% marketplace fee will be applied to sales</p>
          <p>• You can cancel your listing at any time</p>
        </div>
      </div>
    </div>
  );
}