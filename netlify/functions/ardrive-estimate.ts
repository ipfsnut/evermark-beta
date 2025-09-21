// netlify/functions/ardrive-estimate.ts
// ArDrive cost estimation service

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { ArDriveService } from '../lib/ArDriveService';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface EstimateRequest {
  size?: number;           // File size in bytes
  files?: Array<{          // Multiple files estimation
    size: number;
    type: string;
  }>;
  currency?: 'usd' | 'ar'; // Preferred currency for response
}

interface EstimateResponse {
  success: boolean;
  estimates: Array<{
    sizeBytes: number;
    usd: number;
    ar: string;
    winc: string;
    type?: string;
  }>;
  total: {
    sizeBytes: number;
    usd: number;
    ar: string;
    winc: string;
  };
  rates: {
    arToUsd: number;
    wincToAr: number;
  };
  timestamp: string;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    console.log('💰 ArDrive cost estimation request received');

    // Check if ArDrive is enabled
    if (process.env.VITE_ARDRIVE_ENABLED !== 'true') {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: 'ArDrive cost estimation unavailable',
          message: 'ArDrive is currently disabled'
        }),
      };
    }

    // Parse request
    const estimateRequest: EstimateRequest = JSON.parse(event.body || '{}');
    
    // Validate request
    if (!estimateRequest.size && !estimateRequest.files) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Either size or files array is required',
          example: {
            size: 1048576,
            currency: 'usd'
          }
        }),
      };
    }

    // Initialize ArDrive service
    const ardriveService = new ArDriveService();
    await ardriveService.initialize();

    // Prepare files list for estimation
    let filesToEstimate: Array<{ size: number; type?: string }> = [];
    
    if (estimateRequest.size) {
      filesToEstimate.push({ size: estimateRequest.size });
    }
    
    if (estimateRequest.files) {
      filesToEstimate.push(...estimateRequest.files);
    }

    // Validate file sizes
    for (const file of filesToEstimate) {
      if (file.size <= 0 || file.size > 100 * 1024 * 1024) { // 100MB limit
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Invalid file size',
            message: 'File size must be between 1 byte and 100MB',
            receivedSize: file.size
          }),
        };
      }
    }

    // Get cost estimates
    const estimates = await Promise.all(
      filesToEstimate.map(async (file) => {
        const estimate = await ardriveService.estimateCost(file.size);
        return {
          sizeBytes: file.size,
          usd: estimate.usd,
          ar: estimate.ar,
          winc: estimate.winc,
          type: file.type
        };
      })
    );

    // Calculate totals
    const total = estimates.reduce(
      (acc, est) => ({
        sizeBytes: acc.sizeBytes + est.sizeBytes,
        usd: acc.usd + est.usd,
        ar: (parseFloat(acc.ar) + parseFloat(est.ar)).toString(),
        winc: (BigInt(acc.winc) + BigInt(est.winc)).toString()
      }),
      { sizeBytes: 0, usd: 0, ar: '0', winc: '0' }
    );

    // Get current rates for reference
    const sampleEstimate = estimates[0];
    const rates = {
      arToUsd: sampleEstimate.usd / parseFloat(sampleEstimate.ar || '1'),
      wincToAr: 1e12 // 1 AR = 1e12 winc
    };

    const response: EstimateResponse = {
      success: true,
      estimates,
      total,
      rates,
      timestamp: new Date().toISOString()
    };

    console.log('✅ Cost estimation completed:', {
      fileCount: estimates.length,
      totalSize: total.sizeBytes,
      totalCost: total.usd
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('❌ ArDrive cost estimation failed:', error);
    
    // Provide fallback estimation based on typical rates
    if (event.body) {
      try {
        const request = JSON.parse(event.body);
        const size = request.size || (request.files?.[0]?.size);
        
        if (size && size > 0) {
          const fallbackEstimate = getFallbackEstimate(size);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              estimates: [fallbackEstimate],
              total: fallbackEstimate,
              rates: {
                arToUsd: 50, // Approximate rate
                wincToAr: 1e12
              },
              timestamp: new Date().toISOString(),
              warning: 'This is a fallback estimate. Actual costs may vary.'
            }),
          };
        }
      } catch (parseError) {
        // Fall through to error response
      }
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Cost estimation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Please try again later or contact support'
      }),
    };
  }
};

/**
 * Get fallback cost estimate when ArDrive service is unavailable
 */
function getFallbackEstimate(sizeBytes: number) {
  // Rough estimation based on typical ArDrive rates
  // As of 2024: ~$0.001-0.002 per MB
  const mbSize = sizeBytes / (1024 * 1024);
  const usdCost = mbSize * 0.0015; // $0.0015 per MB estimate
  const arCost = usdCost / 50; // Assuming $50 per AR
  const wincCost = Math.floor(arCost * 1e12);

  return {
    sizeBytes,
    usd: usdCost,
    ar: arCost.toString(),
    winc: wincCost.toString()
  };
}

/**
 * Format cost estimate for display
 */
function formatCostEstimate(estimate: any): string {
  if (estimate.usd < 0.001) {
    return `< $0.001`;
  } else if (estimate.usd < 1) {
    return `$${estimate.usd.toFixed(4)}`;
  } else {
    return `$${estimate.usd.toFixed(2)}`;
  }
}

/**
 * Validate and sanitize file size input
 */
function validateFileSize(size: any): number {
  const parsedSize = typeof size === 'string' ? parseInt(size) : size;
  
  if (isNaN(parsedSize) || parsedSize <= 0) {
    throw new Error('Invalid file size: must be a positive number');
  }
  
  if (parsedSize > 100 * 1024 * 1024) { // 100MB
    throw new Error('File size too large: maximum 100MB');
  }
  
  return parsedSize;
}