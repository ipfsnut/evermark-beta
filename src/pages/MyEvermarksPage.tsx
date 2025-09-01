import React, { useState } from 'react';
import { useAppAuth } from '../providers/AppContext';
import { useTheme } from '../providers/ThemeProvider';
import { cn } from '../utils/responsive';
import { Heart, Plus, User, Sparkles } from 'lucide-react';
import { EvermarkCard } from '../features/evermarks/components/EvermarkCard';
import { useQuery } from '@tanstack/react-query';

interface Evermark {
  token_id: number;
  title: string;
  author: string;
  owner: string;
  description: string;
  content_type: string;
  source_url: string;
  supabase_image_url?: string;
  created_at: string;
  updated_at: string;
}

// Tab types
type TabType = 'created' | 'supported';

interface Tab {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tabs: Tab[] = [
  {
    id: 'created',
    label: 'Created',
    icon: Plus,
  },
  {
    id: 'supported', 
    label: 'Supported',
    icon: Heart,
  },
];

export function MyEvermarksPage() {
  const { isAuthenticated, user } = useAppAuth();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('created');

  // Fetch user's created evermarks
  const { data: createdEvermarks = [], isLoading: isLoadingCreated } = useQuery({
    queryKey: ['my-evermarks', 'created', user?.address],
    queryFn: async (): Promise<Evermark[]> => {
      if (!user?.address) return [];
      
      const response = await fetch(`/.netlify/functions/evermarks?creator=${user.address}`);
      if (!response.ok) throw new Error('Failed to fetch created evermarks');
      
      const data = await response.json();
      return data.evermarks || [];
    },
    enabled: isAuthenticated && !!user?.address,
    staleTime: 30000,
  });

  // Fetch user's supported evermarks (voting records)
  const { data: supportedEvermarks = [], isLoading: isLoadingSupported } = useQuery({
    queryKey: ['my-evermarks', 'supported', user?.address],
    queryFn: async (): Promise<Evermark[]> => {
      if (!user?.address) return [];
      
      // This would need to be implemented in the backend
      // For now, return empty array as placeholder
      return [];
    },
    enabled: isAuthenticated && !!user?.address && activeTab === 'supported',
    staleTime: 30000,
  });

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className={cn(
          "max-w-md mx-auto text-center rounded-lg p-8",
          isDark 
            ? "bg-gray-800/50 border border-gray-700" 
            : "bg-gray-50 border border-gray-200"
        )}>
          <User className={cn(
            "h-16 w-16 mx-auto mb-4",
            isDark ? "text-gray-400" : "text-gray-500"
          )} />
          <h2 className={cn(
            "text-2xl font-bold mb-2",
            isDark ? "text-white" : "text-gray-900"
          )}>
            Sign In Required
          </h2>
          <p className={cn(
            "text-base mb-6",
            isDark ? "text-gray-300" : "text-gray-600"
          )}>
            Connect your wallet to view your created and supported Evermarks.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-cyber-primary to-cyber-secondary text-black font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Get Started
          </button>
        </div>
      </div>
    );
  }

  const currentData = activeTab === 'created' ? createdEvermarks : supportedEvermarks;
  const isLoading = activeTab === 'created' ? isLoadingCreated : isLoadingSupported;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-cyber-primary to-cyber-secondary rounded-lg flex items-center justify-center">
            <User className="h-5 w-5 text-black" />
          </div>
          <div>
            <h1 className={cn(
              "text-3xl font-bold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              My Evermarks
            </h1>
            <p className={cn(
              "text-sm",
              isDark ? "text-gray-400" : "text-gray-600"
            )}>
              {user?.displayName || user?.username || 'Your'} collection and contributions
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center space-x-2 px-4 py-2.5 rounded-md font-medium transition-all duration-200 flex-1 justify-center",
                  isActive
                    ? "bg-white dark:bg-gray-700 text-cyber-primary shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.id === 'created' && (
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-full",
                    isActive
                      ? "bg-cyber-primary/20 text-cyber-primary"
                      : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400"
                  )}>
                    {createdEvermarks.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-cyber-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className={cn(
            "text-sm",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            Loading your evermarks...
          </p>
        </div>
      ) : currentData.length === 0 ? (
        <div className={cn(
          "text-center py-16 rounded-lg",
          isDark 
            ? "bg-gray-800/50 border border-gray-700" 
            : "bg-gray-50 border border-gray-200"
        )}>
          <Sparkles className={cn(
            "h-16 w-16 mx-auto mb-4",
            isDark ? "text-gray-400" : "text-gray-500"
          )} />
          <h3 className={cn(
            "text-xl font-semibold mb-2",
            isDark ? "text-white" : "text-gray-900"
          )}>
            {activeTab === 'created' 
              ? 'No Evermarks Created Yet' 
              : 'No Evermarks Supported Yet'}
          </h3>
          <p className={cn(
            "text-base mb-6 max-w-md mx-auto",
            isDark ? "text-gray-300" : "text-gray-600"
          )}>
            {activeTab === 'created'
              ? 'Start preserving important content by creating your first Evermark.'
              : 'Support the community by voting on Evermarks you find valuable.'}
          </p>
          {activeTab === 'created' && (
            <button
              onClick={() => window.location.href = '/create'}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-cyber-primary to-cyber-secondary text-black font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Evermark
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentData.map((evermark) => (
            <EvermarkCard
              key={evermark.token_id}
              id={evermark.token_id}
              title={evermark.title}
              author={evermark.author}
              description={evermark.description}
              contentType={evermark.content_type}
              imageUrl={evermark.supabase_image_url}
              sourceUrl={evermark.source_url}
              createdAt={evermark.created_at}
              showAuthor={activeTab !== 'created'} // Hide author for created evermarks since it's the user
            />
          ))}
        </div>
      )}
    </div>
  );
}