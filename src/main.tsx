import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Enable React 18 concurrent features
const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Log app initialization
if (import.meta.env.DEV) {
  console.log('🚀 Evermark Beta initialized');
  console.log('Environment:', import.meta.env.MODE);
  console.log('Farcaster detected:', (window as any).__evermark_farcaster_detected);
}