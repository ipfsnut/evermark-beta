import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env files: .env.local for development, then fallback to .env
  // Vite automatically loads .env.local, .env.development, .env.production
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    
    // Fix for "process is not defined" error
    define: {
      // Define global for libraries that need it
      global: 'globalThis',
      
      // Define process.env for libraries that use it
      'process.env': {
        NODE_ENV: JSON.stringify(mode),
        
        // For local development (.env.local) and production (Netlify env vars)
        // Vite will automatically pick up VITE_ prefixed variables
        VITE_SUPABASE_URL: JSON.stringify(env.VITE_SUPABASE_URL || ''),
        VITE_SUPABASE_ANON_KEY: JSON.stringify(env.VITE_SUPABASE_ANON_KEY || ''),
        VITE_THIRDWEB_CLIENT_ID: JSON.stringify(env.VITE_THIRDWEB_CLIENT_ID || ''),
        VITE_THIRDWEB_SECRET_KEY: JSON.stringify(env.VITE_THIRDWEB_SECRET_KEY || ''),
        VITE_NEYNAR_API_KEY: JSON.stringify(env.VITE_NEYNAR_API_KEY || ''),
        
        // Contract addresses
        VITE_EMARK_TOKEN_ADDRESS: JSON.stringify(env.VITE_EMARK_TOKEN_ADDRESS || ''),
        VITE_CARD_CATALOG_ADDRESS: JSON.stringify(env.VITE_CARD_CATALOG_ADDRESS || ''),
        VITE_EVERMARK_NFT_ADDRESS: JSON.stringify(env.VITE_EVERMARK_NFT_ADDRESS || ''),
        VITE_EVERMARK_VOTING_ADDRESS: JSON.stringify(env.VITE_EVERMARK_VOTING_ADDRESS || ''),
        VITE_EVERMARK_LEADERBOARD_ADDRESS: JSON.stringify(env.VITE_EVERMARK_LEADERBOARD_ADDRESS || ''),
        VITE_EVERMARK_REWARDS_ADDRESS: JSON.stringify(env.VITE_EVERMARK_REWARDS_ADDRESS || ''),
        VITE_FEE_COLLECTOR_ADDRESS: JSON.stringify(env.VITE_FEE_COLLECTOR_ADDRESS || ''),
        
        // Debug flags
        VITE_DEBUG_MODE: JSON.stringify(env.VITE_DEBUG_MODE || (mode === 'development' ? 'true' : 'false')),
        VITE_ENABLE_DEVTOOLS: JSON.stringify(env.VITE_ENABLE_DEVTOOLS || (mode === 'development' ? 'true' : 'false')),
      }
    },

    // Path resolution
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '~': path.resolve(__dirname, './src'),
      },
    },

    // Server configuration
    server: {
      port: 3000,
      open: true,
      cors: true,
    },

    // Build configuration
    build: {
      target: 'esnext',
      sourcemap: mode === 'development',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            thirdweb: ['thirdweb'],
            tanstack: ['@tanstack/react-query'],
          },
        },
      },
    },

    // Optimize dependencies
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'thirdweb',
        '@tanstack/react-query',
        'react-router-dom',
      ],
    },
  }
})