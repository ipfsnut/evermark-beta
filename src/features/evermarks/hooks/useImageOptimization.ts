import { useState, useEffect, useRef, useCallback } from 'react';
import { ImageHelpers } from '../utils/imageHelpers';

interface UseImageOptimizationOptions {
  lazy?: boolean;
  preload?: boolean;
  fallbackDelay?: number;
  retryAttempts?: number;
}

interface UseImageOptimizationResult {
  imageUrl: string | null;
  isLoading: boolean;
  hasError: boolean;
  loadImage: () => void;
  retryLoad: () => void;
}

export function useImageOptimization(
  evermark: {
    supabaseImageUrl?: string;
    thumbnailUrl?: string;
    processed_image_url?: string;
    ipfsHash?: string;
  },
  options: UseImageOptimizationOptions = {}
): UseImageOptimizationResult {
  const {
    lazy = true,
    preload = false,
    fallbackDelay = 2000,
    retryAttempts = 2
  } = options;

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Get image URLs in priority order
  const getImageUrls = useCallback((): string[] => {
    const urls: string[] = [];
    
    if (evermark.supabaseImageUrl) urls.push(evermark.supabaseImageUrl);
    if (evermark.processed_image_url) urls.push(evermark.processed_image_url);
    if (evermark.ipfsHash) urls.push(`https://gateway.pinata.cloud/ipfs/${evermark.ipfsHash}`);
    
    return urls;
  }, [evermark]);

  const loadImage = useCallback(async () => {
    const urls = getImageUrls();
    if (urls.length === 0) {
      setImageUrl(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    // Try URLs in priority order
    for (let i = 0; i < urls.length && i <= attempts; i++) {
      try {
        const url = urls[i];
        
        // Test if image loads
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Image load failed'));
          img
