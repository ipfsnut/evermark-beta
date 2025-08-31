// src/components/layout/Layout.tsx - Mobile-first responsive layout
import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileMenu } from './MobileMenu';
import { useAppUI } from '../../providers/AppContext';
import { useFarcasterDetection } from '../../hooks/useFarcasterDetection';
import { useTheme } from '../../providers/ThemeProvider';
import { cn } from '../../utils/responsive';
import { themeClasses } from '../../utils/theme';
import { useIsMobileDevice } from '../../utils/device-detection';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { sidebarOpen, toggleSidebar } = useAppUI();
  const { isInFarcaster } = useFarcasterDetection();
  const { isDark } = useTheme();
  const isMobile = useIsMobileDevice();

  // Mobile-first: Use slide-out menu on mobile, sidebar on desktop
  const showDesktopSidebar = !isMobile && !isInFarcaster;
  const showMobileMenu = isMobile;

  return (
    <div className={themeClasses.page}>
      {/* Header - optimized for mobile */}
      <Header />
      
      <div className="flex relative">
        {/* Desktop Sidebar */}
        {showDesktopSidebar && (
          <Sidebar 
            isOpen={sidebarOpen}
            className={cn(
              'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out',
              'lg:relative lg:translate-x-0',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            )}
          />
        )}
        
        {/* Main content area - no bottom padding needed for slide-out menu */}
        <main className={cn(
          'flex-1 transition-all duration-300',
          'min-h-[calc(100vh-64px)]', // Account for header
          showDesktopSidebar && sidebarOpen && 'lg:ml-0'
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
      
      {/* Mobile Menu */}
      {showMobileMenu && (
        <MobileMenu 
          isOpen={sidebarOpen}
          onClose={toggleSidebar}
        />
      )}
      
      {/* Sidebar backdrop for desktop */}
      {showDesktopSidebar && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleSidebar}
          aria-label="Close sidebar"
        />
      )}
    </div>
  );
}