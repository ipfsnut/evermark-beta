// netlify/functions/evermark-share.ts - Beautiful sharing pages for individual evermarks
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const headers = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

interface EvermarkData {
  token_id: number;
  title: string;
  author: string;
  description?: string;
  supabase_image_url?: string;
  processed_image_url?: string;
  content_type?: string;
  verified: boolean;
  owner?: string;
  created_at: string;
  source_url?: string;
}

async function getEvermarkData(tokenId: string): Promise<EvermarkData | null> {
  try {
    // Query the database directly
    const { data, error } = await supabase
      .from('beta_evermarks')
      .select(`
        token_id,
        title,
        author,
        description,
        supabase_image_url,
        content_type,
        verified,
        owner,
        created_at,
        source_url
      `)
      .eq('token_id', parseInt(tokenId))
      .single();

    if (error) {
      console.error('Database error:', error);
      return null;
    }

    return data as EvermarkData;
  } catch (error) {
    console.error('Error fetching evermark data:', error);
    return null;
  }
}

function getEvermarkImageUrl(evermark: EvermarkData, baseUrl: string): string {
  if (evermark.processed_image_url) {
    return evermark.processed_image_url;
  }
  if (evermark.supabase_image_url) {
    return evermark.supabase_image_url;
  }
  return `${baseUrl}/og-image.png`;
}

function formatContentType(contentType?: string): string {
  switch (contentType?.toLowerCase()) {
    case 'cast':
      return 'Farcaster Cast';
    case 'doi':
      return 'Academic Paper';
    case 'isbn':
      return 'Book';
    case 'url':
      return 'Web Content';
    default:
      return 'Content';
  }
}

function generateEvermarkShareHTML(evermark: EvermarkData, baseUrl: string): string {
  const imageUrl = getEvermarkImageUrl(evermark, baseUrl);
  const contentType = formatContentType(evermark.content_type);
  const shareUrl = `${baseUrl}/evermark/${evermark.token_id}`;
  
  const title = `"${evermark.title}" by ${evermark.author} | Evermark`;
  const description = evermark.description 
    ? `${evermark.description} • ${contentType} preserved on Evermark Protocol`
    : `${contentType} by ${evermark.author} • Preserved forever on Evermark Protocol`;

  const verifiedBadge = evermark.verified ? '✓ ' : '';
  const createdDate = new Date(evermark.created_at).toLocaleDateString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${shareUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Evermark Protocol" />
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  
  <!-- Auto-redirect to main app -->
  <meta http-equiv="refresh" content="2; url=${shareUrl}">
  
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
      max-width: 800px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 2rem;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 255, 65, 0.3);
      display: flex;
      gap: 2rem;
      align-items: center;
    }
    .cover {
      flex-shrink: 0;
      width: 200px;
      height: 280px;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }
    .cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .content {
      flex: 1;
    }
    .title {
      font-size: 1.8rem;
      font-weight: bold;
      margin-bottom: 0.5rem;
      background: linear-gradient(45deg, #00ff41, #0080ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .author {
      font-size: 1.2rem;
      color: #ccc;
      margin-bottom: 1rem;
    }
    .description {
      color: #aaa;
      margin-bottom: 1rem;
      line-height: 1.6;
    }
    .meta {
      font-size: 0.9rem;
      color: #888;
    }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(45deg, #00ff41, #0080ff);
      color: black;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      margin-top: 1rem;
    }
    @media (max-width: 768px) {
      .container {
        flex-direction: column;
        text-align: center;
      }
      .cover {
        width: 160px;
        height: 224px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="cover">
      <img src="${imageUrl}" alt="${evermark.title}" />
    </div>
    <div class="content">
      <h1 class="title">${verifiedBadge}"${evermark.title}"</h1>
      <div class="author">by ${evermark.author}</div>
      ${evermark.description ? `<div class="description">${evermark.description}</div>` : ''}
      <div class="meta">
        ${contentType} • ${createdDate} • Evermark #${evermark.token_id}
      </div>
      <a href="${shareUrl}" class="btn">🔖 View on Evermark</a>
    </div>
  </div>
  
  <script>
    setTimeout(() => {
      window.location.href = '${shareUrl}';
    }, 2000);
  </script>
</body>
</html>`;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const baseUrl = process.env.URL || 'https://evermarks.net';
  
  // Try to get ID from query parameters or path
  let tokenId = event.queryStringParameters?.id;
  
  // If no query param, try to extract from path (for redirected requests)
  if (!tokenId && event.path) {
    // Try different path patterns
    let pathMatch = event.path.match(/\/evermark-share\/(\d+)/);
    if (!pathMatch) {
      pathMatch = event.path.match(/\/share\/evermark\/(\d+)/);
    }
    if (!pathMatch) {
      pathMatch = event.path.match(/(\d+)$/);
    }
    if (pathMatch) {
      tokenId = pathMatch[1];
    }
  }

  // Debug logging
  console.log('Debug info:', {
    path: event.path,
    queryStringParameters: event.queryStringParameters,
    tokenId: tokenId
  });

  if (!tokenId) {
    return {
      statusCode: 400,
      headers,
      body: `Missing id parameter. Path: ${event.path}, Query: ${JSON.stringify(event.queryStringParameters)}`,
    };
  }

  try {
    const evermark = await getEvermarkData(tokenId);
    
    if (!evermark) {
      return {
        statusCode: 404,
        headers,
        body: 'Evermark not found',
      };
    }

    const html = generateEvermarkShareHTML(evermark, baseUrl);
    return {
      statusCode: 200,
      headers,
      body: html,
    };
  } catch (error) {
    console.error('Evermark share error:', error);
    return {
      statusCode: 500,
      headers,
      body: 'Internal server error',
    };
  }
};