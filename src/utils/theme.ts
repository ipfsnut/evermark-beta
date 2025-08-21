// src/utils/theme.ts - Simple theme utilities for components

/**
 * Consistent Tailwind classes using our CSS variables
 * Use these instead of hardcoded colors
 */
export const themeClasses = {
  // Page layouts - different gradients for light/dark mode
  page: 'min-h-screen text-app-text-primary transition-colors duration-200 bg-gradient-to-br from-slate-50 via-slate-200 to-slate-300 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900',
  container: 'max-w-7xl mx-auto px-4 py-8 lg:px-8',
  section: 'bg-app-bg-secondary rounded-lg', /* light grey layout sections */
  
  // Cards - solid, readable
  card: 'bg-app-bg-card text-app-text-on-card border border-app-border rounded-xl p-6 shadow-lg transition-all duration-300',
  cardLarge: 'bg-app-bg-card text-app-text-on-card border border-app-border rounded-2xl p-8 shadow-xl transition-all duration-300',
  cardInteractive: 'bg-app-bg-card text-app-text-on-card border border-app-border rounded-xl p-6 shadow-lg hover:shadow-xl hover:-translate-y-1 hover:border-app-border-hover transition-all duration-300',
  
  // Buttons
  btnPrimary: 'bg-app-brand-primary text-white px-4 py-2 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-app-border-focus',
  btnSecondary: 'bg-app-bg-card text-app-text-on-card border border-app-border px-4 py-2 rounded-lg font-medium hover:bg-app-bg-card-hover hover:border-app-border-hover transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-app-border-focus',
  btnGhost: 'bg-transparent text-app-text-secondary px-4 py-2 rounded-lg font-medium hover:bg-app-bg-secondary hover:text-app-text-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-app-border-focus',
  
  // Inputs
  input: 'bg-app-bg-input text-app-text-on-card border border-app-border px-4 py-2.5 rounded-lg transition-all duration-200 focus:outline-none focus:border-app-border-focus focus:ring-2 focus:ring-app-border-focus focus:ring-opacity-20',
  
  // Navigation
  navLink: 'flex items-center px-3 py-2 rounded-lg text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-secondary border border-transparent transition-all duration-200',
  navLinkActive: 'flex items-center px-3 py-2 rounded-lg text-app-text-accent bg-app-bg-secondary border border-app-border-focus shadow-sm',
  
  // Text
  textPrimary: 'text-app-text-primary',
  textSecondary: 'text-app-text-secondary', 
  textMuted: 'text-app-text-muted',
  textAccent: 'text-app-text-accent',
  textOnCard: 'text-app-text-on-card',
  
  // Common component patterns
  iconContainer: 'p-2 rounded-lg flex-shrink-0 bg-app-brand-primary bg-opacity-10',
  iconPrimary: 'w-5 h-5 text-app-text-accent',
  
  // HEADINGS - Complete system (replaces all 23 inconsistent patterns)
  headingHero: 'text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-green-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent leading-tight',
  headingLarge: 'text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-green-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent leading-tight', 
  headingMedium: 'text-2xl sm:text-3xl font-bold bg-gradient-to-r from-green-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent leading-tight',
  headingSmall: 'text-xl sm:text-2xl font-bold bg-gradient-to-r from-green-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent leading-tight',
  heading: 'text-lg font-semibold mb-2 text-app-text-primary',
  
  // STATUS HEADINGS - Semantic meaning
  errorHeading: 'text-2xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent mb-2',
  errorCodeHuge: 'text-8xl md:text-9xl font-bold bg-gradient-to-r from-red-400 via-red-500 to-red-600 bg-clip-text text-transparent mb-4 animate-pulse',
  successHeading: 'text-2xl font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent mb-2',
  warningHeading: 'text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent mb-2',
  description: 'text-sm mb-4 text-app-text-muted',
  
  // Feature cards/sections  
  featureCard: 'bg-app-bg-card text-app-text-on-card border border-app-border rounded-xl p-6 shadow-lg',
  featureIcon: 'w-12 h-12 text-app-text-accent',
  featureTitle: 'text-xl font-bold mb-2 text-app-text-primary',
  featureText: 'text-app-text-secondary',
  
  // Status indicators
  statusOnline: 'bg-green-500 animate-pulse shadow-sm shadow-green-500',
  statusOffline: 'bg-red-500',
  statusPending: 'bg-yellow-500 animate-pulse shadow-sm shadow-yellow-500',
} as const;

/**
 * Utility to combine classes safely
 */
export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}