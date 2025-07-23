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
        // Your cyber theme colors
        'cyber-primary': '#00ff41',
        'cyber-secondary': '#0080ff', 
        'cyber-accent': '#ff0080',
        
        // Your evermark theme colors
        'evermark-primary': '#00ff41',
        'evermark-secondary': '#0080ff',
        'evermark-accent': '#ff0080',
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