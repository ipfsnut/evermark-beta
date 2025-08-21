/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // This enables class-based dark mode - CRITICAL!
  corePlugins: {
    // Ensure dark mode utilities are generated
    preflight: true,
  },
  theme: {
    extend: {
      colors: {
        // Dark mode cyber theme colors
        'cyber-primary': '#00ff41',
        'cyber-secondary': '#0080ff', 
        'cyber-accent': '#ff0080',
        
        // Evermark brand colors (used in both themes)
        'evermark': {
          // Primary cyan/teal spectrum
          'primary': {
            50: '#ecfeff',
            100: '#cffafe',
            200: '#a5f3fc',
            300: '#67e8f9',
            400: '#22d3ee',
            500: '#06b6d4',
            600: '#0891b2',
            700: '#0e7490',
            800: '#155e75',
            900: '#164e63',
          },
          // Secondary purple spectrum
          'secondary': {
            50: '#faf5ff',
            100: '#f3e8ff',
            200: '#e9d5ff',
            300: '#d8b4fe',
            400: '#c084fc',
            500: '#a855f7',
            600: '#9333ea',
            700: '#7e22ce',
            800: '#6b21a8',
            900: '#581c87',
          },
          // Accent amber spectrum
          'accent': {
            50: '#fffbeb',
            100: '#fef3c7',
            200: '#fde68a',
            300: '#fcd34d',
            400: '#fbbf24',
            500: '#f59e0b',
            600: '#d97706',
            700: '#b45309',
            800: '#92400e',
            900: '#78350f',
          },
        },
        
        // Light mode specific colors
        'light': {
          'bg-primary': '#ffffff',
          'bg-secondary': '#f9fafb',
          'bg-tertiary': '#f3f4f6',
          'text-primary': '#111827',
          'text-secondary': '#4b5563',
          'text-muted': '#6b7280',
          'border': '#e5e7eb',
          'border-hover': '#d1d5db',
        },
        
        // Dark mode specific colors (for consistency)
        'dark': {
          'bg-primary': '#000000',
          'bg-secondary': '#111827',
          'bg-tertiary': '#1f2937',
          'text-primary': '#ffffff',
          'text-secondary': '#d1d5db',
          'text-muted': '#9ca3af',
          'border': '#374151',
          'border-hover': '#4b5563',
        },
      },
      boxShadow: {
        'cyber': '0 0 10px currentColor',
        'cyber-lg': '0 0 20px currentColor, 0 0 30px currentColor',
      },
      animation: {
        'matrix-scroll': 'matrix-scroll 20s linear infinite',
        'cyber-pulse': 'cyberPulse 1.5s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        'matrix-scroll': {
          '0%': { transform: 'translate(0, 0)' },
          '100%': { transform: 'translate(20px, 20px)' }
        },
        'cyberPulse': {
          '0%, 100%': { 
            'box-shadow': '0 0 5px currentColor',
            opacity: '1'
          },
          '50%': { 
            'box-shadow': '0 0 20px currentColor, 0 0 30px currentColor',
            opacity: '0.8'
          }
        },
        'shimmer': {
          '0%': { 'background-position': '-200% 0' },
          '100%': { 'background-position': '200% 0' }
        },
        'fadeIn': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'slideUp': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'scaleIn': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' }
        }
      }
    },
  },
  plugins: [],
}