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
import { type CreateEvermarkInput, type EvermarkMetadata } from '../types';
import { useAppAuth } from '@/providers/AppContext';
import { useUserForEvermarks } from '@/providers/IntegratedUserProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/utils/responsive';
import { themeClasses } from '@/utils/theme';
import { WalletConnect } from '@/components/ConnectButton';
import { farcasterCastService } from '@/services/FarcasterCastService';
import { castImageGenerator } from '@/services/CastImageGenerator';
import { doiService } from '@/services/DOIService';
import { isbnService } from '@/services/ISBNService';

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
  const [primaryInput, setPrimaryInput] = useState(''); // The main URL/identifier input
  const [detectedType, setDetectedType] = useState<'Cast' | 'DOI' | 'ISBN' | 'URL' | 'Custom' | null>(null);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
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
  // Simple image upload state for IPFS-first approach
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Farcaster cast data state
  const [castData, setCastData] = useState<any>(null);
  const [isFetchingCast, setIsFetchingCast] = useState(false);
  const [castImageUrl, setCastImageUrl] = useState<string | null>(null);
  
  // DOI data state
  const [doiData, setDoiData] = useState<any>(null);
  const [isFetchingDOI, setIsFetchingDOI] = useState(false);
  
  // ISBN data state
  const [isbnData, setIsbnData] = useState<any>(null);
  const [isFetchingISBN, setIsFetchingISBN] = useState(false);

  const getAuthor = useCallback(() => {
    return user?.displayName || user?.username || 'Unknown Author';
  }, [user]);

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

  // Smart auto-detect from primary input
  const handleSmartDetection = useCallback(async (input: string) => {
    if (!input.trim()) {
      setDetectedType(null);
      setIsFormExpanded(false);
      setCastData(null);
      setDoiData(null);
      setIsbnData(null);
      setFormData(prev => ({ ...prev, title: '', description: '', sourceUrl: '', contentType: 'Custom' }));
      setTags([]);
      return;
    }
    
    try {
      console.log('🔍 Smart detection for input:', input);
      
      // Reset previous data (but preserve user-uploaded images)
      setCastData(null);
      setDoiData(null);
      setIsbnData(null);
      setCastImageUrl(null);
      
      // Remember if user has already uploaded an image
      const hasUserImage = selectedImage !== null;
      
      // Update sourceUrl in formData
      setFormData(prev => ({ ...prev, sourceUrl: input }));
      
      // Check if it's a Farcaster URL and fetch cast data
      if (farcasterCastService.isFarcasterUrl(input)) {
        setDetectedType('Cast');
        setIsFetchingCast(true);
        console.log('💬 Detected Farcaster URL, fetching cast data...');
        
        const result = await farcasterCastService.fetchCastWithPreview(input);
        
        if (result.success && result.castData) {
          setCastData(result.castData);
          
          // Auto-fill form with cast data
          setFormData(prev => ({ 
            ...prev, 
            title: result.castData?.text?.substring(0, 100) || `Cast by ${result.castData?.author?.display_name || 'Unknown'}`,
            description: result.castData?.text || 'Farcaster cast',
            contentType: 'Cast'
          }));

          setTags(['farcaster', 'cast']);
          setIsFormExpanded(true);
          
          // Generate cast preview image only if user hasn't uploaded one
          if (castImageGenerator && !hasUserImage) {
            try {
              console.log('🎨 Generating cast preview image...');
              
              const castImageFile = await castImageGenerator.generateCastImageFile({
                text: result.castData.text,
                author: {
                  username: result.castData.author.username,
                  displayName: result.castData.author.display_name,
                  pfpUrl: result.castData.author.pfp_url
                },
                reactions: {
                  likes: result.castData.reactions.likes_count,
                  recasts: result.castData.reactions.recasts_count
                },
                timestamp: result.castData.timestamp
              });
              
              const previewUrl = URL.createObjectURL(castImageFile);
              setImagePreview(previewUrl);
              setSelectedImage(castImageFile);
              setCastImageUrl(previewUrl);
              
              console.log('✅ Cast preview image generated successfully');
            } catch (genError) {
              console.warn('Could not generate cast preview image:', genError);
            }
          } else if (hasUserImage) {
            console.log('👤 Preserving user-uploaded image over cast preview');
          }
          
          console.log('✅ Cast data fetched and form populated');
        }
        
        setIsFetchingCast(false);
      } 
      // Check if it's a DOI URL and fetch paper data
      else if (doiService.isDOIUrl(input)) {
        setDetectedType('DOI');
        setIsFetchingDOI(true);
        console.log('📄 Detected DOI URL, fetching paper data...');
        
        const result = await doiService.fetchDOIMetadata(input);
        
        if (result.success && result.metadata) {
          setDoiData(result.metadata);
          
          // Auto-fill form with DOI data
          setFormData(prev => ({ 
            ...prev, 
            title: result.metadata?.title || 'Unknown Title',
            description: result.metadata?.title ? 
              result.metadata.title + (result.metadata.authors && result.metadata.authors.length > 0 ? ` by ${result.metadata.authors.join(', ')}` : '') :
              'Academic paper',
            contentType: 'DOI'
          }));

          setTags(['academic', 'research', 'paper']);
          setIsFormExpanded(true);
          
          console.log('✅ DOI metadata fetched and form populated');
        }
        
        setIsFetchingDOI(false);
      }
      // Check if input contains ISBN and fetch book data
      else if (isbnService.isISBN(input) || isbnService.findISBNInURL(input)) {
        setDetectedType('ISBN');
        setIsFetchingISBN(true);
        console.log('📚 Detected ISBN, fetching book data...');
        
        const isbnToFetch = isbnService.extractISBN(input) || isbnService.findISBNInURL(input);
        
        if (isbnToFetch) {
          const result = await isbnService.fetchISBNMetadata(isbnToFetch);
          
          if (result.success && result.metadata) {
            setIsbnData(result.metadata);
            
            // Auto-fill form with ISBN data
            setFormData(prev => ({ 
              ...prev, 
              title: result.metadata?.title || 'Unknown Title',
              description: result.metadata?.description || 
                (result.metadata?.title && result.metadata?.authors ? 
                  `${result.metadata.title} by ${result.metadata.authors.join(', ')}` : 
                  'Book description'),
              contentType: 'ISBN'
            }));

            // Auto-populate tags for books
            const bookTags = ['book'];
            if (result.metadata?.categories && result.metadata.categories.length > 0) {
              bookTags.push(...result.metadata.categories.slice(0, 3).map(cat => cat.toLowerCase()));
            }
            setTags(bookTags);
            setIsFormExpanded(true);
            
            // Set cover image if available and user hasn't uploaded one
            if (result.metadata?.coverImage && !hasUserImage) {
              try {
                const response = await fetch(result.metadata.coverImage);
                const blob = await response.blob();
                const file = new File([blob], 'book-cover.jpg', { type: 'image/jpeg' });
                setSelectedImage(file);
                setImagePreview(result.metadata.coverImage);
                console.log('📸 Using book cover image');
              } catch (imgError) {
                console.warn('Could not load book cover image:', imgError);
              }
            } else if (hasUserImage) {
              console.log('👤 Preserving user-uploaded image over book cover');
            }
            
            console.log('✅ ISBN metadata fetched and form populated');
          }
        }
        
        setIsFetchingISBN(false);
      } else {
        // Handle as URL or allow manual entry
        try {
          const url = new URL(input);
          setDetectedType('URL');
          const domain = url.hostname.replace('www.', '');
          
          setFormData(prev => ({ 
            ...prev, 
            title: `Content from ${domain}`,
            description: `Content from ${input}`,
            contentType: 'URL'
          }));
          
          setTags(['web', 'url']);
          setIsFormExpanded(true);
          
          console.log('✅ URL detected, form expanded for manual entry');
        } catch (urlError) {
          // Not a valid URL, allow manual entry
          setDetectedType('Custom');
          setFormData(prev => ({ 
            ...prev, 
            title: '',
            description: '',
            contentType: 'Custom'
          }));
          setTags([]);
          setIsFormExpanded(true);
          
          console.log('✅ Manual entry mode, form expanded');
        }
      }
      
    } catch (error) {
      console.warn('Smart detection failed:', error);
      setIsFetchingCast(false);
      setIsFetchingDOI(false);
      setIsFetchingISBN(false);
      setDetectedType('Custom');
      setIsFormExpanded(true);
    }
  }, [setDetectedType, setIsFormExpanded, setCastData, setDoiData, setIsbnData, setFormData, setTags, setIsFetchingCast, setIsFetchingDOI, setIsFetchingISBN, setCastImageUrl, castImageGenerator, setImagePreview, setSelectedImage]);

  // Debounced smart detection effect
  useEffect(() => {
    if (!primaryInput.trim()) {
      return;
    }
    
    const timeoutId = setTimeout(() => {
      handleSmartDetection(primaryInput);
    }, 500); // 500ms debounce delay
    
    return () => clearTimeout(timeoutId);
  }, [primaryInput, handleSmartDetection]);

  const isFormValid = useCallback(() => {
    // For Cast type, only require sourceUrl since title/description will be auto-populated
    if (formData.contentType === 'Cast') {
      return formData.sourceUrl.trim().length > 0;
    }
    // For other types, require title and description
    return formData.title.trim().length > 0 && 
           formData.description.trim().length > 0;
  }, [formData.title, formData.description, formData.sourceUrl, formData.contentType]);

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
      // For Cast type, auto-generate title and description if not provided
      let title = formData.title.trim();
      let description = formData.description.trim();
      let author = getAuthor();
      let finalTags = [...tags];

      if (formData.contentType === 'Cast') {
        // Auto-populate tags for Cast type
        finalTags = ['farcaster', 'cast'];
        
        if (castData) {
          // Use cast data if available
          title = castData.text.substring(0, 100) || `Cast by ${castData.author.display_name}`;
          description = castData.text || 'Farcaster cast';
          author = castData.author.display_name;
        } else {
          // Fallback titles for Cast type
          const url = new URL(formData.sourceUrl);
          title = `Cast from ${url.hostname}`;
          description = `Farcaster cast preserved from ${formData.sourceUrl}`;
        }
      }

      const evermarkMetadata: EvermarkMetadata = {
        title,
        description,
        sourceUrl: formData.sourceUrl.trim(),
        author,
        tags: finalTags,
        contentType: formData.contentType,
        customFields: [],
        // Include cast URL if it's a Farcaster cast
        castUrl: formData.contentType === 'Cast' ? formData.sourceUrl.trim() : undefined
      };
      
      // If we have cast data, include it in metadata
      if (castData && formData.contentType === 'Cast') {
        evermarkMetadata.customFields = [
          { key: 'cast_author_username', value: castData.author.username },
          { key: 'cast_author_display_name', value: castData.author.display_name },
          { key: 'cast_hash', value: castData.hash },
          { key: 'cast_likes', value: castData.reactions.likes_count.toString() },
          { key: 'cast_recasts', value: castData.reactions.recasts_count.toString() },
          { key: 'cast_timestamp', value: castData.timestamp }
        ];
      }
      
      // If we have DOI data, include it in metadata
      if (doiData && formData.contentType === 'DOI') {
        evermarkMetadata.customFields = [
          { key: 'doi', value: doiData.doi },
          { key: 'authors', value: doiData.authors.join('; ') },
          { key: 'journal', value: doiData.journal || '' },
          { key: 'publisher', value: doiData.publisher || '' },
          { key: 'volume', value: doiData.volume || '' },
          { key: 'issue', value: doiData.issue || '' },
          { key: 'pages', value: doiData.pages || '' },
          { key: 'published_date', value: doiData.publishedDate || '' }
        ];
      }
      
      // If we have ISBN data, include it in metadata
      if (isbnData && formData.contentType === 'ISBN') {
        evermarkMetadata.customFields = [
          { key: 'isbn', value: isbnData.isbn },
          { key: 'authors', value: isbnData.authors.join('; ') },
          { key: 'publisher', value: isbnData.publisher || '' },
          { key: 'published_date', value: isbnData.publishedDate || '' },
          { key: 'page_count', value: isbnData.pageCount?.toString() || '' },
          { key: 'categories', value: isbnData.categories?.join('; ') || '' }
        ];
      }

      const createInput: CreateEvermarkInput = {
        metadata: evermarkMetadata,
        // For Cast types, don't include image - it will be auto-generated after creation
        image: formData.contentType === 'Cast' ? undefined : (selectedImage || undefined)
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
    castData,
    createEvermark, 
    onSuccess, 
    navigate
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
                {/* Primary Input Field - The star of the show! */}
                <div className="space-y-4">
                  <label className={cn(
                    "block text-lg font-medium text-center",
                    isDark ? "text-cyan-400" : "text-purple-600"
                  )}>
                    Paste URL or Identifier
                  </label>
                  
                  <div className="relative">
                    <input
                      type="text"
                      value={primaryInput}
                      onChange={(e) => {
                        setPrimaryInput(e.target.value);
                        // Debounced auto-detection will be added next
                      }}
                      placeholder="Paste Farcaster cast URL, DOI, ISBN, or any URL..."
                      disabled={isFormDisabled}
                      className={cn(
                        "w-full px-6 py-4 text-lg border-2 rounded-xl focus:ring-2 focus:ring-opacity-20 transition-all",
                        isFormDisabled && "opacity-50 cursor-not-allowed",
                        // Dynamic border colors based on detection state
                        detectedType === 'Cast' && "border-purple-400 bg-purple-50",
                        detectedType === 'DOI' && "border-blue-400 bg-blue-50", 
                        detectedType === 'ISBN' && "border-green-400 bg-green-50",
                        detectedType === 'URL' && "border-orange-400 bg-orange-50",
                        !detectedType && (isDark 
                          ? "border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-cyan-400" 
                          : "border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:border-purple-400 focus:ring-purple-400")
                      )}
                    />
                    
                    {/* Loading indicator */}
                    {(isFetchingCast || isFetchingDOI || isFetchingISBN) && (
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                        <LoaderIcon className="h-5 w-5 animate-spin text-purple-500" />
                      </div>
                    )}
                    
                    {/* Detection result badge */}
                    {detectedType && !isFetchingCast && !isFetchingDOI && !isFetchingISBN && (
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                        <div className={cn(
                          "flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium",
                          detectedType === 'Cast' && "bg-purple-100 text-purple-700 border border-purple-200",
                          detectedType === 'DOI' && "bg-blue-100 text-blue-700 border border-blue-200",
                          detectedType === 'ISBN' && "bg-green-100 text-green-700 border border-green-200",
                          detectedType === 'URL' && "bg-orange-100 text-orange-700 border border-orange-200",
                          detectedType === 'Custom' && "bg-gray-100 text-gray-700 border border-gray-200"
                        )}>
                          <CheckCircleIcon className="h-4 w-4" />
                          {detectedType === 'Cast' && '💬 Cast'}
                          {detectedType === 'DOI' && '📄 Paper'}
                          {detectedType === 'ISBN' && '📚 Book'}
                          {detectedType === 'URL' && '🌐 URL'}
                          {detectedType === 'Custom' && '✨ Custom'}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Manual entry option */}
                  {!isFormExpanded && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setDetectedType('Custom');
                          setIsFormExpanded(true);
                          setFormData(prev => ({ ...prev, contentType: 'Custom' }));
                        }}
                        className={cn(
                          "text-sm underline transition-colors",
                          isDark ? "text-gray-400 hover:text-gray-300" : "text-gray-600 hover:text-gray-700"
                        )}
                      >
                        Or create custom evermark manually
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded Form Section - Only shows after detection/manual selection */}
                {isFormExpanded && (
                  <div className={cn(
                    "space-y-6 animate-in slide-in-from-top-4 duration-300",
                    isDark ? "border-t border-gray-700 pt-6" : "border-t border-gray-200 pt-6"
                  )}>
                    
                    {/* Detection Success Banner */}
                    {detectedType && detectedType !== 'Custom' && (
                      <div className={cn(
                        "p-4 rounded-lg border",
                        detectedType === 'Cast' && "bg-purple-50 border-purple-200",
                        detectedType === 'DOI' && "bg-blue-50 border-blue-200", 
                        detectedType === 'ISBN' && "bg-green-50 border-green-200",
                        detectedType === 'URL' && "bg-orange-50 border-orange-200"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center",
                              detectedType === 'Cast' && "bg-purple-100",
                              detectedType === 'DOI' && "bg-blue-100",
                              detectedType === 'ISBN' && "bg-green-100", 
                              detectedType === 'URL' && "bg-orange-100"
                            )}>
                              {detectedType === 'Cast' && '💬'}
                              {detectedType === 'DOI' && '📄'}
                              {detectedType === 'ISBN' && '📚'}
                              {detectedType === 'URL' && '🌐'}
                            </div>
                            <div>
                              <h3 className={cn(
                                "font-medium",
                                detectedType === 'Cast' && "text-purple-800",
                                detectedType === 'DOI' && "text-blue-800",
                                detectedType === 'ISBN' && "text-green-800",
                                detectedType === 'URL' && "text-orange-800"
                              )}>
                                {detectedType === 'Cast' && 'Farcaster Cast Detected'}
                                {detectedType === 'DOI' && 'Academic Paper Detected'}
                                {detectedType === 'ISBN' && 'Book Detected'}
                                {detectedType === 'URL' && 'URL Detected'}
                              </h3>
                              <p className={cn(
                                "text-sm",
                                detectedType === 'Cast' && "text-purple-600",
                                detectedType === 'DOI' && "text-blue-600",
                                detectedType === 'ISBN' && "text-green-600",
                                detectedType === 'URL' && "text-orange-600"
                              )}>
                                Form auto-populated with detected metadata. Review and edit as needed.
                              </p>
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => {
                              setIsFormExpanded(false);
                              setDetectedType(null);
                              setPrimaryInput('');
                              setFormData({
                                title: '',
                                description: '',
                                content: '',
                                sourceUrl: '',
                                category: '',
                                contentType: 'Custom'
                              });
                              setTags([]);
                              setCastData(null);
                              setDoiData(null);
                              setIsbnData(null);
                            }}
                            className={cn(
                              "text-xs px-3 py-1 rounded-full border transition-colors",
                              detectedType === 'Cast' && "border-purple-300 text-purple-700 hover:bg-purple-100",
                              detectedType === 'DOI' && "border-blue-300 text-blue-700 hover:bg-blue-100",
                              detectedType === 'ISBN' && "border-green-300 text-green-700 hover:bg-green-100",
                              detectedType === 'URL' && "border-orange-300 text-orange-700 hover:bg-orange-100"
                            )}
                          >
                            Start Over
                          </button>
                        </div>
                      </div>
                    )}

                {/* Cast Mode Indicator */}
                {formData.contentType === 'Cast' && (
                  <div className={cn(
                    "p-4 border rounded-lg",
                    isDark 
                      ? "bg-purple-900/30 border-purple-500/50" 
                      : "bg-purple-100/80 border-purple-300"
                  )}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💬</span>
                      <div>
                        <h4 className={cn(
                          "font-medium",
                          isDark ? "text-purple-300" : "text-purple-700"
                        )}>
                          Cast Mode - Simplified Form
                        </h4>
                        <p className={cn(
                          "text-sm",
                          isDark ? "text-purple-400" : "text-purple-600"
                        )}>
                          Just provide the Farcaster cast URL. Title, description, and tags will be auto-populated when you fetch the cast data.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Title - Simplified for Cast content type */}
                {formData.contentType !== 'Cast' && (
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
                )}

                {/* Description - Simplified for Cast content type */}
                {formData.contentType !== 'Cast' && (
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
                )}

                {/* Source URL - Required for Cast type */}
                <div className="space-y-2">
                  <label className={cn(
                    "block text-sm font-medium",
                    isDark ? "text-cyan-400" : "text-purple-600"
                  )}>
                    {formData.contentType === 'Cast' ? 'Farcaster Cast URL *' : 'Source URL (Optional)'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={formData.sourceUrl}
                      onChange={(e) => handleFieldChange('sourceUrl', e.target.value)}
                      placeholder={
                        formData.contentType === 'Cast' 
                          ? "https://warpcast.com/username/0x12345..." 
                          : "https://example.com/content"
                      }
                      disabled={isFormDisabled}
                      required={formData.contentType === 'Cast'}
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
                        onClick={() => handleSmartDetection(formData.sourceUrl)}
                        disabled={isFormDisabled || isFetchingCast || isFetchingDOI || isFetchingISBN}
                        className={cn(
                          "px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors",
                          isFormDisabled && "opacity-50 cursor-not-allowed"
                        )}
                        title="Auto-detect content"
                      >
                        {(isFetchingCast || isFetchingDOI || isFetchingISBN) ? (
                          <LoaderIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <ZapIcon className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                  {/* Show detected data indicators */}
                  {castData && formData.contentType === 'Cast' && (
                    <div className={cn(
                      "mt-2 p-3 border rounded-lg text-sm",
                      isDark 
                        ? "bg-purple-900/30 border-purple-500/50 text-purple-300" 
                        : "bg-purple-100/80 border-purple-300 text-purple-700"
                    )}>
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="h-4 w-4" />
                        <span>💬 Farcaster cast detected: @{castData.author.username}</span>
                      </div>
                      {castImageUrl && (
                        <div className="mt-2 text-xs opacity-80">
                          ✓ Cast image generated and will be used
                        </div>
                      )}
                    </div>
                  )}
                  
                  {doiData && formData.contentType === 'DOI' && (
                    <div className={cn(
                      "mt-2 p-3 border rounded-lg text-sm",
                      isDark 
                        ? "bg-blue-900/30 border-blue-500/50 text-blue-300" 
                        : "bg-blue-100/80 border-blue-300 text-blue-700"
                    )}>
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="h-4 w-4" />
                        <span>📄 Academic paper detected: {doiData.journal}</span>
                      </div>
                      <div className="mt-2 text-xs opacity-80">
                        ✓ Authors: {doiData.authors.slice(0, 3).join(', ')}{doiData.authors.length > 3 ? '...' : ''}
                      </div>
                      {doiData.publishedDate && (
                        <div className="text-xs opacity-80">
                          ✓ Published: {doiData.publishedDate}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {isbnData && formData.contentType === 'ISBN' && (
                    <div className={cn(
                      "mt-2 p-3 border rounded-lg text-sm",
                      isDark 
                        ? "bg-green-900/30 border-green-500/50 text-green-300" 
                        : "bg-green-100/80 border-green-300 text-green-700"
                    )}>
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="h-4 w-4" />
                        <span>📚 Book detected: {isbnData.publisher}</span>
                      </div>
                      <div className="mt-2 text-xs opacity-80">
                        ✓ Authors: {isbnData.authors.slice(0, 3).join(', ')}{isbnData.authors.length > 3 ? '...' : ''}
                      </div>
                      {isbnData.pageCount && (
                        <div className="text-xs opacity-80">
                          ✓ Pages: {isbnData.pageCount}
                        </div>
                      )}
                      {isbnData.coverImage && (
                        <div className="text-xs opacity-80">
                          ✓ Cover image found and will be used
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tags - Simplified for Cast content type */}
                {formData.contentType !== 'Cast' && (
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
                )}

                {/* Show auto-populated tags for Cast content type */}
                {formData.contentType === 'Cast' && (
                  <div className="space-y-3">
                    <label className={cn(
                      "block text-sm font-medium",
                      isDark ? "text-cyan-400" : "text-purple-600"
                    )}>
                      Tags (Auto-populated)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <span className={cn(
                        "inline-flex items-center px-3 py-1 rounded-full border",
                        isDark 
                          ? "bg-green-900/30 text-green-300 border-green-500/30" 
                          : "bg-green-100 text-green-700 border-green-300"
                      )}>
                        farcaster
                      </span>
                      <span className={cn(
                        "inline-flex items-center px-3 py-1 rounded-full border",
                        isDark 
                          ? "bg-green-900/30 text-green-300 border-green-500/30" 
                          : "bg-green-100 text-green-700 border-green-300"
                      )}>
                        cast
                      </span>
                    </div>
                    <p className={cn(
                      "text-xs",
                      isDark ? "text-gray-500" : "text-gray-600"
                    )}>
                      ✓ Auto-populated from cast data
                    </p>
                  </div>
                )}

                {/* FIXED: SDK Image Upload with proper error handling - Hidden for Cast types */}
                {formData.contentType !== 'Cast' && (
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
                )}

                {/* Cast Image Auto-Generation Info */}
                {formData.contentType === 'Cast' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-cyan-400">Cast Preview Image</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded">
                          ✅ Auto-Generated
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🎨</span>
                        <span className="font-medium text-purple-300">Automatic Image Generation</span>
                      </div>
                      <p className="text-purple-200 text-sm mb-3">
                        Cast images are automatically generated from the cast content. No manual upload needed!
                      </p>
                      {castImageUrl && (
                        <div className="bg-green-900/20 border border-green-500/30 p-3 rounded-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircleIcon className="h-4 w-4 text-green-400" />
                            <span className="text-sm text-green-300">Cast preview generated successfully</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
                  </div>
                )}
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