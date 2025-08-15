// src/components/layout/Layout.tsx - Mobile-first responsive layout
import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNavigation } from './MobileNavigation';
import { useAppUI } from '../../providers/AppContext';
import { useFarcasterUser } from '../../lib/farcaster';
import { cn } from '../../utils/responsive';
import { useIsMobileDevice } from '../../utils/device-detection';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { sidebarOpen, theme, toggleSidebar } = useAppUI();
  const { isInFarcaster } = useFarcasterUser();
  const isMobile = useIsMobileDevice();

  // Mobile-first: Always show mobile nav on mobile devices
  // Don't rely on Farcaster detection for mobile layout
  const showMobileNav = isMobile;
  const showSidebar = !isMobile && !isInFarcaster;

  return (
    <div className={cn(
      'min-h-screen bg-black text-white transition-colors duration-200',
      theme === 'light' && 'bg-gray-50 text-gray-900'
    )}>
      {/* Header - optimized for mobile */}
      <Header />
      
      <div className="flex relative">
        {/* Desktop Sidebar */}
        {showSidebar && (
          <Sidebar 
            isOpen={sidebarOpen}
            className={cn(
              'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out',
              'lg:relative lg:translate-x-0',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            )}
          />
        )}
        
        {/* Main content area - adjusted for mobile nav */}
        <main className={cn(
          'flex-1 transition-all duration-300',
          'min-h-[calc(100vh-64px)]', // Account for header
          showSidebar && sidebarOpen && 'lg:ml-0',
          showMobileNav && 'pb-20' // Space for bottom nav
        )}>
          {/* Safe area padding for notches/home indicators */}
          <div className={cn(
            'h-full',
            'safe-top safe-bottom',
            isInFarcaster && 'px-0' // No padding in frames
          )}>
            {/* Page content */}
            <div className={cn(
              'container mx-auto px-4 py-4',
              isInFarcaster ? 'max-w-none px-2' : 'max-w-7xl',
              isMobile && 'px-3' // Tighter padding on mobile
            )}>
              {children}
            </div>
          </div>
        </main>
      </div>
      
      {/* Mobile Bottom Navigation */}
      {showMobileNav && <MobileNavigation />}
      
      {/* Sidebar backdrop for mobile (tablets) */}
      {showSidebar && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleSidebar}
          aria-label="Close sidebar"
        />
      )}
    </div>
  );
}