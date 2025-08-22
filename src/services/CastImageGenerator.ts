/**
 * Generate a visual preview image of a Farcaster cast using Canvas
 * This runs in the browser and creates an image representation of the cast
 */

interface CastImageOptions {
  text: string;
  author: {
    username: string;
    displayName: string;
    pfpUrl?: string;
  };
  reactions?: {
    likes: number;
    recasts: number;
  };
  timestamp?: string;
}

export class CastImageGenerator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 800;
    this.canvas.height = 400;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    this.ctx = ctx;
  }

  /**
   * Generate a cast preview image
   */
  async generateCastImage(options: CastImageOptions): Promise<Blob> {
    const { text, author, reactions, timestamp } = options;

    // Clear canvas with white background
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw purple header bar (Farcaster brand color)
    this.ctx.fillStyle = '#8b5cf6';
    this.ctx.fillRect(0, 0, this.canvas.width, 60);

    // Draw "Farcaster" label
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
    this.ctx.fillText('Farcaster Cast', 20, 40);

    // Draw author info
    this.ctx.fillStyle = '#1f2937';
    this.ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    this.ctx.fillText(author.displayName || author.username, 30, 100);
    
    this.ctx.fillStyle = '#6b7280';
    this.ctx.font = '16px system-ui, -apple-system, sans-serif';
    this.ctx.fillText(`@${author.username}`, 30, 125);

    // Draw cast text (with word wrapping)
    this.ctx.fillStyle = '#111827';
    this.ctx.font = '18px system-ui, -apple-system, sans-serif';
    this.wrapText(text, 30, 160, 740, 25);

    // Draw engagement metrics at bottom
    if (reactions) {
      this.ctx.fillStyle = '#6b7280';
      this.ctx.font = '14px system-ui, -apple-system, sans-serif';
      const metricsText = `❤️ ${reactions.likes} likes  •  🔄 ${reactions.recasts} recasts`;
      this.ctx.fillText(metricsText, 30, 360);
    }

    // Draw timestamp if available
    if (timestamp) {
      this.ctx.fillStyle = '#9ca3af';
      this.ctx.font = '12px system-ui, -apple-system, sans-serif';
      const date = new Date(timestamp);
      const dateStr = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      this.ctx.fillText(dateStr, 30, 380);
    }

    // Add border
    this.ctx.strokeStyle = '#e5e7eb';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(1, 1, this.canvas.width - 2, this.canvas.height - 2);

    // Convert canvas to blob
    return new Promise((resolve, reject) => {
      this.canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to generate image blob'));
        }
      }, 'image/png');
    });
  }

  /**
   * Helper function to wrap text
   */
  private wrapText(text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = this.ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && i > 0) {
        this.ctx.fillText(line, x, currentY);
        line = words[i] + ' ';
        currentY += lineHeight;
        
        // Stop if we're getting too close to the bottom
        if (currentY > 320) {
          this.ctx.fillText('...', x, currentY);
          break;
        }
      } else {
        line = testLine;
      }
    }
    
    if (currentY <= 320) {
      this.ctx.fillText(line, x, currentY);
    }
  }

  /**
   * Generate and convert to File object for upload
   */
  async generateCastImageFile(options: CastImageOptions): Promise<File> {
    const blob = await this.generateCastImage(options);
    return new File([blob], 'cast-preview.png', { type: 'image/png' });
  }
}

// Export singleton instance
export const castImageGenerator = typeof window !== 'undefined' ? new CastImageGenerator() : null;