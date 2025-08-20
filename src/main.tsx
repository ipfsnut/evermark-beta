// src/main.tsx - Mobile-first app with PWA support
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import '../index.css';
import './styles/mobile-first.css';

// Import dev logging utilities
import { devLog, prodLog } from './utils/debug';

// Register service worker for PWA functionality
async function registerServiceWorker() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      prodLog('Service Worker registered:', registration.scope);
      
      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60000); // Check every minute
      
      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              if (confirm('New version available! Refresh to update?')) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        }
      });
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
}

// Register SW after app loads
window.addEventListener('load', registerServiceWorker);

// Ensure we have a root element
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Create React 18 root with concurrent features enabled
const root = ReactDOM.createRoot(rootElement);

// TEMPORARY FIX: Remove StrictMode to test if it's causing the GoTrueClient issue
// StrictMode causes components to render twice in development, which can create multiple instances
try {
  root.render(
    // Remove React.StrictMode temporarily to test
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  );
} catch (error) {
  console.error('Failed to render app:', error);
  
  // Fallback UI for critical errors
  root.render(
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4">Application Error</h1>
        <p className="text-gray-400 mb-4">Failed to load Evermark. Please refresh the page.</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-cyber-primary text-black font-medium rounded hover:bg-opacity-80"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}

// Development logging
if (import.meta.env.DEV) {
  console.log('🚀 Evermark Beta initialized');
  console.log('Environment:', import.meta.env.MODE);
  console.log('Farcaster detected:', (window as any).__evermark_farcaster_detected);
  console.log('Build info:', {
    version: import.meta.env.VITE_APP_VERSION || 'development',
    buildTime: new Date().toISOString(),
  });
  
  // Import debug function to check Supabase instances
  import('./lib/supabase').then(({ getSupabaseDebugInfo }) => {
    console.log('🔍 Supabase Debug Info:', getSupabaseDebugInfo());
  });
}