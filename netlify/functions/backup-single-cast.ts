import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface BackupRequest {
  castInput: string;
  castData: any;
  includeMedia?: boolean;
  includeThread?: boolean;
  userWallet?: string;
}

interface BackupResult {
  backupId: string;
  includedMedia: boolean;
  includedThread: boolean;
  costPaid: number;
  mediaUrls: string[];
  preservedMediaCount: number;
  threadHash?: string;
  ardriveTransactions: string[];
  ipfsHashes: string[];
}

/**
 * Generate unique backup ID
 */
function generateBackupId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `backup_${timestamp}_${random}`;
}

/**
 * Process media preservation
 */
async function processMediaPreservation(embeds: any[]): Promise<{
  mediaUrls: string[];
  preservedCount: number;
  totalCost: number;
  ardriveTransactions: string[];
  ipfsHashes: string[];
}> {
  if (!embeds || embeds.length === 0) {
    return {
      mediaUrls: [],
      preservedCount: 0,
      totalCost: 0,
      ardriveTransactions: [],
      ipfsHashes: [],
    };
  }

  const results = {
    mediaUrls: [] as string[],
    preservedCount: 0,
    totalCost: 0,
    ardriveTransactions: [] as string[],
    ipfsHashes: [] as string[],
  };

  for (const embed of embeds) {
    if (embed.url) {
      try {
        // Call preserve-media function
        const response = await fetch('/.netlify/functions/preserve-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: embed.url }),
        });

        if (response.ok) {
          const preserved = await response.json();
          results.mediaUrls.push(embed.url);
          results.preservedCount++;
          results.totalCost += 0.10; // Approximate cost per media item
          
          if (preserved.ardrive_tx) {
            results.ardriveTransactions.push(preserved.ardrive_tx);
          }
          if (preserved.ipfs_hash) {
            results.ipfsHashes.push(preserved.ipfs_hash);
          }
        }
      } catch (error) {
        console.error(`Failed to preserve media: ${embed.url}`, error);
        // Continue with other media items
      }
    }
  }

  return results;
}

/**
 * Process thread preservation
 */
async function processThreadPreservation(castHash: string): Promise<{
  threadHash?: string;
  threadCost: number;
}> {
  try {
    const response = await fetch('/.netlify/functions/preserve-thread', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ castHash }),
    });

    if (response.ok) {
      const threadData = await response.json();
      return {
        threadHash: threadData.thread_hash,
        threadCost: 0.02, // Approximate cost for thread preservation
      };
    }
  } catch (error) {
    console.error('Failed to preserve thread:', error);
  }

  return { threadHash: undefined, threadCost: 0 };
}

/**
 * Store backup record in database
 */
async function storeBackupRecord(
  backupId: string,
  castData: any,
  result: BackupResult,
  userWallet?: string
): Promise<void> {
  try {
    await supabase.from('cast_backups').insert({
      backup_id: backupId,
      cast_hash: castData.castHash,
      cast_author: castData.author,
      cast_content: castData.content,
      user_wallet: userWallet?.toLowerCase(),
      included_media: result.includedMedia,
      included_thread: result.includedThread,
      media_count: result.preservedMediaCount,
      cost_paid: result.costPaid,
      ardrive_transactions: result.ardriveTransactions,
      ipfs_hashes: result.ipfsHashes,
      created_at: new Date().toISOString(),
    });

    // Also track costs for future estimates
    if (userWallet && result.costPaid > 0) {
      await supabase.from('backup_costs').insert({
        user_wallet: userWallet.toLowerCase(),
        cost_usd: result.costPaid,
        operation_type: 'single_cast_backup',
        media_included: result.includedMedia,
        thread_included: result.includedThread,
        created_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Failed to store backup record:', error);
    // Don't throw - backup succeeded even if recording failed
  }
}

export const handler: Handler = async (event) => {
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
    const {
      castInput,
      castData,
      includeMedia = true,
      includeThread = false,
      userWallet,
    }: BackupRequest = JSON.parse(event.body || '{}');

    if (!castInput || !castData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Cast input and data are required' }),
      };
    }

    console.log('🚀 Starting cast backup for:', castData.castHash);

    const backupId = generateBackupId();
    let totalCost = 0.05; // Base cost

    // Process media preservation
    let mediaResult = {
      mediaUrls: [] as string[],
      preservedCount: 0,
      totalCost: 0,
      ardriveTransactions: [] as string[],
      ipfsHashes: [] as string[],
    };

    if (includeMedia && castData.embeds) {
      console.log('📸 Processing media preservation...');
      mediaResult = await processMediaPreservation(castData.embeds);
      totalCost += mediaResult.totalCost;
    }

    // Process thread preservation
    let threadResult: { threadHash?: string; threadCost: number } = { 
      threadHash: undefined, 
      threadCost: 0 
    };
    if (includeThread && castData.castHash) {
      console.log('🧵 Processing thread preservation...');
      threadResult = await processThreadPreservation(castData.castHash);
      totalCost += threadResult.threadCost;
    }

    const result: BackupResult = {
      backupId,
      includedMedia: includeMedia && mediaResult.preservedCount > 0,
      includedThread: includeThread && !!threadResult.threadHash,
      costPaid: Math.round(totalCost * 100) / 100,
      mediaUrls: mediaResult.mediaUrls,
      preservedMediaCount: mediaResult.preservedCount,
      threadHash: threadResult.threadHash,
      ardriveTransactions: mediaResult.ardriveTransactions,
      ipfsHashes: mediaResult.ipfsHashes,
    };

    // Store backup record
    await storeBackupRecord(backupId, castData, result, userWallet);

    console.log('✅ Cast backup completed:', backupId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('❌ Cast backup failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Backup failed' 
      }),
    };
  }
};