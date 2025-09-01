import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, CheckCircle, Shield, FileText } from 'lucide-react';
import { useTheme } from '../../../providers/ThemeProvider';
import { cn } from '../../../utils/responsive';
import type { Evermark } from '../types';

interface AttestationPopupProps {
  evermark: Evermark;
  isOpen: boolean;
  onClose: () => void;
}

export function AttestationPopup({ evermark, isOpen, onClose }: AttestationPopupProps) {
  const { isDark } = useTheme();
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'document'>('summary');
  const [attestationText, setAttestationText] = useState<string>('');
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'document' && !attestationText) {
      loadAttestationDocument();
    }
  }, [isOpen, activeTab, attestationText]);

  const loadAttestationDocument = async () => {
    setIsLoadingDocument(true);
    try {
      const response = await fetch('/.netlify/functions/generate-attestation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_id: evermark.tokenId })
      });
      
      if (!response.ok) throw new Error('Failed to generate attestation');
      
      const text = await response.text();
      setAttestationText(text);
    } catch (error) {
      console.error('Failed to load attestation:', error);
      setAttestationText('Error loading attestation document');
    } finally {
      setIsLoadingDocument(false);
    }
  };

  if (!isOpen) return null;

  const handleDownloadAttestation = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch('/.netlify/functions/generate-attestation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_id: evermark.tokenId })
      });
      
      if (!response.ok) throw new Error('Failed to generate attestation');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `evermark-${evermark.tokenId}-attestation.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Attestation download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleViewOnBasescan = () => {
    if (evermark.extendedMetadata?.txHash) {
      window.open(`https://basescan.org/tx/${evermark.extendedMetadata.txHash}`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className={cn(
        "bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto",
        isDark ? "bg-gray-800 border border-gray-700" : "bg-white"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-400" />
            <h3 className={cn("text-lg font-semibold", isDark ? "text-white" : "text-gray-900")}>
              Verified Evermark
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            <button
              onClick={() => setActiveTab('summary')}
              className={cn(
                "px-4 py-2 font-medium text-sm border-b-2 transition-colors",
                activeTab === 'summary'
                  ? "border-green-400 text-green-400"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              Summary
            </button>
            <button
              onClick={() => setActiveTab('document')}
              className={cn(
                "px-4 py-2 font-medium text-sm border-b-2 transition-colors",
                activeTab === 'document'
                  ? "border-green-400 text-green-400"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              <FileText className="h-4 w-4 mr-1 inline" />
              Attestation Document
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'summary' ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className={cn("font-medium mb-1", isDark ? "text-white" : "text-gray-900")}>
                    Authenticity Verified
                  </h4>
                  <p className={cn("text-sm", isDark ? "text-gray-300" : "text-gray-600")}>
                    This content was evermarked by its original author, proving authenticity.
                  </p>
                </div>
              </div>

              {/* Evermark Details */}
              <div className={cn(
                "bg-gray-50 rounded-lg p-4 space-y-2",
                isDark ? "bg-gray-700/50" : "bg-gray-50"
              )}>
                <div className="flex justify-between">
                  <span className={cn("text-sm font-medium", isDark ? "text-gray-300" : "text-gray-700")}>
                    Title:
                  </span>
                  <span className={cn("text-sm text-right", isDark ? "text-white" : "text-gray-900")}>
                    {evermark.title}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={cn("text-sm font-medium", isDark ? "text-gray-300" : "text-gray-700")}>
                    Author:
                  </span>
                  <span className={cn("text-sm", isDark ? "text-white" : "text-gray-900")}>
                    {evermark.author}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={cn("text-sm font-medium", isDark ? "text-gray-300" : "text-gray-700")}>
                    Token ID:
                  </span>
                  <span className={cn("text-sm", isDark ? "text-white" : "text-gray-900")}>
                    #{evermark.tokenId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={cn("text-sm font-medium", isDark ? "text-gray-300" : "text-gray-700")}>
                    Created:
                  </span>
                  <span className={cn("text-sm", isDark ? "text-white" : "text-gray-900")}>
                    {new Date(evermark.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={handleDownloadAttestation}
                  disabled={isDownloading}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                    "bg-blue-600 hover:bg-blue-700 text-white",
                    isDownloading && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Download className="h-4 w-4" />
                  {isDownloading ? 'Generating...' : 'Download Attestation'}
                </button>

                <button
                  onClick={handleViewOnBasescan}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                    isDark 
                      ? "bg-gray-700 hover:bg-gray-600 text-white" 
                      : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                  )}
                >
                  <ExternalLink className="h-4 w-4" />
                  View on Basescan
                </button>
              </div>

              <p className={cn("text-xs text-center", isDark ? "text-gray-400" : "text-gray-500")}>
                Verified evermarks prove the content author and evermark creator are the same person.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {isLoadingDocument ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto mb-4" />
                  <p className={cn("text-sm", isDark ? "text-gray-300" : "text-gray-600")}>
                    Generating attestation document...
                  </p>
                </div>
              ) : (
                <>
                  <div className={cn(
                    "bg-gray-50 rounded-lg p-4 font-mono text-xs overflow-auto max-h-96",
                    isDark ? "bg-gray-900 text-gray-300" : "bg-gray-50 text-gray-800"
                  )}>
                    <pre className="whitespace-pre-wrap">{attestationText}</pre>
                  </div>
                  
                  <button
                    onClick={handleDownloadAttestation}
                    disabled={isDownloading}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                      "bg-blue-600 hover:bg-blue-700 text-white",
                      isDownloading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Download className="h-4 w-4" />
                    {isDownloading ? 'Downloading...' : 'Download as File'}
                  </button>
                </>
              )}
            </div>
          )}
      </div>
    </div>
  );
}