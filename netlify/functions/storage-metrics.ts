// netlify/functions/storage-metrics.ts
// API endpoint for storage metrics and cost estimates

import { Context, Config } from '@netlify/functions';
import { ArDriveSeasonService } from '../lib/ArDriveSeasonService';

export default async function handler(req: Request, context: Context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'overview';

    switch (action) {
      case 'overview':
        return await getStorageOverview(headers);
      
      case 'estimate':
        return await getStorageEstimate(req, headers);
      
      case 'seasons':
        return await getSeasonMetrics(headers);
      
      default:
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid action. Use: overview, estimate, or seasons' 
          }),
          { status: 400, headers }
        );
    }
  } catch (error) {
    console.error('Storage metrics error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers }
    );
  }
}

async function getStorageOverview(headers: Record<string, string>) {
  try {
    const seasonService = new ArDriveSeasonService();
    
    // Get current season info
    const seasonState = await seasonService.getCurrentSeasonState();
    const currentSeason = seasonState.current;
    
    // Mock storage cost estimates - would integrate with actual ArDrive pricing
    const estimateStorageCost = (bytes: number) => {
      // Rough ArDrive pricing: ~$5 per GB for permanent storage
      const costPerByte = 5 / (1024 * 1024 * 1024); // $5 per GB
      return {
        costAR: bytes * costPerByte * 0.1, // Assume AR token conversion
        costUSD: bytes * costPerByte
      };
    };
    
    // Calculate storage metrics
    const metrics = {
      currentSeason: {
        number: currentSeason.number,
        folderReady: seasonState.sync?.arDrive?.currentFolderReady || false,
        estimatedCost: 0, // Would calculate based on expected uploads
      },
      totalStorage: {
        estimatedCostUSD: 0,
        totalFiles: 0,
        totalSizeBytes: 0,
      },
      costEstimates: {
        perEvermark: estimateStorageCost(1024 * 500), // 500KB estimate
        per1MB: estimateStorageCost(1024 * 1024),
        per10MB: estimateStorageCost(1024 * 1024 * 10),
      }
    };

    return new Response(
      JSON.stringify({ 
        success: true, 
        metrics,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers }
    );
  } catch (error) {
    throw new Error(`Failed to get storage overview: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getStorageEstimate(req: Request, headers: Record<string, string>) {
  try {
    const url = new URL(req.url);
    const sizeBytes = parseInt(url.searchParams.get('size') || '0');
    
    if (!sizeBytes || sizeBytes <= 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Valid size parameter required (bytes)' 
        }),
        { status: 400, headers }
      );
    }

    // Mock storage cost estimates - would integrate with actual ArDrive pricing
    const estimateStorageCost = (bytes: number) => {
      // Rough ArDrive pricing: ~$5 per GB for permanent storage
      const costPerByte = 5 / (1024 * 1024 * 1024); // $5 per GB
      return {
        costAR: bytes * costPerByte * 0.1, // Assume AR token conversion
        costUSD: bytes * costPerByte
      };
    };

    const estimate = estimateStorageCost(sizeBytes);

    return new Response(
      JSON.stringify({ 
        success: true, 
        estimate: {
          sizeBytes,
          costAR: estimate.costAR,
          costUSD: estimate.costUSD,
          currency: 'USD',
          provider: 'ArDrive',
          permanent: true
        },
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers }
    );
  } catch (error) {
    throw new Error(`Failed to get storage estimate: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getSeasonMetrics(headers: Record<string, string>) {
  try {
    const seasonService = new ArDriveSeasonService();
    const seasonState = await seasonService.getCurrentSeasonState();
    
    // Mock season storage data - in production this would query actual storage usage
    const seasonMetrics = {
      current: {
        season: seasonState.current.number,
        folderId: `season-${seasonState.current.number}-folder-id`,
        evermarkCount: 0,
        totalStorageBytes: 0,
        estimatedCostUSD: 0,
      },
      previous: {
        season: seasonState.previous.number,
        folderId: `season-${seasonState.previous.number}-folder-id`,
        evermarkCount: 0,
        totalStorageBytes: 0,
        estimatedCostUSD: 0,
      },
      sync: seasonState.sync?.arDrive || {
        currentFolderReady: false,
        previousFolderFinalized: false,
      }
    };

    return new Response(
      JSON.stringify({ 
        success: true, 
        seasonMetrics,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers }
    );
  } catch (error) {
    throw new Error(`Failed to get season metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export const config: Config = {
  path: '/storage-metrics'
};