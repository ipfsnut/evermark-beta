// src/main.tsx - Application entry point
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Ensure we have a root element
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Create React 18 root with concurrent features enabled
const root = ReactDOM.createRoot(rootElement);

// Render app with error handling
try {
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
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
}