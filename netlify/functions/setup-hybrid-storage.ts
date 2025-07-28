import type { 
  EvermarkMetadata, 
  FarcasterCastData
} from '@/features/evermarks/types';
import type { 
  ValidationResult,
  ValidationFieldError
} from '@/utils/errors';

export class ValidationService {
  // Maximum allowed lengths for various fields
  private static readonly MAX_TITLE_LENGTH = 100;
  private static readonly MAX_DESCRIPTION_LENGTH = 1000;
  private static readonly MAX_AUTHOR_LENGTH = 50;
  private static readonly MAX_TAGS_COUNT = 10;
  private static readonly MAX_TAG_LENGTH = 30;
  private static readonly MAX_CUSTOM_FIELDS = 20;
  private static readonly MAX_FIELD_KEY_LENGTH = 50;
  private static readonly MAX_FIELD_VALUE_LENGTH = 200;
  private static readonly MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
  
  // Supported image types
  private static readonly SUPPORTED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp'
  ];

  /**
   * Main validation method for evermark metadata
   */
  static validateEvermarkMetadata(metadata: EvermarkMetadata): ValidationResult {
    const errors: ValidationFieldError[] = [];
    const warnings: ValidationFieldError[] = [];

    // Title validation (required)
    this.validateTitle(metadata.title, errors, warnings);
    
    // Description validation (recommended)
    this.validateDescription(metadata.description, errors, warnings);
    
    // Author validation (required)
    this.validateAuthor(metadata.author, errors, warnings);
    
    // Source URL validation (optional)
    this.validateSourceUrl(metadata.sourceUrl, errors, warnings);
    
    // Content type specific validation
    this.validateContentTypeSpecific(metadata, errors, warnings);
    
    // Image validation (optional)
    this.validateImage(metadata.imageFile, errors, warnings);
    
    // Tags validation (optional)
    this.validateTags(metadata.tags, errors, warnings);
    
    // Custom fields validation (optional)
    this.validateCustomFields(metadata.customFields, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Validate title field
   */
  private static validateTitle(title: string, errors: ValidationFieldError[], warnings: ValidationFieldError[]): void {
    if (!title || !title.trim()) {
      errors.push({
        field: 'title',
        message: 'Title is required'
      });
      return;
    }

    const trimmedTitle = title.trim();
    
    if (trimmedTitle.length > this.MAX_TITLE_LENGTH) {
      errors.push({
        field: 'title',
        message: `Title must be ${this.MAX_TITLE_LENGTH} characters or less`
      });
    }
    
    if (trimmedTitle.length < 3) {
      warnings.push({
        field: 'title',
        message: 'Title should be at least 3 characters for better discoverability'
      });
    }

    // Check for potentially problematic characters
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(trimmedTitle)) {
      warnings.push({
        field: 'title',
        message: 'Title contains control characters that may cause display issues'
      });
    }
  }

  /**
   * Validate description field
   */
  private static validateDescription(description: string, errors: ValidationFieldError[], warnings: ValidationFieldError[]): void {
    if (!description || !description.trim()) {
      warnings.push({
        field: 'description',
        message: 'Description is recommended for better discoverability'
      });
      return;
    }

    const trimmedDescription = description.trim();
    
    if (trimmedDescription.length > this.MAX_DESCRIPTION_LENGTH) {
      errors.push({
        field: 'description',
        message: `Description must be ${this.MAX_DESCRIPTION_LENGTH} characters or less`
      });
    }

    if (trimmedDescription.length < 10) {
      warnings.push({
        field: 'description',
        message: 'Description should be at least 10 characters for better context'
      });
    }
  }

  /**
   * Validate author field
   */
  private static validateAuthor(author: string, errors: ValidationFieldError[], warnings: ValidationFieldError[]): void {
    if (!author || !author.trim()) {
      errors.push({
        field: 'author',
        message: 'Author is required'
      });
      return;
    }

    const trimmedAuthor = author.trim();
    
    if (trimmedAuthor.length > this.MAX_AUTHOR_LENGTH) {
      errors.push({
        field: 'author',
        message: `Author name must be ${this.MAX_AUTHOR_LENGTH} characters or less`
      });
    }
  }

  /**
   * Validate source URL
   */
  private static validateSourceUrl(sourceUrl: string | undefined, errors: ValidationFieldError[], warnings: ValidationFieldError[]): void {
    if (!sourceUrl || !sourceUrl.trim()) {
      return; // Optional field
    }

    try {
      new URL(sourceUrl.trim());
    } catch {
      errors.push({
        field: 'sourceUrl',
        message: 'Source URL must be a valid URL'
      });
    }
  }

  /**
   * Validate content type specific fields
   */
  private static validateContentTypeSpecific(metadata: EvermarkMetadata, errors: ValidationFieldError[], warnings: ValidationFieldError[]): void {
    switch (metadata.contentType) {
      case 'DOI':
        this.validateDOI(metadata.doi, errors);
        break;
      case 'ISBN':
        this.validateISBN(metadata.isbn, errors);
        break;
      case 'Cast':
        this.validateFarcasterCast(metadata.castUrl, errors);
        break;
      case 'URL':
        this.validateURL(metadata.url, errors);
        break;
      case 'Custom':
      default:
        // No specific validation for custom content
        break;
    }
  }

  /**
   * Validate DOI format
   */
  private static validateDOI(doi: string | undefined, errors: ValidationFieldError[]): void {
    if (!doi || !doi.trim()) {
      errors.push({
        field: 'doi',
        message: 'DOI is required for academic papers'
      });
      return;
    }

    const doiPattern = /^10\.\d{4,}\/[^\s]+$/;
    if (!doiPattern.test(doi.trim())) {
      errors.push({
        field: 'doi',
        message: 'DOI must be in valid format (e.g., 10.1000/182)'
      });
    }
  }

  /**
   * Validate ISBN format
   */
  private static validateISBN(isbn: string | undefined, errors: ValidationFieldError[]): void {
    if (!isbn || !isbn.trim()) {
      errors.push({
        field: 'isbn',
        message: 'ISBN is required for books'
      });
      return;
    }

    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    const isbnPattern = /^(?:\d{9}[\dX]|\d{13})$/;
    
    if (!isbnPattern.test(cleanIsbn)) {
      errors.push({
        field: 'isbn',
        message: 'ISBN must be a valid 10 or 13 digit ISBN'
      });
    }
  }

  /**
   * Validate Farcaster cast URL or hash
   */
  private static validateFarcasterCast(castUrl: string | undefined, errors: ValidationFieldError[]): void {
    if (!castUrl || !castUrl.trim()) {
      errors.push({
        field: 'castUrl',
        message: 'Cast URL or hash is required for Farcaster casts'
      });
      return;
    }

    const trimmedUrl = castUrl.trim();
    
    // Check for valid Farcaster URLs
    const urlPatterns = [
      /^https:\/\/warpcast\.com\/[^\/]+\/0x[a-fA-F0-9]+/,
      /^https:\/\/farcaster\.xyz\/[^\/]+\/0x[a-fA-F0-9]+/,
      /^https:\/\/supercast\.xyz\/[^\/]+\/0x[a-fA-F0-9]+/
    ];

    // Check for direct hash
    const hashPattern = /^0x[a-fA-F0-9]{8,64}$/;

    const isValidUrl = urlPatterns.some(pattern => pattern.test(trimmedUrl));
    const isValidHash = hashPattern.test(trimmedUrl);

    if (!isValidUrl && !isValidHash) {
      errors.push({
        field: 'castUrl',
        message: 'Must be a valid Farcaster cast URL or hash'
      });
    }
  }

  /**
   * Validate generic URL
   */
  private static validateURL(url: string | undefined, errors: ValidationFieldError[]): void {
    if (!url || !url.trim()) {
      errors.push({
        field: 'url',
        message: 'URL is required for web content'
      });
      return;
    }

    try {
      new URL(url.trim());
    } catch {
      errors.push({
        field: 'url',
        message: 'Must be a valid URL'
      });
    }
  }

  /**
   * Validate image file
   */
  private static validateImage(imageFile: File | null | undefined, errors: ValidationFieldError[], warnings: ValidationFieldError[]): void {
    if (!imageFile) {
      return; // Optional field
    }

    // Check file type
    if (!this.SUPPORTED_IMAGE_TYPES.includes(imageFile.type)) {
      errors.push({
        field: 'imageFile',
        message: 'Image must be JPEG, PNG, GIF, or WebP format'
      });
    }

    // Check file size
    if (imageFile.size > this.MAX_IMAGE_SIZE) {
      errors.push({
        field: 'imageFile',
        message: `Image must be less than ${this.MAX_IMAGE_SIZE / (1024 * 1024)}MB`
      });
    }

    if (imageFile.size === 0) {
      errors.push({
        field: 'imageFile',
        message: 'Image file appears to be empty'
      });
    }

    // Warn about large files
    if (imageFile.size > 2 * 1024 * 1024) { // 2MB
      warnings.push({
        field: 'imageFile',
        message: 'Large images may take longer to upload and process'
      });
    }
  }

  /**
   * Validate tags array
   */
  private static validateTags(tags: string[] | undefined, errors: ValidationFieldError[], warnings: ValidationFieldError[]): void {
    if (!tags || tags.length === 0) {
      warnings.push({
        field: 'tags',
        message: 'Adding tags helps with discoverability'
      });
      return;
    }

    if (tags.length > this.MAX_TAGS_COUNT) {
      errors.push({
        field: 'tags',
        message: `Maximum ${this.MAX_TAGS_COUNT} tags allowed`
      });
    }

    tags.forEach((tag, index) => {
      if (!tag || !tag.trim()) {
        errors.push({
          field: `tags.${index}`,
          message: 'Tag cannot be empty'
        });
        return;
      }

      const trimmedTag = tag.trim();
      
      if (trimmedTag.length > this.MAX_TAG_LENGTH) {
        errors.push({
          field: `tags.${index}`,
          message: `Tag must be ${this.MAX_TAG_LENGTH} characters or less`
        });
      }

      // Check for valid tag format (alphanumeric, hyphens, underscores)
      if (!/^[a-zA-Z0-9-_]+$/.test(trimmedTag)) {
        errors.push({
          field: `tags.${index}`,
          message: 'Tags can only contain letters, numbers, hyphens, and underscores'
        });
      }
    });

    // Check for duplicate tags
    const uniqueTags = new Set(tags.map(tag => tag.trim().toLowerCase()));
    if (uniqueTags.size !== tags.length) {
      warnings.push({
        field: 'tags',
        message: 'Duplicate tags will be removed'
      });
    }
  }

  /**
   * Validate custom fields array
   */
  private static validateCustomFields(customFields: Array<{ key: string; value: string }> | undefined, errors: ValidationFieldError[], warnings: ValidationFieldError[]): void {
    if (!customFields || customFields.length === 0) {
      return; // Optional field
    }

    if (customFields.length > this.MAX_CUSTOM_FIELDS) {
      errors.push({
        field: 'customFields',
        message: `Maximum ${this.MAX_CUSTOM_FIELDS} custom fields allowed`
      });
    }

    const usedKeys = new Set<string>();

    customFields.forEach((field, index) => {
      // Validate key
      if (!field.key || !field.key.trim()) {
        errors.push({
          field: `customFields.${index}.key`,
          message: 'Custom field key is required'
        });
      } else {
        const trimmedKey = field.key.trim();
        
        if (trimmedKey.length > this.MAX_FIELD_KEY_LENGTH) {
          errors.push({
            field: `customFields.${index}.key`,
            message: `Custom field key must be ${this.MAX_FIELD_KEY_LENGTH} characters or less`
          });
        }

        // Check for valid key format
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmedKey)) {
          errors.push({
            field: `customFields.${index}.key`,
            message: 'Custom field key must start with a letter and contain only letters, numbers, and underscores'
          });
        }

        // Check for duplicate keys
        if (usedKeys.has(trimmedKey.toLowerCase())) {
          errors.push({
            field: `customFields.${index}.key`,
            message: 'Duplicate custom field key'
          });
        } else {
          usedKeys.add(trimmedKey.toLowerCase());
        }
      }

      // Validate value
      if (!field.value || !field.value.trim()) {
        errors.push({
          field: `customFields.${index}.value`,
          message: 'Custom field value is required'
        });
      } else if (field.value.trim().length > this.MAX_FIELD_VALUE_LENGTH) {
        errors.push({
          field: `customFields.${index}.value`,
          message: `Custom field value must be ${this.MAX_FIELD_VALUE_LENGTH} characters or less`
        });
      }
    });
  }

  /**
   * Validate Farcaster cast data structure
   */
  static validateFarcasterCastData(castData: FarcasterCastData): ValidationResult {
    const errors: ValidationFieldError[] = [];

    if (!castData.castHash) {
      errors.push({
        field: 'castHash',
        message: 'Cast hash is required'
      });
    }

    if (!castData.author) {
      errors.push({
        field: 'author',
        message: 'Cast author is required'
      });
    }

    if (!castData.content) {
      errors.push({
        field: 'content',
        message: 'Cast content is required'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize text input by trimming and normalizing whitespace
   */
  static sanitizeText(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }

  /**
   * Extract and validate hash from Farcaster URL
   */
  static extractCastHash(input: string): string | null {
    if (!input || !input.trim()) {
      return null;
    }

    const trimmedInput = input.trim();

    // If it's already a hash
    if (/^0x[a-fA-F0-9]{8,64}$/.test(trimmedInput)) {
      return trimmedInput;
    }

    // Extract hash from URL
    const hashMatch = trimmedInput.match(/0x[a-fA-F0-9]+/);
    return hashMatch ? hashMatch[0] : null;
  }

  /**
   * Get validation configuration for UI display
   */
  static getValidationConfig() {
    return {
      title: {
        required: true,
        maxLength: this.MAX_TITLE_LENGTH,
        minLength: 3
      },
      description: {
        required: false,
        maxLength: this.MAX_DESCRIPTION_LENGTH,
        minLength: 10
      },
      author: {
        required: true,
        maxLength: this.MAX_AUTHOR_LENGTH
      },
      tags: {
        maxCount: this.MAX_TAGS_COUNT,
        maxLength: this.MAX_TAG_LENGTH
      },
      customFields: {
        maxCount: this.MAX_CUSTOM_FIELDS,
        keyMaxLength: this.MAX_FIELD_KEY_LENGTH,
        valueMaxLength: this.MAX_FIELD_VALUE_LENGTH
      },
      image: {
        maxSize: this.MAX_IMAGE_SIZE,
        supportedTypes: this.SUPPORTED_IMAGE_TYPES
      }
    };
  }
}