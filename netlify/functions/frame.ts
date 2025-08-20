// netlify/functions/frame.ts - Farcaster Frame support
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Beta table name - using beta_evermarks instead of alpha evermarks table
const EVERMARKS_TABLE = 'beta_evermarks';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const headers = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
};

function generateFrameHTML(evermark: any, baseUrl: string) {
  const title = evermark?.title || 'Evermark Protocol';
  const description = evermark?.description || 'Content preserved forever on blockchain';
  const image = evermark?.supabase_image_url || evermark?.token_uri || `${baseUrl}/og-image.png`;
  const author = evermark?.author || 'Anonymous';
  const tokenId = evermark?.token_id;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - Evermark Protocol</title>
  
  <!-- Farcaster Frame Meta Tags -->
  <meta name="fc:frame" content="vNext" />
  <meta name="fc:frame:image" content="${image}" />
  <meta name="fc:frame:image:aspect_ratio" content="1.91:1" />
  
  <meta name="fc:frame:button:1" content="🔗 View Evermark" />
  <meta name="fc:frame:button:1:action" content="link" />
  <meta name="fc:frame:button:1:target" content="${baseUrl}/evermark/${tokenId}" />
  
  <meta name="fc:frame:button:2" content="🗳️ Vote" />
  <meta name="fc:frame:button:2:action" content="post" />
  <meta name="fc:frame:button:2:target" content="${baseUrl}/api/frame/vote/${tokenId}" />
  
  <meta name="fc:frame:button:3" content="🚀 Explore More" />
  <meta name="fc:frame:button:3:action" content="link" />
  <meta name="fc:frame:button:3:target" content="${baseUrl}/explore" />
  
  <!-- Open Graph -->
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${baseUrl}/evermark/${tokenId}" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  
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
    }
    .container {
      max-width: 600px;
      text-align: center;
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
    .author {
      color: #00ff41;
      margin-bottom: 0.5rem;
      font-weight: 600;
    }
    .token-id {
      color: #888;
      margin-bottom: 1rem;
      font-size: 0.9rem;
    }
    .description {
      line-height: 1.6;
      margin-bottom: 2rem;
      color: #ccc;
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
      transition: all 0.3s ease;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 255, 65, 0.3);
    }
    .verified {
      display: inline-block;
      background: #00ff41;
      color: black;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: bold;
      margin-left: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="title">${title}</h1>
    <div class="author">
      by ${author}
      ${evermark?.verified ? '<span class="verified">✓ VERIFIED</span>' : ''}
    </div>
    ${tokenId ? `<div class="token-id">Token ID: ${tokenId}</div>` : ''}
    <p class="description">${description}</p>
    <a href="${baseUrl}/evermark/${tokenId}" class="btn">🔗 View Full Evermark</a>
    <a href="${baseUrl}/explore" class="btn">🚀 Explore More</a>
  </div>
</body>
</html>`;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const tokenId = event.path?.split('/').pop();
  const baseUrl = process.env.URL || 'https://evermarks.net';

  try {
    if (tokenId && tokenId !== 'frame') {
      // Get specific evermark for frame
      const { data: evermark, error } = await supabase
        .from(EVERMARKS_TABLE)
        .select('*')
        .eq('token_id', parseInt(tokenId))
        .single();

      if (error || !evermark) {
        return {
          statusCode: 404,
          headers,
          body: generateFrameHTML(null, baseUrl),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: generateFrameHTML(evermark, baseUrl),
      };
    } else {
      // Default frame - show latest verified evermark
      const { data: latestEvermark } = await supabase
        .from(EVERMARKS_TABLE)
        .select('*')
        .eq('verified', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        statusCode: 200,
        headers,
        body: generateFrameHTML(latestEvermark, baseUrl),
      };
    }
  } catch (error) {
    console.error('Frame error:', error);
    return {
      statusCode: 500,
      headers,
      body: generateFrameHTML(null, baseUrl),
    };
  }
};