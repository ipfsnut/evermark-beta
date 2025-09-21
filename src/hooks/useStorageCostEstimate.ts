// src/hooks/useStorageCostEstimate.ts
// React hook for ArDrive storage cost estimation

import { useQuery, useMutation } from '@tanstack/react-query';
import { FEATURES } from '@/config/features';

interface CostEstimate {
  sizeBytes: number;
  usd: number;
  ar: string;
  winc: string;
  type?: string;
}

interface CostEstimateResponse {
  success: boolean;
  estimates: CostEstimate[];
  total: CostEstimate;
  rates: {
    arToUsd: number;
    wincToAr: number;
  };
  timestamp: string;
  warning?: string;
}

interface EstimateRequest {
  size?: number;
  files?: Array<{ size: number; type?: string }>;
  currency?: 'usd' | 'ar';
}

/**
 * Hook for estimating storage cost for a single file size
 */
export function useStorageCostEstimate(fileSize?: number) {
  return useQuery<CostEstimateResponse>({
    queryKey: ['storage', 'cost', 'estimate', fileSize],
    queryFn: async (): Promise<CostEstimateResponse> => {
      if (!fileSize || fileSize <= 0) {
        throw new Error('Valid file size is required');
      }

      // Check if ArDrive is enabled
      if (!FEATURES.isArDriveEnabled()) {
        // Return zero cost for IPFS (subscription model)
        return {
          success: true,
          estimates: [{
            sizeBytes: fileSize,
            usd: 0,
            ar: '0',
            winc: '0',
            type: 'ipfs'
          }],
          total: {
            sizeBytes: fileSize,
            usd: 0,
            ar: '0',
            winc: '0'
          },
          rates: {
            arToUsd: 0,
            wincToAr: 1e12
          },
          timestamp: new Date().toISOString(),
          warning: 'Using IPFS - no direct storage cost'
        };
      }

      const response = await fetch('/.netlify/functions/ardrive-estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ size: fileSize }),
      });

      if (!response.ok) {
        throw new Error(`Cost estimation failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Cost estimation failed');
      }

      return data;
    },
    enabled: !!fileSize && fileSize > 0,
    staleTime: 5 * 60 * 1000,    // Cache for 5 minutes
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
}

/**
 * Hook for estimating cost of multiple files
 */
export function useMultipleFilesCostEstimate(files?: Array<{ size: number; type?: string }>) {
  return useQuery<CostEstimateResponse>({
    queryKey: ['storage', 'cost', 'estimate', 'multiple', files],
    queryFn: async (): Promise<CostEstimateResponse> => {
      if (!files || files.length === 0) {
        throw new Error('Files array is required');
      }

      // Validate file sizes
      for (const file of files) {
        if (!file.size || file.size <= 0) {
          throw new Error('All files must have valid sizes');
        }
      }

      // Check if ArDrive is enabled
      if (!FEATURES.isArDriveEnabled()) {
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        
        return {
          success: true,
          estimates: files.map(file => ({
            sizeBytes: file.size,
            usd: 0,
            ar: '0',
            winc: '0',
            type: file.type || 'ipfs'
          })),
          total: {
            sizeBytes: totalSize,
            usd: 0,
            ar: '0',
            winc: '0'
          },
          rates: {
            arToUsd: 0,
            wincToAr: 1e12
          },
          timestamp: new Date().toISOString(),
          warning: 'Using IPFS - no direct storage cost'
        };
      }

      const response = await fetch('/.netlify/functions/ardrive-estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files }),
      });

      if (!response.ok) {
        throw new Error(`Cost estimation failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Cost estimation failed');
      }

      return data;
    },
    enabled: !!files && files.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Hook for cost estimation mutations (immediate estimates)
 */
export function useStorageCostEstimator() {
  const mutation = useMutation<CostEstimateResponse, Error, EstimateRequest>({
    mutationFn: async (request: EstimateRequest): Promise<CostEstimateResponse> => {
      if (!request.size && !request.files) {
        throw new Error('Either size or files array is required');
      }

      // Check if ArDrive is enabled
      if (!FEATURES.isArDriveEnabled()) {
        const size = request.size || request.files?.reduce((sum, f) => sum + f.size, 0) || 0;
        
        return {
          success: true,
          estimates: [{
            sizeBytes: size,
            usd: 0,
            ar: '0',
            winc: '0'
          }],
          total: {
            sizeBytes: size,
            usd: 0,
            ar: '0',
            winc: '0'
          },
          rates: {
            arToUsd: 0,
            wincToAr: 1e12
          },
          timestamp: new Date().toISOString(),
          warning: 'Using IPFS - no direct storage cost'
        };
      }

      const response = await fetch('/.netlify/functions/ardrive-estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Cost estimation failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Cost estimation failed');
      }

      return data;
    },
  });

  return {
    estimate: mutation.mutate,
    estimateAsync: mutation.mutateAsync,
    isEstimating: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
    data: mutation.data,
    
    // Convenience methods
    estimateFileSize: (size: number) => 
      mutation.mutate({ size }),
    
    estimateFiles: (files: Array<{ size: number; type?: string }>) => 
      mutation.mutate({ files }),
    
    estimateEvermark: (imageSize: number, metadataSize: number = 2048) => 
      mutation.mutate({
        files: [
          { size: imageSize, type: 'image' },
          { size: metadataSize, type: 'metadata' }
        ]
      }),
  };
}

/**
 * Hook for File object cost estimation
 */
export function useFileCostEstimate(file?: File) {
  return useStorageCostEstimate(file?.size);
}

/**
 * Hook for evermark creation cost estimation (image + metadata)
 */
export function useEvermarkCostEstimate(imageFile?: File, estimatedMetadataSize: number = 2048) {
  const files = imageFile ? [
    { size: imageFile.size, type: 'image' },
    { size: estimatedMetadataSize, type: 'metadata' }
  ] : undefined;

  return useMultipleFilesCostEstimate(files);
}

/**
 * Hook for formatted cost display
 */
export function useCostFormatter() {
  const formatUsdCost = (usd: number): string => {
    if (usd === 0) {
      return 'Free';
    } else if (usd < 0.001) {
      return '< $0.001';
    } else if (usd < 0.01) {
      return `$${usd.toFixed(4)}`;
    } else if (usd < 1) {
      return `$${usd.toFixed(3)}`;
    } else {
      return `$${usd.toFixed(2)}`;
    }
  };

  const formatArCost = (ar: string): string => {
    const arNum = parseFloat(ar);
    if (arNum === 0) {
      return '0 AR';
    } else if (arNum < 0.001) {
      return '< 0.001 AR';
    } else {
      return `${arNum.toFixed(6)} AR`;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return {
    formatUsdCost,
    formatArCost,
    formatFileSize,
    
    // Format complete estimate
    formatEstimate: (estimate: CostEstimate) => ({
      size: formatFileSize(estimate.sizeBytes),
      usd: formatUsdCost(estimate.usd),
      ar: formatArCost(estimate.ar),
      primary: estimate.usd > 0 ? formatUsdCost(estimate.usd) : 'Free (IPFS)'
    }),
  };
}

/**
 * Hook for storage backend status
 */
export function useStorageBackendStatus() {
  return {
    backend: FEATURES.getStorageBackend(),
    ardriveEnabled: FEATURES.isArDriveEnabled(),
    dualStorage: FEATURES.shouldUseDualStorage(),
    
    // Display info
    backendName: FEATURES.getStorageBackend() === 'ardrive' ? 'ArDrive' : 'IPFS',
    permanentStorage: FEATURES.isArDriveEnabled(),
    
    // Cost model
    costModel: FEATURES.isArDriveEnabled() ? 'pay-per-use' : 'subscription',
    costDescription: FEATURES.isArDriveEnabled() 
      ? 'One-time payment for 200+ years of permanent storage'
      : 'Included in platform subscription',
  };
}

/**
 * Utility hook for cost comparisons
 */
export function useCostComparison() {
  const formatters = useCostFormatter();
  
  const compareWithTraditional = (arDriveCost: number, fileSizeBytes: number) => {
    // Rough estimates for comparison
    const googleDriveCostPerMB = 0.02 / 15 / 1024; // $2/month for 15GB
    const dropboxCostPerMB = 0.0099 / 2 / 1024;   // $9.99/month for 2TB
    const awsS3CostPerMB = 0.023 / 1024;          // $0.023/GB/month
    
    const fileSizeMB = fileSizeBytes / 1024 / 1024;
    
    const yearlyComparisons = {
      googleDrive: googleDriveCostPerMB * fileSizeMB * 12,
      dropbox: dropboxCostPerMB * fileSizeMB * 12,
      awsS3: awsS3CostPerMB * fileSizeMB * 12,
      arDrive: arDriveCost // One-time cost
    };
    
    // 10-year comparison
    const tenYearComparisons = {
      googleDrive: yearlyComparisons.googleDrive * 10,
      dropbox: yearlyComparisons.dropbox * 10,
      awsS3: yearlyComparisons.awsS3 * 10,
      arDrive: arDriveCost // Still one-time
    };
    
    return {
      yearly: yearlyComparisons,
      tenYear: tenYearComparisons,
      savings: {
        vsGoogleDrive: tenYearComparisons.googleDrive - arDriveCost,
        vsDropbox: tenYearComparisons.dropbox - arDriveCost,
        vsAwsS3: tenYearComparisons.awsS3 - arDriveCost,
      },
      formatted: {
        yearly: Object.fromEntries(
          Object.entries(yearlyComparisons).map(([k, v]) => [k, formatters.formatUsdCost(v)])
        ),
        tenYear: Object.fromEntries(
          Object.entries(tenYearComparisons).map(([k, v]) => [k, formatters.formatUsdCost(v)])
        ),
      }
    };
  };
  
  return {
    compareWithTraditional,
  };
}