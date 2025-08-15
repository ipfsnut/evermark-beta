// Webhook handler for Thirdweb mint events
import { Handler } from '@netlify/functions';
import { syncRecentEvermarks } from '../../src/lib/images/chain-sync';

export const handler: Handler = async (event, context) => {
  console.log('🎯 Mint webhook triggered');

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse webhook payload
    const body = event.body ? JSON.parse(event.body) : {};
    console.log('📨 Webhook payload:', body);

    // Verify webhook authenticity (optional - add if Thirdweb provides signing)
    // const signature = event.headers['x-thirdweb-signature'];
    // if (!verifyWebhookSignature(event.body, signature)) {
    //   return { statusCode: 401, body: JSON.stringify({ error: 'Invalid signature' }) };
    // }

    // Sync recent evermarks (last 10 to handle webhook unreliability)
    const result = await syncRecentEvermarks(10);
    
    console.log(`✅ Sync result:`, result);

    // Trigger background processing for any new pending images
    if (result.processed > 0) {
      console.log(`🔄 Triggering image processing for ${result.processed} evermarks`);
      
      // Trigger the background processing function
      try {
        await fetch(`${process.env.URL}/.netlify/functions/process-images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger: 'webhook', count: result.processed })
        });
        console.log('✅ Image processing triggered');
      } catch (error) {
        console.error('❌ Failed to trigger image processing:', error);
        // Don't fail the webhook for this
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        synced: result.synced,
        processed: result.processed,
        errors: result.errors
      })
    };

  } catch (error) {
    console.error('❌ Webhook processing failed:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

// Optional: Verify webhook signature from Thirdweb
// function verifyWebhookSignature(payload: string, signature: string): boolean {
//   // Implement signature verification if Thirdweb provides it
//   return true;
// }