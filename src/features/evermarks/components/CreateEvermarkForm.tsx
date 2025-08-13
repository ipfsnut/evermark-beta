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

// FIXED: Updated SDK imports to use unified package
import { ImageUpload } from 'evermark-sdk/react';
import type { StorageConfig } from 'evermark-sdk/core';

import { useEvermarksState } from '../hooks/useEvermarkState';
import { type CreateEvermarkInput, type EvermarkMetadata } from '../types';
import { useAppAuth } from '@/providers/AppContext';
import { useUserForEvermarks } from '@/providers/IntegratedUserProvider';
import { getEvermarkStorageConfig, getUploadOptions } from '../config/sdk-config';

// Utility function for responsive classes
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h3 className="text-xl font-bold text-white">Creating Evermarks</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6 text-gray-300">
          <div>
            <h4 className="text-lg font-semibold text-white mb-2">What is an Evermark?</h4>
            <p>Evermarks preserve content permanently on the blockchain with hybrid storage for optimal performance.</p>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-white mb-2">SDK-Powered Storage</h4>
            <p>Your content is stored using our advanced SDK:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li><strong className="text-green-400">Primary:</strong> Supabase for fast loading</li>
              <li><strong className="text-cyan-400">Backup:</strong> IPFS for permanent decentralized storage</li>
              <li><strong className="text-purple-400">Auto-transfer:</strong> Seamless fallback between sources</li>
              <li><strong className="text-yellow-400">SDK:</strong> Intelligent image handling and optimization</li>
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
  
  // ADDED: Wallet auth integration
  const { 
    isWalletAuthenticated, 
    ensureWalletAuth, 
    authError,
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
  
  // FIXED: Store both File and URL data for SDK compatibility
  const [uploadedImageData, setUploadedImageData] = useState<{
    file?: File;
    originalUrl: string;
    thumbnailUrl?: string;
    fileSize?: number;
    dimensions?: string;
  } | null>(null);

  const getAuthor = useCallback(() => {
    return user?.displayName || user?.username || 'Unknown Author';
  }, [user]);

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
  const handleUploadComplete = useCallback(async (result: any) => {
    console.log('✅ SDK upload completed:', result);
    
    // Check if we have Supabase auth before proceeding
    if (!isWalletAuthenticated) {
      console.log('🔐 Ensuring Supabase authentication before processing upload...');
      const authSuccess = await ensureWalletAuth();
      if (!authSuccess) {
        console.error('❌ Failed to authenticate with Supabase');
        return;
      }
    }
    
    // Extract the relevant data from the SDK upload result
    const uploadData = {
      file: result.file,  // Store the File object for createEvermark
      originalUrl: result.supabaseUrl || result.url || result.originalUrl,
      thumbnailUrl: result.thumbnailUrl,
      fileSize: result.fileSize,
      dimensions: result.dimensions
    };
    
    setUploadedImageData(uploadData);
  }, [isWalletAuthenticated, ensureWalletAuth]);

  const handleUploadError = useCallback((error: string) => {
    console.error('❌ SDK upload failed:', error);
    
    // Check if it's an auth-related error
    if (error.includes('row-level security') || error.includes('unauthorized')) {
      console.log('🔐 Upload failed due to auth - attempting to fix...');
      ensureWalletAuth().then(success => {
        if (success) {
          console.log('✅ Auth fixed - you can try uploading again');
        }
      });
    }
  }, [ensureWalletAuth]);

  // UPDATED: Form submission with comprehensive auth checks
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isCreating || !isFormValid()) return;

    // ADDED: Check Supabase auth before proceeding
    if (!canCreate) {
      console.log('🔐 Ensuring authentication before creating evermark...');
      const authSuccess = await ensureWalletAuth();
      if (!authSuccess) {
        console.error('❌ Cannot create evermark without Supabase authentication');
        return;
      }
    }

    const canProceed = await requireAuth();
    if (!canProceed) return;

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
        image: uploadedImageData?.file
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
    ensureWalletAuth,
    requireAuth, 
    formData, 
    getAuthor, 
    tags, 
    uploadedImageData?.file,
    createEvermark, 
    onSuccess, 
    navigate
  ]);

  // Show authentication prompt if not connected
  if (!isAuthenticated) {
    return (
      <div className={cn("bg-gray-800/30 border border-gray-700 rounded-lg p-12 text-center", className)}>
        <PlusIcon className="mx-auto h-16 w-16 text-gray-500 mb-6" />
        <h3 className="text-2xl font-medium text-white mb-4">Connect to Create</h3>
        <p className="text-gray-400 mb-6 max-w-md mx-auto">
          Please connect your wallet to create an Evermark
        </p>
      </div>
    );
  }

  // Get SDK configuration with error handling
  let storageConfig: StorageConfig;
  let uploadOptions: any;
  
  try {
    storageConfig = getEvermarkStorageConfig();
    uploadOptions = getUploadOptions();
  } catch (error) {
    console.error('Failed to get SDK configuration:', error);
    return (
      <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6 text-center">
        <AlertCircleIcon className="mx-auto h-12 w-12 text-red-400 mb-4" />
        <h3 className="text-xl font-medium text-red-300 mb-2">Configuration Error</h3>
        <p className="text-red-400">
          SDK configuration is invalid. Please check your environment variables.
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
              Transform any content into a permanent reference with our advanced SDK. 
              <span className="text-green-400 font-bold"> Hybrid storage</span> ensures optimal performance and permanence.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Error Display */}
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

        {/* ADDED: Supabase Auth Status */}
        {authError && (
          <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-500/50 rounded-lg flex items-start">
            <AlertCircleIcon className="h-5 w-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-yellow-300 font-medium">Authentication Issue</p>
              <p className="text-yellow-400 text-sm">{authError}</p>
              <button
                onClick={() => ensureWalletAuth()}
                className="mt-2 text-sm bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded transition-colors"
              >
                Retry Authentication
              </button>
            </div>
          </div>
        )}

        {/* ADDED: Auth Status Indicator */}
        {isAuthenticated && (
          <div className="mb-6 p-4 bg-gray-800/50 border border-gray-600 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isWalletAuthenticated ? 'bg-green-400' : 'bg-yellow-400'}`} />
                <span className="text-sm text-gray-300">
                  {isWalletAuthenticated ? '✅ Ready to create' : '⏳ Setting up authentication...'}
                </span>
              </div>
              {!isWalletAuthenticated && (
                <button
                  onClick={() => ensureWalletAuth()}
                  className="text-sm bg-cyan-600 hover:bg-cyan-700 px-3 py-1 rounded transition-colors"
                >
                  Complete Setup
                </button>
              )}
            </div>
          </div>
        )}

        {/* Progress Display */}
        {isCreating && (
          <div className="mb-6 p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg">
            <div className="flex items-start">
              <LoaderIcon className="animate-spin h-5 w-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-blue-300 font-medium">Creating Evermark with SDK...</p>
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
                  <span>SDK Powered</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Content Type Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-cyan-400">
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
                            ? "border-cyan-400 bg-cyan-900/30 text-cyan-300"
                            : "border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500"
                        )}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg">{type.icon}</span>
                          <span className="font-medium">{type.label}</span>
                        </div>
                        <p className="text-xs text-gray-400">{type.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-cyan-400">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    placeholder="Enter a descriptive title..."
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20"
                    maxLength={100}
                    required
                  />
                  <div className="text-xs text-gray-500 text-right">
                    {formData.title.length}/100
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-cyan-400">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    placeholder="Describe this content and why it's worth preserving..."
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20 resize-none"
                    rows={4}
                    maxLength={1000}
                    required
                  />
                  <div className="text-xs text-gray-500 text-right">
                    {formData.description.length}/1000
                  </div>
                </div>

                {/* Source URL */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-cyan-400">
                    Source URL (Optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={formData.sourceUrl}
                      onChange={(e) => handleFieldChange('sourceUrl', e.target.value)}
                      placeholder="https://example.com/content"
                      className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20"
                    />
                    {formData.sourceUrl && (
                      <button
                        type="button"
                        onClick={handleAutoDetect}
                        className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                        title="Auto-detect content"
                      >
                        <ZapIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-cyan-400">
                    Tags (Optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={handleTagKeyPress}
                      placeholder="Add tags..."
                      className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20"
                      disabled={tags.length >= 10}
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      disabled={!tagInput.trim() || tags.length >= 10}
                      className="px-4 py-3 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg transition-colors"
                    >
                      <TagIcon className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center bg-purple-900/30 text-purple-300 px-3 py-1 rounded-full border border-purple-500/30"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-2 text-purple-400 hover:text-purple-200"
                          >
                            <XIcon className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500">
                    {tags.length}/10 tags • Press Enter to add
                  </p>
                </div>

                {/* FIXED: SDK Image Upload with proper error handling */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-cyan-400">Cover Image (Optional)</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 bg-green-900/20 px-2 py-1 rounded">
                        SDK Enhanced
                      </span>
                      {isWalletAuthenticated ? (
                        <span className="text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded">
                          ✅ Auth Ready
                        </span>
                      ) : (
                        <span className="text-xs text-yellow-400 bg-yellow-900/20 px-2 py-1 rounded">
                          ⏳ Auth Pending
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="border border-gray-600 rounded-lg p-4">
                    <ImageUpload
                      storageConfig={storageConfig}
                      onUploadComplete={handleUploadComplete}
                      onUploadError={handleUploadError}
                      generateThumbnails={uploadOptions.generateThumbnails}
                      allowedTypes={uploadOptions.allowedTypes}
                      maxFileSize={uploadOptions.maxFileSize}
                      className="w-full"
                    />
                  </div>

                  {uploadedImageData && (
                    <div className="bg-green-900/20 border border-green-500/30 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircleIcon className="h-4 w-4 text-green-400" />
                        <span className="text-sm text-green-300">Image Uploaded Successfully</span>
                      </div>
                      <div className="text-xs text-green-400 space-y-1">
                        <div>Primary URL: {uploadedImageData.originalUrl.substring(0, 50)}...</div>
                        {uploadedImageData.thumbnailUrl && (
                          <div>Thumbnail: {uploadedImageData.thumbnailUrl.substring(0, 50)}...</div>
                        )}
                        {uploadedImageData.fileSize && (
                          <div>Size: {Math.round(uploadedImageData.fileSize / 1024)} KB</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ADDED: Auth troubleshooting info */}
                  {!isWalletAuthenticated && (
                    <div className="bg-yellow-900/20 border border-yellow-500/30 p-3 rounded-lg">
                      <p className="text-yellow-300 text-sm mb-2">
                        ⚠️ Supabase authentication required for image uploads
                      </p>
                      <button
                        type="button"
                        onClick={() => ensureWalletAuth()}
                        className="text-sm bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded transition-colors"
                      >
                        Authenticate Now
                      </button>
                    </div>
                  )}

                  <div className="bg-green-900/20 border border-green-500/30 p-3 rounded-lg">
                    <p className="text-green-300 text-sm">
                      ✅ Advanced SDK upload: Direct to Supabase with automatic optimization and thumbnails
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
                          Creating with SDK...
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
                  SDK Enhanced
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
                  {uploadedImageData && (
                    <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircleIcon className="h-4 w-4 text-green-400" />
                        <span className="text-sm text-green-300">Image Uploaded via SDK</span>
                      </div>
                      <div className="text-xs text-green-400">
                        Ready for minting with optimized storage
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SDK Architecture Info */}
              <div className="mt-6 pt-4 border-t border-gray-700">
                <h4 className="text-sm font-medium text-gray-300 mb-3">SDK Architecture</h4>
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
                  
                  {/* ADDED: Auth status in architecture */}
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isWalletAuthenticated ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                    <div>
                      <div className={`text-xs font-medium ${isWalletAuthenticated ? 'text-green-400' : 'text-yellow-400'}`}>
                        {isWalletAuthenticated ? 'Authenticated' : 'Auth Pending'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {isWalletAuthenticated ? 'Ready for uploads' : 'Setting up permissions'}
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