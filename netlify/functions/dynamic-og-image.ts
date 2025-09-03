// netlify/functions/dynamic-og-image.ts - Dynamic OG image generation
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { VotingDataService } from '../../shared/services/VotingDataService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Beta table name
const EVERMARKS_TABLE = 'beta_evermarks';

const headers = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

interface TopEvermark {
  token_id: number;
  title: string;
  author: string;
  description?: string;
  supabase_image_url?: string;
  verified: boolean;
  votes: number;
}

/**
 * Get the current top evermark from leaderboard
 */
async function getTopEvermark(): Promise<TopEvermark | null> {
  try {
    // Use the leaderboard API to get the top evermark (already handles filtering and ranking)
    const baseUrl = process.env.URL || 'https://evermarks.net';
    const response = await fetch(`${baseUrl}/.netlify/functions/leaderboard-data?limit=1`);
    
    if (!response.ok) {
      console.warn('Leaderboard API failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.evermarks || data.evermarks.length === 0) {
      console.warn('No evermarks found in leaderboard');
      return null;
    }
    
    const topEvermark = data.evermarks[0];
    const result: TopEvermark = {
      token_id: topEvermark.tokenId || topEvermark.token_id,
      title: topEvermark.title,
      author: topEvermark.author,
      description: topEvermark.description,
      supabase_image_url: topEvermark.supabaseImageUrl || topEvermark.supabase_image_url,
      verified: topEvermark.verified || false,
      votes: parseInt(topEvermark.totalVotes) || topEvermark.votes || 0
    };

    console.log('🏆 Top evermark for sharing:', {
      token_id: result.token_id,
      title: result.title,
      votes: result.votes,
      hasImage: !!result.supabase_image_url
    });

    return result;
  } catch (error) {
    console.error('Error getting top evermark:', error);
    return null;
  }
}

/**
 * Generate HTML with dynamic meta tags for the top evermark
 */
function generateDynamicOGHTML(topEvermark: TopEvermark | null, baseUrl: string) {
  const title = topEvermark 
    ? `🏆 "${topEvermark.title}" is trending on Evermark!`
    : 'Evermark Protocol - Content Preserved Forever';
  
  const description = topEvermark
    ? `Currently #1 with ${topEvermark.votes} votes: ${topEvermark.description || `Content by ${topEvermark.author}`}`
    : 'Preserve and curate your favorite content on the blockchain. Community-driven curation with real rewards.';
  
  const image = topEvermark?.supabase_image_url || `${baseUrl}/og-image.png`;
  
  const url = topEvermark 
    ? `${baseUrl}/evermark/${topEvermark.token_id}`
    : baseUrl;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  
  <!-- Farcaster Mini App Meta Tags -->
  <meta name="fc:miniapp" content="1" />
  <meta name="fc:miniapp:image" content="${image}" />
  <meta name="fc:miniapp:button:1" content="🚀 Open Evermark" />
  <meta name="fc:miniapp:button:1:action" content="link" />
  <meta name="fc:miniapp:button:1:target" content="${baseUrl}" />
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Evermark Protocol" />
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  
  <!-- Auto-redirect to main app -->
  <meta http-equiv="refresh" content="0; url=${baseUrl}">
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
      color: white;
      margin: 0;
      padding: 2rem;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .container {
      max-width: 600px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 2rem;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 255, 65, 0.3);
    }
    .title {
      font-size: 2rem;
      font-weight: bold;
      margin-bottom: 1rem;
      background: linear-gradient(45deg, #00ff41, #0080ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .trophy {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    .description {
      color: #ccc;
      margin-bottom: 2rem;
      line-height: 1.6;
    }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(45deg, #00ff41, #0080ff);
      color: black;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      margin: 0.5rem;
    }
  </style>
</head>
<body>
  <div class="container">
    ${topEvermark ? `
      <div class="trophy">🏆</div>
      <h1 class="title">${topEvermark.title}</h1>
      <div class="description">
        Currently #1 on Evermark with ${topEvermark.votes} votes!<br/>
        by ${topEvermark.author}
      </div>
    ` : `
      <h1 class="title">Evermark Protocol</h1>
      <div class="description">
        Preserve and curate content forever on the blockchain
      </div>
    `}
    <a href="${baseUrl}" class="btn">🚀 Explore Evermark</a>
  </div>
  <script>
    // Auto-redirect for direct visits
    window.location.href = '${baseUrl}';
  </script>
</body>
</html>`;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const baseUrl = process.env.URL || 'https://evermarks.net';

  try {
    // Get the current top evermark from leaderboard
    const topEvermark = await getTopEvermark();
    
    // Generate HTML with dynamic meta tags
    const html = generateDynamicOGHTML(topEvermark, baseUrl);

    return {
      statusCode: 200,
      headers,
      body: html,
    };
  } catch (error) {
    console.error('Dynamic OG image error:', error);
    
    // Fallback to static version
    const fallbackHtml = generateDynamicOGHTML(null, baseUrl);
    
    return {
      statusCode: 200,
      headers,
      body: fallbackHtml,
    };
  }
};