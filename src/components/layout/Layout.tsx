// src/components/layout/Layout.tsx - Main layout structure
import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useAppUI } from '../../providers/AppContext';
import { useFarcasterUser } from '../../lib/farcaster';
import { cn } from '../../utils/responsive';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { sidebarOpen, theme } = useAppUI();
  const { isInFarcaster } = useFarcasterUser();

  return (
    <div className={cn(
      'min-h-screen bg-black text-white transition-colors duration-200',
      theme === 'light' && 'bg-gray-50 text-gray-900'
    )}>
      {/* Header - always visible */}
      <Header />
      
      <div className="flex">
        {/* Sidebar - hidden in Farcaster mini-app for space optimization */}
        {!isInFarcaster && (
          <Sidebar 
            isOpen={sidebarOpen}
            className={cn(
              'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            )}
          />
        )}
        
        {/* Main content area */}
        <main className={cn(
          'flex-1 transition-all duration-300',
          !isInFarcaster && sidebarOpen && 'lg:ml-0', // Adjust for sidebar
          'safe-top safe-bottom' // Safe area support for mobile
        )}>
          {/* Page content with proper spacing */}
          <div className={cn(
            'container mx-auto px-4 py-6',
            isInFarcaster ? 'max-w-none' : 'max-w-7xl' // Full width in mini-app
          )}>
            {children}
          </div>
        </main>
      </div>
      
      {/* Sidebar backdrop for mobile */}
      {!isInFarcaster && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => {
            // This will be connected to toggleSidebar via context
          }}
        />
      )}
    </div>
  );
}