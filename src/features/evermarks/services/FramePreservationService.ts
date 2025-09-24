import type { FrameData, PreservedMedia } from '../types';
import { MediaPreservationService } from './MediaPreservationService';

const FRAME_CONFIG = {
  API_BASE: import.meta.env.VITE_API_URL || '/.netlify/functions',
  SUPPORTED_VERSIONS: ['vNext', '2023-12-01', '2024-02-09'],
};

export class FramePreservationService {
  /**
   * Detect and preserve Frame data from embeds
   */
  static async preserveFrames(embeds: any[]): Promise<FrameData[]> {
    if (!embeds || embeds.length === 0) return [];

    const frames: FrameData[] = [];
    
    for (const embed of embeds) {
      if (embed.url && this.isFrameUrl(embed.url)) {
        const frameData = await this.preserveFrame(embed.url);
        if (frameData) {
          frames.push(frameData);
        }
      }
    }

    return frames;
  }

  /**
   * Check if URL is a Frame
   */
  private static isFrameUrl(url: string): boolean {
    // Frames typically have specific meta tags, but we need to fetch to confirm
    // Common patterns include /frames/, frame., or known Frame providers
    return url.includes('/frames/') || 
           url.includes('frame.') ||
           url.includes('frames.') ||
           url.includes('/api/frame');
  }

  /**
   * Preserve individual Frame
   */
  static async preserveFrame(frameUrl: string): Promise<FrameData | null> {
    try {
      console.log('🖼️ Preserving Frame:', frameUrl);

      // Fetch Frame metadata
      const response = await fetch(`${FRAME_CONFIG.API_BASE}/preserve-frame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: frameUrl }),
      });

      if (!response.ok) {
        console.error('Failed to preserve Frame:', response.statusText);
        return null;
      }

      const frameMetadata = await response.json();
      
      // Preserve Frame image if exists
      let preservedImage: PreservedMedia | undefined;
      if (frameMetadata.image) {
        const preserved = await MediaPreservationService.preserveMedia(frameMetadata.image);
        if (preserved) {
          preservedImage = preserved;
        }
      }

      return {
        frame_url: frameUrl,
        title: frameMetadata.title,
        image: frameMetadata.image,
        preserved_image: preservedImage,
        buttons: this.parseButtons(frameMetadata),
        input_text: frameMetadata['fc:frame:input:text'],
        state: frameMetadata['fc:frame:state'],
        post_url: frameMetadata['fc:frame:post_url'],
        frames_version: frameMetadata['fc:frame'] || 'vNext',
        og_metadata: this.extractOGMetadata(frameMetadata),
      };
    } catch (error) {
      console.error('Error preserving Frame:', error);
      return null;
    }
  }

  /**
   * Parse Frame buttons from metadata
   */
  private static parseButtons(metadata: any): FrameData['buttons'] {
    const buttons: FrameData['buttons'] = [];
    
    // Frames can have up to 4 buttons
    for (let i = 1; i <= 4; i++) {
      const buttonText = metadata[`fc:frame:button:${i}`];
      if (buttonText) {
        const actionType = metadata[`fc:frame:button:${i}:action`] || 'post';
        const target = metadata[`fc:frame:button:${i}:target`];
        
        buttons.push({
          index: i,
          title: buttonText,
          action_type: actionType as any,
          target,
        });
      }
    }
    
    return buttons.length > 0 ? buttons : undefined;
  }

  /**
   * Extract OpenGraph metadata
   */
  private static extractOGMetadata(metadata: any): Record<string, string> {
    const ogData: Record<string, string> = {};
    
    // Extract all og: prefixed properties
    Object.keys(metadata).forEach(key => {
      if (key.startsWith('og:')) {
        ogData[key] = metadata[key];
      }
    });
    
    return Object.keys(ogData).length > 0 ? ogData : {};
  }

  /**
   * Validate Frame metadata
   */
  static validateFrame(frameData: FrameData): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    // Check required fields
    if (!frameData.frame_url) {
      errors.push('Frame URL is required');
    }
    
    if (!frameData.image && !frameData.preserved_image) {
      errors.push('Frame image is required');
    }
    
    // Validate buttons
    if (frameData.buttons) {
      frameData.buttons.forEach(button => {
        if (!button.title) {
          errors.push(`Button ${button.index} is missing title`);
        }
        if (button.action_type === 'post_redirect' && !button.target) {
          errors.push(`Button ${button.index} redirect requires target URL`);
        }
      });
    }
    
    // Check Frame version
    if (frameData.frames_version && 
        !FRAME_CONFIG.SUPPORTED_VERSIONS.includes(frameData.frames_version)) {
      errors.push(`Unsupported Frame version: ${frameData.frames_version}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Simulate Frame interaction for testing
   */
  static async simulateFrameInteraction(
    frameData: FrameData,
    buttonIndex: number,
    inputText?: string,
    fid?: number
  ): Promise<{
    success: boolean;
    response?: any;
    error?: string;
  }> {
    try {
      const button = frameData.buttons?.find(b => b.index === buttonIndex);
      if (!button) {
        return {
          success: false,
          error: 'Button not found',
        };
      }

      // Build Frame action payload
      const payload = {
        untrustedData: {
          fid: fid || 1,
          url: frameData.frame_url,
          messageHash: `0x${'0'.repeat(64)}`, // Mock hash
          timestamp: Date.now(),
          network: 1,
          buttonIndex,
          inputText: inputText || '',
          state: frameData.state || '',
          transactionId: undefined,
        },
        trustedData: {
          messageBytes: '',
        },
      };

      const targetUrl = button.target || frameData.post_url || frameData.frame_url;
      
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Frame responded with ${response.status}`,
        };
      }

      const result = await response.text();
      return {
        success: true,
        response: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}