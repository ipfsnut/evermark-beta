import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useActiveAccount } from 'thirdweb/react';
import { EvermarkService } from '../services/EvermarkService';
import type { CreateEvermarkInput, CreateEvermarkResult, EvermarkMetadata } from '../types';

interface UseEvermarkCreateResult {
  // Creation state
  isCreating: boolean;
  createError: string | null;
  createProgress: number;
  createStep: string;
  
  // Form state
  formData: Partial<EvermarkMetadata>;
  selectedImage: File | null;
  imagePreview: string | null;
  
  // Actions
  createEvermark: (input: CreateEvermarkInput) => Promise<CreateEvermarkResult>;
  updateFormData: (data: Partial<EvermarkMetadata>) => void;
  setSelectedImage: (file: File | null) => void;
  setImagePreview: (url: string | null) => void;
  resetForm: () => void;
  clearError: () => void;
  
  // Validation
  validateForm: () => { isValid: boolean; errors: string[] };
  isFormValid: boolean;
}

const initialFormData: Partial<EvermarkMetadata> = {
  title: '',
  description: '',
  sourceUrl: '',
  author: '',
  tags: [],
  contentType: 'Custom',
  customFields: []
};

export function useEvermarkCreate(): UseEvermarkCreateResult {
  // Get the active account for blockchain operations
  const account = useActiveAccount();
  
  // Form state
  const [formData, setFormData] = useState<Partial<EvermarkMetadata>>(initialFormData);
  const [selectedImage, setSelectedImageState] = useState<File | null>(null);
  const [imagePreview, setImagePreviewState] = useState<string | null>(null);
  
  // Progress tracking
  const [createProgress, setCreateProgress] = useState(0);
  const [createStep, setCreateStep] = useState('');

  // Creation mutation
  const createMutation = useMutation({
    mutationFn: async (input: CreateEvermarkInput) => {
      // Check if we have an account before starting creation
      if (!account) {
        throw new Error('No wallet connected. Please connect your wallet to create an Evermark.');
      }

      setCreateProgress(0);
      setCreateStep('Validating metadata...');
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setCreateProgress(prev => Math.min(prev + 10, 90));
      }, 500);
      
      try {
        // Pass the account to the service
        const result = await EvermarkService.createEvermark(input, account);
        
        if (result.success) {
          setCreateProgress(100);
          setCreateStep('Evermark created successfully!');
        }
        
        clearInterval(progressInterval);
        return result;
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
    },
    onSuccess: () => {
      // Reset form after successful creation
      setTimeout(() => {
        resetForm();
        setCreateProgress(0);
        setCreateStep('');
      }, 2000);
    },
    onError: (error) => {
      console.error('Create evermark error:', error);
      setCreateStep('Creation failed');
      setCreateProgress(0);
    }
  });

  // Actions
  const updateFormData = useCallback((data: Partial<EvermarkMetadata>) => {
    setFormData(prev => ({ ...prev, ...data }));
  }, []);

  const setSelectedImage = useCallback((file: File | null) => {
    setSelectedImageState(file);
    
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviewState(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreviewState(null);
    }
  }, []);

  const setImagePreview = useCallback((url: string | null) => {
    setImagePreviewState(url);
  }, []);

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setSelectedImageState(null);
    setImagePreviewState(null);
    setCreateProgress(0);
    setCreateStep('');
  }, []);

  const clearError = useCallback(() => {
    createMutation.reset();
  }, [createMutation]);

  const validateForm = useCallback(() => {
    const errors: string[] = [];
    
    if (!formData.title?.trim()) {
      errors.push('Title is required');
    }
    
    if (!formData.description?.trim()) {
      errors.push('Description is required');
    }
    
    if (!formData.author?.trim()) {
      errors.push('Author is required');
    }
    
    if (formData.sourceUrl && formData.sourceUrl.trim()) {
      try {
        new URL(formData.sourceUrl);
      } catch {
        errors.push('Source URL must be a valid URL');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }, [formData]);

  const isFormValid = validateForm().isValid;

  const createEvermark = useCallback(async (input: CreateEvermarkInput) => {
    return createMutation.mutateAsync(input);
  }, [createMutation]);

  const createError = createMutation.error instanceof Error 
    ? createMutation.error.message 
    : (createMutation.error ? String(createMutation.error) : null);

  return {
    // Creation state
    isCreating: createMutation.isPending,
    createError,
    createProgress,
    createStep,
    
    // Form state
    formData,
    selectedImage,
    imagePreview,
    
    // Actions
    createEvermark,
    updateFormData,
    setSelectedImage,
    setImagePreview,
    resetForm,
    clearError,
    
    // Validation
    validateForm,
    isFormValid
  };
}