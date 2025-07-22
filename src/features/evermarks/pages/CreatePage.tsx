// src/pages/CreatePage.tsx - Create Evermark page
import React from 'react';
import { CreateEvermarkForm } from '@/features/evermarks';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from 'lucide-react';

export default function CreatePage() {
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate('/explore');
  };

  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Back navigation */}
      <div className="container mx-auto px-4 py-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1" />
          Back
        </button>
      </div>

      {/* Creation form */}
      <CreateEvermarkForm
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        className="container mx-auto"
      />
    </div>
  );
}