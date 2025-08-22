// netlify/functions/evermark-bot-responder.ts
// Handles sending bot replies to Farcaster
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface BotReplyRequest {
  parent_cast_hash: string;
  message_type: 'success' | 'error' | 'info';
  data?: {
    token_id?: number;
    cast_author?: string;
    cast_text?: string;
    error_message?: string;
    existing_token_id?: number;
  };
}

// Generate reply message based on type and data
function generateReplyMessage(messageType: string, data: any = {}): string {
  const baseUrl = process.env.URL || 'https://evermarks.net';

  switch (messageType) {
    case 'success':
      return `✅ Evermark created! This cast by @${data.cast_author} has been preserved forever on the blockchain.

🔗 View: ${baseUrl}/evermark/${data.token_id}
🏷️ Token ID: ${data.token_id}

Thanks for helping preserve valuable content! 🌟`;

    case 'already_exists':
      return `✅ This cast is already evermarked!

🔗 View: ${baseUrl}/evermark/${data.existing_token_id}
🏷️ Token ID: ${data.existing_token_id}

Great minds think alike! 🧠`;

    case 'rate_limit':
      return `⏰ You've reached your daily limit of 5 evermark requests. 

Try again tomorrow or contact us if you need a higher limit for your use case.`;

    case 'no_parent_cast':
      return `❓ Please reply to the cast you want to evermark with "@evermarkbot evermark this"

I need to know which cast to preserve!`;

    case 'cast_not_found':
      return `❌ Could not find or access the cast you want to evermark.

The cast might be deleted, private, or there might be a temporary issue. Please try again later.`;

    case 'creation_failed':
      return `❌ Failed to create evermark: ${data.error_message || 'Unknown error'}

Please try again later or contact support if the issue persists.`;

    case 'processing':
      return `⚡ Processing your evermark request...

This usually takes a few seconds. I'll reply when it's done!`;

    default:
      return `❌ ${data.error_message || 'Something went wrong. Please try again later.'}`;
  }
}

// Post cast using Neynar API
async function postCast(text: string, parentHash?: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.NEYNAR_API_KEY || !process.env.EVERMARK_BOT_SIGNER_UUID) {
      throw new Error('Bot credentials not configured');
    }

    const castData: any = {
      signer_uuid: process.env.EVERMARK_BOT_SIGNER_UUID,
      text: text
    };

    // If replying to a cast, add parent reference
    if (parentHash) {
      castData.parent = parentHash;
    }

    const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api_key': process.env.NEYNAR_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify(castData)
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Neynar API error (${response.status}): ${errorData}`);
    }

    const result = await response.json();
    console.log('✅ Cast posted successfully:', result.cast?.hash);
    
    return { success: true };

  } catch (error) {
    console.error('Failed to post cast:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
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
    const request: BotReplyRequest = JSON.parse(event.body || '{}');
    
    console.log('🤖 Sending bot reply:', {
      type: request.message_type,
      parent: request.parent_cast_hash
    });

    // Generate the appropriate reply message
    const replyMessage = generateReplyMessage(request.message_type, request.data);
    
    // Post the reply
    const postResult = await postCast(replyMessage, request.parent_cast_hash);
    
    if (postResult.success) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: 'Reply sent successfully'
        }),
      };
    } else {
      throw new Error(postResult.error);
    }

  } catch (error) {
    console.error('Bot responder error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};

// Utility function for other functions to send replies
export async function sendBotReply(
  parentCastHash: string, 
  messageType: 'success' | 'error' | 'info', 
  data?: any
): Promise<void> {
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