// src/pages/CreatePage.tsx - Create Evermark page
import React, { useState } from 'react';
import { CreateEvermarkForm } from '@/features/evermarks';
import { CreateEvermarkWizard } from '@/features/evermarks/components/CreateEvermarkWizard';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeftIcon, ToggleLeftIcon, ToggleRightIcon } from 'lucide-react';
import { themeClasses } from '@/utils/theme';

export default function CreatePage(): React.ReactNode {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Check URL param or default to wizard mode
  const defaultMode = searchParams.get('mode') || 'wizard';
  const [useWizard, setUseWizard] = useState(defaultMode === 'wizard');

  const handleSuccess = () => {
    navigate('/explore');
  };

  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <div className={themeClasses.page}>
      {/* Back navigation and mode toggle */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-sm text-app-text-secondary hover:text-app-text-primary transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            Back
          </button>
          
          {/* Mode Toggle */}
          <button
            onClick={() => setUseWizard(!useWizard)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            title={useWizard ? "Switch to classic form" : "Switch to guided wizard"}
          >
            {useWizard ? (
              <>
                <ToggleRightIcon className="w-4 h-4" />
                <span>Wizard Mode</span>
              </>
            ) : (
              <>
                <ToggleLeftIcon className="w-4 h-4" />
                <span>Classic Form</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Creation form or wizard */}
      {useWizard ? (
        <CreateEvermarkWizard
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          className="container mx-auto"
        />
      ) : (
        <CreateEvermarkForm
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          className="container mx-auto"
        />
      )}
    </div>
  );
}