// React hook for smart image resolution
import { useState, useEffect } from 'react';
import { resolveImageUrl, resolveThumbnailUrl, type ImageResolution } from '../lib/images/resolver';

interface UseImageResolverResult {
  imageUrl?: string;
  thumbnailUrl?: string;
  isLoading: boolean;
  error?: string;
  source?: 'supabase' | 'pinata' | 'ipfs' | 'fallback';
  isCached: boolean;
}

export function useImageResolver(
  tokenId: number,
  ipfsHash?: string,
  originalUrl?: string,
  options?: {
    preferThumbnail?: boolean;
    autoLoad?: boolean;
    contentType?: string; // New: for auto-generation logic
    autoGenerate?: boolean; // New: enable auto-generation
  }
): UseImageResolverResult {
  const [state, setState] = useState<UseImageResolverResult>({
    isLoading: true,
    isCached: false
  });

  const { 
    preferThumbnail = false, 
    autoLoad = true, 
    contentType, 
    autoGenerate = true 
  } = options || {};

  useEffect(() => {
    if (!autoLoad || !tokenId) return;

    let isMounted = true;

    const loadImage = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: undefined }));

        let resolution: ImageResolution;
        
        if (preferThumbnail) {
          resolution = await resolveThumbnailUrl(tokenId, ipfsHash, originalUrl);
        } else {
          resolution = await resolveImageUrl(tokenId, ipfsHash, originalUrl);
        }

        // If no image found and it's a Cast, try to auto-generate
        if (resolution.source === 'fallback' && 
            contentType === 'Cast' && 
            autoGenerate && 
            isMounted) {
          
          console.log(`🎨 Auto-generating image for Cast evermark ${tokenId}`);
          
          try {
            const generateResponse = await fetch('/.netlify/functions/generate-cast-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token_id: tokenId })
            });
            
            if (generateResponse.ok) {
              // Re-resolve after generation
              resolution = await resolveImageUrl(tokenId, ipfsHash, originalUrl);
              console.log(`✅ Cast image generated successfully for ${tokenId}`);
            }
          } catch (genError) {
            console.warn('Cast image generation failed:', genError);
            // Continue with fallback - don't throw error
          }
        }

        if (isMounted) {
          setState({
            imageUrl: resolution.url,
            thumbnailUrl: preferThumbnail ? resolution.url : undefined,
            isLoading: false,
            source: resolution.source,
            isCached: resolution.cached
          });
        }
      } catch (error) {
        if (isMounted) {
          setState({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to resolve image',
            isCached: false
          });
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [tokenId, ipfsHash, originalUrl, preferThumbnail, autoLoad, contentType, autoGenerate]);

  return state;
}

/**
 * Hook for preloading both main image and thumbnail
 */
export function useImagePreloader(
  tokenId: number,
  ipfsHash?: string,
  originalUrl?: string
) {
  const [preloadState, setPreloadState] = useState({
    mainImageLoaded: false,
    thumbnailLoaded: false,
    isPreloading: false
  });

  const preload = async () => {
    setPreloadState(prev => ({ ...prev, isPreloading: true }));

    try {
      // Resolve and preload main image
      const mainResolution = await resolveImageUrl(tokenId, ipfsHash, originalUrl);
      const img = new Image();
      img.src = mainResolution.url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Resolve and preload thumbnail
      const thumbResolution = await resolveThumbnailUrl(tokenId, ipfsHash, originalUrl);
      const thumb = new Image();
      thumb.src = thumbResolution.url;
      await new Promise((resolve, reject) => {
        thumb.onload = resolve;
        thumb.onerror = reject;
      });

      setPreloadState({
        mainImageLoaded: true,
        thumbnailLoaded: true,
        isPreloading: false
      });
    } catch (error) {
      setPreloadState(prev => ({ ...prev, isPreloading: false }));
      console.warn('Image preload failed:', error);
    }
  };

  return {
    ...preloadState,
    preload
  };
}