import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronRightIcon,
  ChevronLeftIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  LoaderIcon,
  SparklesIcon,
  LinkIcon,
  EditIcon,
  EyeIcon,
  ZapIcon,
  XIcon,
  TagIcon,
  ImageIcon,
  ArrowLeftIcon
} from 'lucide-react';
import { useEvermarksState } from '../hooks/useEvermarkState';
import { type CreateEvermarkInput, type EvermarkMetadata, type CreateEvermarkResult } from '../types';
import { FarcasterService } from '../services/FarcasterService';
import { ReadmeService } from '../services/ReadmeService';
import { ISBNService } from '../services/ISBNService';
import { DOIService } from '../services/DOIService';
import { useAppAuth } from '@/providers/AppContext';
import { useUserForEvermarks } from '@/providers/IntegratedUserProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/utils/responsive';

// Import test functions for debugging
import '../services/__tests__/metadata-services.test';
import '../services/debug-services';

// Content types configuration with identifier placeholders
const CONTENT_TYPES = [
  { 
    value: 'ISBN', 
    label: 'Published Book', 
    icon: '📚', 
    description: 'Traditional book with ISBN',
    placeholder: '978-3-16-148410-0',
    identifierLabel: 'ISBN',
    identifierType: 'text' as const
  },
  { 
    value: 'README', 
    label: 'NFT Book', 
    icon: '📖', 
    description: 'Decentralized book from PageDAO',
    placeholder: 'https://opensea.io/assets/...',
    identifierLabel: 'Book NFT URL',
    identifierType: 'url' as const
  },
  { 
    value: 'DOI', 
    label: 'Academic Paper', 
    icon: '📄', 
    description: 'Research paper with DOI',
    placeholder: '10.1234/example.doi or https://doi.org/10.xxxx/xxxxx',
    identifierLabel: 'DOI',
    identifierType: 'text' as const
  },
  { 
    value: 'URL', 
    label: 'Web Content', 
    icon: '🌐', 
    description: 'Content from any website',
    placeholder: 'https://example.com/article',
    identifierLabel: 'Content URL',
    identifierType: 'url' as const
  },
  { 
    value: 'Cast', 
    label: 'Farcaster Cast', 
    icon: '🎭', 
    description: 'Social media post from Farcaster',
    placeholder: 'https://warpcast.com/username/0x12345678',
    identifierLabel: 'Cast URL',
    identifierType: 'url' as const
  },
  { 
    value: 'Custom', 
    label: 'Custom Content', 
    icon: '✨', 
    description: 'Create from scratch without a source',
    placeholder: '',
    identifierLabel: '',
    identifierType: 'none' as const,
    skipIdentifier: true // Flag to skip step 2 for custom content
  }
] as const;

interface WizardStep {
  id: string;
  number: number;
  title: string;
  icon: React.ReactNode;
  description: string;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'content-type',
    number: 1,
    title: 'Content Type',
    icon: <SparklesIcon className="h-5 w-5" />,
    description: 'What are you preserving?'
  },
  {
    id: 'identifier',
    number: 2,
    title: 'Identifier',
    icon: <LinkIcon className="h-5 w-5" />,
    description: 'Enter unique identifier'
  },
  {
    id: 'metadata',
    number: 3,
    title: 'Metadata',
    icon: <EditIcon className="h-5 w-5" />,
    description: 'Review & edit details'
  },
  {
    id: 'preview',
    number: 4,
    title: 'Preview',
    icon: <EyeIcon className="h-5 w-5" />,
    description: 'Final review'
  }
];

interface CreateEvermarkWizardProps {
  onSuccess?: (result: CreateEvermarkResult) => void;
  onCancel?: () => void;
  className?: string;
}

export function CreateEvermarkWizard({ 
  onSuccess, 
  onCancel, 
  className = '' 
}: CreateEvermarkWizardProps) {
  const navigate = useNavigate();
  const { user } = useAppAuth();
  const { isDark } = useTheme();
  const { hasWallet, canCreate } = useUserForEvermarks();
  
  const { 
    createEvermark, 
    isCreating, 
    createError, 
    createProgress,
    createStep,
    clearCreateError 
  } = useEvermarksState();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [autoDetectError, setAutoDetectError] = useState<string | null>(null);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [hasAutoFetched, setHasAutoFetched] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    sourceUrl: '',
    contentType: '' as EvermarkMetadata['contentType']
  });
  
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [castData, setCastData] = useState<any>(null);
  const [readmeData, setReadmeData] = useState<any>(null);
  const [castImagePreview, setCastImagePreview] = useState<string | null>(null);
  const [isGeneratingCastImage, setIsGeneratingCastImage] = useState(false);

  const getAuthor = useCallback(() => {
    return user?.displayName || user?.username || 'Unknown Author';
  }, [user]);

  // Generate cast image preview for Cast content type
  const generateCastImagePreview = useCallback(async () => {
    if (formData.contentType !== 'Cast' || isGeneratingCastImage || !formData.sourceUrl.trim()) {
      return;
    }

    // Use either form content or cast data content
    const contentText = formData.content.trim() || castData?.content || '';
    if (!contentText) {
      console.log('⏸️ Skipping cast preview - no content available yet');
      return;
    }

    try {
      setIsGeneratingCastImage(true);
      console.log('🎨 Generating cast preview with content:', `${contentText.substring(0, 50)}...`);
      
      // Create mock evermark data for preview generation
      const mockEvermarkData = {
        token_id: 9999, // Mock token ID for preview
        title: formData.title || 'Untitled Cast',
        description: formData.description,
        content: contentText,
        metadata_json: JSON.stringify({
          contentType: 'Cast',
          sourceUrl: formData.sourceUrl,
          cast: {
            text: contentText,
            author_username: castData?.username || 'unknown',
            author_display_name: castData?.author || 'Unknown Author',
            author_pfp: castData?.author_pfp,
            likes: castData?.engagement?.likes || 0,
            recasts: castData?.engagement?.recasts || 0,
            replies: castData?.engagement?.replies || 0,
            timestamp: castData?.timestamp,
            hash: castData?.castHash,
            channel: castData?.channel,
            embeds: castData?.embeds || []
          },
          author: getAuthor(),
          tags: tags
        })
      };

      // Call the cast image generation endpoint
      const response = await fetch('/.netlify/functions/generate-cast-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEvermarkData)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.imageUrl) {
          setCastImagePreview(result.imageUrl);
        }
      } else {
        console.warn('Cast image generation failed:', response.status);
      }
    } catch (error) {
      console.error('Cast image preview generation failed:', error);
    } finally {
      setIsGeneratingCastImage(false);
    }
  }, [formData.contentType, formData.sourceUrl, formData.title, formData.description, formData.content, getAuthor, castData, tags]);

  // Get current content type config
  const currentContentType = CONTENT_TYPES.find(t => t.value === formData.contentType);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Auto-generate cast image when Cast fields change
  useEffect(() => {
    if (formData.contentType === 'Cast' && formData.sourceUrl.trim()) {
      // Generate preview when we have URL, even if content is still loading
      const timeoutId = setTimeout(() => {
        generateCastImagePreview();
      }, 1000); // Debounce to avoid too many API calls
      
      return () => clearTimeout(timeoutId);
    } else {
      setCastImagePreview(null);
    }
  }, [formData.contentType, formData.sourceUrl, formData.content, castData, generateCastImagePreview]);

  // Auto-fetch metadata when identifier is entered
  const handleAutoFetch = useCallback(async (url: string) => {
    console.log('🔍 handleAutoFetch called with:', { url, contentType: formData.contentType, hasAutoFetched });
    
    if (!url || hasAutoFetched) {
      console.log('⏭️ Skipping auto-fetch:', { noUrl: !url, alreadyFetched: hasAutoFetched });
      return;
    }
    
    try {
      setIsAutoDetecting(true);
      setAutoDetectError(null);
      setHasAutoFetched(true);
      
      console.log('🚀 Starting auto-fetch for content type:', formData.contentType);
    console.log('🔍 Content type exact match check:', {
      contentType: formData.contentType,
      isREADME: formData.contentType === 'README',
      isCast: formData.contentType === 'Cast',
      isISBN: formData.contentType === 'ISBN',
      isDOI: formData.contentType === 'DOI'
    });
      
      // Check for README books
      if (formData.contentType === 'README' && ReadmeService.isReadmeBook(url)) {
        const readmeMetadata = await ReadmeService.fetchReadmeMetadata(url);
        
        if (readmeMetadata) {
          setReadmeData(readmeMetadata);
          setFormData(prev => ({ 
            ...prev, 
            title: ReadmeService.generateEvermarkTitle(readmeMetadata.readmeData),
            description: ReadmeService.generateEvermarkDescription(readmeMetadata.readmeData),
            sourceUrl: url
          }));
          
          if (readmeMetadata.image) {
            setImagePreview(readmeMetadata.image);
          }
          
          // Auto-advance to metadata step
          setCompletedSteps(prev => new Set([...prev, 1]));
          setCurrentStep(2);
        } else {
          throw new Error('Failed to fetch README book metadata');
        }
      } 
      // Check for Farcaster casts
      else if (formData.contentType === 'Cast') {
        console.log('🎭 Starting Farcaster cast fetch for:', url);
        const castMetadata = await FarcasterService.fetchCastMetadata(url);
        
        if (castMetadata) {
          setCastData(castMetadata);
          setFormData(prev => ({ 
            ...prev, 
            title: `Cast by ${castMetadata.author}`,
            description: castMetadata.content || '', // Full cast text for searchability
            content: castMetadata.content || '',
            sourceUrl: url
          }));
          
          // Auto-advance to metadata step
          setCompletedSteps(prev => new Set([...prev, 1]));
          setCurrentStep(2);
        } else {
          throw new Error('Failed to fetch Farcaster cast data');
        }
      }
      // ISBN books
      else if (formData.contentType === 'ISBN') {
        console.log('📚 Starting ISBN fetch for:', url);
        
        try {
          const bookMetadata = await ISBNService.fetchBookMetadata(url);
          console.log('📚 ISBN Service returned:', bookMetadata);
          
          if (bookMetadata) {
            console.log('✅ ISBN metadata found, updating form data...');
            
            const newTitle = ISBNService.generateEvermarkTitle(bookMetadata);
            const newDescription = ISBNService.generateEvermarkDescription(bookMetadata);
            const generatedTags = ISBNService.generateTags(bookMetadata);
            
            console.log('📚 Generated data:', {
              title: newTitle,
              description: newDescription.substring(0, 100) + '...',
              tags: generatedTags,
              hasImage: !!bookMetadata.imageUrl
            });
            
            setFormData(prev => {
              const updated = { 
                ...prev, 
                title: newTitle,
                description: newDescription,
                sourceUrl: `ISBN: ${bookMetadata.isbn}`
              };
              console.log('📝 Setting form data:', updated);
              return updated;
            });
            
            // Set cover image if available
            if (bookMetadata.imageUrl) {
              console.log('🖼️ Setting image preview:', bookMetadata.imageUrl);
              setImagePreview(bookMetadata.imageUrl);
            }
            
            // Set tags
            console.log('🏷️ Setting tags:', generatedTags);
            setTags(generatedTags);
            
            // Auto-advance to metadata step
            console.log('➡️ Auto-advancing to metadata step');
            setCompletedSteps(prev => new Set([...prev, 1]));
            setCurrentStep(2);
            
            console.log('✅ ISBN processing complete!');
          } else {
            console.log('⚠️ ISBN Service returned null, using fallback');
            
            // Fallback if lookup fails
            setFormData(prev => ({ 
              ...prev, 
              title: `Book (ISBN: ${url})`,
              description: `Published book with ISBN ${url}`,
              sourceUrl: `ISBN: ${url}`
            }));
            
            // Still advance to allow manual editing
            setCompletedSteps(prev => new Set([...prev, 1]));
            setCurrentStep(2);
          }
        } catch (isbnError) {
          console.error('❌ ISBN fetch threw error:', isbnError);
          throw isbnError; // Re-throw to be caught by outer try-catch
        }
      }
      // Academic papers with DOI
      else if (formData.contentType === 'DOI') {
        console.log('📄 Starting DOI fetch for:', url);
        
        try {
          const paperMetadata = await DOIService.fetchPaperMetadata(url);
          console.log('📄 DOI Service returned:', paperMetadata);
          
          if (paperMetadata) {
            console.log('✅ DOI metadata found, updating form data...');
            
            const newTitle = DOIService.generateEvermarkTitle(paperMetadata);
            const newDescription = DOIService.generateEvermarkDescription(paperMetadata);
            const generatedTags = DOIService.generateTags(paperMetadata);
            const sourceUrl = paperMetadata.url || `https://doi.org/${paperMetadata.doi}`;
            
            console.log('📄 Generated data:', {
              title: newTitle,
              description: newDescription.substring(0, 100) + '...',
              tags: generatedTags,
              sourceUrl
            });
            
            setFormData(prev => {
              const updated = { 
                ...prev, 
                title: newTitle,
                description: newDescription,
                sourceUrl
              };
              console.log('📝 Setting DOI form data:', updated);
              return updated;
            });
            
            // Set tags
            console.log('🏷️ Setting DOI tags:', generatedTags);
            setTags(generatedTags);
            
            // Auto-advance to metadata step
            console.log('➡️ Auto-advancing DOI to metadata step');
            setCompletedSteps(prev => new Set([...prev, 1]));
            setCurrentStep(2);
            
            console.log('✅ DOI processing complete!');
          } else {
            console.log('⚠️ DOI Service returned null, using fallback');
            
            // Fallback if lookup fails
            let doiUrl = url;
            if (!url.startsWith('http')) {
              doiUrl = `https://doi.org/${url}`;
            }
            
            setFormData(prev => ({ 
              ...prev, 
              title: 'Academic Paper',
              description: `Research paper with DOI: ${url}`,
              sourceUrl: doiUrl
            }));
            
            // Still advance to allow manual editing
            setCompletedSteps(prev => new Set([...prev, 1]));
            setCurrentStep(2);
          }
        } catch (doiError) {
          console.error('❌ DOI fetch threw error:', doiError);
          throw doiError; // Re-throw to be caught by outer try-catch
        }
      }
      // Generic URL - fetch metadata via server function
      else if (formData.contentType === 'URL') {
        console.log('🌐 Starting URL metadata fetch for:', url);
        
        try {
          // Fetch metadata via Netlify function to avoid CORS
          const response = await fetch(`/.netlify/functions/web-metadata?url=${encodeURIComponent(url)}`);
          
          if (response.ok) {
            const { metadata } = await response.json();
            console.log('✅ URL metadata found:', metadata);
            
            // Build title and description from metadata
            let title = metadata.title || 'Web Content';
            if (metadata.author && metadata.author !== metadata.domain) {
              title = `${title} by ${metadata.author}`;
            } else if (metadata.publication) {
              title = `${title} - ${metadata.publication}`;
            }
            
            let description = metadata.description || `Content from ${metadata.domain}`;
            if (metadata.publishedDate) {
              description += ` (${new Date(metadata.publishedDate).toLocaleDateString()})`;
            }
            
            setFormData(prev => ({ 
              ...prev, 
              title,
              description,
              sourceUrl: url
            }));
            
            // Set appropriate tags based on domain/publication
            const urlTags: string[] = ['article'];
            if (metadata.publication) {
              urlTags.push(metadata.publication.toLowerCase().replace(/\s+/g, '-'));
            }
            if (metadata.publishedDate) {
              const year = new Date(metadata.publishedDate).getFullYear();
              urlTags.push(year.toString());
            }
            setTags(urlTags);
            
          } else {
            console.warn('⚠️ URL metadata fetch failed, using fallback');
            // Fallback to basic domain extraction
            const domain = new URL(url).hostname.replace('www.', '');
            setFormData(prev => ({ 
              ...prev, 
              title: `Content from ${domain}`,
              description: `Web content from ${url}`,
              sourceUrl: url
            }));
          }
        } catch (error) {
          console.error('❌ URL metadata fetch error:', error);
          // Fallback to basic domain extraction
          const domain = new URL(url).hostname.replace('www.', '');
          setFormData(prev => ({ 
            ...prev, 
            title: `Content from ${domain}`,
            description: `Web content from ${url}`,
            sourceUrl: url
          }));
        }
        
        // Auto-advance to metadata step
        setCompletedSteps(prev => new Set([...prev, 1]));
        setCurrentStep(2);
      }
      
    } catch (error) {
      console.error('❌ Auto-fetch failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch content metadata';
      setAutoDetectError(`${formData.contentType} lookup failed: ${errorMessage}`);
    } finally {
      console.log('🏁 Auto-fetch complete, setting isAutoDetecting to false');
      setIsAutoDetecting(false);
    }
  }, [formData.contentType, hasAutoFetched]);

  // Step navigation
  const handleGoToStep = useCallback((stepIndex: number) => {
    // For Custom content type, skip step 2 (identifier)
    if (formData.contentType === 'Custom' && stepIndex === 1) {
      return;
    }
    
    // Allow navigation to any previous step or completed steps
    if (stepIndex <= currentStep || completedSteps.has(stepIndex - 1)) {
      setCurrentStep(stepIndex);
      
      // Reset auto-fetch flag when going back to identifier step
      if (stepIndex === 1) {
        setHasAutoFetched(false);
      }
    }
  }, [currentStep, completedSteps, formData.contentType]);

  const handleNextStep = useCallback(() => {
    // Mark current step as completed
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    
    // For Custom content, skip from step 1 to step 3
    if (formData.contentType === 'Custom' && currentStep === 0) {
      setCurrentStep(2);
    } else if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, formData.contentType]);

  const handlePreviousStep = useCallback(() => {
    // For Custom content, skip from step 3 back to step 1
    if (formData.contentType === 'Custom' && currentStep === 2) {
      setCurrentStep(0);
    } else if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep, formData.contentType]);

  // Field handlers
  const handleFieldChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    clearCreateError();
    setAutoDetectError(null);
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

  // Image handling
  const handleImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const maxSize = 25 * 1024 * 1024; // 25MB
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      
      if (!allowedTypes.includes(file.type)) {
        console.error('Invalid file type');
        return;
      }
      
      if (file.size > maxSize) {
        console.error('File too large');
        return;
      }
      
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
      
      const previewUrl = URL.createObjectURL(file);
      setSelectedImage(file);
      setImagePreview(previewUrl);
    }
  }, [imagePreview]);

  const handleRemoveImage = useCallback(() => {
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setSelectedImage(null);
    setImagePreview(null);
  }, [imagePreview]);

  // Form validation
  const isStepValid = useCallback((stepIndex: number) => {
    switch (stepIndex) {
      case 0: // Content Type
        return !!formData.contentType;
      case 1: // Identifier
        return formData.sourceUrl.trim().length > 0 || formData.contentType === 'Custom';
      case 2: // Metadata
        return formData.title.trim().length > 0 && formData.description.trim().length > 0;
      case 3: // Preview
        return formData.title.trim().length > 0 && formData.description.trim().length > 0;
      default:
        return false;
    }
  }, [formData]);

  // Form submission
  const handleSubmit = useCallback(async () => {
    if (isCreating || !hasWallet) return;

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
    hasWallet,
    formData, 
    getAuthor, 
    tags, 
    selectedImage,
    createEvermark, 
    onSuccess, 
    navigate
  ]);

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Step 1: Content Type Selection
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-3">What are you preserving?</h2>
              <p className="text-gray-400 text-lg">Choose the type of content you want to save forever</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
              {CONTENT_TYPES.map((type) => (
                <button
                  key={`wizard-${type.value}`}
                  type="button"
                  onClick={() => {
                    handleFieldChange('contentType', type.value);
                    handleNextStep();
                  }}
                  className={cn(
                    "p-6 rounded-xl border-2 transition-all text-left hover:scale-105 group",
                    formData.contentType === type.value
                      ? "border-green-400 bg-green-900/30 shadow-lg shadow-green-400/20"
                      : "border-gray-700 bg-gray-900/50 hover:border-gray-600 hover:bg-gray-800/50"
                  )}
                >
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-3xl">{type.icon}</span>
                    <span className="font-semibold text-xl text-white group-hover:text-green-400 transition-colors">
                      {type.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{type.description}</p>
                </button>
              ))}
            </div>
          </div>
        );

      case 1: // Step 2: Unique Identifier
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-3">Enter the unique identifier</h2>
              <p className="text-gray-400 text-lg">
                Provide the {currentContentType?.identifierLabel || 'URL'} and we'll fetch the metadata
              </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              <div>
                <label className="block text-sm font-medium text-cyan-400 mb-3">
                  {currentContentType?.identifierLabel} *
                </label>
                <div className="relative">
                  <input
                    type={currentContentType?.identifierType === 'url' ? 'url' : 'text'}
                    value={formData.sourceUrl}
                    onChange={(e) => handleFieldChange('sourceUrl', e.target.value)}
                    onBlur={(e) => {
                      console.log('📝 Input onBlur triggered with value:', e.target.value);
                      if (e.target.value) {
                        handleAutoFetch(e.target.value);
                      }
                    }}
                    onKeyPress={(e) => {
                      console.log('⌨️ Key pressed:', e.key);
                      if (e.key === 'Enter' && formData.sourceUrl) {
                        e.preventDefault();
                        handleAutoFetch(formData.sourceUrl);
                      }
                    }}
                    placeholder={currentContentType?.placeholder}
                    className="w-full px-5 py-4 bg-gray-800 border-2 border-gray-600 text-white rounded-xl focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 text-lg pr-12"
                    autoFocus
                  />
                  {isAutoDetecting && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <LoaderIcon className="h-5 w-5 animate-spin text-cyan-400" />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-500">
                    Press Enter or Tab to auto-fetch metadata
                  </p>
                  {formData.sourceUrl && !isAutoDetecting && (
                    <button
                      type="button"
                      onClick={() => handleAutoFetch(formData.sourceUrl)}
                      className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors flex items-center gap-1"
                    >
                      <ZapIcon className="h-3 w-3" />
                      Fetch Now
                    </button>
                  )}
                </div>
              </div>

              {autoDetectError && (
                <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircleIcon className="h-5 w-5 text-red-400 mt-0.5" />
                    <div>
                      <p className="text-red-400 font-medium">Failed to fetch metadata</p>
                      <p className="text-red-300 text-sm mt-1">{autoDetectError}</p>
                      <p className="text-red-300 text-xs mt-2">You can still proceed and enter details manually</p>
                    </div>
                  </div>
                </div>
              )}

              {(castData || readmeData) && (
                <div className="p-4 bg-green-900/30 border border-green-500/50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <CheckCircleIcon className="h-5 w-5 text-green-400 mt-0.5" />
                    <div>
                      <p className="text-green-400 font-medium">Metadata fetched successfully!</p>
                      <p className="text-green-300 text-sm mt-1">
                        We've populated the title and description. You can edit them in the next step.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                  Back
                </button>
                
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={!formData.sourceUrl.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-black font-medium rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        );

      case 2: // Step 3: Metadata Review & Edit
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-3">Review & edit metadata</h2>
              <p className="text-gray-400 text-lg">
                {hasAutoFetched ? 'We fetched this information. Feel free to edit it.' : 'Add details about your content'}
              </p>
            </div>

            <div className="max-w-3xl mx-auto space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left column - Text fields */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-cyan-400 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleFieldChange('title', e.target.value)}
                      placeholder="Enter a descriptive title..."
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-600 text-white rounded-lg focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                      maxLength={100}
                    />
                    <div className="text-xs text-gray-500 text-right mt-1">
                      {formData.title.length}/100
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-cyan-400 mb-2">
                      Description *
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleFieldChange('description', e.target.value)}
                      placeholder="Describe this content..."
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-600 text-white rounded-lg focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 resize-none"
                      rows={5}
                      maxLength={500}
                    />
                    <div className="text-xs text-gray-500 text-right mt-1">
                      {formData.description.length}/500
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium text-cyan-400 mb-2">
                      Tags (Optional)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                        placeholder="Add tags..."
                        disabled={tags.length >= 10}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleAddTag}
                        disabled={!tagInput.trim() || tags.length >= 10}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        <TagIcon className="h-4 w-4" />
                      </button>
                    </div>
                    
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full bg-purple-900/30 text-purple-300 border border-purple-500/30 text-xs"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="ml-1 text-purple-400 hover:text-purple-200"
                            >
                              <XIcon className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500 mt-1">
                      {tags.length}/10 tags
                    </p>
                  </div>
                </div>

                {/* Right column - Image upload */}
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-cyan-400 mb-2">
                    {formData.contentType === 'Cast' ? 'Generated Cast Preview' : 'Cover Image (Optional)'}
                  </label>
                  
                  {/* Show cast image preview for casts */}
                  {formData.contentType === 'Cast' && castImagePreview && (
                    <div className="relative">
                      <img
                        src={castImagePreview}
                        alt="Cast preview"
                        className="w-full h-64 object-contain rounded-lg bg-gray-100"
                      />
                      {isGeneratingCastImage && (
                        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                          <span className="text-cyan-400 text-sm">Generating preview...</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Show image upload for non-cast types or when no cast image is available */}
                  {formData.contentType !== 'Cast' && !imagePreview ? (
                    <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center h-64 flex flex-col items-center justify-center">
                      <input
                        type="file"
                        id="image-upload"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <label
                        htmlFor="image-upload"
                        className="cursor-pointer flex flex-col items-center"
                      >
                        <ImageIcon className="h-12 w-12 text-gray-400 mb-4" />
                        <span className="text-gray-300 mb-2">Click to upload</span>
                        <span className="text-xs text-gray-500">PNG, JPG, GIF up to 25MB</span>
                      </label>
                    </div>
                  ) : formData.contentType !== 'Cast' && imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-64 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors"
                      >
                        <XIcon className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  ) : formData.contentType === 'Cast' && !castImagePreview ? (
                    <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center h-64 flex flex-col items-center justify-center">
                      <div className="text-cyan-400 text-center">
                        <svg className="h-12 w-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-gray-300 mb-2">Cast preview will appear here</span>
                        <span className="text-xs text-gray-500">Generated automatically from cast content</span>
                      </div>
                    </div>
                  ) : null}
                  
                  {castData && (
                    <div className="p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                      <p className="text-xs text-purple-300">
                        <span className="font-medium">Cast metadata:</span> {castData.engagement?.likes || 0} likes, {castData.engagement?.recasts || 0} recasts
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center pt-6 border-t border-gray-800">
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                  Back
                </button>
                
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={!isStepValid(2)}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-black font-medium rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Review
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        );

      case 3: // Step 4: Final Preview
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-3">Review your evermark</h2>
              <p className="text-gray-400 text-lg">
                Everything look good? You can go back to any step to make changes.
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              {/* Quick navigation buttons */}
              <div className="flex flex-wrap gap-2 mb-6 justify-center">
                <button
                  onClick={() => handleGoToStep(0)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Change content type
                </button>
                {formData.contentType !== 'Custom' && (
                  <button
                    onClick={() => handleGoToStep(1)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Change identifier
                  </button>
                )}
                <button
                  onClick={() => handleGoToStep(2)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Edit metadata
                </button>
              </div>

              {/* Preview card */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-8 shadow-2xl">
                {/* Content type badge */}
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">{currentContentType?.icon}</span>
                  <span className="text-lg font-medium text-cyan-400">{currentContentType?.label}</span>
                </div>

                {/* Title and description */}
                <h3 className="text-2xl font-bold text-white mb-3">{formData.title || "Untitled"}</h3>
                <p className="text-gray-300 text-lg leading-relaxed mb-6">
                  {formData.description || "No description provided"}
                </p>

                {/* Source URL */}
                {formData.sourceUrl && (
                  <div className="mb-6">
                    <p className="text-sm text-gray-500 mb-1">Source</p>
                    <p className="text-blue-400 text-sm truncate">{formData.sourceUrl}</p>
                  </div>
                )}

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm text-gray-500 mb-2">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag, index) => (
                        <span
                          key={index}
                          className="text-xs bg-purple-900/30 text-purple-300 px-3 py-1 rounded-full border border-purple-500/30"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cover image - show cast image preview for casts, uploaded image for others */}
                {(imagePreview || (formData.contentType === 'Cast' && castImagePreview)) && (
                  <div className="mb-6">
                    <p className="text-sm text-gray-500 mb-2">
                      {formData.contentType === 'Cast' && castImagePreview ? 'Generated Cast Preview' : 'Cover Image'}
                      {formData.contentType === 'Cast' && isGeneratingCastImage && (
                        <span className="ml-2 text-cyan-400 text-xs">Generating...</span>
                      )}
                    </p>
                    <img
                      src={castImagePreview || imagePreview || ''}
                      alt={formData.contentType === 'Cast' ? 'Cast preview' : 'Cover'}
                      className={`w-full rounded-lg ${formData.contentType === 'Cast' && castImagePreview 
                        ? 'h-48 object-contain bg-gray-100' 
                        : 'h-48 object-cover'}`}
                    />
                  </div>
                )}

                {/* Author */}
                <div className="pt-6 border-t border-gray-700">
                  <p className="text-sm text-gray-500">
                    Created by <span className="text-gray-400">{getAuthor()}</span>
                  </p>
                </div>
              </div>

              {/* Wallet warning */}
              {!hasWallet && (
                <div className="mt-6 p-4 bg-amber-900/30 border border-amber-500/50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircleIcon className="h-5 w-5 text-amber-400 mt-0.5" />
                    <div>
                      <p className="text-amber-400 font-medium">Wallet Connection Required</p>
                      <p className="text-amber-300 text-sm mt-1">
                        Please connect your wallet from the navigation bar to create evermarks.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error display */}
              {createError && (
                <div className="mt-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircleIcon className="h-5 w-5 text-red-400 mt-0.5" />
                    <div>
                      <p className="text-red-400 font-medium">Error</p>
                      <p className="text-red-300 text-sm mt-1">{createError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-between items-center mt-8">
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                  Back to editing
                </button>
                
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isCreating || !hasWallet || !isStepValid(3)}
                  className="px-8 py-4 bg-gradient-to-r from-green-400 to-green-600 hover:from-green-300 hover:to-green-500 text-black font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/30 text-lg"
                >
                  {isCreating ? (
                    <>
                      <LoaderIcon className="animate-spin h-6 w-6" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="h-6 w-6" />
                      Create Evermark
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Filter steps for Custom content type (skip identifier step)
  const visibleSteps = formData.contentType === 'Custom' 
    ? WIZARD_STEPS.filter(step => step.id !== 'identifier')
    : WIZARD_STEPS;

  return (
    <div className={cn(
      "min-h-screen",
      isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900",
      className
    )}>
      {/* Header with Progress */}
      <div className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-5xl mx-auto">
            {/* Progress Steps */}
            <div className="flex items-center justify-between mb-6">
              {visibleSteps.map((step, index) => {
                const actualStepIndex = WIZARD_STEPS.findIndex(s => s.id === step.id);
                const isActive = currentStep === actualStepIndex;
                const isCompleted = completedSteps.has(actualStepIndex);
                const isClickable = actualStepIndex <= currentStep || isCompleted;
                
                return (
                  <div
                    key={step.id}
                    className={cn(
                      "flex items-center",
                      isClickable ? "cursor-pointer" : "cursor-not-allowed"
                    )}
                    onClick={() => isClickable && handleGoToStep(actualStepIndex)}
                  >
                    <div className="flex items-center">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center transition-all font-bold text-lg",
                          isActive
                            ? "bg-gradient-to-r from-green-400 to-green-600 text-black shadow-lg shadow-green-500/30"
                            : isCompleted
                            ? "bg-green-600/30 text-green-400 border-2 border-green-500"
                            : "bg-gray-800 text-gray-500 border-2 border-gray-700"
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircleIcon className="h-6 w-6" />
                        ) : (
                          step.number
                        )}
                      </div>
                      <div className="ml-3 hidden sm:block">
                        <p className={cn(
                          "text-sm font-medium",
                          isActive ? "text-white" : "text-gray-500"
                        )}>
                          {step.title}
                        </p>
                        <p className="text-xs text-gray-600 hidden lg:block">
                          {step.description}
                        </p>
                      </div>
                    </div>
                    {index < visibleSteps.length - 1 && (
                      <div
                        className={cn(
                          "w-8 sm:w-16 lg:w-24 h-0.5 mx-2",
                          isCompleted ? "bg-green-500" : "bg-gray-700"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Creating Progress */}
          {isCreating && (
            <div className="mb-6 p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg">
              <div className="flex items-start">
                <LoaderIcon className="animate-spin h-5 w-5 text-blue-400 mr-3 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-blue-300">Creating Evermark...</p>
                  <p className="text-sm text-blue-400">{createStep}</p>
                  {createProgress > 0 && (
                    <div className="mt-2 bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-400 to-cyan-400 h-2 rounded-full transition-all"
                        style={{ width: `${createProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step Content */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 min-h-[500px]">
            {renderStepContent()}
          </div>
        </div>
      </div>
    </div>
  );
}