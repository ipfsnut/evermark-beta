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
  EyeIcon,
  HelpCircleIcon,
  TagIcon,
  FileTextIcon,
  LinkIcon,
  ZapIcon
} from 'lucide-react';

import { useEvermarksState } from '../hooks/useEvermarkState';
import { type CreateEvermarkInput, type EvermarkMetadata } from '../types';
import { useAppAuth } from '@/providers/AppContext';
import { cn, useIsMobile } from '@/utils/responsive';

// Content type configuration for the form
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
              {CONTENT_TYPES.map(type => (
                <div key={type.value} className="bg-gray-800/50 p-3 rounded border border-gray-700">
                  <strong className="text-cyan-400">{type.icon} {type.label}:</strong>
                  <p className="text-gray-300 mt-1">{type.description}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-green-400">⚡ Features</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start">
                <span className="w-2 h-2 bg-cyan-400 rounded-full mr-2 mt-2"></span>
                Permanent storage on IPFS and blockchain
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-cyan-400 rounded-full mr-2 mt-2"></span>
                Add tags and custom metadata for better organization
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-cyan-400 rounded-full mr-2 mt-2"></span>
                Optional cover images to make your content stand out
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-cyan-400 rounded-full mr-2 mt-2"></span>
                Farcaster cast metadata is automatically detected
              </li>
            </ul>
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
  
  // Tags state
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  // Image upload state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-populate author if we have user info
  const getAuthor = useCallback(() => {
    return user?.displayName || user?.username || 'Unknown Author';
  }, [user]);

  // Handle form field changes
  const handleFieldChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    clearCreateError();
  }, [clearCreateError]);

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

  // Handle tag management
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

  // Auto-detect content from URL
  const handleAutoDetect = useCallback(async () => {
    if (!formData.sourceUrl) return;
    
    try {
      const url = new URL(formData.sourceUrl);
      const domain = url.hostname.replace('www.', '');
      
      // Auto-fill based on domain
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

  // Validate form
  const isFormValid = useCallback(() => {
    return formData.title.trim().length > 0 && 
           formData.description.trim().length > 0;
  }, [formData.title, formData.description]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isCreating || !isFormValid()) return;

    // Check authentication
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
      console.error('Evermark creation failed:', error);
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

        {/* Creation Progress */}
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
                  <span>Content Preservation</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Content Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Content Type
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {CONTENT_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => handleFieldChange('contentType', type.value)}
                        className={cn(
                          "flex items-center justify-center px-3 py-3 rounded-lg border transition-all duration-200",
                          formData.contentType === type.value
                            ? 'border-cyan-400 bg-cyan-900/30 text-cyan-300 shadow-lg shadow-cyan-500/20'
                            : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500 hover:bg-gray-700'
                        )}
                      >
                        <span className="mr-2">{type.icon}</span>
                        <span className="text-sm font-medium">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Basic Fields */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleFieldChange('title', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white placeholder-gray-400"
                      placeholder="Enter a descriptive title"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                      Description *
                    </label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleFieldChange('description', e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white placeholder-gray-400"
                      placeholder="Describe what this content is about"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="sourceUrl" className="block text-sm font-medium text-gray-300 mb-2">
                      Source URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        id="sourceUrl"
                        value={formData.sourceUrl}
                        onChange={(e) => handleFieldChange('sourceUrl', e.target.value)}
                        className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white placeholder-gray-400"
                        placeholder="https://example.com/content"
                      />
                      {formData.sourceUrl && (
                        <button
                          type="button"
                          onClick={handleAutoDetect}
                          className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center"
                          title="Auto-detect content"
                        >
                          <ZapIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-2">
                        Category
                      </label>
                      <select
                        id="category"
                        value={formData.category}
                        onChange={(e) => handleFieldChange('category', e.target.value)}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white"
                      >
                        <option value="">Select category</option>
                        {CATEGORY_OPTIONS.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="content" className="block text-sm font-medium text-gray-300 mb-2">
                        Additional Content
                      </label>
                      <input
                        type="text"
                        id="content"
                        value={formData.content}
                        onChange={(e) => handleFieldChange('content', e.target.value)}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white placeholder-gray-400"
                        placeholder="Additional notes or content"
                      />
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Tags (max 10)
                  </label>
                  
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={handleTagKeyPress}
                      placeholder="Add a tag..."
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white placeholder-gray-400"
                      disabled={tags.length >= 10}
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      disabled={!tagInput.trim() || tags.length >= 10}
                      className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-lg hover:from-purple-400 hover:to-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                          <TagIcon className="h-3 w-3 mr-1" />
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

                {/* Image Upload */}
                <div className="space-y-4">
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

                  {formData.content && (
                    <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg">
                      <p className="text-blue-200 text-sm">{formData.content}</p>
                    </div>
                  )}

                  {formData.sourceUrl && (
                    <div className="pt-3 border-t border-gray-700">
                      <p className="text-xs text-gray-500 mb-2">Source:</p>
                      <a
                        href={formData.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 text-sm break-all transition-colors flex items-center"
                      >
                        <LinkIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                        {formData.sourceUrl}
                      </a>
                    </div>
                  )}

                  {/* Category Preview */}
                  {formData.category && (
                    <div className="pt-3">
                      <p className="text-xs text-gray-500 mb-2">Category:</p>
                      <span className="inline-block bg-green-900/30 text-green-300 text-xs px-3 py-1 rounded-full border border-green-500/30">
                        {formData.category}
                      </span>
                    </div>
                  )}

                  {/* Tags Preview */}
                  {tags.length > 0 && (
                    <div className="pt-3">
                      <p className="text-xs text-gray-500 mb-3">Tags:</p>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag, index) => (
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
                    {CONTENT_TYPES.find(type => type.value === formData.contentType)?.icon} {formData.contentType}
                  </span>
                </div>
              </div>

              {/* User Info */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>User:</span>
                    <span className="text-green-400">
                      ✅ {user?.displayName || user?.username || 'Authenticated'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Storage:</span>
                    <span className="text-cyan-400">IPFS + Blockchain</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className={isFormValid() ? "text-green-400" : "text-yellow-400"}>
                      {isFormValid() ? "Ready to create" : "Fill required fields"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Information Panels */}
            <div className="space-y-4">
              {/* Creation Process Info */}
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-6">
                <div className="flex items-start">
                  <InfoIcon className="h-5 w-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <h4 className="font-medium text-blue-300 mb-3">Creation Process</h4>
                    <div className="text-blue-200 space-y-2">
                      <div className="flex items-center">
                        <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-2">1</span>
                        <span>Upload image to IPFS (if provided)</span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-2">2</span>
                        <span>Create metadata and upload to IPFS</span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-2">3</span>
                        <span>Mint NFT on Base blockchain</span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-2">4</span>
                        <span>Your Evermark is live forever!</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tips Panel */}
              <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-6">
                <div className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <h4 className="font-medium text-green-300 mb-3">Tips for Best Results</h4>
                    <div className="text-green-200 space-y-2">
                      <p>• Use descriptive titles that clearly explain the content</p>
                      <p>• Add relevant tags to help others discover your Evermark</p>
                      <p>• Include source URLs for proper attribution</p>
                      <p>• High-quality cover images increase engagement</p>
                      <p>• Choose the appropriate content type for better categorization</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Special content type help */}
              {formData.contentType === 'Cast' && (
                <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-6">
                  <div className="flex items-start">
                    <span className="text-2xl mr-3">💬</span>
                    <div className="text-sm">
                      <h4 className="font-medium text-purple-300 mb-2">Farcaster Cast Tips</h4>
                      <p className="text-purple-200">
                        For Farcaster casts, paste the Warpcast URL in the source field. 
                        The system will automatically detect and preserve the cast content, 
                        including author information and engagement metrics.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {formData.contentType === 'DOI' && (
                <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-lg p-6">
                  <div className="flex items-start">
                    <span className="text-2xl mr-3">📄</span>
                    <div className="text-sm">
                      <h4 className="font-medium text-yellow-300 mb-2">Academic Paper Tips</h4>
                      <p className="text-yellow-200">
                        For academic papers, include the DOI in the source URL (e.g., https://doi.org/10.1234/example). 
                        This ensures proper citation and helps others access the original research.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {formData.contentType === 'ISBN' && (
                <div className="bg-orange-900/30 border border-orange-500/30 rounded-lg p-6">
                  <div className="flex items-start">
                    <span className="text-2xl mr-3">📚</span>
                    <div className="text-sm">
                      <h4 className="font-medium text-orange-300 mb-2">Book Content Tips</h4>
                      <p className="text-orange-200">
                        For books, you can include the ISBN in the source URL or additional content field. 
                        This helps with proper cataloging and makes it easier for others to find the original work.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {formData.contentType === 'URL' && (
                <div className="bg-cyan-900/30 border border-cyan-500/30 rounded-lg p-6">
                  <div className="flex items-start">
                    <span className="text-2xl mr-3">🌐</span>
                    <div className="text-sm">
                      <h4 className="font-medium text-cyan-300 mb-2">Web Content Tips</h4>
                      <p className="text-cyan-200">
                        Make sure to include the full URL in the source field. 
                        Use the auto-detect feature to automatically fill in title and description based on the webpage.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Help Modal */}
      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </div>
  );
}