// src/features/evermarks/components/CreateEvermarkForm.tsx
// Complete evermark creation form component following the development guide

import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PlusIcon, 
  AlertCircleIcon, 
  CheckCircleIcon,
  UploadIcon,
  ImageIcon,
  XIcon,
  LoaderIcon,
  InfoIcon,
  WalletIcon,
  LinkIcon,
  ZapIcon,
  EyeIcon,
  HelpCircleIcon
} from 'lucide-react';

import { useEvermarksState } from '../hooks/useEvermarkState';
import { type CreateEvermarkInput, type EvermarkMetadata } from '../types';
import { EvermarkService } from '../services/EvermarkService';
import { useAppAuth } from '@/providers/AppContext';
import { cn, useIsMobile } from '@/utils/responsive';

// MetadataForm component for enhanced metadata handling
interface MetadataField {
  key: string;
  value: string;
}

interface EnhancedMetadata {
  contentType: 'Cast' | 'DOI' | 'ISBN' | 'URL' | 'Custom';
  tags: string[];
  customFields: MetadataField[];
  // Type-specific fields
  doi?: string;
  isbn?: string;
  url?: string;
  castUrl?: string;
  publisher?: string;
  publicationDate?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
}

// Simplified MetadataForm for this component
const MetadataForm: React.FC<{
  onMetadataChange: (metadata: EnhancedMetadata) => void;
  initialMetadata?: Partial<EnhancedMetadata>;
}> = ({ onMetadataChange, initialMetadata }) => {
  const [contentType, setContentType] = useState<EnhancedMetadata['contentType']>(
    initialMetadata?.contentType || 'URL'
  );
  const [tags, setTags] = useState<string[]>(initialMetadata?.tags || []);
  const [customFields, setCustomFields] = useState<MetadataField[]>(
    initialMetadata?.customFields || []
  );
  const [tagInput, setTagInput] = useState('');
  const [typeSpecificData, setTypeSpecificData] = useState<Partial<EnhancedMetadata>>({
    doi: initialMetadata?.doi || '',
    isbn: initialMetadata?.isbn || '',
    url: initialMetadata?.url || '',
    castUrl: initialMetadata?.castUrl || '',
    publisher: initialMetadata?.publisher || '',
    publicationDate: initialMetadata?.publicationDate || '',
    journal: initialMetadata?.journal || '',
    volume: initialMetadata?.volume || '',
    issue: initialMetadata?.issue || '',
    pages: initialMetadata?.pages || '',
  });

  // Update parent whenever metadata changes
  React.useEffect(() => {
    const metadata: EnhancedMetadata = {
      contentType,
      tags,
      customFields,
      ...typeSpecificData
    };
    onMetadataChange(metadata);
  }, [contentType, tags, customFields, typeSpecificData, onMetadataChange]);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTypeSpecificChange = (field: string, value: string) => {
    setTypeSpecificData(prev => ({ ...prev, [field]: value }));
  };

  const contentTypeIcons = {
    Cast: '💬',
    DOI: '📄', 
    ISBN: '📚',
    URL: '🌐',
    Custom: '✨'
  };

  return (
    <div className="space-y-6">
      {/* Content Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Content Type
        </label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {(['Cast', 'DOI', 'ISBN', 'URL', 'Custom'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setContentType(type)}
              className={cn(
                "flex items-center justify-center px-3 py-3 rounded-lg border transition-all duration-200",
                contentType === type
                  ? 'border-cyan-400 bg-cyan-900/30 text-cyan-300 shadow-lg shadow-cyan-500/20'
                  : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500 hover:bg-gray-700'
              )}
            >
              <span className="mr-2">{contentTypeIcons[type]}</span>
              <span className="text-sm font-medium">{type}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Type-Specific Fields */}
      <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-4">
        <h4 className="text-sm font-medium text-cyan-400 mb-4">
          {contentType} Details
        </h4>
        
        {contentType === 'URL' && (
          <div>
            <label className="block text-sm text-gray-300 mb-2">URL</label>
            <input
              type="url"
              value={typeSpecificData.url || ''}
              onChange={(e) => handleTypeSpecificChange('url', e.target.value)}
              placeholder="https://example.com/article"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white placeholder-gray-400"
            />
          </div>
        )}

        {contentType === 'Cast' && (
          <div>
            <label className="block text-sm text-gray-300 mb-2">Cast URL or Hash</label>
            <input
              type="text"
              value={typeSpecificData.castUrl || ''}
              onChange={(e) => handleTypeSpecificChange('castUrl', e.target.value)}
              placeholder="https://warpcast.com/username/0x1234... or 0x1234..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white placeholder-gray-400"
            />
          </div>
        )}

        {contentType === 'DOI' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">DOI</label>
              <input
                type="text"
                value={typeSpecificData.doi || ''}
                onChange={(e) => handleTypeSpecificChange('doi', e.target.value)}
                placeholder="10.1234/example"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Journal</label>
              <input
                type="text"
                value={typeSpecificData.journal || ''}
                onChange={(e) => handleTypeSpecificChange('journal', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white placeholder-gray-400"
              />
            </div>
          </div>
        )}

        {contentType === 'ISBN' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">ISBN</label>
              <input
                type="text"
                value={typeSpecificData.isbn || ''}
                onChange={(e) => handleTypeSpecificChange('isbn', e.target.value)}
                placeholder="978-3-16-148410-0"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Publisher</label>
              <input
                type="text"
                value={typeSpecificData.publisher || ''}
                onChange={(e) => handleTypeSpecificChange('publisher', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white placeholder-gray-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Tags
        </label>
        
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
            placeholder="Add a tag..."
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white placeholder-gray-400"
          />
          <button
            type="button"
            onClick={handleAddTag}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-lg hover:from-purple-400 hover:to-purple-600 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-3 py-1 bg-cyan-900/30 text-cyan-300 rounded-full text-sm border border-cyan-500/30"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-2 hover:text-cyan-100 transition-colors"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Help Modal Component
const HelpModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-cyan-500/50 rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h3 className="text-xl font-bold text-cyan-400">Creating Evermarks</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-green-400">📚 Content Types</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-800/50 p-3 rounded border border-gray-700">
                <strong className="text-purple-400">Cast:</strong> Preserve Farcaster posts permanently
              </div>
              <div className="bg-gray-800/50 p-3 rounded border border-gray-700">
                <strong className="text-blue-400">URL:</strong> Reference any web content
              </div>
              <div className="bg-gray-800/50 p-3 rounded border border-gray-700">
                <strong className="text-yellow-400">DOI:</strong> Academic papers and research
              </div>
              <div className="bg-gray-800/50 p-3 rounded border border-gray-700">
                <strong className="text-green-400">ISBN:</strong> Books and publications
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main CreateEvermarkForm Component
interface CreateEvermarkFormProps {
  onSuccess?: (evermark: any) => void;
  onCancel?: () => void;
  className?: string;
}

export function CreateEvermarkForm({ 
  onSuccess, 
  onCancel, 
  className = '' 
}: CreateEvermarkFormProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isAuthenticated, user, requireAuth } = useAppAuth();
  
  // Use the evermarks state hook
  const { 
    createEvermark, 
    isCreating, 
    createError, 
    clearCreateError 
  } = useEvermarksState();
  
  // Form state
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [enhancedMetadata, setEnhancedMetadata] = useState<EnhancedMetadata>({
    contentType: 'URL',
    tags: [],
    customFields: []
  });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Image upload state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-populate author if we have user info
  React.useEffect(() => {
    if (user) {
      const authorName = user.displayName || user.username || '';
      if (authorName) {
        setEnhancedMetadata(prev => {
          const otherFields = prev.customFields.filter(f => f.key !== 'author');
          return {
            ...prev,
            customFields: [
              ...otherFields,
              { key: 'author', value: authorName }
            ]
          };
        });
      }
    }
  }, [user]);

  // Handle image selection
  const handleImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setImageUploadError('Please select a valid image file');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setImageUploadError('Image must be smaller than 10MB');
      return;
    }
    
    setSelectedImage(file);
    setImageUploadError(null);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);
  
  const removeImage = useCallback(() => {
    setSelectedImage(null);
    setImagePreview(null);
    setImageUploadError(null);
  }, []);

  // Generate title based on content type and metadata
  const generateTitle = useCallback((): string => {
    if (title.trim()) return title.trim();
    
    const { contentType } = enhancedMetadata;
    
    switch (contentType) {
      case 'Cast':
        return 'Farcaster Cast';
      case 'DOI':
        return enhancedMetadata.journal ? 
          `Research Paper from ${enhancedMetadata.journal}` : 
          'Academic Research Paper';
      case 'ISBN':
        return enhancedMetadata.publisher ? 
          `Book from ${enhancedMetadata.publisher}` : 
          'Published Book';
      case 'URL':
        if (enhancedMetadata.url) {
          try {
            const domain = new URL(enhancedMetadata.url).hostname.replace('www.', '');
            return `Content from ${domain}`;
          } catch {
            return 'Web Content';
          }
        }
        return 'Web Content';
      case 'Custom':
        return 'Custom Evermark';
      default:
        return 'Untitled Evermark';
    }
  }, [title, enhancedMetadata]);

  // Generate description from metadata
  const generateDescription = useCallback((): string => {
    if (description.trim()) return description.trim();
    
    const { contentType } = enhancedMetadata;
    let autoDescription = '';
    
    switch (contentType) {
      case 'DOI':
        const parts = [];
        if (enhancedMetadata.journal) parts.push(`Published in ${enhancedMetadata.journal}`);
        autoDescription = parts.join(' • ');
        break;
      case 'ISBN':
        const bookParts = [];
        if (enhancedMetadata.publisher) bookParts.push(`Published by ${enhancedMetadata.publisher}`);
        autoDescription = bookParts.join(' • ');
        break;
      case 'URL':
        autoDescription = enhancedMetadata.url ? `Web content from ${enhancedMetadata.url}` : 'Web content reference';
        break;
      case 'Cast':
        autoDescription = 'Content preserved from Farcaster social network';
        break;
      case 'Custom':
        autoDescription = 'Custom content preserved on blockchain';
        break;
    }
    
    // Add tags to description if present
    if (enhancedMetadata.tags.length > 0) {
      autoDescription += ` | Tags: ${enhancedMetadata.tags.join(', ')}`;
    }
    
    return autoDescription;
  }, [description, enhancedMetadata]);

  // Get source URL from metadata
  const getSourceUrl = useCallback((): string => {
    const { contentType } = enhancedMetadata;
    
    switch (contentType) {
      case 'Cast':
        return enhancedMetadata.castUrl || '';
      case 'DOI':
        return enhancedMetadata.doi ? `https://doi.org/${enhancedMetadata.doi}` : '';
      case 'ISBN':
        return enhancedMetadata.isbn ? `https://www.worldcat.org/isbn/${enhancedMetadata.isbn}` : '';
      case 'URL':
        return enhancedMetadata.url || '';
      default:
        return enhancedMetadata.customFields.find(f => f.key === 'sourceUrl')?.value || '';
    }
  }, [enhancedMetadata]);

  // Get author from metadata
  const getAuthor = useCallback((): string => {
    const castAuthor = enhancedMetadata.customFields.find(f => f.key === 'author')?.value;
    if (castAuthor && castAuthor !== 'Unknown Author') {
      return castAuthor;
    }
    
    return user?.displayName || user?.username || 'Unknown Author';
  }, [enhancedMetadata, user]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isCreating) return;

    // Check authentication
    const canProceed = await requireAuth();
    if (!canProceed) return;
    
    try {
      const finalTitle = generateTitle();
      if (!finalTitle.trim()) {
        return;
      }
      
      const evermarkData: EvermarkMetadata = {
        title: finalTitle,
        description: generateDescription(),
        sourceUrl: getSourceUrl(),
        author: getAuthor(),
        imageFile: selectedImage,
        customFields: enhancedMetadata.customFields,
        tags: enhancedMetadata.tags,
        contentType: enhancedMetadata.contentType,
        // Include type-specific fields
        ...(enhancedMetadata.contentType === 'DOI' && {
          doi: enhancedMetadata.doi,
          journal: enhancedMetadata.journal
        }),
        ...(enhancedMetadata.contentType === 'ISBN' && {
          isbn: enhancedMetadata.isbn,
          publisher: enhancedMetadata.publisher
        }),
        ...(enhancedMetadata.contentType === 'Cast' && {
          castUrl: enhancedMetadata.castUrl
        }),
        ...(enhancedMetadata.contentType === 'URL' && {
          url: enhancedMetadata.url
        })
      };
      
      const createInput: CreateEvermarkInput = {
        metadata: evermarkData,
        image: selectedImage || undefined
      };
      
      const result = await createEvermark(createInput);
      
      if (result.success) {
        onSuccess?.(result);
        navigate('/explore');
      }
    } catch (error) {
      console.error('Evermark creation failed:', error);
    }
  }, [
    isCreating, 
    requireAuth, 
    generateTitle, 
    generateDescription, 
    getSourceUrl, 
    getAuthor, 
    selectedImage, 
    enhancedMetadata, 
    createEvermark, 
    onSuccess, 
    navigate
  ]);

  // Preview data
  const previewTitle = generateTitle();
  const previewDescription = generateDescription();
  const previewSourceUrl = getSourceUrl();
  const previewAuthor = getAuthor();

  // Content type info
  const getContentTypeInfo = () => {
    const { contentType } = enhancedMetadata;
    const icons = {
      Cast: '💬',
      DOI: '📄',
      ISBN: '📚', 
      URL: '🌐',
      Custom: '✨'
    };
    
    const descriptions = {
      Cast: 'Social media post from Farcaster',
      DOI: 'Academic research paper with DOI',
      ISBN: 'Published book with ISBN',
      URL: 'Web content from a URL',
      Custom: 'Custom content with flexible metadata'
    };
    
    return {
      icon: icons[contentType],
      description: descriptions[contentType]
    };
  };

  const contentTypeInfo = getContentTypeInfo();

  if (!isAuthenticated) {
    return (
      <div className={cn("bg-gray-800/30 border border-gray-700 rounded-lg p-12 text-center", className)}>
        <PlusIcon className="mx-auto h-16 w-16 text-gray-500 mb-6" />
        <h3 className="text-2xl font-medium text-white mb-4">
          Connect to Create
        </h3>
        <p className="text-gray-400 mb-6 max-w-md mx-auto">
          Please connect your wallet to create an Evermark
        </p>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-black text-white", className)}>
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 border-b border-green-400/30">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-purple-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50">
                <PlusIcon className="h-7 w-7 text-black" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-green-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent">
                CREATE EVERMARK
              </h1>
              <button
                onClick={() => setShowHelpModal(true)}
                className="w-8 h-8 bg-gray-800/50 border border-cyan-400/50 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors group"
                title="Get Help"
              >
                <HelpCircleIcon className="h-4 w-4 text-cyan-400 group-hover:text-cyan-300" />
              </button>
            </div>
            
            <p className="text-gray-300 max-w-3xl mx-auto text-lg">
              Transform any content into a permanent reference. Stored forever on <span className="text-green-400 font-bold">IPFS</span> and <span className="text-purple-400 font-bold">Base blockchain</span>.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Error Messages */}
        {createError && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg flex items-start">
            <AlertCircleIcon className="h-5 w-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-red-300 font-medium">Error</p>
              <p className="text-red-400 text-sm">{createError}</p>
            </div>
            <button
              onClick={clearCreateError}
              className="text-red-400 hover:text-red-300"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className={cn(
          "grid gap-8",
          isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"
        )}>
          {/* Left Column - Form */}
          <div className="space-y-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Create Evermark</h2>
                <div className="flex items-center text-sm text-gray-400">
                  <span className="mr-2">{contentTypeInfo.icon}</span>
                  <span>{contentTypeInfo.description}</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Enhanced Metadata Form */}
                <MetadataForm 
                  onMetadataChange={setEnhancedMetadata}
                  initialMetadata={enhancedMetadata}
                />

                {/* Basic Fields */}
                <div className="space-y-4 pt-6 border-t border-gray-700">
                  <h3 className="font-medium text-cyan-400">Content Details</h3>
                  
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
                      Title (Optional)
                    </label>
                    <input
                      type="text"
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white placeholder-gray-400"
                      placeholder="Leave blank for auto-generated title"
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white placeholder-gray-400"
                      placeholder="Leave blank for auto-generated description"
                    />
                  </div>
                </div>

                {/* Image Upload */}
                <div className="space-y-4 pt-6 border-t border-gray-700">
                  <h3 className="font-medium text-cyan-400">Cover Image (Optional)</h3>
                  
                  {!selectedImage ? (
                    <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-cyan-400 transition-colors bg-gray-800/30">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <ImageIcon className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                      <p className="text-gray-400 mb-4">Add a cover image to your Evermark</p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-lg hover:from-purple-400 hover:to-purple-600 transition-colors shadow-lg shadow-purple-500/30"
                      >
                        <UploadIcon className="h-4 w-4 mr-2" />
                        Choose Image
                      </button>
                      <p className="text-xs text-gray-500 mt-3">PNG, JPG, GIF up to 10MB</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={imagePreview!}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg border border-gray-600"
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-3 right-3 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-lg"
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {imageUploadError && (
                    <p className="text-red-400 text-sm">{imageUploadError}</p>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-6 border-t border-gray-700">
                  <div className="flex gap-4">
                    {onCancel && (
                      <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-6 py-4 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isCreating}
                      className="flex-1 flex items-center justify-center px-6 py-4 bg-gradient-to-r from-green-400 to-green-600 text-black font-bold rounded-lg hover:from-green-300 hover:to-green-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/30"
                    >
                      {isCreating ? (
                        <>
                          <LoaderIcon className="animate-spin h-5 w-5 mr-2" />
                          Creating Evermark...
                        </>
                      ) : (
                        <>
                          <PlusIcon className="h-5 w-5 mr-2" />
                          Create Evermark
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column - Preview */}
          <div className="space-y-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg shadow-lg p-6 sticky top-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-cyan-400">Live Preview</h3>
                <EyeIcon className="h-5 w-5 text-gray-500" />
              </div>
              
              <div className="space-y-6">
                {/* Preview Image */}
                {imagePreview && (
                  <div className="aspect-video bg-gray-700 rounded-lg overflow-hidden border border-gray-600">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Preview Content */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-white text-xl mb-2">
                      {previewTitle || "Untitled Evermark"}
                    </h4>
                    <p className="text-sm text-gray-400">by {previewAuthor}</p>
                  </div>

                  {previewDescription && (
                    <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                      <p className="text-gray-300 text-sm leading-relaxed">
                        {previewDescription}
                      </p>
                    </div>
                  )}

                  {previewSourceUrl && (
                    <div className="pt-3 border-t border-gray-700">
                      <p className="text-xs text-gray-500 mb-2">Source:</p>
                      <a
                        href={previewSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 text-sm break-all transition-colors"
                      >
                        {previewSourceUrl}
                      </a>
                    </div>
                  )}

                  {/* Tags Preview */}
                  {enhancedMetadata.tags.length > 0 && (
                    <div className="pt-3">
                      <p className="text-xs text-gray-500 mb-3">Tags:</p>
                      <div className="flex flex-wrap gap-2">
                        {enhancedMetadata.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-block bg-purple-900/50 text-purple-300 text-xs px-3 py-1 rounded-full border border-purple-500/30"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Content Type Info */}
              <div className="mt-6 pt-4 border-t border-gray-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Content Type:</span>
                  <span className="text-white font-medium">
                    {contentTypeInfo.icon} {enhancedMetadata.contentType}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>User:</span>
                    <span className="text-green-400">
                      ✅ {user?.displayName || user?.username || 'Authenticated'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Help Section */}
            <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-6">
              <div className="flex items-start">
                <InfoIcon className="h-5 w-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <h4 className="font-medium text-blue-300 mb-3">Creating Evermarks</h4>
                  <div className="text-blue-200 space-y-2">
                    <p>• Choose your content type and fill in the relevant metadata</p>
                    <p>• Title and description will be auto-generated if left blank</p>
                    <p>• Add tags to help others discover your content</p>
                    <p>• Upload an optional cover image to make your Evermark stand out</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Help Modal */}
      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </div>
  );
}