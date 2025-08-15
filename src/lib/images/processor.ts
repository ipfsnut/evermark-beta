// Image processing utilities
import sharp from 'sharp';

export interface ProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface ProcessingResult {
  success: boolean;
  buffer?: Buffer;
  contentType?: string;
  dimensions?: { width: number; height: number };
  error?: string;
}

/**
 * Process and optimize image
 */
export async function processImage(
  inputBuffer: Buffer,
  options: ProcessingOptions = {}
): Promise<ProcessingResult> {
  try {
    const {
      maxWidth = 1200,
      maxHeight = 1200,
      quality = 85,
      format = 'jpeg'
    } = options;

    let processor = sharp(inputBuffer);
    
    // Get original dimensions
    const metadata = await processor.metadata();
    
    // Resize if needed (maintain aspect ratio)
    if (metadata.width && metadata.height) {
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        processor = processor.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }
    }

    // Convert and optimize
    let buffer: Buffer;
    let contentType: string;

    switch (format) {
      case 'webp':
        buffer = await processor.webp({ quality }).toBuffer();
        contentType = 'image/webp';
        break;
      case 'png':
        buffer = await processor.png({ quality }).toBuffer();
        contentType = 'image/png';
        break;
      default:
        buffer = await processor.jpeg({ quality }).toBuffer();
        contentType = 'image/jpeg';
    }

    // Get processed dimensions
    const processedMetadata = await sharp(buffer).metadata();

    return {
      success: true,
      buffer,
      contentType,
      dimensions: {
        width: processedMetadata.width || 0,
        height: processedMetadata.height || 0
      }
    };
  } catch (error) {
    console.error('Image processing failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Processing failed'
    };
  }
}

/**
 * Generate thumbnail
 */
export async function generateThumbnail(
  inputBuffer: Buffer,
  size: number = 400
): Promise<ProcessingResult> {
  try {
    const buffer = await sharp(inputBuffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    const metadata = await sharp(buffer).metadata();

    return {
      success: true,
      buffer,
      contentType: 'image/jpeg',
      dimensions: {
        width: metadata.width || size,
        height: metadata.height || size
      }
    };
  } catch (error) {
    console.error('Thumbnail generation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Thumbnail generation failed'
    };
  }
}

/**
 * Validate image buffer
 */
export async function validateImage(buffer: Buffer): Promise<{
  valid: boolean;
  format?: string;
  dimensions?: { width: number; height: number };
  error?: string;
}> {
  try {
    const metadata = await sharp(buffer).metadata();
    
    if (!metadata.format) {
      return { valid: false, error: 'Unknown image format' };
    }

    const supportedFormats = ['jpeg', 'png', 'webp', 'gif'];
    if (!supportedFormats.includes(metadata.format)) {
      return { valid: false, error: `Unsupported format: ${metadata.format}` };
    }

    return {
      valid: true,
      format: metadata.format,
      dimensions: {
        width: metadata.width || 0,
        height: metadata.height || 0
      }
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid image'
    };
  }
}

/**
 * Get image info without processing
 */
export async function getImageInfo(buffer: Buffer): Promise<{
  format?: string;
  width?: number;
  height?: number;
  size: number;
  hasTransparency?: boolean;
}> {
  try {
    const metadata = await sharp(buffer).metadata();
    
    return {
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      size: buffer.length,
      hasTransparency: metadata.channels === 4 || metadata.format === 'png'
    };
  } catch (error) {
    return {
      size: buffer.length
    };
  }
}