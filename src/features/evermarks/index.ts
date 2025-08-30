// Fix the ValidationError export issue
export type {
  Evermark,
  EvermarkMetadata,
  CreateEvermarkInput,
  CreateEvermarkResult,
  EvermarkFilters,
  EvermarkPagination,
  EvermarkFeedOptions,
  EvermarkFeedResult,
  ValidationResult,
  ValidationFieldError, // Fixed: Import from correct module
  UseEvermarksResult,
  FarcasterCastData
} from './types';

// Services - Export business logic layer
// EvermarkService not exported due to SDK dependencies

// Hooks - Export main state management hook
export { useEvermarksState } from './hooks/useEvermarkState';

// Components - Export all UI components
export { EvermarkFeed } from './components/EvermarkFeed';
export { EvermarkCard } from './components/EvermarkCard';
export { CreateEvermarkForm } from './components/CreateEvermarkForm';
export { ReferralPanel } from './components/ReferralPanel';
export { ReferralEarnings } from './components/ReferralEarnings';

// Feature configuration and utilities
export const evermarksConfig = {
  name: 'evermarks',
  version: '1.0.0',
  description: 'Content preservation and curation on blockchain',
  
  // Feature capabilities
  features: {
    create: true,
    view: true,
    search: true,
    filter: true,
    paginate: true,
    imageUpload: true,
    metadataValidation: true,
    farcasterIntegration: true,
    blockchainMinting: true,
    ipfsStorage: true
  },
  
  // Default configuration
  defaults: {
    pageSize: 12,
    sortBy: 'created_at' as const,
    sortOrder: 'desc' as const,
    refreshInterval: 30000, // 30 seconds
    imageMaxSize: 10 * 1024 * 1024, // 10MB
    supportedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxTitleLength: 100,
    maxDescriptionLength: 1000,
    maxTagsCount: 10
  },
  
  // Content type configuration
  contentTypes: {
    Cast: {
      name: 'Farcaster Cast',
      icon: '💬',
      description: 'Social media post from Farcaster',
      requiredFields: ['castUrl'],
      validation: {
        castUrl: {
          required: true,
          pattern: /^(https:\/\/(warpcast\.com|farcaster\.xyz)|0x[a-fA-F0-9]+)/
        }
      }
    },
    DOI: {
      name: 'Academic Paper',
      icon: '📄',
      description: 'Academic research paper with DOI',
      requiredFields: ['doi'],
      validation: {
        doi: {
          required: true,
          pattern: /^10\.\d{4,}\/[^\s]+$/
        }
      }
    },
    ISBN: {
      name: 'Book',
      icon: '📚',
      description: 'Published book with ISBN',
      requiredFields: ['isbn'],
      validation: {
        isbn: {
          required: true,
          pattern: /^(?:\d{9}[\dX]|\d{13})$/
        }
      }
    },
    URL: {
      name: 'Web Content',
      icon: '🌐',
      description: 'Web content from a URL',
      requiredFields: ['url'],
      validation: {
        url: {
          required: true,
          type: 'url'
        }
      }
    },
    Custom: {
      name: 'Custom Content',
      icon: '✨',
      description: 'Custom content with flexible metadata',
      requiredFields: [],
      validation: {}
    }
  },
  
  // UI configuration
  ui: {
    defaultView: 'grid' as const,
    enableViewToggle: true,
    enableFilters: true,
    enableSearch: true,
    showCreateButton: true,
    showPreview: true,
    enableImageUpload: true,
    maxPreviewTags: 5
  },
  
  // Integration settings
  integrations: {
    blockchain: {
      network: 'base',
      mintingEnabled: true,
      gasOptimization: true
    },
    ipfs: {
      enabled: true,
      pinningService: 'pinata',
      metadataUpload: true,
      imageUpload: true
    },
    farcaster: {
      enabled: true,
      autoDetection: true,
      frameSupport: true,
      castValidation: true
    }
  }
};

// Utility functions for external use
export const evermarksUtils = {
  /**
   * Check if evermarks feature is enabled
   */
  isEnabled: (): boolean => {
    return evermarksConfig.features.create && evermarksConfig.features.view;
  },
  
  /**
   * Get content type configuration
   */
  getContentTypeConfig: (contentType: keyof typeof evermarksConfig.contentTypes) => {
    return evermarksConfig.contentTypes[contentType];
  },
  
  /**
   * Validate content type input
   */
  validateContentType: (
    contentType: keyof typeof evermarksConfig.contentTypes, 
    data: Record<string, any>
  ): { isValid: boolean; errors: string[] } => {
    const config = evermarksConfig.contentTypes[contentType];
    const errors: string[] = [];
    
    // Check required fields
    for (const field of config.requiredFields) {
      if (!data[field] || !data[field].toString().trim()) {
        errors.push(`${field} is required for ${config.name}`);
      }
    }
    
    // Check validation rules
    for (const [field, rules] of Object.entries(config.validation)) {
      const value = data[field];
      if (value) {
        if ('pattern' in rules && rules.pattern && !rules.pattern.test(value)) {
          errors.push(`Invalid ${field} format for ${config.name}`);
        }
        if (rules.type === 'url') {
          try {
            new URL(value);
          } catch {
            errors.push(`Invalid URL format for ${field}`);
          }
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },
  
  /**
   * Format evermark metadata for display
   */
  formatMetadata: (evermark: any) => {
    return {
      title: evermark.title || 'Untitled Evermark',
      author: evermark.author || 'Unknown Author',
      description: evermark.description || '',
      contentType: evermark.contentType || 'Custom',
      tags: evermark.tags || [],
      createdAt: new Date(evermark.createdAt),
      sourceUrl: evermark.sourceUrl
    };
  },
  
  /**
   * Generate shareable URL for evermark
   */
  getShareableUrl: (evermarkId: string): string => {
    return `${window.location.origin}/evermark/${evermarkId}`;
  },
  
  /**
   * Extract domain from URL
   */
  extractDomain: (url: string): string => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'Unknown Source';
    }
  },
  
  /**
   * Format file size for display
   */
  formatFileSize: (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  },
  
  /**
   * Validate image file
   */
  validateImageFile: (file: File): { isValid: boolean; error?: string } => {
    if (!evermarksConfig.defaults.supportedImageTypes.includes(file.type)) {
      return {
        isValid: false,
        error: 'Unsupported image format. Please use JPEG, PNG, GIF, or WebP.'
      };
    }
    
    if (file.size > evermarksConfig.defaults.imageMaxSize) {
      return {
        isValid: false,
        error: `Image too large. Maximum size is ${evermarksUtils.formatFileSize(evermarksConfig.defaults.imageMaxSize)}.`
      };
    }
    
    return { isValid: true };
  },
  
  /**
   * Generate evermark preview URL
   */
  generatePreviewUrl: (evermarkId: string): string => {
    return `/evermark/${evermarkId}/preview`;
  },
  
  /**
   * Check if content type supports auto-detection
   */
  supportsAutoDetection: (contentType: keyof typeof evermarksConfig.contentTypes): boolean => {
    return ['Cast', 'URL'].includes(contentType);
  }
};

// Default export for convenience
export default {
  config: evermarksConfig,
  utils: evermarksUtils,
};