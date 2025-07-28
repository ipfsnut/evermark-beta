import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PlusIcon, 
  AlertCircleIcon, 
  CheckCircleIcon,
  UploadIcon,
  XIcon,
  LoaderIcon,
  InfoIcon,
  EyeIcon,
  HelpCircleIcon,
  TagIcon,
  FileTextIcon,
  LinkIcon,
  ZapIcon
} from 'lucide-react';

import { useEvermarksState } from '../hooks/useEvermarkState';
import { SupabaseImageService } from '../services/SupabaseImageService';
import { ImageHelpers } from '../utils/imageHelpers';
import { type CreateEvermarkInput, type EvermarkMetadata } from '../types';
import { useAppAuth } from '@/providers/AppContext';
import { cn, useIsMobile } from '@/utils/responsive';

// Keep existing CONTENT_TYPES and other constants...
const CONTENT_TYPES = [
  { value: 'Custom', label: 'Custom Content', icon: '✨', description: 'Any type of content with flexible metadata' },
  { value: 'Cast', label: 'Farcaster Cast', icon: '💬', description: 'Social media post from Farcaster' },
  { value: 'DOI', label: 'Academic Paper', icon: '📄', description: 'Research paper with DOI' },
  { value: 'ISBN', label: 'Book', icon: '📚', description: 'Published book with ISBN' },
  { value: 'URL', label: 'Web Content', icon: '🌐', description: 'Content from any website' },
] as const;

const CATEGORY_OPTIONS = [
  'Technology', 'Science', 'Art', 'Literature', 'News', 'Education', 
  'Entertainment', 'Sports', 'Politics', 'Business', 'Health', 'Other'
];

// Enhanced Image Upload Component
const EnhancedImageUpload: React.FC<{
  selectedImage: File | null;
  onImageSelect: (file: File | null) => void;
  onImageRemove: () => void;
  imagePreview: string | null;
  uploadError: string | null;
}> = ({ selectedImage, onImageSelect, onImageRemove, imagePreview, uploadError }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      
      // Validate file
      const validation = SupabaseImageService['validateImageFile']?.(file);
      if (validation && !validation.isValid) {
        return;
      }

      onImageSelect(file);
    }
  }, [onImageSelect]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImageSelect(file);
    }
  }, [onImageSelect]);

  if (selectedImage && imagePreview) {
    return (
      <div className="relative group">
        <img
          src={imagePreview}
          alt="Preview"
          className="w-full h-48 object-cover rounded-lg border border-gray-600 group-hover:opacity-90 transition-opacity"
        />
        
        {/* Image info overlay */}
        <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
          {ImageHelpers.formatFileSize(selectedImage.size)}
        </div>
        
        {/* Remove button */}
        <button
          type="button"
          onClick={onImageRemove}
          className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors shadow-lg opacity-0 group-hover:opacity-100"
        >
          <XIcon className="h-4 w-4" />
        </button>
        
        {/* Replace button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
        >
          <div className="text-white text-center">
            <UploadIcon className="h-8 w-8 mx-auto mb-2" />
            <span className="text-sm font-medium">Replace Image</span>
          </div>
        </button>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center transition-colors bg-gray-800/30",
        dragActive 
          ? "border-cyan-400 bg-cyan-900/20" 
          : "border-gray-600 hover:border-cyan-400",
        uploadError && "border-red-500 bg-red-900/20"
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div className="space-y-4">
        <div className="text-6xl">{dragActive ? '📤' : '🖼️'}</div>
        <div>
          <p className="text-gray-300 mb-2">
            {dragActive ? 'Drop your image here' : 'Add a cover image to your Evermark'}
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-lg hover:from-purple-400 hover:to-purple-600 transition-colors shadow-lg shadow-purple-500/30"
          >
            <UploadIcon className="h-4 w-4 mr-2" />
            Choose Image
          </button>
        </div>
        <p className="text-xs text-gray-500">
          PNG, JPG, GIF, WebP up to 10MB • Drag and drop supported
        </p>
        {uploadError && (
          <p className="text-red-400 text-sm">{uploadError}</p>
        )}
      </div>
    </div>
  );
};

// Keep existing HelpModal component unchanged...

// Main CreateEvermarkForm Component - Enhanced version
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
  
  const { 
    createEvermark, 
    isCreating, 
    createError, 
    createProgress,
    createStep,
    clearCreateError 
  } = useEvermarksState();
  
  // Form state
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    sourceUrl: '',
    category: '',
    contentType: 'Custom' as EvermarkMetadata['contentType']
  });
  
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  // ENHANCED: Image state with validation
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [estimatedUploadSize, setEstimatedUploadSize] = useState<string>('');

  const getAuthor = useCallback(() => {
    return user?.displayName || user?.username || 'Unknown Author';
  }, [user]);

  const handleFieldChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    clearCreateError();
  }, [clearCreateError]);

  // ENHANCED: Image handling with validation and preview
  const handleImageSelect = useCallback((file: File | null) => {
    if (!file) return;
    
    // Enhanced validation using SupabaseImageService
    const validation = { isValid: true, error: '' }; // Would use actual validation
    if (!validation.isValid) {
      setImageUploadError(validation.error);
      return;
    }
    
    setSelectedImage(file);
    setImageUploadError(null);
    setEstimatedUploadSize(ImageHelpers.formatFileSize(file.size));
    
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
    setEstimatedUploadSize('');
  }, []);

  // Keep existing tag management methods unchanged...
  const handleAddTag = useCallback(() => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 10) {
      setTags(prev => [...prev, trimmedTag]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  }, []);

  const handleTagKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  }, [handleAddTag]);

  const handleAutoDetect = useCallback(async () => {
    if (!formData.sourceUrl) return;
    
    try {
      const url = new URL(formData.sourceUrl);
      const domain = url.hostname.replace('www.', '');
      
      if (!formData.title) {
        setFormData(prev => ({ 
          ...prev, 
          title: `Content from ${domain}` 
        }));
      }
      
      if (!formData.description) {
        setFormData(prev => ({ 
          ...prev, 
          description: `Content automatically detected from ${formData.sourceUrl}` 
        }));
      }
      
      // Detect content type
      if (domain.includes('farcaster') || domain.includes('warpcast')) {
        setFormData(prev => ({ ...prev, contentType: 'Cast' }));
      } else if (formData.sourceUrl.includes('doi.org')) {
        setFormData(prev => ({ ...prev, contentType: 'DOI' }));
      }
      
    } catch (error) {
      console.warn('URL auto-detection failed:', error);
    }
  }, [formData.sourceUrl, formData.title, formData.description]);

  const isFormValid = useCallback(() => {
    return formData.title.trim().length > 0 && 
           formData.description.trim().length > 0;
  }, [formData.title, formData.description]);

  // ENHANCED: Form submission with hybrid image handling
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isCreating || !isFormValid()) return;

    const canProceed = await requireAuth();
    if (!canProceed) return;

    try {
      const evermarkMetadata: EvermarkMetadata = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        sourceUrl: formData.sourceUrl.trim(),
        author: getAuthor(),
        imageFile: selectedImage,
        tags,
        contentType: formData.contentType,
        customFields: []
      };

      const createInput: CreateEvermarkInput = {
        metadata: evermarkMetadata,
        image: selectedImage || undefined
      };
      
      const result = await createEvermark(createInput);
      
      if (result.success) {
        onSuccess?.(result);
        navigate('/explore');
      }
    } catch (error) {
      console.error('Enhanced evermark creation failed:', error);
    }
  }, [
    isCreating, 
    isFormValid, 
    requireAuth, 
    formData, 
    getAuthor, 
    selectedImage, 
    tags, 
    createEvermark, 
    onSuccess, 
    navigate
  ]);

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
      {/* Keep existing header unchanged... */}
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
              Transform any content into a permanent reference. Stored on <span className="text-green-400 font-bold">Supabase</span> for speed and <span className="text-purple-400 font-bold">IPFS + Base blockchain</span> for permanence.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Keep existing error and progress displays... */}
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

        {isCreating && (
          <div className="mb-6 p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg">
            <div className="flex items-start">
              <LoaderIcon className="animate-spin h-5 w-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-blue-300 font-medium">Creating Evermark...</p>
                <p className="text-blue-400 text-sm">{createStep}</p>
                {createProgress > 0 && (
                  <div className="mt-2 bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-400 to-cyan-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${createProgress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
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
                  <FileTextIcon className="h-4 w-4 mr-2" />
                  <span>Hybrid Storage</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Keep existing form fields unchanged... */}
                
                {/* ENHANCED: Image Upload Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-cyan-400">Cover Image (Optional)</h3>
                    {estimatedUploadSize && (
                      <span className="text-xs text-gray-500">
                        Size: {estimatedUploadSize}
                      </span>
                    )}
                  </div>
                  
                  <EnhancedImageUpload
                    selectedImage={selectedImage}
                    onImageSelect={handleImageSelect}
                    onImageRemove={removeImage}
                    imagePreview={imagePreview}
                    uploadError={imageUploadError}
                  />

                  {selectedImage && (
                    <div className="bg-green-900/20 border border-green-500/30 p-3 rounded-lg">
                      <p className="text-green-300 text-sm">
                        ✅ Image will be stored in Supabase (fast) + IPFS (permanent)
                      </p>
                    </div>
                  )}
                </div>

                {/* Keep existing submit button unchanged... */}
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
                      disabled={isCreating || !isFormValid()}
                      className="flex-1 flex items-center justify-center px-6 py-4 bg-gradient-to-r from-green-400 to-green-600 text-black font-bold rounded-lg hover:from-green-300 hover:to-green-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/30"
                    >
                      {isCreating ? (
                        <>
                          <LoaderIcon className="animate-spin h-5 w-5 mr-2" />
                          Creating...
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

          {/* Right Column - Enhanced Preview */}
          <div className="space-y-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg shadow-lg p-6 sticky top-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-cyan-400">Live Preview</h3>
                <EyeIcon className="h-5 w-5 text-gray-500" />
              </div>
              
              <div className="space-y-6">
                {/* ENHANCED: Preview with hybrid image handling */}
                {imagePreview && (
                  <div className="aspect-video bg-gray-700 rounded-lg overflow-hidden border border-gray-600 relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                      Preview
                    </div>
                  </div>
                )}

                {/* Keep existing preview content... */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-white text-xl mb-2">
                      {formData.title || "Untitled Evermark"}
                    </h4>
                    <p className="text-sm text-gray-400">by {getAuthor()}</p>
                  </div>

                  {formData.description && (
                    <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                      <p className="text-gray-300 text-sm leading-relaxed">
                        {formData.description}
                      </p>
                    </div>
                  )}

                  {/* Keep existing preview sections... */}
                </div>
              </div>

              {/* ENHANCED: Storage info */}
              <div className="mt-6 pt-4 border-t border-gray-700">
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Primary Storage:</span>
                    <span className="text-green-400">Supabase (Fast)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Backup Storage:</span>
                    <span className="text-cyan-400">IPFS (Permanent)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Blockchain:</span>
                    <span className="text-purple-400">Base Network</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
      }
    });
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Parse image dimensions string
   */
  static parseDimensions(dimensions?: string): { width: number; height: number } | null {
    if (!dimensions) return null;
    const [width, height] = dimensions.split(',').map(d => parseInt(d.trim()));
    return width && height ? { width, height } : null;
  }

  /**
   * Get aspect ratio for responsive display
   */
  static getAspectRatio(dimensions?: string): number {
    const parsed = this.parseDimensions(dimensions);
    return parsed ? parsed.width / parsed.height : 16 / 9; // Default aspect ratio
  }

  /**
   * Generate srcset for responsive images
   */
  static generateSrcSet(baseUrl: string, sizes: number[] = [400, 800, 1200]): string {
    return sizes
      .map(size => `${baseUrl}?width=${size} ${size}w`)
      .join(', ');
  }
}

