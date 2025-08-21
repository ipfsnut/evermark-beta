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
        // App theme colors using CSS variables
        // These automatically switch between dark/light modes
        app: {
          // Backgrounds
          'bg-primary': 'var(--app-bg-primary)',
          'bg-secondary': 'var(--app-bg-secondary)', 
          'bg-tertiary': 'var(--app-bg-tertiary)',
          'bg-card': 'var(--app-bg-card)',
          'bg-card-hover': 'var(--app-bg-card-hover)',
          'bg-input': 'var(--app-bg-input)',
          
          // Text colors
          'text-primary': 'var(--app-text-primary)',
          'text-secondary': 'var(--app-text-secondary)',
          'text-muted': 'var(--app-text-muted)',
          'text-on-card': 'var(--app-text-on-card)',
          'text-accent': 'var(--app-text-accent)',
          
          // Borders
          'border': 'var(--app-border)',
          'border-hover': 'var(--app-border-hover)',
          'border-focus': 'var(--app-border-focus)',
          
          // Brand colors (theme-aware)
          'brand-primary': 'var(--app-brand-primary)',
          'brand-secondary': 'var(--app-brand-secondary)',
          'brand-success': 'var(--app-brand-success)',
          'brand-warning': 'var(--app-brand-warning)',
          'brand-error': 'var(--app-brand-error)',
        },
        
        // Keep existing cyber theme for backwards compatibility
        'cyber-primary': '#00ff41',
        'cyber-secondary': '#0080ff', 
        'cyber-accent': '#ff0080',
        
        // Evermark brand color palette
        'evermark-primary': {
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
        'evermark-secondary': {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7c3aed',
          800: '#6b21a8',
          900: '#581c87',
        },
        'evermark-accent': {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
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