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
  // When dynamic sharing is enabled, point to the dynamic endpoint for all sharing
  const shareUrl = useDynamicSharing ? '/.netlify/functions/dynamic-og-image' : url;
  
  // For dynamic sharing, the meta tags act as fallbacks - social platforms will
  // fetch from the shareUrl which contains the actual dynamic content
  const metaTitle = useDynamicSharing ? 'Evermark Protocol - Community Curated Content' : title;
  const metaDescription = useDynamicSharing ? 
    'See what\'s trending! The top community-voted content on Evermark Protocol.' : 
    description;
  
  return (
    <Helmet>
      {/* Farcaster Mini App Embed Meta Tags */}
      <meta name="fc:miniapp" content="1" />
      <meta name="fc:miniapp:image" content={shareUrl} />
      <meta name="fc:miniapp:button:1" content={buttonText} />
      <meta name="fc:miniapp:button:1:action" content={buttonAction} />
      <meta name="fc:miniapp:button:1:target" content={shareUrl} />
      
      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={shareUrl} />
      <meta property="og:url" content={shareUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Evermark Beta" />
      
      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={shareUrl} />
      
      {/* Dynamic page title */}
      <title>{metaTitle} - Evermark Beta</title>
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
  
  // Use the new dynamic sharing endpoint for beautiful book pages
  const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:8888' : 'https://evermarks.net';
  const shareEndpoint = `${baseUrl}/.netlify/functions/evermark-share?id=${evermark.id}`;
  const directUrl = `${baseUrl}/evermark/${evermark.id}`;
  
  return (
    <Helmet>
      {/* Farcaster Mini App Embed Meta Tags */}
      <meta name="fc:miniapp" content="1" />
      <meta name="fc:miniapp:image" content={shareEndpoint} />
      <meta name="fc:miniapp:button:1" content="🔖 View Evermark" />
      <meta name="fc:miniapp:button:1:action" content="link" />
      <meta name="fc:miniapp:button:1:target" content={directUrl} />
      
      {/* Open Graph Meta Tags - point to sharing endpoint for rich previews */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={shareEndpoint} />
      <meta property="og:url" content={shareEndpoint} />
      <meta property="og:type" content="article" />
      <meta property="og:site_name" content="Evermark Protocol" />
      
      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={shareEndpoint} />
      
      {/* Canonical URL points to the actual app page */}
      <link rel="canonical" href={directUrl} />
      
      {/* Dynamic page title */}
      <title>{title} - Evermark</title>
    </Helmet>
  );
}