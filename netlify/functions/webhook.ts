// netlify/functions/webhook.ts - Blockchain webhook handler
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-webhook-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface BlockchainEvent {
  eventType: string;
  contractAddress: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  eventData: any;
  timestamp: string;
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
    const webhookData: BlockchainEvent = JSON.parse(event.body || '{}');
    
    console.log('Received blockchain event:', webhookData.eventType, webhookData.transactionHash);

    // Process different event types
    switch (webhookData.eventType) {
      case 'EvermarkCreated':
        await handleEvermarkCreated(webhookData);
        break;
      case 'VoteDelegated':
        await handleVoteDelegated(webhookData);
        break;
      case 'Transfer':
        await handleTransfer(webhookData);
        break;
      case 'MetadataUpdate':
        await handleMetadataUpdate(webhookData);
        break;
      default:
        console.log('Unhandled event type:', webhookData.eventType);
    }

    // Log the webhook event
    await supabase
      .from('webhook_events')
      .insert([{
        event_type: webhookData.eventType,
        contract_address: webhookData.contractAddress,
        transaction_hash: webhookData.transactionHash,
        block_number: webhookData.blockNumber,
        event_data: webhookData.eventData,
        processed_at: new Date().toISOString(),
      }]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, processed: webhookData.eventType }),
    };

  } catch (error) {
    console.error('Webhook processing error:', error);
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

async function handleEvermarkCreated(event: BlockchainEvent) {
  const { tokenId, creator, tokenURI } = event.eventData;
  
  // Update or create evermark with blockchain data
  const { error } = await supabase
    .from('evermarks')
    .upsert({
      token_id: tokenId,
      owner: creator,
      token_uri: tokenURI,
      tx_hash: event.transactionHash,
      block_number: event.blockNumber,
      verified: true,
      sync_timestamp: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'token_id'
    });

  if (error) {
    console.error('Failed to update evermark:', error);
  } else {
    console.log(`✅ Evermark ${tokenId} created/updated`);
  }
}

async function handleVoteDelegated(event: BlockchainEvent) {
  const { tokenId, voter, amount } = event.eventData;
  
  // Could update vote counts or delegation records
  console.log(`🗳️ Vote delegated: ${amount} votes to token ${tokenId} by ${voter}`);
}

async function handleTransfer(event: BlockchainEvent) {
  const { from, to, tokenId } = event.eventData;
  
  // Update owner when token is transferred
  if (to !== '0x0000000000000000000000000000000000000000') {
    await supabase
      .from('evermarks')
      .update({
        owner: to,
        updated_at: new Date().toISOString(),
      })
      .eq('token_id', tokenId);
      
    console.log(`🔄 Token ${tokenId} transferred from ${from} to ${to}`);
  }
}

async function handleMetadataUpdate(event: BlockchainEvent) {
  const { tokenId } = event.eventData;
  
  // Mark metadata as needing refresh
  await supabase
    .from('evermarks')
    .update({
      metadata_fetched: false,
      updated_at: new Date().toISOString(),
    })
    .eq('token_id', tokenId);
    
  console.log(`📝 Metadata update triggered for token ${tokenId}`);
}