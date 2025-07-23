import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Path resolution for clean imports
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/core': resolve(__dirname, 'src/core'),
      '@/features': resolve(__dirname, 'src/features'),
      '@/components': resolve(__dirname, 'src/components'),
      '@/providers': resolve(__dirname, 'src/providers'),
      '@/hooks': resolve(__dirname, 'src/hooks'),
      '@/lib': resolve(__dirname, 'src/lib'),
      '@/pages': resolve(__dirname, 'src/pages'),
      '@/utils': resolve(__dirname, 'src/utils')
    }
  },

  // Development server configuration
  server: {
    port: 3000,
    host: true,
    open: true
  },

  // Build optimization
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: true,
    
    // Bundle optimization
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          vendor: ['react', 'react-dom'],
          blockchain: ['thirdweb', 'viem', 'wagmi'],
          farcaster: ['@farcaster/frame-sdk', '@farcaster/frame-wagmi-connector'],
          ui: ['lucide-react', 'classnames', 'date-fns']
        }
      }
    },
    
    // Performance optimization
    chunkSizeWarningLimit: 1000
  },

  // Environment variables
  define: {
    global: 'globalThis'
  },

  // Optimizations for dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'thirdweb',
      'viem',
      'wagmi'
    ]
  }
})