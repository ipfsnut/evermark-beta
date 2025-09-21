// src/components/StorageCostEstimator.tsx
// Component for displaying storage cost estimates

import React from 'react';
import { useFileCostEstimate, useCostFormatter, useStorageBackendStatus, useCostComparison } from '@/hooks/useStorageCostEstimate';
import { FEATURES } from '@/config/features';

interface StorageCostEstimatorProps {
  file?: File;
  className?: string;
  showComparison?: boolean;
  showDetails?: boolean;
}

export function StorageCostEstimator({ 
  file, 
  className = '',
  showComparison = false,
  showDetails = false 
}: StorageCostEstimatorProps) {
  const { data: estimate, isLoading, error } = useFileCostEstimate(file);
  const { formatEstimate, formatFileSize } = useCostFormatter();
  const { backendName, permanentStorage, costDescription } = useStorageBackendStatus();
  const { compareWithTraditional } = useCostComparison();

  // Don't show if no file
  if (!file) return null;

  // Don't show if ArDrive is disabled (IPFS has no direct cost)
  if (!FEATURES.isArDriveEnabled()) {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <h3 className="text-sm font-medium text-green-900">
            Storage: {backendName}
          </h3>
        </div>
        <p className="text-lg font-bold text-green-600 mt-1">
          Free
        </p>
        <p className="text-xs text-green-600 mt-1">
          {formatFileSize(file.size)} • {costDescription}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            <div className="h-4 bg-gray-300 rounded w-24"></div>
          </div>
          <div className="h-6 bg-gray-300 rounded w-16 mt-2"></div>
          <div className="h-3 bg-gray-300 rounded w-32 mt-1"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <h3 className="text-sm font-medium text-yellow-900">
            Storage Cost
          </h3>
        </div>
        <p className="text-sm text-yellow-700 mt-1">
          Unable to estimate cost
        </p>
        <p className="text-xs text-yellow-600 mt-1">
          {formatFileSize(file.size)} • Cost estimation will be available at upload
        </p>
      </div>
    );
  }

  if (!estimate?.success) {
    return null;
  }

  const formatted = formatEstimate(estimate.total);
  const comparison = showComparison && estimate.total.usd > 0 
    ? compareWithTraditional(estimate.total.usd, estimate.total.sizeBytes)
    : null;

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <h3 className="text-sm font-medium text-blue-900">
            Permanent Storage Cost
          </h3>
        </div>
        {permanentStorage && (
          <div className="px-2 py-1 bg-blue-100 rounded text-xs font-medium text-blue-700">
            200+ years
          </div>
        )}
      </div>

      {/* Cost Display */}
      <div className="mt-2">
        <p className="text-2xl font-bold text-blue-600">
          {formatted.primary}
        </p>
        
        {estimate.total.usd > 0 && showDetails && (
          <div className="text-xs text-blue-600 mt-1 space-y-1">
            <div>≈ {formatted.ar}</div>
            <div>{estimate.total.winc} winc</div>
          </div>
        )}
      </div>

      {/* File Info */}
      <div className="flex items-center justify-between mt-2 text-xs text-blue-600">
        <span>{formatted.size}</span>
        <span>{backendName}</span>
      </div>

      {/* Description */}
      <p className="text-xs text-blue-600 mt-2">
        {costDescription}
      </p>

      {/* Warning if applicable */}
      {estimate.warning && (
        <p className="text-xs text-yellow-600 mt-2 italic">
          {estimate.warning}
        </p>
      )}

      {/* Cost Comparison */}
      {comparison && (
        <div className="mt-4 pt-3 border-t border-blue-200">
          <h4 className="text-xs font-medium text-blue-800 mb-2">
            vs. Traditional Storage (10 years)
          </h4>
          <div className="space-y-1 text-xs text-blue-700">
            <div className="flex justify-between">
              <span>Google Drive:</span>
              <span>{comparison.formatted.tenYear.googleDrive}</span>
            </div>
            <div className="flex justify-between">
              <span>Dropbox:</span>
              <span>{comparison.formatted.tenYear.dropbox}</span>
            </div>
            <div className="flex justify-between">
              <span>AWS S3:</span>
              <span>{comparison.formatted.tenYear.awsS3}</span>
            </div>
            <div className="flex justify-between font-medium border-t border-blue-200 pt-1">
              <span>ArDrive:</span>
              <span>{formatted.primary}</span>
            </div>
          </div>
          
          {comparison.savings.vsGoogleDrive > 0 && (
            <p className="text-xs text-green-600 mt-2 font-medium">
              Save ${comparison.savings.vsGoogleDrive.toFixed(4)} vs Google Drive
            </p>
          )}
        </div>
      )}

      {/* Details Toggle */}
      {!showDetails && estimate.total.usd > 0 && (
        <button
          onClick={() => {/* Toggle details */}}
          className="text-xs text-blue-500 hover:text-blue-600 mt-2 underline"
        >
          Show details
        </button>
      )}
    </div>
  );
}

/**
 * Simplified cost display for inline use
 */
export function InlineStorageCost({ file, className = '' }: { file?: File; className?: string }) {
  const { data: estimate, isLoading } = useFileCostEstimate(file);
  const { formatEstimate } = useCostFormatter();
  const { backendName } = useStorageBackendStatus();

  if (!file || isLoading) {
    return (
      <span className={`text-sm text-gray-500 ${className}`}>
        Calculating cost...
      </span>
    );
  }

  if (!estimate?.success) {
    return (
      <span className={`text-sm text-gray-500 ${className}`}>
        Cost: TBD
      </span>
    );
  }

  const formatted = formatEstimate(estimate.total);

  return (
    <span className={`text-sm font-medium ${className}`}>
      <span className="text-gray-500">Storage:</span>{' '}
      <span className="text-blue-600">{formatted.primary}</span>
      <span className="text-gray-400 ml-1">({backendName})</span>
    </span>
  );
}

/**
 * Cost estimator for evermark creation (image + metadata)
 */
interface EvermarkCostEstimatorProps {
  imageFile?: File;
  className?: string;
  showBreakdown?: boolean;
}

export function EvermarkCostEstimator({ 
  imageFile, 
  className = '',
  showBreakdown = false 
}: EvermarkCostEstimatorProps) {
  const metadataSize = 2048; // Estimated metadata size
  const files = imageFile ? [
    { size: imageFile.size, type: 'image' },
    { size: metadataSize, type: 'metadata' }
  ] : undefined;

  const { data: estimate, isLoading, error } = useMultipleFilesCostEstimate(files);
  const { formatEstimate, formatFileSize } = useCostFormatter();
  const { backendName, costDescription } = useStorageBackendStatus();

  if (!imageFile) return null;

  if (!FEATURES.isArDriveEnabled()) {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-green-900">
            Evermark Storage
          </span>
          <span className="text-lg font-bold text-green-600">Free</span>
        </div>
        <p className="text-xs text-green-600 mt-1">
          Image + Metadata • {backendName}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-3 ${className}`}>
        <div className="animate-pulse flex items-center justify-between">
          <div className="h-4 bg-gray-300 rounded w-24"></div>
          <div className="h-5 bg-gray-300 rounded w-16"></div>
        </div>
      </div>
    );
  }

  if (error || !estimate?.success) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-yellow-900">
            Evermark Storage
          </span>
          <span className="text-sm text-yellow-700">Cost TBD</span>
        </div>
      </div>
    );
  }

  const formatted = formatEstimate(estimate.total);

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-3 ${className}`}>
      {/* Main Display */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-blue-900">
          Evermark Storage
        </span>
        <span className="text-lg font-bold text-blue-600">
          {formatted.primary}
        </span>
      </div>

      {/* Breakdown */}
      {showBreakdown && estimate.estimates.length > 1 && (
        <div className="mt-2 space-y-1 text-xs text-blue-700">
          {estimate.estimates.map((est, index) => {
            const estFormatted = formatEstimate(est);
            return (
              <div key={index} className="flex justify-between">
                <span>{est.type === 'image' ? 'Image' : 'Metadata'} ({formatFileSize(est.sizeBytes)}):</span>
                <span>{estFormatted.primary}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Description */}
      <p className="text-xs text-blue-600 mt-2">
        {formatFileSize(estimate.total.sizeBytes)} total • {costDescription}
      </p>
    </div>
  );
}

// Import the multiple files hook that was missing
import { useMultipleFilesCostEstimate } from '@/hooks/useStorageCostEstimate';