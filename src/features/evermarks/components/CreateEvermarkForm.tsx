import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PlusIcon, 
  AlertCircleIcon, 
  CheckCircleIcon,
  XIcon,
  LoaderIcon,
  HelpCircleIcon,
  TagIcon,
  FileTextIcon,
  ZapIcon,
  UploadIcon
} from 'lucide-react';

// Removed ImageUpload component - using simple file input with IPFS-first approach in EvermarkService

import { useEvermarksState } from '../hooks/useEvermarkState';
import { type CreateEvermarkInput, type EvermarkMetadata, type Evermark, type CreateEvermarkResult } from '../types';
import { useAppAuth } from '@/providers/AppContext';
import { useUserForEvermarks } from '@/providers/IntegratedUserProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/utils/responsive';
import { themeClasses } from '@/utils/theme';

// Simple mobile detection hook
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

// Image Preview Component with Aspect Ratio Detection
const ImagePreviewWithAspectRatio: React.FC<{
  src: string;
  alt: string;
  containerClassName?: string;
}> = ({ src, alt, containerClassName }) => {
  const [dimensions, setDimensions] = useState<{
    aspectRatio: number;
    isTall: boolean;
    isPortrait: boolean;
    isSquare: boolean;
    isWide: boolean;
  } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    
    setDimensions({
      aspectRatio,
      isTall: aspectRatio < 0.75,
      isPortrait: aspectRatio < 0.95,
      isSquare: aspectRatio >= 0.95 && aspectRatio <= 1.05,
      isWide: aspectRatio > 1.05
    });
    
    setImageLoaded(true);
    console.log('📐 Preview image aspect ratio:', {
      ratio: aspectRatio.toFixed(2),
      type: aspectRatio < 0.75 ? 'tall/book' : aspectRatio < 0.95 ? 'portrait' : aspectRatio <= 1.05 ? 'square' : 'wide'
    });
  };

  // Get dynamic padding based on aspect ratio
  const getDynamicPadding = () => {
    if (!dimensions) return '';
    
    if (dimensions.isTall) {
      // Book covers need horizontal padding
      return 'px-8 sm:px-12 md:px-16';
    } else if (dimensions.isPortrait) {
      return 'px-4 sm:px-6';
    } else if (dimensions.isWide) {
      return 'py-4 sm:py-6';
    }
    return 'p-2';
  };

  const getObjectFit = () => {
    if (!dimensions) return 'object-cover';
    // For tall images (books), use contain to show full cover
    return dimensions.isTall || dimensions.isPortrait ? 'object-contain' : 'object-cover';
  };

  const getBackgroundPattern = () => {
    if (!dimensions) return 'bg-gray-800';
    // Add subtle gradient for book covers
    return dimensions.isTall 
      ? 'bg-gradient-to-b from-gray-900/50 via-gray-800/30 to-gray-900/50' 
      : 'bg-gray-800/30';
  };

  return (
    <div 
      className={cn(
        containerClassName,
        'flex items-center justify-center',
        getBackgroundPattern(),
        getDynamicPadding()
      )}
    >
      <img 
        src={src} 
        alt={alt}
        className={cn(
          'max-w-full max-h-full transition-opacity duration-300',
          getObjectFit(),
          imageLoaded ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={handleImageLoad}
        onError={(e) => console.error('Image failed to load:', e)}
      />
      
      {/* Loading indicator */}
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      )}
      
      {/* Book cover indicator */}
      {dimensions?.isTall && (
        <div className="absolute bottom-2 left-2 bg-purple-900/60 backdrop-blur-sm text-purple-200 text-xs px-2 py-1 rounded">
          📖 Book Cover
        </div>
      )}
    </div>
  );
};

// Content types configuration
const CONTENT_TYPES = [
  { value: 'Custom', label: 'Custom Content', icon: '✨', description: 'Any type of content with flexible metadata' },
  { value: 'Cast', label: 'Farcaster Cast', icon: '💬', description: 'Social media post from Farcaster' },
  { value: 'DOI', label: 'Academic Paper', icon: '📄', description: 'Research paper with DOI' },
  { value: 'ISBN', label: 'Book', icon: '📚', description: 'Published book with ISBN' },
  { value: 'URL', label: 'Web Content', icon: '🌐', description: 'Content from any website' },
] as const;

// Help Modal Component
const HelpModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { isDark } = useTheme();
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        "relative border rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto",
        isDark 
          ? "bg-gray-900 border-gray-700" 
          : "bg-white border-gray-300"
      )}>
        <div className={cn(
          "flex items-center justify-between p-6 border-b",
          isDark ? "border-gray-700" : "border-gray-200"
        )}>
          <h3 className={cn(
            "text-xl font-bold",
            isDark ? "text-white" : "text-gray-900"
          )}>Creating Evermarks</h3>
          <button
            onClick={onClose}
            className={cn(
              "p-2 rounded transition-colors",
              isDark 
                ? "text-gray-400 hover:text-white hover:bg-gray-800" 
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        
        <div className={cn(
          "p-6 space-y-6",
          isDark ? "text-gray-300" : "text-gray-700"
        )}>
          <div>
            <h4 className={cn(
              "text-lg font-semibold mb-2",
              isDark ? "text-white" : "text-gray-900"
            )}>What is an Evermark?</h4>
            <p>Evermarks preserve content permanently on the blockchain with hybrid storage for optimal performance.</p>
          </div>
          
          <div>
            <h4 className={cn(
              "text-lg font-semibold mb-2",
              isDark ? "text-white" : "text-gray-900"
            )}>Hybrid Storage</h4>
            <p>Your content is stored using our hybrid approach:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li><strong className="text-green-400">Primary:</strong> Supabase for fast loading</li>
              <li><strong className="text-cyan-400">Backup:</strong> IPFS for permanent decentralized storage</li>
              <li><strong className="text-purple-400">Auto-transfer:</strong> Seamless fallback between sources</li>
              <li><strong className="text-yellow-400">Auto:</strong> Intelligent image handling and optimization</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main CreateEvermarkForm Component
interface CreateEvermarkFormProps {
  onSuccess?: (result: CreateEvermarkResult) => void;
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
  const { user } = useAppAuth();
  const { isDark } = useTheme();
  
  // SIMPLIFIED: Just check wallet connection
  const { 
    hasWallet,
    canCreate 
  } = useUserForEvermarks();
  
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
  
  // Referral state
  const [referrer, setReferrer] = useState('');
  const [referralFromUrl, setReferralFromUrl] = useState<string | null>(null);
  
  // FIXED: Store both File and URL data for SDK compatibility
  // Simple image upload state for IPFS-first approach
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const getAuthor = useCallback(() => {
    return user?.displayName || user?.username || 'Unknown Author';
  }, [user]);

  // Check for referral in URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refParam = urlParams.get('ref') || urlParams.get('referrer');
    if (refParam) {
      setReferrer(refParam);
      setReferralFromUrl(refParam);
    }
  }, []);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleFieldChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    clearCreateError();
  }, [clearCreateError]);

  // Tag management
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

  // FIXED: Handle SDK upload completion with auth check
  // Simple file selection handler with preview - no upload until form submission
  const handleImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type and size
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      
      if (!allowedTypes.includes(file.type)) {
        console.error('Invalid file type. Please use JPEG, PNG, GIF, or WebP.');
        return;
      }
      
      if (file.size > maxSize) {
        console.error('File too large. Maximum size is 10MB.');
        return;
      }
      
      // Clean up previous preview URL to prevent memory leaks
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      
      // Create new preview URL
      const previewUrl = URL.createObjectURL(file);
      
      setSelectedImage(file);
      setImagePreview(previewUrl);
      console.log('✅ Image selected with preview:', file.name, file.size, 'bytes', 'Preview URL:', previewUrl);
    }
  }, [imagePreview]);

  // Remove selected image and cleanup preview
  const handleRemoveImage = useCallback(() => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setSelectedImage(null);
    setImagePreview(null);
    
    // Reset file input
    const fileInput = document.getElementById('image-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }, [imagePreview]);

  // UPDATED: Form submission with comprehensive auth checks
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isCreating || !isFormValid()) {
      return;
    }

    // Check if wallet is connected via app-level wallet provider
    if (!hasWallet) {
      console.error('❌ Cannot create evermark without wallet connection from app header');
      return;
    }

    try {
      const evermarkMetadata: EvermarkMetadata = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        sourceUrl: formData.sourceUrl.trim(),
        author: getAuthor(),
        tags,
        contentType: formData.contentType,
        customFields: []
      };

      const createInput: CreateEvermarkInput = {
        metadata: evermarkMetadata,
        image: selectedImage || undefined,
        referrer: referrer.trim() || undefined
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
    canCreate,
    formData, 
    getAuthor, 
    tags, 
    selectedImage,
    createEvermark, 
    onSuccess, 
    navigate,
    hasWallet,
    referrer
  ]);

  // Add this import at the top if not already imported
  const isFormDisabled = !hasWallet; // Enable form when wallet is connected via app header

  // Debug logging removed for cleaner console

  // No longer need SDK configuration - using IPFS-first approach in EvermarkService

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-200",
      isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900",
      className
    )}>
      {/* Header */}
      <div className={cn(
        "border-b border-green-400/30",
        isDark 
          ? "bg-gradient-to-r from-gray-900 via-black to-gray-900" 
          : "bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100"
      )}>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-purple-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50">
                <PlusIcon className="h-7 w-7 text-black" />
              </div>
              <h1 className={themeClasses.headingHero}>
                CREATE EVERMARK
              </h1>
              <button
                onClick={() => setShowHelpModal(true)}
                className={cn(
                  "w-8 h-8 border border-cyan-400/50 rounded-full flex items-center justify-center transition-colors group",
                  isDark 
                    ? "bg-gray-800/50 hover:bg-gray-700" 
                    : "bg-white/50 hover:bg-white"
                )}
                title="Get Help"
              >
                <HelpCircleIcon className="h-4 w-4 text-cyan-400 group-hover:text-cyan-300" />
              </button>
            </div>
            
            <p className={cn(
              "max-w-3xl mx-auto text-lg",
              isDark ? "text-gray-300" : "text-gray-700"
            )}>
              Transform any content into a permanent reference with our hybrid storage. 
              <span className="text-green-400 font-bold"> Hybrid storage</span> ensures optimal performance and permanence.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Error Display */}
        {createError && (
          <div className={cn(
            "mb-6 p-4 border rounded-lg flex items-start",
            isDark 
              ? "bg-red-900/30 border-red-500/50" 
              : "bg-red-100/80 border-red-300"
          )}>
            <AlertCircleIcon className={cn(
              "h-5 w-5 mr-3 mt-0.5 flex-shrink-0",
              isDark ? "text-red-400" : "text-red-600"
            )} />
            <div className="flex-1">
              <p className={cn(
                "font-medium",
                isDark ? "text-red-300" : "text-red-700"
              )}>Error</p>
              <p className={cn(
                "text-sm",
                isDark ? "text-red-400" : "text-red-600"
              )}>{createError}</p>
            </div>
            <button
              onClick={clearCreateError}
              className={cn(
                "transition-colors",
                isDark ? "text-red-400 hover:text-red-300" : "text-red-600 hover:text-red-500"
              )}
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        )}



        {/* Progress Display */}
        {isCreating && (
          <div className={cn(
            "mb-6 p-4 border rounded-lg",
            isDark 
              ? "bg-blue-900/30 border-blue-500/50" 
              : "bg-blue-100/80 border-blue-300"
          )}>
            <div className="flex items-start">
              <LoaderIcon className={cn(
                "animate-spin h-5 w-5 mr-3 mt-0.5 flex-shrink-0",
                isDark ? "text-blue-400" : "text-blue-600"
              )} />
              <div className="flex-1">
                <p className={cn(
                  "font-medium",
                  isDark ? "text-blue-300" : "text-blue-700"
                )}>Creating Evermark...</p>
                <p className={cn(
                  "text-sm",
                  isDark ? "text-blue-400" : "text-blue-600"
                )}>{createStep}</p>
                {createProgress > 0 && (
                  <div className={cn(
                    "mt-2 rounded-full h-2",
                    isDark ? "bg-gray-700" : "bg-gray-300"
                  )}>
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
            <div className={cn(
              "border rounded-lg shadow-lg p-6",
              isDark 
                ? "bg-gray-800/50 border-gray-700" 
                : "bg-white border-gray-300"
            )}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={cn(
                  "text-xl font-bold",
                  isDark ? "text-white" : "text-gray-900"
                )}>Create Evermark</h2>
                <div className={cn(
                  "flex items-center text-sm",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}>
                  <FileTextIcon className="h-4 w-4 mr-2" />
                  <span>Blockchain</span>
                </div>
              </div>

              {/* Wallet Status Message */}
              {!hasWallet && (
                <div className={cn(
                  "mb-6 p-4 border rounded-lg bg-amber-500/10 border-amber-500/30"
                )}>
                  <div className="flex items-start gap-3">
                    <AlertCircleIcon className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-amber-400 font-medium mb-2">Connect Wallet Required</h3>
                      <p className="text-amber-200 text-sm">
                        Please connect your wallet using the Connect button in the top navigation to create Evermarks.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Content Type Selection */}
                <div className="space-y-3">
                  <label className={cn(
                    "block text-sm font-medium",
                    isDark ? "text-cyan-400" : "text-purple-600"
                  )}>
                    Content Type
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CONTENT_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => handleFieldChange('contentType', type.value)}
                        className={cn(
                          "p-4 rounded-lg border transition-all text-left",
                          formData.contentType === type.value
                            ? (isDark 
                                ? "border-cyan-400 bg-cyan-900/30 text-cyan-300" 
                                : "border-purple-400 bg-purple-100/50 text-purple-700")
                            : (isDark 
                                ? "border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500" 
                                : "border-gray-300 bg-gray-100/50 text-gray-700 hover:border-gray-400")
                        )}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg">{type.icon}</span>
                          <span className="font-medium">{type.label}</span>
                        </div>
                        <p className={cn(
                          "text-xs",
                          isDark ? "text-gray-400" : "text-gray-600"
                        )}>{type.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <label className={cn(
                    "block text-sm font-medium",
                    isDark ? "text-cyan-400" : "text-purple-600"
                  )}>
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    placeholder="Enter a descriptive title..."
                    disabled={isFormDisabled}
                    className={cn(
                      "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-opacity-20 transition-colors",
                      isFormDisabled && "opacity-50 cursor-not-allowed",
                      isDark 
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-cyan-400" 
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-purple-400 focus:ring-purple-400"
                    )}
                    maxLength={100}
                    required
                  />
                  <div className={cn(
                    "text-xs text-right",
                    isDark ? "text-gray-500" : "text-gray-600"
                  )}>
                    {formData.title.length}/100
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className={cn(
                    "block text-sm font-medium",
                    isDark ? "text-cyan-400" : "text-purple-600"
                  )}>
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    placeholder="Describe this content and why it's worth preserving..."
                    disabled={isFormDisabled}
                    className={cn(
                      "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-opacity-20 resize-none transition-colors",
                      isFormDisabled && "opacity-50 cursor-not-allowed",
                      isDark 
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-cyan-400" 
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-purple-400 focus:ring-purple-400"
                    )}
                    rows={4}
                    maxLength={1000}
                    required
                  />
                  <div className={cn(
                    "text-xs text-right",
                    isDark ? "text-gray-500" : "text-gray-600"
                  )}>
                    {formData.description.length}/1000
                  </div>
                </div>

                {/* Source URL */}
                <div className="space-y-2">
                  <label className={cn(
                    "block text-sm font-medium",
                    isDark ? "text-cyan-400" : "text-purple-600"
                  )}>
                    Source URL (Optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={formData.sourceUrl}
                      onChange={(e) => handleFieldChange('sourceUrl', e.target.value)}
                      placeholder="https://example.com/content"
                      disabled={isFormDisabled}
                      className={cn(
                        "flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-opacity-20 transition-colors",
                        isFormDisabled && "opacity-50 cursor-not-allowed",
                        isDark 
                          ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-cyan-400" 
                          : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-purple-400 focus:ring-purple-400"
                      )}
                    />
                    {formData.sourceUrl && (
                      <button
                        type="button"
                        onClick={handleAutoDetect}
                        disabled={isFormDisabled}
                        className={cn(
                          "px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors",
                          isFormDisabled && "opacity-50 cursor-not-allowed"
                        )}
                        title="Auto-detect content"
                      >
                        <ZapIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Referral Address */}
                <div className="space-y-2">
                  <label className={cn(
                    "block text-sm font-medium",
                    isDark ? "text-cyan-400" : "text-purple-600"
                  )}>
                    Referrer Address (Optional)
                  </label>
                  <input
                    type="text"
                    value={referrer}
                    onChange={(e) => setReferrer(e.target.value)}
                    placeholder="0x... (Get 10% of minting fee)"
                    disabled={isFormDisabled}
                    className={cn(
                      "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-opacity-20 transition-colors",
                      isFormDisabled && "opacity-50 cursor-not-allowed",
                      isDark 
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-cyan-400" 
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-purple-400 focus:ring-purple-400"
                    )}
                  />
                  {referralFromUrl && (
                    <div className={cn(
                      "text-xs p-2 rounded border",
                      isDark 
                        ? "bg-green-900/30 text-green-300 border-green-500/30" 
                        : "bg-green-100 text-green-700 border-green-300"
                    )}>
                      ✅ Referral detected from URL
                    </div>
                  )}
                  <p className={cn(
                    "text-xs",
                    isDark ? "text-gray-500" : "text-gray-600"
                  )}>
                    The referrer will receive 10% of the minting fee (0.000007 ETH)
                  </p>
                </div>

                {/* Tags */}
                <div className="space-y-3">
                  <label className={cn(
                    "block text-sm font-medium",
                    isDark ? "text-cyan-400" : "text-purple-600"
                  )}>
                    Tags (Optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={handleTagKeyPress}
                      placeholder="Add tags..."
                      disabled={isFormDisabled || tags.length >= 10}
                      className={cn(
                        "flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-opacity-20 transition-colors",
                        (isFormDisabled || tags.length >= 10) && "opacity-50 cursor-not-allowed",
                        isDark 
                          ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-cyan-400" 
                          : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-purple-400 focus:ring-purple-400"
                      )}
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      disabled={isFormDisabled || !tagInput.trim() || tags.length >= 10}
                      className={cn(
                        "px-4 py-3 text-white rounded-lg transition-colors",
                        isDark 
                          ? "bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 disabled:text-gray-500" 
                          : "bg-gray-500 hover:bg-gray-400 disabled:bg-gray-300 disabled:text-gray-500"
                      )}
                    >
                      <TagIcon className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag, index) => (
                        <span
                          key={index}
                          className={cn(
                            "inline-flex items-center px-3 py-1 rounded-full border",
                            isDark 
                              ? "bg-purple-900/30 text-purple-300 border-purple-500/30" 
                              : "bg-purple-100 text-purple-700 border-purple-300"
                          )}
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className={cn(
                              "ml-2 transition-colors",
                              isDark ? "text-purple-400 hover:text-purple-200" : "text-purple-600 hover:text-purple-800"
                            )}
                          >
                            <XIcon className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <p className={cn(
                    "text-xs",
                    isDark ? "text-gray-500" : "text-gray-600"
                  )}>
                    {tags.length}/10 tags • Press Enter to add
                  </p>
                </div>

                {/* FIXED: SDK Image Upload with proper error handling */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-cyan-400">Cover Image (Optional)</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 bg-green-900/20 px-2 py-1 rounded">
                        IPFS Ready
                      </span>
                      <span className="text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded">
                        ✅ Wallet Ready
                      </span>
                    </div>
                  </div>
                  
                  <div className="border border-gray-600 rounded-lg p-4">
                    <div className="text-center">
                      <input
                        type="file"
                        id="image-input"
                        accept=".jpg,.jpeg,.png,.gif,.webp"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <label
                        htmlFor="image-input"
                        className="cursor-pointer flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-500 rounded-lg hover:border-gray-400 transition-colors"
                      >
                        <UploadIcon className="h-12 w-12 text-gray-400 mb-4" />
                        <span className="text-gray-300 mb-2">
                          {selectedImage ? selectedImage.name : 'Drag and drop or click to select'}
                        </span>
                        <span className="text-xs text-gray-500">
                          Max 10MB • image/jpeg, image/png, image/gif, image/webp
                        </span>
                      </label>
                    </div>
                  </div>

                  {selectedImage && (
                    <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <CheckCircleIcon className="h-4 w-4 text-blue-400" />
                          <span className="text-sm text-blue-300">Image Selected (will upload to IPFS on submit)</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </div>
                      
                      {/* Enhanced Image Preview with book cover support */}
                      {imagePreview ? (
                        <div className="mb-3">
                          <ImagePreviewWithAspectRatio
                            src={imagePreview}
                            alt="Selected image preview"
                            containerClassName="relative w-full h-48 sm:h-56 rounded-lg overflow-hidden border-2 border-blue-500/50"
                          />
                        </div>
                      ) : (
                        <div className="mb-3 text-xs text-gray-500">No preview available</div>
                      )}
                      
                      <div className="text-xs text-blue-400 space-y-1">
                        <div>File: {selectedImage.name}</div>
                        <div>Size: {Math.round(selectedImage.size / 1024)} KB</div>
                        <div>Type: {selectedImage.type}</div>
                        {imagePreview && <div>Preview URL: {imagePreview.substring(0, 50)}...</div>}
                      </div>
                    </div>
                  )}


                  <div className="bg-green-900/20 border border-green-500/30 p-3 rounded-lg">
                    <p className="text-green-300 text-sm">
                      ✅ Hybrid upload: IPFS storage with Supabase caching for optimal performance
                    </p>
                  </div>
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
                      disabled={isCreating || !isFormValid() || !canCreate}
                      className="flex-1 flex items-center justify-center px-6 py-4 bg-gradient-to-r from-green-400 to-green-600 text-black font-bold rounded-lg hover:from-green-300 hover:to-green-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/30"
                      title={!canCreate ? 'Authentication required' : undefined}
                    >
                      {isCreating ? (
                        <>
                          <LoaderIcon className="animate-spin h-5 w-5 mr-2" />
                          Creating...
                        </>
                      ) : !canCreate ? (
                        <>
                          <AlertCircleIcon className="h-5 w-5 mr-2" />
                          Auth Required
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
                <div className="text-xs text-gray-500 bg-purple-900/20 px-2 py-1 rounded">
                  Hybrid Storage
                </div>
              </div>
              
              <div className="space-y-6">
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

                  {/* Content Type Badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {CONTENT_TYPES.find(t => t.value === formData.contentType)?.icon}
                    </span>
                    <span className="text-sm text-cyan-400">
                      {CONTENT_TYPES.find(t => t.value === formData.contentType)?.label}
                    </span>
                  </div>

                  {/* Tags Preview */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag, index) => (
                        <span
                          key={index}
                          className="text-xs bg-purple-900/30 text-purple-300 px-2 py-1 rounded border border-purple-500/30"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Source URL Preview */}
                  {formData.sourceUrl && (
                    <div className="flex items-center gap-2 text-sm text-blue-400">
                      <span>🔗</span>
                      <span className="truncate">{formData.sourceUrl}</span>
                    </div>
                  )}

                  {/* Upload Status Preview */}
                  {selectedImage && (
                    <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircleIcon className="h-4 w-4 text-blue-400" />
                        <span className="text-sm text-blue-300">Image Selected for IPFS Upload</span>
                      </div>
                      
                      {/* Enhanced Image Preview in Sidebar with book cover support */}
                      {imagePreview && (
                        <div className="mb-2">
                          <ImagePreviewWithAspectRatio
                            src={imagePreview}
                            alt="Selected image preview"
                            containerClassName="relative w-full h-48 rounded overflow-hidden border-2 border-blue-500/50"
                          />
                        </div>
                      )}
                      
                      <div className="text-xs text-blue-400">
                        Will upload to IPFS when you submit the form
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SDK Architecture Info */}
              <div className="mt-6 pt-4 border-t border-gray-700">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Storage Architecture</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <div>
                      <div className="text-xs font-medium text-green-400">Direct Upload</div>
                      <div className="text-xs text-gray-500">Supabase Storage with CDN</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-cyan-400 rounded-full"></div>
                    <div>
                      <div className="text-xs font-medium text-cyan-400">Auto Thumbnails</div>
                      <div className="text-xs text-gray-500">Generated for performance</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                    <div>
                      <div className="text-xs font-medium text-purple-400">Smart Loading</div>
                      <div className="text-xs text-gray-500">Intelligent source fallbacks</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    <div>
                      <div className="text-xs font-medium text-green-400">
                        Wallet Connected
                      </div>
                      <div className="text-xs text-gray-500">
                        Ready for uploads
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Help Modal */}
      <HelpModal 
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
    </div>
  );
}