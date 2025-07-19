/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Cyber theme colors from existing project
      colors: {
        // Primary cyber palette
        cyber: {
          primary: '#00ff41',    // Matrix green
          secondary: '#00ffff',  // Cyan
          accent: '#ff0080',     // Hot pink
          warning: '#ffff00',    // Electric yellow
          dark: '#0a0a0a',       // Near black
          darker: '#000000',     // Pure black
        },
        
        // Enhanced grays for dark theme
        gray: {
          850: '#1f2937',
          900: '#111827',
          950: '#0f172a',
        },

        // Evermark brand colors (preserved from existing)
        evermark: {
          primary: '#8B5CF6',    // Purple-600
          secondary: '#06B6D4',  // Cyan-500
          accent: '#EC4899',     // Pink-500
          success: '#10B981',    // Emerald-500
          warning: '#F59E0B',    // Amber-500
          error: '#EF4444',      // Red-500
        }
      },

      // Typography enhancements
      fontFamily: {
        'serif': ['Georgia', 'Times New Roman', 'serif'],
        'mono': ['Fira Code', 'Monaco', 'Consolas', 'monospace'],
      },

      // Animation enhancements
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'matrix-rain': 'matrix-rain 20s linear infinite',
        'cyber-pulse': 'cyber-pulse 1.5s ease-in-out infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },

      keyframes: {
        glow: {
          '0%': { 
            textShadow: '0 0 5px currentColor, 0 0 10px currentColor, 0 0 15px currentColor',
            filter: 'brightness(1)'
          },
          '100%': { 
            textShadow: '0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor',
            filter: 'brightness(1.2)'
          }
        },
        'matrix-rain': {
          '0%': { transform: 'translateY(-100vh)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(100vh)', opacity: '0' }
        },
        'cyber-pulse': {
          '0%, 100%': { 
            boxShadow: '0 0 5px currentColor',
            opacity: '1'
          },
          '50%': { 
            boxShadow: '0 0 20px currentColor, 0 0 30px currentColor',
            opacity: '0.8'
          }
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        }
      },

      // Spacing enhancements
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },

      // Responsive breakpoints
      screens: {
        'xs': '475px',
        '3xl': '1600px',
      },

      // Enhanced shadows for cyber effects
      boxShadow: {
        'cyber': '0 0 10px rgba(0, 255, 65, 0.3)',
        'cyber-lg': '0 0 20px rgba(0, 255, 65, 0.4)',
        'cyber-xl': '0 0 30px rgba(0, 255, 65, 0.5)',
        'neon': '0 0 5px currentColor, 0 0 10px currentColor, 0 0 15px currentColor',
        'neon-lg': '0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor',
      },

      // Backdrop blur utilities
      backdropBlur: {
        'xs': '2px',
      },

      // Border radius enhancements
      borderRadius: {
        '4xl': '2rem',
      }
    },
  },
  plugins: [
    // Custom utilities for cyber theme
    function({ addUtilities }) {
      addUtilities({
        '.text-glow': {
          textShadow: '0 0 10px currentColor',
        },
        '.text-glow-lg': {
          textShadow: '0 0 20px currentColor, 0 0 30px currentColor',
        },
        '.border-glow': {
          boxShadow: '0 0 10px currentColor',
        },
        '.border-glow-lg': {
          boxShadow: '0 0 20px currentColor',
        },
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        },
        '.touch-friendly': {
          'touch-action': 'manipulation',
          '-webkit-tap-highlight-color': 'transparent',
          'min-height': '44px',
          'min-width': '44px',
        }
      })
    }
  ],
  
  // Dark mode configuration
  darkMode: 'class',
}