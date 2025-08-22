// netlify/functions/farcaster-webhook.ts
// Main webhook handler for Farcaster events (mentions of @evermarkbot)
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Beta table name
const EVERMARKS_TABLE = 'beta_evermarks';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-neynar-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface FarcasterWebhookData {
  created_at: number;
  type: string;
  data: {
    hash: string;
    thread_hash: string;
    parent_hash?: string;
    parent_url?: string;
    root_parent_url?: string;
    parent_author: {
      fid: number;
    };
    author: {
      fid: number;
      username: string;
      display_name: string;
      pfp_url: string;
      custody_address: string;
      verifications: string[];
      verified_addresses: {
        eth_addresses: string[];
        sol_addresses: string[];
      };
    };
    text: string;
    timestamp: string;
    embeds: any[];
    reactions: {
      likes_count: number;
      recasts_count: number;
      likes: Array<{
        fid: number;
        fname: string;
      }>;
      recasts: Array<{
        fid: number;
        fname: string;
      }>;
    };
    replies: {
      count: number;
    };
    mentioned_profiles: Array<{
      fid: number;
      username: string;
    }>;
  };
}

// Verify webhook signature from Neynar
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    const receivedSignature = signature.replace('sha256=', '');
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Check if cast mentions our bot and contains "evermark this"
function shouldProcessCast(castData: FarcasterWebhookData['data']): boolean {
  const botFid = parseInt(process.env.EVERMARK_BOT_FID || '0');
  if (!botFid) return false;

  // Check if our bot is mentioned
  const isBotMentioned = castData.mentioned_profiles?.some(
    profile => profile.fid === botFid
  );

  if (!isBotMentioned) return false;

  // Check if text contains evermark trigger
  const text = castData.text.toLowerCase().trim();
  const triggerPhrases = [
    'evermark this',
    'evermark this cast', 
    '@evermarkbot evermark this',
    'evermark',
  ];

  return triggerPhrases.some(phrase => text.includes(phrase));
}

// Rate limiting check
async function checkRateLimit(userFid: number): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Check if user has made too many requests today
    const today = new Date().toISOString().split('T')[0];
    
    const { count } = await supabase
      .from('evermark_requests')
      .select('*', { count: 'exact' })
      .eq('requester_fid', userFid)
      .gte('created_at', `${today}T00:00:00.000Z`);

    const dailyLimit = 5; // 5 evermarks per user per day
    if (count && count >= dailyLimit) {
      return { 
        allowed: false, 
        reason: `Daily limit reached (${dailyLimit} evermarks per day). Try again tomorrow!` 
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return { allowed: true }; // Fail open
  }
}

// Log the evermark request
async function logEvermarkRequest(requestData: {
  requester_fid: number;
  requester_username: string;
  request_cast_hash: string;
  parent_cast_hash?: string;
  parent_cast_url?: string;
  status: 'pending' | 'completed' | 'failed';
  error_message?: string;
}) {
  try {
    await supabase
      .from('evermark_requests')
      .insert([{
        ...requestData,
        created_at: new Date().toISOString()
      }]);
  } catch (error) {
    console.error('Failed to log evermark request:', error);
  }
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
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
    const payload = event.body || '';
    const signature = event.headers['x-neynar-signature'] || '';
    const webhookSecret = process.env.NEYNAR_WEBHOOK_SECRET;

    // Verify webhook signature (optional but recommended)
    if (webhookSecret && !verifyWebhookSignature(payload, signature, webhookSecret)) {
      console.log('Invalid webhook signature');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid signature' }),
      };
    }

    const webhookData: FarcasterWebhookData = JSON.parse(payload);
    
    // Only process cast.created events
    if (webhookData.type !== 'cast.created') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Event type not handled' }),
      };
    }

    const castData = webhookData.data;
    
    console.log('📨 Received cast webhook:', {
      hash: castData.hash,
      author: castData.author.username,
      text: castData.text.substring(0, 100),
      mentions: castData.mentioned_profiles?.map(p => p.username)
    });

    // Check if this cast should trigger an evermark
    if (!shouldProcessCast(castData)) {
      console.log('ℹ️ Cast does not meet evermark criteria');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Cast does not meet criteria' }),
      };
    }

    console.log('🎯 Processing evermark request from @' + castData.author.username);

    // Check rate limiting
    const rateLimitCheck = await checkRateLimit(castData.author.fid);
    if (!rateLimitCheck.allowed) {
      console.log('🚫 Rate limit exceeded for user:', castData.author.fid);
      
      // Log the failed request
      await logEvermarkRequest({
        requester_fid: castData.author.fid,
        requester_username: castData.author.username,
        request_cast_hash: castData.hash,
        parent_cast_hash: castData.parent_hash,
        status: 'failed',
        error_message: rateLimitCheck.reason
      });

      // Send rate limit reply (will be implemented in next function)
      await sendBotReply(castData.hash, `❌ ${rateLimitCheck.reason}`);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Rate limit exceeded' }),
      };
    }

    // Process the evermark request asynchronously
    processEvermarkRequest(castData).catch(error => {
      console.error('Async evermark processing failed:', error);
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Evermark request received' }),
    };

  } catch (error) {
    console.error('Farcaster webhook error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};

// Process evermark request
async function processEvermarkRequest(castData: FarcasterWebhookData['data']) {
  const baseUrl = process.env.URL || 'https://evermarks.net';
  
  try {
    console.log('🔄 Processing evermark request from @' + castData.author.username);
    
    // Send initial "processing" reply
    await sendBotReply(castData.hash, 'processing');
    
    // Call the processor function
    const processorResponse = await fetch(`${baseUrl}/.netlify/functions/evermark-bot-processor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requester: {
          fid: castData.author.fid,
          username: castData.author.username,
          display_name: castData.author.display_name
        },
        request_cast_hash: castData.hash,
        parent_cast_data: castData.parent_hash ? undefined : null // Will be fetched by processor
      })
    });

    const result = await processorResponse.json();
    
    if (result.success) {
      // Send success reply
      await sendBotReply(castData.hash, 'success', {
        token_id: result.token_id,
        cast_author: result.cast_author,
        cast_text: result.cast_text
      });
    } else {
      // Determine error type and send appropriate reply
      let errorType = 'error';
      if (result.error?.includes('already evermarked')) {
        errorType = 'already_exists';
      } else if (result.error?.includes('No cast found')) {
        errorType = 'no_parent_cast';
      } else if (result.error?.includes('Could not fetch')) {
        errorType = 'cast_not_found';
      } else {
        errorType = 'creation_failed';
      }

      await sendBotReply(castData.hash, errorType, {
        error_message: result.error,
        existing_token_id: result.existing_token_id
      });
    }

  } catch (error) {
    console.error('Error processing evermark request:', error);
    await sendBotReply(castData.hash, 'creation_failed', {
      error_message: 'Internal processing error'
    });
  }
}

// Send bot reply using the responder function
async function sendBotReply(parentCastHash: string, messageType: string, data?: any) {
  try {
    const baseUrl = process.env.URL || 'https://evermarks.net';
    
    const response = await fetch(`${baseUrl}/.netlify/functions/evermark-bot-responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parent_cast_hash: parentCastHash,
        message_type: messageType,
        data
      })
    });

    if (!response.ok) {
      console.error('Failed to send bot reply:', await response.text());
    }
  } catch (error) {
    console.error('Error sending bot reply:', error);
  }
}