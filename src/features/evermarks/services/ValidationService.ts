import type { 
  EvermarkMetadata, 
  ValidationResult, 
  ValidationError, 
  FarcasterCastData 
} from '../types';

export class ValidationService {
  /**
   * Validate complete evermark metadata
   */
  static validateEvermarkMetadata(metadata: EvermarkMetadata): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Required fields validation
    this.validateRequiredFields(metadata, errors, warnings);
    
    // Content-type specific validation
    this.validateContentTypeFields(metadata, errors);
    
    // File validation
    this.validateFiles(metadata, errors, warnings);
    
    // Additional field validation
    this.validateAdditionalFields(metadata, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Validate required fields
   */
  private static validateRequiredFields(
    metadata: EvermarkMetadata, 
    errors: ValidationError[], 
    warnings: ValidationError[]
  ): void {
    if (!metadata.title?.trim()) {
      errors.push({ field: 'title', message: 'Title is required' });
    } else if (metadata.title.length > 100) {
      errors.push({ field: 'title', message: 'Title must be 100 characters or less' });
    } else if (metadata.title.length < 3) {
      warnings.push({ field: 'title', message: 'Title should be at least 3 characters' });
    }

    if (!metadata.description?.trim()) {
      warnings.push({ field: 'description', message: 'Description is recommended for better discoverability' });
    } else if (metadata.description.length > 1000) {
      errors.push({ field: 'description', message: 'Description must be 1000 characters or less' });
    }

    if (!metadata.author?.trim()) {
      errors.push({ field: 'author', message: 'Author is required' });
    } else if (metadata.author.length > 50) {
      errors.push({ field: 'author', message: 'Author name must be 50 characters or less' });
    }

    if (metadata.sourceUrl && metadata.sourceUrl.trim()) {
      try {
        new URL(metadata.sourceUrl);
      } catch {
        errors.push({ field: 'sourceUrl', message: 'Source URL must be a valid URL' });
      }
    } else {
      warnings.push({ field: 'sourceUrl', message: 'Source URL is recommended for reference' });
    }
  }

  /**
   * Validate content-type specific fields
   */
  private static validateContentTypeFields(metadata: EvermarkMetadata, errors: ValidationError[]): void {
    switch (metadata.contentType) {
      case 'DOI':
        if (metadata.doi && !this.isValidDOI(metadata.doi)) {
          errors.push({ field: 'doi', message: 'Invalid DOI format (should be 10.xxxx/xxxxx)' });
        }
        break;
        
      case 'ISBN':
        if (metadata.isbn && !this.isValidISBN(metadata.isbn)) {
          errors.push({ field: 'isbn', message: 'Invalid ISBN format (should be 10 or 13 digits)' });
        }
        break;
        
      case 'Cast':
        if (metadata.castUrl && !this.isValidFarcasterInput(metadata.castUrl)) {
          errors.push({ field: 'castUrl', message: 'Invalid Farcaster cast URL or hash' });
        }
        break;
        
      case 'URL':
        if (metadata.url) {
          try {
            new URL(metadata.url);
          } catch {
            errors.push({ field: 'url', message: 'Invalid URL format' });
          }
        }
        break;
    }
  }

  /**
   * Validate file uploads
   */
  private static validateFiles(
    metadata: EvermarkMetadata, 
    errors: ValidationError[], 
    warnings: ValidationError[]
  ): void {
    if (metadata.imageFile) {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(metadata.imageFile.type)) {
        errors.push({ field: 'imageFile', message: 'Image must be JPEG, PNG, GIF, or WebP format' });
      }
      
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (metadata.imageFile.size > maxSize) {
        errors.push({ field: 'imageFile', message: 'Image must be less than 10MB' });
      }
      
      if (metadata.imageFile.size > 2 * 1024 * 1024) { // 2MB
        warnings.push({ field: 'imageFile', message: 'Consider compressing the image for faster loading' });
      }
    }
  }

  /**
   * Validate additional fields
   */
  private static validateAdditionalFields(
    metadata: EvermarkMetadata, 
    errors: ValidationError[], 
    warnings: ValidationError[]
  ): void {
    // Tags validation
    if (metadata.tags && metadata.tags.length > 10) {
      warnings.push({ field: 'tags', message: 'Consider using fewer tags for better organization' });
    }

    // Custom fields validation
    if (metadata.customFields) {
      metadata.customFields.forEach((field, index) => {
        if (!field.key?.trim()) {
          errors.push({ field: `customFields.${index}.key`, message: 'Custom field key is required' });
        } else if (field.key.length > 50) {
          errors.push({ field: `customFields.${index}.key`, message: 'Custom field key must be 50 characters or less' });
        } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.key)) {
          errors.push({ field: `customFields.${index}.key`, message: 'Custom field key must start with a letter and contain only letters, numbers, and underscores' });
        }
        
        if (!field.value?.trim()) {
          errors.push({ field: `customFields.${index}.value`, message: 'Custom field value is required' });
        } else if (field.value.length > 200) {
          errors.push({ field: `customFields.${index}.value`, message: 'Custom field value must be 200 characters or less' });
        }
      });
    }
  }

  /**
   * Validate DOI format
   */
  static isValidDOI(doi: string): boolean {
    return /^10\.\d{4,}\/[^\s]+$/.test(doi);
  }

  /**
   * Validate ISBN format
   */
  static isValidISBN(isbn: string): boolean {
    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    return /^(?:\d{9}[\dX]|\d{13})$/.test(cleanIsbn);
  }

  /**
   * Validate Farcaster input (URL or hash)
   */
  static isValidFarcasterInput(input: string): boolean {
    const urlPatterns = [
      /^https:\/\/warpcast\.com\/[^\/]+\/0x[a-fA-F0-9]+/,
      /^https:\/\/farcaster\.xyz\/[^\/]+\/0x[a-fA-F0-9]+/,
      /^https:\/\/supercast\.xyz\/[^\/]+\/0x[a-fA-F0-9]+/
    ];

    // Check URL patterns
    for (const pattern of urlPatterns) {
      if (pattern.test(input)) return true;
    }

    // Check direct hash
    return /^0x[a-fA-F0-9]{8,64}$/.test(input);
  }

  /**
   * Validate image file specifically
   */
  static validateImageFile(file: File): { isValid: boolean; error?: string } {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!validTypes.includes(file.type)) {
      return {
        isValid: false,
        error: 'Image must be JPEG, PNG, GIF, or WebP format'
      };
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: 'Image must be less than 10MB'
      };
    }
    
    return { isValid: true };
  }

  /**
   * Sanitize and format input data
   */
  static sanitizeMetadata(metadata: EvermarkMetadata): EvermarkMetadata {
    return {
      ...metadata,
      title: metadata.title?.trim(),
      description: metadata.description?.trim(),
      author: metadata.author?.trim(),
      sourceUrl: metadata.sourceUrl?.trim(),
      tags: metadata.tags?.map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0),
      customFields: metadata.customFields?.map(field => ({
        key: field.key.trim(),
        value: field.value.trim()
      }))
    };
  }
}