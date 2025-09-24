import React from 'react';
import { X, AlertTriangle, FileImage, FileVideo, Zap, DollarSign, Info } from 'lucide-react';

interface MediaFile {
  url: string;
  type: string;
  sizeMB: number;
  estimatedCostUSD: number;
}

interface CostBreakdown {
  baseCost: number;
  mediaCost: number;
  threadCost: number;
  estimatedFileSize: number;
  shouldChargeExtra?: boolean;
  mediaFiles?: MediaFile[];
  ourProfitUSD?: number;
  recommendedFeeUSD?: number;
}

interface DynamicFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (agreedFeeUSD: number) => void;
  onReject: () => void;
  
  // Cost data
  totalCostUSD: number;
  currentFeeUSD: number;
  recommendedFeeUSD: number;
  profitUSD: number;
  breakdown: CostBreakdown;
  
  // UI props
  castUrl?: string;
  isProcessing?: boolean;
}

export function DynamicFeeModal({
  isOpen,
  onClose,
  onAccept,
  onReject,
  totalCostUSD,
  currentFeeUSD,
  recommendedFeeUSD,
  profitUSD,
  breakdown,
  castUrl,
  isProcessing = false,
}: DynamicFeeModalProps) {
  if (!isOpen) return null;

  const isLosing = profitUSD < 0;
  const extraFeeUSD = recommendedFeeUSD - currentFeeUSD;
  const extraFeeETH = extraFeeUSD / 2500; // Rough ETH conversion, should use real price

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'video': return <FileVideo className="w-4 h-4 text-red-400" />;
      case 'image': return <FileImage className="w-4 h-4 text-blue-400" />;
      case 'gif': return <FileImage className="w-4 h-4 text-purple-400" />;
      default: return <FileImage className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isLosing ? 'bg-red-500/20' : 'bg-yellow-500/20'}`}>
              {isLosing ? (
                <AlertTriangle className="w-5 h-5 text-red-400" />
              ) : (
                <DollarSign className="w-5 h-5 text-yellow-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {isLosing ? 'High Storage Cost Detected' : 'Dynamic Pricing Required'}
              </h3>
              <p className="text-sm text-gray-400">
                This cast requires additional fees for permanent storage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Cost Summary */}
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-blue-400" />
              <h4 className="font-semibold text-white">Cost Breakdown</h4>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Base storage fee:</span>
                <span className="text-white">${breakdown.baseCost.toFixed(4)}</span>
              </div>
              
              {breakdown.mediaCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Media storage ({breakdown.estimatedFileSize.toFixed(1)} MB):</span>
                  <span className="text-white">${breakdown.mediaCost.toFixed(4)}</span>
                </div>
              )}
              
              {breakdown.threadCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Thread preservation:</span>
                  <span className="text-white">${breakdown.threadCost.toFixed(4)}</span>
                </div>
              )}
              
              <div className="border-t border-gray-600 pt-2 mt-2">
                <div className="flex justify-between text-base font-semibold">
                  <span className="text-gray-300">Total ArDrive cost:</span>
                  <span className="text-white">${totalCostUSD.toFixed(4)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Media Files List */}
          {breakdown.mediaFiles && breakdown.mediaFiles.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-3">Media Files ({breakdown.mediaFiles.length})</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {breakdown.mediaFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getFileIcon(file.type)}
                      <span className="text-gray-300 truncate">
                        {file.url.split('/').pop() || 'media file'}
                      </span>
                      <span className="text-gray-500">({file.sizeMB.toFixed(1)} MB)</span>
                    </div>
                    <span className="text-white">${file.estimatedCostUSD.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fee Comparison */}
          <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-xl p-4 border border-purple-500/30">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Standard fee (0.00007 ETH):</span>
                <span className="text-white">${currentFeeUSD.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Required fee for this cast:</span>
                <span className={`font-bold text-lg ${isLosing ? 'text-red-400' : 'text-yellow-400'}`}>
                  ${recommendedFeeUSD.toFixed(4)}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Additional fee needed:</span>
                <span className={`font-semibold ${isLosing ? 'text-red-400' : 'text-yellow-400'}`}>
                  +${extraFeeUSD.toFixed(4)} (+{extraFeeETH.toFixed(6)} ETH)
                </span>
              </div>
              
              {profitUSD < 0 && (
                <div className="bg-red-500/20 rounded-lg p-2 mt-2">
                  <p className="text-red-300 text-xs">
                    ⚠️ Without additional fee, we would lose ${Math.abs(profitUSD).toFixed(4)} on this transaction
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Why This Happens */}
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h4 className="font-semibold text-white mb-2">Why the extra fee?</h4>
            <p className="text-sm text-gray-300 leading-relaxed">
              Large media files require significant storage costs on Arweave for permanent preservation. 
              Our standard fee of $0.30 covers basic text and small images, but larger content needs 
              additional fees to maintain the service sustainably.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onReject}
              disabled={isProcessing}
              className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50"
            >
              Skip This Cast
            </button>
            <button
              onClick={() => onAccept(recommendedFeeUSD)}
              disabled={isProcessing}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 text-white rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Pay ${recommendedFeeUSD.toFixed(4)}
                </>
              )}
            </button>
          </div>
          
          <p className="text-xs text-gray-500 text-center">
            This ensures permanent, decentralized storage for your content
          </p>
        </div>
      </div>
    </div>
  );
}