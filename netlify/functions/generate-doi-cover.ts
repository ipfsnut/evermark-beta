import { Handler } from '@netlify/functions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface DOIMetadata {
  title: string;
  authors: string[];
  journal: string;
  year?: string;
  doi: string;
  abstract?: string;
}

/**
 * Estimate text width in pixels based on character analysis
 * Uses average character widths for Inter font family
 */
function estimateTextWidth(text: string, fontSize: number): number {
  // Average character widths for Inter font (relative to font size)
  const avgCharWidth = 0.55; // Inter is relatively compact
  const spaceWidth = 0.25;
  
  let width = 0;
  for (const char of text) {
    if (char === ' ') {
      width += spaceWidth * fontSize;
    } else if (char.match(/[iIl]/)) {
      width += 0.3 * fontSize; // Narrow characters
    } else if (char.match(/[mwMW]/)) {
      width += 0.8 * fontSize; // Wide characters
    } else {
      width += avgCharWidth * fontSize;
    }
  }
  
  return width;
}

/**
 * Calculate font size that fits within available width
 */
function calculateOptimalFontSize(text: string, maxWidth: number, maxFontSize: number, minFontSize: number = 16): number {
  let fontSize = maxFontSize;
  
  while (fontSize >= minFontSize) {
    const estimatedWidth = estimateTextWidth(text, fontSize);
    if (estimatedWidth <= maxWidth) {
      return fontSize;
    }
    fontSize -= 2; // Decrease by 2px steps
  }
  
  return minFontSize;
}

/**
 * Calculate adaptive font sizes based on actual text width estimation
 */
function calculateFontSizes(title: string, authors: string[], journal?: string) {
  const authorsText = authors.join(', ');
  
  // Available width: 1200px canvas minus 100px padding (50px each side)
  const maxWidth = 1100;
  
  // Calculate optimal font sizes based on text width
  const titleSize = calculateOptimalFontSize(title, maxWidth, 52, 28);
  const authorsSize = calculateOptimalFontSize(authorsText, maxWidth, 32, 20);
  const journalSize = journal ? calculateOptimalFontSize(journal, maxWidth, 28, 18) : 24;

  return {
    title: titleSize,
    authors: authorsSize,
    journal: journalSize,
    doi: 18,
    year: 20
  };
}

/**
 * Wrap text to fit within specified pixel width
 */
function wrapTextByWidth(text: string, maxWidth: number, fontSize: number, maxLines: number = 10): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = estimateTextWidth(testLine, fontSize);
    
    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word is longer than max width, break it
        let remainingWord = word;
        while (remainingWord && lines.length < maxLines) {
          let breakPoint = remainingWord.length;
          while (breakPoint > 0) {
            const testSegment = remainingWord.substring(0, breakPoint);
            if (estimateTextWidth(testSegment, fontSize) <= maxWidth) {
              lines.push(testSegment);
              remainingWord = remainingWord.substring(breakPoint);
              break;
            }
            breakPoint--;
          }
          if (breakPoint === 0) break; // Avoid infinite loop
        }
        currentLine = remainingWord;
      }
      
      if (lines.length >= maxLines) break;
    }
  }
  
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  
  return lines.slice(0, maxLines);
}

/**
 * Generate hi-tech academic paper cover SVG
 */
async function generateDOICover(metadata: DOIMetadata): Promise<string> {
  const width = 1200; // Landscape format
  const height = 630; // Standard social media landscape dimensions
  
  const fontSizes = calculateFontSizes(metadata.title, metadata.authors, metadata.journal);
  
  // Wrap text based on actual pixel width calculations
  const maxWidth = 1100; // Available width minus padding
  const titleLines = wrapTextByWidth(metadata.title, maxWidth, fontSizes.title, 3);
  const authorsText = metadata.authors.join(', ');
  const authorsLines = wrapTextByWidth(authorsText, maxWidth, fontSizes.authors, 2);
  const journalLines = metadata.journal ? wrapTextByWidth(metadata.journal, maxWidth, fontSizes.journal, 1) : [];

  // Hi-tech color scheme
  const colors = {
    background: '#0A0A0F', // Dark blue-black
    accent: '#00D4FF', // Cyan accent
    accentGlow: '#00D4FF40', // Cyan with opacity
    text: '#FFFFFF',
    textSecondary: '#B0BEC5',
    textTertiary: '#78909C',
    grid: '#1A1A2E20', // Subtle grid lines
    highlight: '#FF6B35' // Orange highlight
  };

  // Create SVG with hi-tech design
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Hi-tech background gradient -->
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0A0A0F;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#1A1A2E;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#0A0A0F;stop-opacity:1" />
        </linearGradient>
        
        <!-- Accent gradient -->
        <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#00D4FF;stop-opacity:0.8" />
          <stop offset="100%" style="stop-color:#FF6B35;stop-opacity:0.8" />
        </linearGradient>
        
        <!-- Grid pattern -->
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${colors.grid}" stroke-width="1"/>
        </pattern>
        
        <!-- Glow filter -->
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- Background -->
      <rect width="100%" height="100%" fill="url(#bgGradient)"/>
      
      <!-- Grid overlay -->
      <rect width="100%" height="100%" fill="url(#grid)" opacity="0.1"/>
      
      <!-- Top accent bar -->
      <rect x="0" y="0" width="100%" height="8" fill="url(#accentGradient)"/>
      
      <!-- Header section with geometric elements -->
      <rect x="50" y="30" width="1100" height="2" fill="${colors.accent}" opacity="0.6"/>
      <circle cx="70" cy="31" r="4" fill="${colors.accent}" filter="url(#glow)"/>
      <circle cx="1130" cy="31" r="4" fill="${colors.highlight}" filter="url(#glow)"/>
      
      <!-- Title section -->
      <rect x="50" y="70" width="1100" height="4" fill="${colors.accentGlow}" rx="2"/>
      
      ${titleLines.map((line, index) => `
        <text x="600" y="${120 + (index * (fontSizes.title + 12))}" 
              text-anchor="middle" 
              font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" 
              font-size="${fontSizes.title}" 
              font-weight="700" 
              fill="${colors.text}"
              filter="url(#glow)">
          ${line}
        </text>
      `).join('')}
      
      <!-- Authors section -->
      <rect x="50" y="${250 + (titleLines.length * 40)}" width="1100" height="2" fill="${colors.accent}" opacity="0.4"/>
      
      ${authorsLines.map((line, index) => `
        <text x="600" y="${290 + (titleLines.length * 40) + (index * (fontSizes.authors + 8))}" 
              text-anchor="middle" 
              font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" 
              font-size="${fontSizes.authors}" 
              font-weight="400" 
              fill="${colors.textSecondary}">
          ${line}
        </text>
      `).join('')}
      
      <!-- Journal section (only show if journal exists) -->
      ${metadata.journal ? `
        <rect x="50" y="${360 + (titleLines.length * 40) + (authorsLines.length * 35)}" width="1100" height="2" fill="${colors.highlight}" opacity="0.6"/>
        
        ${journalLines.map((line, index) => `
          <text x="600" y="${400 + (titleLines.length * 40) + (authorsLines.length * 35) + (index * (fontSizes.journal + 6))}" 
                text-anchor="middle" 
                font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" 
                font-size="${fontSizes.journal}" 
                font-weight="500" 
                fill="${colors.textTertiary}">
            ${line}
          </text>
        `).join('')}
      ` : ''}
      
      ${metadata.year ? `
        <text x="600" y="${430 + (titleLines.length * 40) + (authorsLines.length * 35)}" 
              text-anchor="middle" 
              font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" 
              font-size="${fontSizes.year}" 
              font-weight="400" 
              fill="${colors.textTertiary}">
          ${metadata.year}
        </text>
      ` : ''}
      
      <!-- Bottom section with DOI -->
      <rect x="50" y="${height - 100}" width="1100" height="2" fill="${colors.accent}" opacity="0.3"/>
      
      <!-- DOI with tech styling -->
      <rect x="50" y="${height - 60}" width="1100" height="30" fill="${colors.accentGlow}" rx="4" opacity="0.1"/>
      <text x="600" y="${height - 40}" 
            text-anchor="middle" 
            font-family="JetBrains Mono, Monaco, 'Courier New', monospace" 
            font-size="${fontSizes.doi}" 
            font-weight="400" 
            fill="${colors.accent}">
        DOI: ${metadata.doi}
      </text>
      
      <!-- Corner elements -->
      <path d="M 0 0 L 30 0 L 0 30 Z" fill="${colors.accent}" opacity="0.3"/>
      <path d="M ${width} 0 L ${width - 30} 0 L ${width} 30 Z" fill="${colors.highlight}" opacity="0.3"/>
      <path d="M 0 ${height} L 30 ${height} L 0 ${height - 30} Z" fill="${colors.highlight}" opacity="0.3"/>
      <path d="M ${width} ${height} L ${width - 30} ${height} L ${width} ${height - 30} Z" fill="${colors.accent}" opacity="0.3"/>
      
      <!-- Evermark branding -->
      <text x="600" y="${height - 15}" 
            text-anchor="middle" 
            font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" 
            font-size="14" 
            font-weight="300" 
            fill="${colors.textTertiary}" 
            opacity="0.6">
        Generated by Evermark
      </text>
    </svg>
  `;

  return svg;
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
    const { doi, title, authors, journal, year, preview = false } = JSON.parse(event.body || '{}');

    if (!title || !authors || !doi) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required fields: title, authors, doi' 
        }),
      };
    }

    console.log('🎓 Generating DOI cover for:', { 
      doi, 
      title: title.substring(0, 50) + '...',
      authors: Array.isArray(authors) ? authors : [authors],
      journal,
      year
    });

    const metadata: DOIMetadata = {
      title,
      authors: Array.isArray(authors) ? authors : [authors],
      journal,
      year,
      doi
    };

    const svgContent = await generateDOICover(metadata);

    if (preview) {
      // Return SVG as data URL for preview
      const base64Svg = Buffer.from(svgContent).toString('base64');
      const dataUrl = `data:image/svg+xml;base64,${base64Svg}`;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          preview: true,
          imageUrl: dataUrl
        }),
      };
    }

    // For actual evermark creation, we'd save to storage here
    // For now, return success with metadata
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'DOI cover generated successfully',
        metadata: {
          doi,
          title: title.substring(0, 100) + (title.length > 100 ? '...' : ''),
          authors: metadata.authors.length,
          journal
        }
      }),
    };

  } catch (error) {
    console.error('❌ DOI cover generation failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to generate DOI cover',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};