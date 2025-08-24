import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { MiniAppLayout } from './MiniAppLayout';
import { PageLoader } from '../../components/ui';

// Lazy load mini app pages
const MiniAppHome = React.lazy(() => import('./MiniAppHome'));
const MiniAppExplore = React.lazy(() => import('./MiniAppExplore'));
const MiniAppCreate = React.lazy(() => import('./MiniAppCreate'));

export default function MiniAppRouter() {
  return (
    <MiniAppLayout>
      <Suspense fallback={<PageLoader />}>
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