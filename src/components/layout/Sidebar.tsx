// src/components/layout/Sidebar.tsx - Navigation sidebar
import React from 'react';
import { Navigation } from './Navigation';
import { useAppUI } from '@/providers/AppContext';
import { cn } from '@/utils/responsive';

interface SidebarProps {
  isOpen: boolean;
  className?: string;
}

export function Sidebar({ isOpen, className }: SidebarProps) {
  const { theme } = useAppUI();

  return (
    <aside className={cn(
      'w-64 min-h-screen border-r transition-colors duration-200',
      theme === 'light' && 'border-gray-200',
      className
    )}>
      <Navigation />
    </aside>
  );
}