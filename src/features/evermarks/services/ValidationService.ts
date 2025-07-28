import type { 
  EvermarkMetadata, 
  FarcasterCastData
} from '../types';
import type { ValidationResult, ValidationFieldError } from '@/utils/errors';
import { EvermarkValidator } from '@/utils/validators';

export class ValidationService {
  /**
   * Validate evermark metadata using the utility validator
   */
  static validateEvermarkMetadata(metadata: EvermarkMetadata): ValidationResult {
    return EvermarkValidator.validateMetadata(metadata);
  }

  /**
   * Validate individual fields for real-time feedback
   */
  static validateField(field: string, value: any, metadata?: Partial<EvermarkMetadata>): ValidationFieldError | null {
    switch (field) {
      case 'title':
        if (!value?.trim()) {
          return { field: 'title', message: 'Title is required' };
        }
        if (value.length > 100) {
          return { field: 'title', message: 'Title must be 100 characters or less' };
        }
        if (value.length < 3) {
          return { field: 'title', message: 'Title should be at least 3 characters' };
        }
        break;

      case 'description':
        if (value && value.length > 1000) {
          return { field: 'description', message: 'Description must be 1000 characters or less' };
        }
        break;

      case 'author':
        if (!value?.trim()) {
          return { field: 'author', message: 'Author is required' };
        }
        if (value.length > 50) {
          return { field: 'author', message: 'Author name must be 50 characters or less' };
        }
        break;

      case 'sourceUrl':
        if (value && value.trim()) {
          try {
            new URL(value);
          } catch {
            return { field: 'sourceUrl', message: 'Source URL must be a valid URL' };
          }
        }
        break;

      case 'doi':
        if (value && !/^10\.\d{4,}\/[^\s]+$/.test(value)) {
          return { field: 'doi', message: 'Invalid DOI format' };
        }
        break;

      case 'isbn':
        if (value) {
          const cleanIsbn = value.replace(/[-\s]/g, '');
          if (!/^(?:\d{9}[\dX]|\d{13})$/.test(cleanIsbn)) {
            return { field: 'isbn', message: 'Invalid ISBN format' };
          }
        }
        break;

      case 'castUrl':
        if (value) {
          const urlPatterns = [
            /^https:\/\/warpcast\.com\/[^\/]+\/0x[a-fA-F0-9]+/,
            /^https:\/\/farcaster\.xyz\/[^\/]+\/0x[a-fA-F0-9]+/,
            /^https:\/\/supercast\.xyz\/[^\/]+\/0x[a-fA-F0-9]+/
          ];
          
          const isValidUrl = urlPatterns.some(pattern => pattern.test(value));
          const isValidHash = /^0x[a-fA-F0-9]{8,64}$/.test(value);
          
          if (!isValidUrl && !isValidHash) {
            return { field: 'castUrl', message: 'Invalid Farcaster cast URL or hash' };
          }
        }
        break;

      case 'imageFile':
        if (value) {
          const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
          if (!validTypes.includes(value.type)) {
            return { field: 'imageFile', message: 'Image must be JPEG, PNG, GIF, or WebP format' };
          }
          
          const maxSize = 10 * 1024 * 1024; // 10MB
          if (value.size > maxSize) {
            return { field: 'imageFile', message: 'Image must be less than 10MB' };
          }
        }
        break;

      case 'tags':
        if (value && Array.isArray(value)) {
          if (value.length > 10) {
            return { field: 'tags', message: 'Maximum 10 tags allowed' };
          }
          
          for (const tag of value) {
            if (!/^[a-zA-Z0-9-_]+$/.test(tag) || tag.length > 30) {
              return { field: 'tags', message: 'Tags must be alphanumeric and under 30 characters' };
            }
          }
        }
        break;
    }

    return null;
  }

  /**
   * Validate content type specific requirements
   */
  static validateContentTypeRequirements(
    contentType: EvermarkMetadata['contentType'], 
    metadata: Partial<EvermarkMetadata>
  ): ValidationFieldError[] {
    const errors: ValidationFieldError[] = [];

    switch (contentType) {
      case 'DOI':
        if (!metadata.doi?.trim()) {
          errors.push({ field: 'doi', message: 'DOI is required for academic papers' });
        }
        break;

      case 'ISBN':
        if (!metadata.isbn?.trim()) {
          errors.push({ field: 'isbn', message: 'ISBN is required for books' });
        }
        break;

      case 'Cast':
        if (!metadata.castUrl?.trim()) {
          errors.push({ field: 'castUrl', message: 'Cast URL or hash is required for Farcaster casts' });
        }
        break;

      case 'URL':
        if (!metadata.sourceUrl?.trim()) {
          errors.push({ field: 'sourceUrl', message: 'Source URL is required for web content' });
        }
        break;
    }

    return errors;
  }

  /**
   * Validate batch of evermarks for bulk operations
   */
  static validateEvermarkBatch(metadataArray: EvermarkMetadata[]): {
    isValid: boolean;
    results: Array<{ index: number; validation: ValidationResult }>;
  } {
    const results = metadataArray.map((metadata, index) => ({
      index,
      validation: this.validateEvermarkMetadata(metadata)
    }));

    const isValid = results.every(result => result.validation.isValid);

    return { isValid, results };
  }

  /**
   * Get validation schema for frontend forms
   */
  static getValidationSchema() {
    return {
      title: {
        required: true,
        minLength: 3,
        maxLength: 100,
        pattern: null
      },
      description: {
        required: false,
        minLength: 0,
        maxLength: 1000,
        pattern: null
      },
      author: {
        required: true,
        minLength: 1,
        maxLength: 50,
        pattern: null
      },
      sourceUrl: {
        required: false,
        minLength: 0,
        maxLength: 2048,
        pattern: 'url'
      },
      doi: {
        required: false,
        minLength: 0,
        maxLength: 200,
        pattern: /^10\.\d{4,}\/[^\s]+$/
      },
      isbn: {
        required: false,
        minLength: 0,
        maxLength: 20,
        pattern: /^(?:\d{9}[\dX]|\d{13})$/
      },
      castUrl: {
        required: false,
        minLength: 0,
        maxLength: 500,
        pattern: /^(https:\/\/(warpcast\.com|farcaster\.xyz|supercast\.xyz)\/[^\/]+\/0x[a-fA-F0-9]+|0x[a-fA-F0-9]{8,64})$/
      },
      tags: {
        required: false,
        maxItems: 10,
        itemPattern: /^[a-zA-Z0-9-_]+$/,
        itemMaxLength: 30
      }
    };
  }
}