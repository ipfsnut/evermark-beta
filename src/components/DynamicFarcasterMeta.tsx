// src/components/DynamicFarcasterMeta.tsx - Dynamic sharing with top leaderboard evermark
import React, { useEffect, useState } from 'react';
import { FarcasterMeta } from './FarcasterMeta';

interface TopEvermark {
  token_id: number;
  title: string;
  author: string;
  description?: string;
  supabase_image_url?: string;
  votes: number;
}

interface DynamicFarcasterMetaProps {
  fallbackTitle?: string;
  fallbackDescription?: string;
  fallbackImageUrl?: string;
}

export function DynamicFarcasterMeta({ 
  fallbackTitle = 'Evermark Protocol',
  fallbackDescription = 'Preserve and curate your favorite content on the blockchain',
  fallbackImageUrl = 'https://evermarks.net/og-image.png'
}: DynamicFarcasterMetaProps) {
  const [topEvermark, setTopEvermark] = useState<TopEvermark | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTopEvermark() {
      try {
        // Get leaderboard data to find the top evermark
        const response = await fetch('/.netlify/functions/leaderboard-data?limit=1');
        if (!response.ok) throw new Error('Failed to fetch leaderboard');
        
        const data = await response.json();
        
        if (data.evermarks && data.evermarks.length > 0) {
          const top = data.evermarks[0];
          setTopEvermark({
            token_id: top.token_id,
            title: top.title,
            author: top.author,
            description: top.description,
            supabase_image_url: top.supabase_image_url ?? top.processed_image_url,
            votes: top.votes ?? 0
          });
        }
      } catch (error) {
        console.error('Failed to fetch top evermark for dynamic sharing:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTopEvermark();
  }, []);

  // If we have a top evermark, create dynamic sharing content
  if (!isLoading && topEvermark) {
    const dynamicTitle = `🏆 "${topEvermark.title}" is trending on Evermark!`;
    const dynamicDescription = `Currently #1 with ${topEvermark.votes} votes: ${topEvermark.description ?? `Content by ${topEvermark.author}`}`;
    const dynamicImageUrl = topEvermark.supabase_image_url ?? fallbackImageUrl;

    return (
      <FarcasterMeta
        title={dynamicTitle}
        description={dynamicDescription}
        imageUrl={dynamicImageUrl}
        url="https://evermarks.net"
        buttonText="🚀 Explore Evermark"
        buttonAction="link"
        useDynamicSharing={true}
      />
    );
  }

  // Fallback to static sharing
  return (
    <FarcasterMeta
      title={fallbackTitle}
      description={fallbackDescription}
      imageUrl={fallbackImageUrl}
      url="https://evermarks.net"
      buttonText="🚀 Explore Evermark"
      buttonAction="link"
    />
  );
}