// src/features/evermarks/components/EvermarkImage.tsx
import React from 'react';
import { EvermarkImage as SDKEvermarkImage } from '@ipfsnut/evermark-sdk-react';
import { getEvermarkStorageConfig } from '../config/sdk-config';

interface EvermarkImageProps {
  evermark: {
    id: string;
    tokenId: number;
    title: string;
    contentType: string;
    supabaseImageUrl?: string;
    thumbnailUrl?: string;
    processed_image_url?: string;
    ipfsHash?: string;
    imageStatus?: 'processed' | 'processing' | 'failed' | 'none';
  };
  variant?: 'hero' | 'standard' | 'compact' | 'list';
  showPlaceholder?: boolean;
  className?: string;
  onImageLoad?: () => void;
  onImageError?: (error: string) => void;
}

export const EvermarkImage: React.FC<EvermarkImageProps> = ({
  evermark,
  variant = 'standard',
  showPlaceholder = true,
  className = '',
  onImageLoad,
  onImageError
}) => {
  return (
    <SDKEvermarkImage
      evermark={evermark}
      storageConfig={getEvermarkStorageConfig()}
      variant={variant}
      showPlaceholder={showPlaceholder}
      className={className}
      enableAutoTransfer={true}
      showTransferStatus={true}
      onImageLoad={onImageLoad}
      onImageError={onImageError}
      onTransferComplete={(result) => console.log('Transfer complete:', result)}
    />
  );
};