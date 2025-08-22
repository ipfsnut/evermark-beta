// netlify/functions/setup-evermark-bot.ts
// ONE-TIME SETUP: Helper for setting up the Evermark bot account
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface BotSetupResponse {
  success: boolean;
  instructions?: string[];
  next_steps?: string[];
  bot_config?: {
    username: string;
    bio: string;
    profile_setup_url: string;
  };
  webhook_config?: {
    url: string;
    event_type: string;
    required_env_vars: string[];
  };
  error?: string;
}

// Check if username is available on Farcaster
async function checkUsernameAvailability(username: string): Promise<{ available: boolean; message: string }> {
  try {
    if (!process.env.NEYNAR_API_KEY) {
      return { available: false, message: 'NEYNAR_API_KEY not configured' };
    }

    const response = await fetch(`https://api.neynar.com/v2/farcaster/fname/availability?fname=${username}`, {
      headers: {
        'accept': 'application/json',
        'x-api-key': process.env.NEYNAR_API_KEY
      }
    });

    if (!response.ok) {
      return { available: false, message: 'Could not check availability' };
    }

    const data = await response.json();
    return { 
      available: data.available, 
      message: data.available ? 'Username is available!' : 'Username is taken' 
    };
  } catch (error) {
    return { available: false, message: 'Error checking availability' };
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

  // Only allow this function to run with admin key
  const adminKey = event.headers['x-admin-key'];
  if (adminKey !== process.env.EVERMARK_ADMIN_KEY) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized - Admin key required' }),
    };
  }

  try {
    const { botUsername = 'evermarkbot' } = JSON.parse(event.body || '{}');

    // Check if bot already exists
    if (process.env.EVERMARK_BOT_FID && process.env.EVERMARK_BOT_SIGNER_UUID) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Bot already configured',
          current_config: {
            fid: process.env.EVERMARK_BOT_FID,
            username: process.env.EVERMARK_BOT_USERNAME || botUsername,
            signer_configured: !!process.env.EVERMARK_BOT_SIGNER_UUID
          }
        }),
      };
    }

    // Check username availability
    const usernameCheck = await checkUsernameAvailability(botUsername);
    
    const baseUrl = process.env.URL || 'https://evermarks.net';
    
    const response: BotSetupResponse = {
      success: true,
      instructions: [
        "🤖 EVERMARK BOT SETUP GUIDE",
        "",
        "1. CREATE FARCASTER ACCOUNT:",
        "   • Go to https://farcaster.xyz",
        "   • Create account with username: @" + botUsername,
        `   • Username availability: ${usernameCheck.message}`,
        "",
        "2. SET UP BOT PROFILE:",
        "   • Bio: 🔗 Creating permanent references to valuable content. Reply with \"@evermarkbot evermark this\" to preserve any cast forever on blockchain.",
        "   • Display Name: Evermark Bot",
        "   • Profile Picture: Upload evermark logo",
        "",
        "3. GET BOT CREDENTIALS:",
        "   • Note your FID number from the profile",
        "   • Go to https://dev.neynar.com/app/agents-and-bots",
        "   • Create a new signer for your bot account",
        "   • Copy the signer UUID",
        "",
        "4. CONFIGURE ENVIRONMENT:",
        "   Add these to your .env file:",
        "   EVERMARK_BOT_FID=<your_bot_fid>",
        "   EVERMARK_BOT_SIGNER_UUID=<your_signer_uuid>",
        "   EVERMARK_BOT_USERNAME=" + botUsername,
        "   NEYNAR_WEBHOOK_SECRET=<generate_random_secret>",
        "",
        "5. SET UP WEBHOOK:",
        `   • URL: ${baseUrl}/.netlify/functions/farcaster-webhook`,
        "   • Event Type: cast.created",
        "   • Filter: mentioned_fids = [your_bot_fid]",
        "   • Secret: Use the NEYNAR_WEBHOOK_SECRET from step 4"
      ],
      bot_config: {
        username: botUsername,
        bio: '🔗 Creating permanent references to valuable content. Reply with "@evermarkbot evermark this" to preserve any cast forever on blockchain.',
        profile_setup_url: 'https://farcaster.xyz'
      },
      webhook_config: {
        url: `${baseUrl}/.netlify/functions/farcaster-webhook`,
        event_type: 'cast.created',
        required_env_vars: [
          'EVERMARK_BOT_FID',
          'EVERMARK_BOT_SIGNER_UUID', 
          'EVERMARK_BOT_USERNAME',
          'NEYNAR_WEBHOOK_SECRET'
        ]
      },
      next_steps: [
        "After completing the setup:",
        "1. Deploy your functions to Netlify",
        "2. Test by mentioning @" + botUsername + " with 'evermark this' in a reply",
        "3. Check logs in Netlify Functions dashboard",
        "4. Monitor bot responses in Farcaster"
      ]
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('❌ Bot setup error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Setup guide generation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};