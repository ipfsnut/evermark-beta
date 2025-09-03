// src/components/FarcasterMeta.tsx - Dynamic Farcaster Mini App meta tags
import React from 'react';
import { Helmet } from 'react-helmet-async';

interface FarcasterMetaProps {
  title?: string;
  description?: string;
  imageUrl?: string;
  url?: string;
  buttonText?: string;
  buttonAction?: 'link' | 'post' | 'tx';
  useDynamicSharing?: boolean; // NEW: Enable dynamic top evermark sharing
}

export function FarcasterMeta({
  title = 'Evermark',
  description = 'Preserve and curate your favorite content on the blockchain',
  imageUrl = 'https://evermarks.net/og-image.png',
  url = 'https://evermarks.net',
  buttonText = '📖 Open Evermark',
  buttonAction = 'link',
  useDynamicSharing = false
}: FarcasterMetaProps) {
  // Use dynamic sharing when enabled
  const shareUrl = useDynamicSharing ? '/.netlify/functions/dynamic-og-image' : url;
  return (
    <Helmet>
      {/* Farcaster Mini App Embed Meta Tags */}
      <meta name="fc:miniapp" content="1" />
      <meta name="fc:miniapp:image" content={imageUrl} />
      <meta name="fc:miniapp:button:1" content={buttonText} />
      <meta name="fc:miniapp:button:1:action" content={buttonAction} />
      <meta name="fc:miniapp:button:1:target" content={shareUrl} />
      
      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:url" content={shareUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Evermark Beta" />
      
      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      
      {/* Dynamic page title */}
      <title>{title} - Evermark Beta</title>
    </Helmet>
  );
}

// Specific component for Evermark detail pages
interface EvermarkMetaProps {
  evermark: {
    id: string;
    title?: string;
    description?: string;
    image?: string;
    author?: string;
    createdAt?: string;
  };
}

export function EvermarkMeta({ evermark }: EvermarkMetaProps) {
  const title = evermark.title ?? `Evermark #${evermark.id}`;
  const description = evermark.description ?? 
    `A preserved piece of content by ${evermark.author ?? 'Anonymous'} on Evermark`;
  const imageUrl = evermark.image ?? 'https://evermarks.net/og-image.png';
  const url = `https://evermarks.net/evermark/${evermark.id}`;
  
  return (
    <FarcasterMeta
      title={title}
      description={description}
      imageUrl={imageUrl}
      url={url}
      buttonText="🔖 View Evermark"
      buttonAction="link"
    />
  );
}