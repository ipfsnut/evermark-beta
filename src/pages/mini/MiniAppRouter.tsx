import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { MiniAppLayout } from './MiniAppLayout';
// Simple loading component for mini app
function MiniAppLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading Mini App...</p>
      </div>
    </div>
  );
}

// Lazy load mini app pages
const MiniAppHome = React.lazy(() => import('./MiniAppHome'));
const MiniAppExplore = React.lazy(() => import('./MiniAppExplore'));
const MiniAppCreate = React.lazy(() => import('./MiniAppCreate'));

export default function MiniAppRouter() {
  return (
    <MiniAppLayout>
      <Suspense fallback={<MiniAppLoader />}>
        <Routes>
          <Route path="/" element={<MiniAppHome />} />
          <Route path="/explore" element={<MiniAppExplore />} />
          <Route path="/create" element={<MiniAppCreate />} />
          <Route path="/evermark/:id" element={<MiniAppHome />} />
        </Routes>
      </Suspense>
    </MiniAppLayout>
  );
}