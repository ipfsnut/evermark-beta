import type { EvermarkMetadata, IPFSMetadata } from '../types';
import { IPFSService } from './IPFSService';

export class MetadataService {
  /**
   * Create IPFS-compatible metadata from evermark metadata
   */
  static createIPFSMetadata(metadata: EvermarkMetadata, imageUrl?: string): IPFSMetadata {
    const ipfsMetadata: IPFSMetadata = {
      name: metadata.title,
      description: metadata.description || '',
      image: imageUrl,
      external_url: metadata.sourceUrl,
      
      // Standard ERC721 attributes
      attributes: [
        {
          trait_type: 'Content Type',
          value: metadata.contentType || 'Custom'
        },
        {
          trait_type: 'Author',
          value: metadata.author
        },
        {
          trait_type: 'Created At',
          value: new Date().toISOString()
        }
      ],
      
      // Extended Evermark metadata
      evermark: {
        version: '1.0',
        contentType: metadata.contentType,
        sourceUrl: metadata.sourceUrl,
        tags: metadata.tags || [],
        customFields: metadata.customFields || []
      }
    };

    // Add tags as attributes if present
    if (metadata.tags && metadata.tags.length > 0) {
      ipfsMetadata.attributes.push({
        trait_type: 'Tags',
        value: metadata.tags.join(', ')
      });
    }

    // Add custom fields as attributes
    if (metadata.customFields && metadata.customFields.length > 0) {
      metadata.customFields.forEach(field => {
        ipfsMetadata.attributes.push({
          trait_type: field.key,
          value: field.value
        });
      });
    }

    // Add content-type specific metadata
    this.addContentTypeSpecificMetadata(metadata, ipfsMetadata);

    return ipfsMetadata;
  }

  /**
   * Add content-type specific metadata
   */
  private static addContentTypeSpecificMetadata(
    metadata: EvermarkMetadata, 
    ipfsMetadata: IPFSMetadata
  ): void {
    switch (metadata.contentType) {
      case 'DOI':
        if (metadata.doi) {
          ipfsMetadata.evermark.doi = metadata.doi;
          ipfsMetadata.attributes.push({
            trait_type: 'DOI',
            value: metadata.doi
          });
        }
        break;

      case 'ISBN':
        if (metadata.isbn) {
          ipfsMetadata.evermark.isbn = metadata.isbn;
          ipfsMetadata.attributes.push({
            trait_type: 'ISBN',
            value: metadata.isbn
          });
        }
        break;

      case 'Cast':
        if (metadata.castUrl) {
          ipfsMetadata.evermark.castUrl = metadata.castUrl;
        }
        break;

      case 'URL':
        if (metadata.url) {
          ipfsMetadata.evermark.url = metadata.url;
        }
        break;
    }

    // Add optional metadata fields
    if (metadata.journal) {
      ipfsMetadata.evermark.journal = metadata.journal;
      ipfsMetadata.attributes.push({
        trait_type: 'Journal',
        value: metadata.journal
      });
    }

    if (metadata.publisher) {
      ipfsMetadata.evermark.publisher = metadata.publisher;
      ipfsMetadata.attributes.push({
        trait_type: 'Publisher',
        value: metadata.publisher
      });
    }

    if (metadata.publicationDate) {
      ipfsMetadata.evermark.publicationDate = metadata.publicationDate;
      ipfsMetadata.attributes.push({
        trait_type: 'Publication Date',
        value: metadata.publicationDate
      });
    }
  }

  /**
   * Upload metadata to IPFS and return the URI
   */
  static async uploadMetadata(metadata: EvermarkMetadata, imageUrl?: string): Promise<{
    success: boolean;
    metadataURI?: string;
    ipfsHash?: string;
    error?: string;
  }> {
    try {
      const ipfsMetadata = this.createIPFSMetadata(metadata, imageUrl);
      const result = await IPFSService.uploadMetadata(ipfsMetadata);
      
      return {
        success: true,
        metadataURI: `ipfs://${result.ipfsHash}`,
        ipfsHash: result.ipfsHash
      };
    } catch (error) {
      console.error('Failed to upload metadata to IPFS:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload metadata'
      };
    }
  }

  /**
   * Process and upload image if provided
   */
  static async processImage(imageFile: File): Promise<{
    success: boolean;
    imageUrl?: string;
    ipfsHash?: string;
    error?: string;
  }> {
    try {
      const result = await IPFSService.uploadFile(imageFile);
      
      return {
        success: true,
        imageUrl: result.url,
        ipfsHash: result.ipfsHash
      };
    } catch (error) {
      console.error('Failed to upload image to IPFS:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload image'
      };
    }
  }

  /**
   * Estimate metadata size
   */
  static estimateMetadataSize(metadata: EvermarkMetadata): number {
    const ipfsMetadata = this.createIPFSMetadata(metadata);
    const jsonString = JSON.stringify(ipfsMetadata);
    return new Blob([jsonString]).size;
  }

  /**
   * Validate metadata for IPFS compatibility
   */
  static validateForIPFS(metadata: EvermarkMetadata): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check size limits
    const estimatedSize = this.estimateMetadataSize(metadata);
    if (estimatedSize > 1024 * 1024) { // 1MB limit
      errors.push('Metadata size exceeds 1MB limit');
    } else if (estimatedSize > 512 * 1024) { // 512KB warning
      warnings.push('Metadata size is large, consider reducing content');
    }

    // Check for problematic characters
    const problematicFields = [metadata.title, metadata.description, metadata.author];
    problematicFields.forEach((field, index) => {
      if (field && /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(field)) {
        const fieldNames = ['title', 'description', 'author'];
        warnings.push(`${fieldNames[index]} contains control characters that may cause issues`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}