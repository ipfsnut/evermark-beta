import React from 'react';
import { Navigation } from './Navigation';
import { useTheme } from '../../providers/ThemeProvider';
import { cn } from '@/utils/responsive';

interface SidebarProps {
  isOpen: boolean;
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const { isDark: _isDark } = useTheme();

  return (
    <aside className={cn(
      'w-64 min-h-screen border-r transition-colors duration-200 bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800',
      className
    )}>
      <Navigation />
    </aside>
  );
}