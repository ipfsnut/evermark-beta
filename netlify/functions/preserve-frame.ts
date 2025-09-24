import { Handler } from '@netlify/functions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface FrameMetadata {
  title?: string;
  image?: string;
  'fc:frame'?: string;
  'fc:frame:image'?: string;
  'fc:frame:post_url'?: string;
  'fc:frame:input:text'?: string;
  'fc:frame:state'?: string;
  'fc:frame:image:aspect_ratio'?: string;
  [key: string]: string | undefined;
}

/**
 * Fetch and parse Frame metadata from URL
 */
async function fetchFrameMetadata(url: string): Promise<FrameMetadata> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'facebookexternalhit/1.1', // Some sites serve different content based on UA
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Frame: ${response.status}`);
  }

  const html = await response.text();
  return parseFrameMetadata(html);
}

/**
 * Parse Frame metadata from HTML
 */
function parseFrameMetadata(html: string): FrameMetadata {
  const metadata: FrameMetadata = {};
  
  // Regular expression to extract meta tags
  const metaTagRegex = /<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]+)"/gi;
  let match;

  while ((match = metaTagRegex.exec(html)) !== null) {
    const property = match[1];
    const content = match[2];

    // Capture Frame-specific metadata
    if (property.startsWith('fc:frame') || property.startsWith('og:')) {
      metadata[property] = content;
    }
  }

  // Also check for og:title and og:image as fallbacks
  if (!metadata['fc:frame:image'] && metadata['og:image']) {
    metadata.image = metadata['og:image'];
  }
  if (metadata['og:title']) {
    metadata.title = metadata['og:title'];
  }

  // Extract buttons (up to 4)
  for (let i = 1; i <= 4; i++) {
    const buttonKey = `fc:frame:button:${i}`;
    const actionKey = `fc:frame:button:${i}:action`;
    const targetKey = `fc:frame:button:${i}:target`;
    
    // Check if button exists in the HTML even if not in our current matches
    const buttonRegex = new RegExp(`<meta\\s+(?:property|name)="${buttonKey}"\\s+content="([^"]+)"`, 'i');
    const buttonMatch = html.match(buttonRegex);
    if (buttonMatch) {
      metadata[buttonKey] = buttonMatch[1];
      
      // Look for action and target
      const actionRegex = new RegExp(`<meta\\s+(?:property|name)="${actionKey}"\\s+content="([^"]+)"`, 'i');
      const actionMatch = html.match(actionRegex);
      if (actionMatch) {
        metadata[actionKey] = actionMatch[1];
      }
      
      const targetRegex = new RegExp(`<meta\\s+(?:property|name)="${targetKey}"\\s+content="([^"]+)"`, 'i');
      const targetMatch = html.match(targetRegex);
      if (targetMatch) {
        metadata[targetKey] = targetMatch[1];
      }
    }
  }

  return metadata;
}

/**
 * Validate Frame metadata
 */
function validateFrameMetadata(metadata: FrameMetadata): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for required Frame fields
  if (!metadata['fc:frame'] && !metadata['fc:frame:image']) {
    errors.push('Not a valid Frame: missing fc:frame or fc:frame:image meta tag');
  }

  // Validate image
  const frameImage = metadata['fc:frame:image'] || metadata.image;
  if (!frameImage) {
    errors.push('Frame image is required');
  }

  // Validate buttons
  for (let i = 1; i <= 4; i++) {
    const buttonKey = `fc:frame:button:${i}`;
    const actionKey = `fc:frame:button:${i}:action`;
    
    if (metadata[buttonKey]) {
      const action = metadata[actionKey];
      if (action && !['post', 'post_redirect', 'link', 'mint'].includes(action)) {
        errors.push(`Invalid action for button ${i}: ${action}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Simulate Frame button click (for testing)
 */
async function simulateFrameAction(
  frameUrl: string,
  metadata: FrameMetadata,
  buttonIndex: number,
  inputText?: string
): Promise<any> {
  const postUrl = metadata['fc:frame:post_url'] || frameUrl;
  
  // Build Frame action payload following Farcaster spec
  const payload = {
    untrustedData: {
      fid: 1, // Mock FID for testing
      url: frameUrl,
      messageHash: '0x' + '0'.repeat(64), // Mock hash
      timestamp: Date.now(),
      network: 1,
      buttonIndex,
      inputText: inputText || '',
      state: metadata['fc:frame:state'] || '',
    },
    trustedData: {
      messageBytes: '', // Would contain signed message in production
    },
  };

  const response = await fetch(postUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Frame action failed: ${response.status}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return await response.json();
  } else {
    return await response.text();
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
    const { url, testAction } = JSON.parse(event.body || '{}');
    
    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL is required' }),
      };
    }

    console.log('🖼️ Fetching Frame metadata:', url);

    // Fetch and parse Frame metadata
    const metadata = await fetchFrameMetadata(url);
    
    // Validate Frame
    const validation = validateFrameMetadata(metadata);
    if (!validation.valid) {
      console.warn('⚠️ Frame validation issues:', validation.errors);
    }

    // Format response
    const frameData = {
      url,
      title: metadata.title,
      image: metadata['fc:frame:image'] || metadata.image,
      version: metadata['fc:frame'] || 'vNext',
      post_url: metadata['fc:frame:post_url'],
      input_text: metadata['fc:frame:input:text'],
      state: metadata['fc:frame:state'],
      aspect_ratio: metadata['fc:frame:image:aspect_ratio'],
      buttons: [],
      validation,
      metadata, // Include all metadata for debugging
    };

    // Extract buttons
    for (let i = 1; i <= 4; i++) {
      const buttonText = metadata[`fc:frame:button:${i}`];
      if (buttonText) {
        (frameData.buttons as any[]).push({
          index: i,
          text: buttonText,
          action: metadata[`fc:frame:button:${i}:action`] || 'post',
          target: metadata[`fc:frame:button:${i}:target`],
        });
      }
    }

    // Test action if requested
    let testResult;
    if (testAction?.buttonIndex) {
      try {
        testResult = await simulateFrameAction(
          url,
          metadata,
          testAction.buttonIndex,
          testAction.inputText
        );
      } catch (error) {
        console.error('Frame action test failed:', error);
      }
    }

    console.log('✅ Frame metadata extracted successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...frameData,
        testResult,
      }),
    };

  } catch (error) {
    console.error('❌ Frame preservation failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to preserve Frame' 
      }),
    };
  }
};