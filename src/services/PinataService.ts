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

    } catch (error) {
      console.error('❌ IPFS image upload failed:', error);
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

    } catch (error) {
      console.error('❌ IPFS metadata upload failed:', error);
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