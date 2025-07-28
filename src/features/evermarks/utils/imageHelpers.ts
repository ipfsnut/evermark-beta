
// =============================================================================
// SQL Commands for Manual Execution in Supabase Dashboard
// Copy these to Supabase SQL Editor if the function approach doesn't work
// =============================================================================

/*
-- 1. Add hybrid image storage columns
ALTER TABLE evermarks 
ADD COLUMN IF NOT EXISTS supabase_image_url TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS ipfs_image_hash TEXT,
ADD COLUMN IF NOT EXISTS image_file_size INTEGER,
ADD COLUMN IF NOT EXISTS image_dimensions TEXT;

-- 2. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_evermarks_supabase_images 
ON evermarks(supabase_image_url) WHERE supabase_image_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evermarks_image_processing 
ON evermarks(image_processing_status, image_processed_at);

-- 3. Update existing records to use supabase_image_url as primary
UPDATE evermarks 
SET supabase_image_url = processed_image_url 
WHERE processed_image_url IS NOT NULL 
  AND supabase_image_url IS NULL
  AND processed_image_url LIKE '%supabase%';

-- 4. Add helpful comments
COMMENT ON COLUMN evermarks.supabase_image_url IS 'Primary image URL stored in Supabase Storage for reliability';
COMMENT ON COLUMN evermarks.thumbnail_url IS 'Optimized thumbnail URL for list views and previews';
COMMENT ON COLUMN evermarks.ipfs_image_hash IS 'IPFS backup hash for decentralized storage';
COMMENT ON COLUMN evermarks.image_file_size IS 'Image file size in bytes for optimization tracking';
COMMENT ON COLUMN evermarks.image_dimensions IS 'Image dimensions as width,height for responsive display';
*/

// =============================================================================
// File: src/features/evermarks/utils/imageHelpers.ts
// NEW FILE - Utility functions for image handling
// =============================================================================

export class ImageHelpers {
  /**
   * Get responsive image URL based on viewport
   */
  static getResponsiveImageUrl(evermark: {
    supabaseImageUrl?: string;
    thumbnailUrl?: string;
    processed_image_url?: string;
    ipfsHash?: string;
  }, size: 'thumbnail' | 'standard' | 'full' = 'standard'): string | null {
    
    switch (size) {
      case 'thumbnail':
        return evermark.thumbnailUrl || 
               evermark.supabaseImageUrl || 
               evermark.processed_image_url ||
               (evermark.ipfsHash ? `https://gateway.pinata.cloud/ipfs/${evermark.ipfsHash}` : null);
               
      case 'full':
        return evermark.supabaseImageUrl || 
               evermark.processed_image_url ||
               (evermark.ipfsHash ? `https://gateway.pinata.cloud/ipfs/${evermark.ipfsHash}` : null);
               
      default: // standard
        return evermark.supabaseImageUrl || 
               evermark.processed_image_url ||
               (evermark.ipfsHash ? `https://gateway.pinata.cloud/ipfs/${evermark.ipfsHash}` : null);
    }
  }

  /**
   * Preload critical images for better UX
   */
  static preloadImages(evermarks: Array<{ supabaseImageUrl?: string; thumbnailUrl?: string }>): void {
    evermarks.slice(0, 5).forEach(evermark => {
      const url = evermark.thumbnailUrl || evermark.supabaseImageUrl;
      if (url) {
        const img = new Image();
                  img.src = url;
        });

        // Success - use this URL
        setImageUrl(url);
        setIsLoading(false);
        setHasError(false);
        return;

      } catch (error) {
        console.warn(`Image load failed for URL ${i + 1}:`, error);
        
        // If this was the last URL, set error state
        if (i === urls.length - 1 || i >= retryAttempts) {
          setHasError(true);
          setIsLoading(false);
          setImageUrl(null);
        }
      }
    }
  }, [getImageUrls, attempts, retryAttempts]);

  const retryLoad = useCallback(() => {
    if (attempts < retryAttempts) {
      setAttempts(prev => prev + 1);
      loadImage();
    }
  }, [attempts, retryAttempts, loadImage]);

  // Initial load or preload
  useEffect(() => {
    if (preload || !lazy) {
      loadImage();
    }
  }, [loadImage, preload, lazy]);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    imageUrl,
    isLoading,
    hasError,
    loadImage,
    retryLoad
  };
}

