import React, { useState } from 'react';
import { X, Lock, FileText, AlertCircle } from 'lucide-react';
import { useTheme } from '../../../providers/ThemeProvider';
import { cn } from '../../../utils/responsive';
import type { Evermark } from '../types';

interface StakeForVerificationModalProps {
  evermark: Evermark;
  isOpen: boolean;
  onClose: () => void;
  onStake: (notes: string) => Promise<void>;
}

export function StakeForVerificationModal({ 
  evermark, 
  isOpen, 
  onClose, 
  onStake 
}: StakeForVerificationModalProps) {
  const { isDark } = useTheme();
  const [notes, setNotes] = useState('');
  const [isStaking, setIsStaking] = useState(false);

  if (!isOpen) return null;

  const handleStake = async () => {
    if (!notes.trim()) {
      alert('Please add attestation notes explaining your relationship to this content.');
      return;
    }

    setIsStaking(true);
    try {
      await onStake(notes.trim());
      onClose();
    } catch (error) {
      console.error('Staking failed:', error);
    } finally {
      setIsStaking(false);
    }
  };

  const isContentCreator = evermark.author === evermark.creator || 
                          evermark.author.toLowerCase().includes(evermark.creator.toLowerCase());

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className={cn(
        "bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto",
        isDark ? "bg-gray-800 border border-gray-700" : "bg-white"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-orange-400" />
            <h3 className={cn("text-lg font-semibold", isDark ? "text-white" : "text-gray-900")}>
              Stake for Verification
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Warning if not obvious content creator */}
          {!isContentCreator && (
            <div className={cn(
              "bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3",
              isDark ? "bg-yellow-900/20 border-yellow-700" : "bg-yellow-50 border-yellow-200"
            )}>
              <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className={cn("font-medium text-yellow-800", isDark ? "text-yellow-200" : "text-yellow-800")}>
                  Verification Risk
                </h4>
                <p className={cn("text-sm text-yellow-700", isDark ? "text-yellow-300" : "text-yellow-700")}>
                  The author ({evermark.author}) doesn't match your address. Only stake if you can prove you created this content.
                </p>
              </div>
            </div>
          )}

          {/* Evermark Info */}
          <div className={cn(
            "bg-gray-50 rounded-lg p-4",
            isDark ? "bg-gray-700/50" : "bg-gray-50"
          )}>
            <h4 className={cn("font-medium mb-2", isDark ? "text-white" : "text-gray-900")}>
              Evermark Details
            </h4>
            <div className="space-y-1 text-sm">
              <div><strong>Title:</strong> {evermark.title}</div>
              <div><strong>Author:</strong> {evermark.author}</div>
              <div><strong>Content:</strong> {evermark.contentType}</div>
              <div><strong>Token ID:</strong> #{evermark.tokenId}</div>
            </div>
          </div>

          {/* Attestation Notes */}
          <div>
            <label className={cn("block text-sm font-medium mb-2", isDark ? "text-white" : "text-gray-900")}>
              Attestation Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain your relationship to this content and why it should be verified. For example: 'I am the original author of this cast posted on my Farcaster account @username' or 'I am the lead author of this academic paper and can provide institutional verification.'"
              className={cn(
                "w-full h-32 px-3 py-2 border rounded-lg resize-none",
                isDark 
                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" 
                  : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
              )}
              maxLength={500}
            />
            <div className={cn("text-xs mt-1", isDark ? "text-gray-400" : "text-gray-500")}>
              {notes.length}/500 characters
            </div>
          </div>

          {/* Staking Warning */}
          <div className={cn(
            "bg-orange-50 border border-orange-200 rounded-lg p-4",
            isDark ? "bg-orange-900/20 border-orange-700" : "bg-orange-50 border-orange-200"
          )}>
            <h4 className={cn("font-medium text-orange-800 mb-1", isDark ? "text-orange-200" : "text-orange-800")}>
              Staking Commitment
            </h4>
            <p className={cn("text-sm text-orange-700", isDark ? "text-orange-300" : "text-orange-700")}>
              By staking your NFT, you're putting it at risk. Failed verification results in forced unstaking and permanent verification ban for this token.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={cn(
                "flex-1 px-4 py-2 rounded-lg font-medium transition-colors",
                isDark 
                  ? "bg-gray-700 hover:bg-gray-600 text-white" 
                  : "bg-gray-100 hover:bg-gray-200 text-gray-900"
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleStake}
              disabled={isStaking || !notes.trim()}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                "bg-orange-600 hover:bg-orange-700 text-white",
                (isStaking || !notes.trim()) && "opacity-50 cursor-not-allowed"
              )}
            >
              <Lock className="h-4 w-4" />
              {isStaking ? 'Staking...' : 'Stake NFT'}
            </button>
          </div>

          <p className={cn("text-xs text-center", isDark ? "text-gray-400" : "text-gray-500")}>
            Your notes will be included in the attestation document as proof of authenticity.
          </p>
        </div>
      </div>
    </div>
  );
}