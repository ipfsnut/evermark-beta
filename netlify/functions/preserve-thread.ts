import { Handler } from '@netlify/functions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const NEYNAR_API_BASE = 'https://api.neynar.com/v2/farcaster';
const NEYNAR_API_KEY = process.env.VITE_NEYNAR_API_KEY;

interface ThreadReply {
  hash: string;
  author: {
    fid: number;
    username: string;
    display_name: string;
  };
  text: string;
  timestamp: string;
  depth: number;
}

interface ThreadData {
  thread_hash: string;
  root_cast?: {
    hash: string;
    author: any;
    text: string;
    timestamp: string;
  };
  replies: ThreadReply[];
  total_replies: number;
}

/**
 * Fetch cast thread from Neynar
 */
async function fetchThread(castHash: string): Promise<ThreadData> {
  if (!NEYNAR_API_KEY) {
    throw new Error('NEYNAR_API_KEY not configured');
  }

  // First, get the main cast to find thread hash
  const castUrl = `${NEYNAR_API_BASE}/cast?identifier=${castHash}&type=hash&api_key=${NEYNAR_API_KEY}`;
  const castResponse = await fetch(castUrl);
  
  if (!castResponse.ok) {
    throw new Error(`Failed to fetch cast: ${castResponse.status}`);
  }

  const { cast } = await castResponse.json();
  const threadHash = cast.thread_hash || cast.hash;

  // Fetch thread conversation
  const threadUrl = `${NEYNAR_API_BASE}/cast/conversation?identifier=${threadHash}&type=hash&api_key=${NEYNAR_API_KEY}&reply_depth=5&include_chronological_parent_casts=true`;
  const threadResponse = await fetch(threadUrl);

  if (!threadResponse.ok) {
    throw new Error(`Failed to fetch thread: ${threadResponse.status}`);
  }

  const threadData = await threadResponse.json();
  
  // Process and structure the thread data
  const replies = processThreadReplies(threadData.conversation?.cast?.direct_replies || []);
  
  return {
    thread_hash: threadHash,
    root_cast: threadData.conversation?.root || undefined,
    replies,
    total_replies: replies.length,
  };
}

/**
 * Process nested replies into flat array with depth
 */
function processThreadReplies(replies: any[], depth: number = 1): ThreadReply[] {
  const processed: ThreadReply[] = [];
  
  for (const reply of replies) {
    processed.push({
      hash: reply.hash,
      author: {
        fid: reply.author.fid,
        username: reply.author.username,
        display_name: reply.author.display_name,
      },
      text: reply.text,
      timestamp: reply.timestamp,
      depth,
    });
    
    // Process nested replies
    if (reply.direct_replies && reply.direct_replies.length > 0) {
      const nestedReplies = processThreadReplies(reply.direct_replies, depth + 1);
      processed.push(...nestedReplies);
    }
  }
  
  return processed;
}

/**
 * Fetch all replies in a thread (paginated)
 */
async function fetchAllThreadReplies(
  threadHash: string,
  limit: number = 500
): Promise<ThreadReply[]> {
  const allReplies: ThreadReply[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore && allReplies.length < limit) {
    const url = new URL(`${NEYNAR_API_BASE}/cast/conversation`);
    url.searchParams.append('identifier', threadHash);
    url.searchParams.append('type', 'hash');
    url.searchParams.append('api_key', NEYNAR_API_KEY!);
    url.searchParams.append('reply_depth', '10');
    url.searchParams.append('limit', '50');
    
    if (cursor) {
      url.searchParams.append('cursor', cursor);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error('Failed to fetch page of replies');
      break;
    }

    const data = await response.json();
    const replies = processThreadReplies(data.conversation?.cast?.direct_replies || []);
    allReplies.push(...replies);

    cursor = data.next?.cursor;
    hasMore = !!cursor && allReplies.length < limit;
  }

  return allReplies;
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
    const { castHash } = JSON.parse(event.body || '{}');
    
    if (!castHash) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Cast hash is required' }),
      };
    }

    console.log('🧵 Fetching thread for cast:', castHash);

    // Fetch thread data
    const threadData = await fetchThread(castHash);
    
    // If thread is large, fetch all replies
    if (threadData.total_replies > 50) {
      console.log(`📚 Fetching ${threadData.total_replies} replies...`);
      const allReplies = await fetchAllThreadReplies(threadData.thread_hash);
      threadData.replies = allReplies;
      threadData.total_replies = allReplies.length;
    }

    console.log(`✅ Thread preserved: ${threadData.total_replies} replies`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(threadData),
    };

  } catch (error) {
    console.error('❌ Thread preservation failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to preserve thread' 
      }),
    };
  }
};