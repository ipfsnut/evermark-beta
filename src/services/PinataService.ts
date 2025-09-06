// src/services/PinataService.ts
// Simple Pinata IPFS upload service for evermark creation

interface PinataUploadResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
  isDuplicate?: boolean;
}

interface IPFSUploadResult {
  success: boolean;
  hash?: string;
  url?: string;
  error?: string;
}

class PinataService {
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly jwt: string;
  private readonly gateway: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_PINATA_API_KEY || '';
    this.secretKey = import.meta.env.VITE_PINATA_SECRET_KEY || '';
    this.jwt = import.meta.env.VITE_PINATA_JWT || '';
    this.gateway = import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud';
  }

  /**
   * Upload an image file to IPFS via Pinata
   */
  async uploadImage(file: File): Promise<IPFSUploadResult> {
    try {
      console.log('📁 Uploading image to IPFS:', file.name, `(${file.size} bytes)`);

      // Check if we're in a restricted environment (Farcaster mini-app)
      const isRestrictedEnv = window.location !== window.parent.location || 
                             /farcaster|warpcast/i.test(navigator.userAgent);

      if (isRestrictedEnv) {
        console.log('🔄 Using proxy for IPFS upload in restricted environment');
        
        // Convert file to base64 for proxy upload
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Use our backend proxy for Pinata upload
        const response = await fetch('/.netlify/functions/upload-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: base64,
            filename: file.name,
            size: file.size
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Proxy upload failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        console.log('✅ Image uploaded to IPFS via proxy:', result.hash);

        return {
          success: true,
          hash: result.hash,
          url: result.url || `${this.gateway}/ipfs/${result.hash}`
        };
      } else {
        // Direct upload for regular browser environment
        const formData = new FormData();
        formData.append('file', file);

        const metadata = JSON.stringify({
          name: `evermark-image-${Date.now()}`,
          keyvalues: {
            type: 'evermark-image',
            filename: file.name,
            size: file.size.toString()
          }
        });
        formData.append('pinataMetadata', metadata);

        const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.jwt}`
          },
          body: formData
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Pinata upload failed: ${response.status} - ${errorText}`);
        }

        const result: PinataUploadResponse = await response.json();
        
        console.log('✅ Image uploaded to IPFS:', result.IpfsHash);

        return {
          success: true,
          hash: result.IpfsHash,
          url: `${this.gateway}/ipfs/${result.IpfsHash}`
        };
      }
    } catch (error) {
      console.error('❌ IPFS image upload failed:', error);
      
      // More specific error messages
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        return {
          success: false,
          error: 'Network error: Unable to upload image. This may be due to CORS restrictions in the Farcaster app. Please try again or use a different browser.'
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Image upload failed'
      };
    }
  }

  /**
   * Upload metadata JSON to IPFS via Pinata
   */
  async uploadMetadata(metadata: any): Promise<IPFSUploadResult> {
    try {
      console.log('📋 Uploading metadata to IPFS for:', metadata.name);

      // Check if we're in a restricted environment
      const isRestrictedEnv = window.location !== window.parent.location || 
                             /farcaster|warpcast/i.test(navigator.userAgent);

      if (isRestrictedEnv) {
        console.log('🔄 Using proxy for metadata upload in restricted environment');
        
        // Use our backend proxy for metadata upload
        const response = await fetch('/.netlify/functions/upload-metadata', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ metadata })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Proxy metadata upload failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        console.log('✅ Metadata uploaded to IPFS via proxy:', result.hash);

        return {
          success: true,
          hash: result.hash,
          url: `ipfs://${result.hash}`
        };
      } else {
        // Direct upload for regular browser environment
        const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.jwt}`
          },
          body: JSON.stringify({
            pinataContent: metadata,
            pinataMetadata: {
              name: `evermark-metadata-${Date.now()}`,
              keyvalues: {
                type: 'evermark-metadata',
                title: metadata.name
              }
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Pinata metadata upload failed: ${response.status} - ${errorText}`);
        }

        const result: PinataUploadResponse = await response.json();
        
        console.log('✅ Metadata uploaded to IPFS:', result.IpfsHash);

        return {
          success: true,
          hash: result.IpfsHash,
          url: `ipfs://${result.IpfsHash}`
        };
      }
    } catch (error) {
      console.error('❌ IPFS metadata upload failed:', error);
      
      // More specific error messages
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        return {
          success: false,
          error: 'Network error: Unable to upload metadata. This may be due to CORS restrictions. Please try again or use a different browser.'
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Metadata upload failed'
      };
    }
  }

  isConfigured(): boolean {
    return !!(this.jwt && this.apiKey && this.secretKey);
  }
}

export const pinataService = new PinataService();
export type { IPFSUploadResult };