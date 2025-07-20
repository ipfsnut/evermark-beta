const IPFS_CONFIG = {
  PINATA_JWT: import.meta.env.VITE_PINATA_JWT,
  PINATA_API_URL: 'https://api.pinata.cloud',
  IPFS_GATEWAY: import.meta.env.VITE_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs',
  ENABLE_IPFS: import.meta.env.VITE_ENABLE_IPFS !== 'false'
};

export interface IPFSUploadResult {
  ipfsHash: string;
  url: string;
}

export class IPFSService {
  /**
   * Upload file to IPFS via Pinata
   */
  static async uploadFile(file: File): Promise<IPFSUploadResult> {
    if (!IPFS_CONFIG.PINATA_JWT) {
      console.warn('IPFS upload disabled: No Pinata JWT configured');
      // Return a mock hash for development
      return {
        ipfsHash: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url: URL.createObjectURL(file)
      };
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Add metadata for better organization
      const metadata = JSON.stringify({
        name: file.name,
        keyvalues: {
          type: 'evermark-image',
          uploadedAt: new Date().toISOString(),
          size: file.size.toString(),
          mimeType: file.type
        }
      });
      formData.append('pinataMetadata', metadata);

      const options = JSON.stringify({
        cidVersion: 1,
        customPinPolicy: {
          regions: [
            { id: 'FRA1', desiredReplicationCount: 2 },
            { id: 'NYC1', desiredReplicationCount: 2 }
          ]
        }
      });
      formData.append('pinataOptions', options);

      const response = await fetch(`${IPFS_CONFIG.PINATA_API_URL}/pinning/pinFileToIPFS`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${IPFS_CONFIG.PINATA_JWT}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`IPFS upload failed: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      
      return {
        ipfsHash: result.IpfsHash,
        url: `${IPFS_CONFIG.IPFS_GATEWAY}/${result.IpfsHash}`
      };
    } catch (error) {
      console.error('IPFS file upload failed:', error);
      throw new Error(`Failed to upload image to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload JSON metadata to IPFS
   */
  static async uploadMetadata(metadata: Record<string, any>): Promise<IPFSUploadResult> {
    if (!IPFS_CONFIG.PINATA_JWT) {
      console.warn('IPFS metadata upload disabled: No Pinata JWT configured');
      // Return a mock hash for development
      return {
        ipfsHash: `mock-meta-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url: `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`
      };
    }

    try {
      const pinataMetadata = {
        name: `evermark-metadata-${Date.now()}`,
        keyvalues: {
          type: 'evermark-metadata',
          contentType: metadata.contentType || 'unknown',
          uploadedAt: new Date().toISOString(),
          title: metadata.title || 'Untitled'
        }
      };

      const pinataOptions = {
        cidVersion: 1,
        customPinPolicy: {
          regions: [
            { id: 'FRA1', desiredReplicationCount: 2 },
            { id: 'NYC1', desiredReplicationCount: 2 }
          ]
        }
      };

      const data = {
        pinataContent: metadata,
        pinataMetadata,
        pinataOptions
      };

      const response = await fetch(`${IPFS_CONFIG.PINATA_API_URL}/pinning/pinJSONToIPFS`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${IPFS_CONFIG.PINATA_JWT}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`IPFS metadata upload failed: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      
      return {
        ipfsHash: result.IpfsHash,
        url: `${IPFS_CONFIG.IPFS_GATEWAY}/${result.IpfsHash}`
      };
    } catch (error) {
      console.error('IPFS metadata upload failed:', error);
      throw new Error(`Failed to upload metadata to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch content from IPFS
   */
  static async fetchFromIPFS(ipfsHash: string): Promise<any> {
    try {
      const response = await fetch(`${IPFS_CONFIG.IPFS_GATEWAY}/${ipfsHash}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch (error) {
      console.error('IPFS fetch failed:', error);
      throw new Error(`Failed to fetch from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if IPFS is properly configured
   */
  static isConfigured(): boolean {
    return !!IPFS_CONFIG.PINATA_JWT && IPFS_CONFIG.ENABLE_IPFS;
  }

  /**
   * Get IPFS gateway URL for a hash
   */
  static getGatewayUrl(ipfsHash: string): string {
    return `${IPFS_CONFIG.IPFS_GATEWAY}/${ipfsHash}`;
  }
}