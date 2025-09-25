import type { ValidationResult, ValidationFieldError } from './errors';

export class Validators {
  /**
   * Validate Ethereum address
   */
  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Validate URL format
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
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
      /^https:\/\/warpcast\.com\/[^/]+\/0x[a-fA-F0-9]+/,
      /^https:\/\/farcaster\.xyz\/[^/]+\/0x[a-fA-F0-9]+/,
      /^https:\/\/supercast\.xyz\/[^/]+\/0x[a-fA-F0-9]+/
    ];

    // Check URL patterns
    for (const pattern of urlPatterns) {
      if (pattern.test(input)) return true;
    }

    // Check direct hash
    return /^0x[a-fA-F0-9]{8,64}$/.test(input);
  }

  /**
   * Validate image file
   */
  static validateImageFile(file: File): { isValid: boolean; error?: string } {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!validTypes.includes(file.type)) {
      return {
        isValid: false,
        error: 'Image must be JPEG, PNG, GIF, or WebP format'
      };
    }
    
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: 'Image must be less than 25MB'
      };
    }
    
    return { isValid: true };
  }

  /**
   * Sanitize text input
   */
  static sanitizeText(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }

  /**
   * Validate custom field key
   */
  static validateCustomFieldKey(key: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) && key.length <= 50;
  }

  /**
   * Validate tag format
   */
  static validateTag(tag: string): boolean {
    return /^[a-zA-Z0-9-_]+$/.test(tag) && tag.length <= 30;
  }
}

// Feature-specific validator that can be used by evermarks
export class EvermarkValidator {
  /**
   * Validate evermark metadata - requires EvermarkMetadata type from feature
   */
  static validateMetadata(metadata: unknown): ValidationResult {
    const errors: ValidationFieldError[] = [];
    const warnings: ValidationFieldError[] = [];
    
    // Handle null/undefined metadata
    if (!metadata || typeof metadata !== 'object') {
      errors.push({ field: 'metadata', message: 'Metadata is required' });
      return { isValid: false, errors };
    }
    
    // Cast metadata to any for property access - this is a validation function
    // that needs to handle arbitrary input
    const meta = metadata as any;

    // Title validation
    if (!meta.title?.trim()) {
      errors.push({ field: 'title', message: 'Title is required' });
    } else if (meta.title.length > 500) {
      errors.push({ field: 'title', message: 'Title must be 500 characters or less' });
    } else if (meta.title.length < 3) {
      warnings.push({ field: 'title', message: 'Title should be at least 3 characters' });
    }

    // Description validation
    if (!meta.description?.trim()) {
      warnings.push({ field: 'description', message: 'Description is recommended for better discoverability' });
    } else if (meta.description.length > 2000) {
      errors.push({ field: 'description', message: 'Description must be 2000 characters or less' });
    }

    // Author validation
    if (!meta.author?.trim()) {
      errors.push({ field: 'author', message: 'Author is required' });
    } else if (meta.author.length > 200) {
      errors.push({ field: 'author', message: 'Author name must be 200 characters or less' });
    }

    // URL validation
    if (meta.sourceUrl?.trim()) {
      if (!Validators.isValidUrl(meta.sourceUrl)) {
        errors.push({ field: 'sourceUrl', message: 'Source URL must be a valid URL' });
      }
    }

    // Content-type specific validation
    if (meta.contentType === 'DOI' && meta.doi) {
      if (!Validators.isValidDOI(meta.doi)) {
        errors.push({ field: 'doi', message: 'Invalid DOI format' });
      }
    }

    if (meta.contentType === 'ISBN' && meta.isbn) {
      if (!Validators.isValidISBN(meta.isbn)) {
        errors.push({ field: 'isbn', message: 'Invalid ISBN format' });
      }
    }

    if (meta.contentType === 'Cast' && meta.castUrl) {
      if (!Validators.isValidFarcasterInput(meta.castUrl)) {
        errors.push({ field: 'castUrl', message: 'Invalid Farcaster cast URL or hash' });
      }
    }

    // Image file validation
    if (meta.imageFile) {
      const imageValidation = Validators.validateImageFile(meta.imageFile);
      if (!imageValidation.isValid) {
        errors.push({ field: 'imageFile', message: imageValidation.error! });
      }
    }

    // Tags validation
    if (meta.tags && meta.tags.length > 10) {
      warnings.push({ field: 'tags', message: 'Consider using fewer tags for better organization' });
    }

    // Custom fields validation
    if (meta.customFields) {
      meta.customFields.forEach((field: { key: string; value: string }, index: number) => {
        if (!field.key?.trim()) {
          errors.push({ field: `customFields.${index}.key`, message: 'Custom field key is required' });
        } else if (!Validators.validateCustomFieldKey(field.key)) {
          errors.push({ field: `customFields.${index}.key`, message: 'Invalid custom field key format' });
        }
        
        if (!field.value?.trim()) {
          errors.push({ field: `customFields.${index}.value`, message: 'Custom field value is required' });
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}