import React, { useState, useEffect } from 'react';
import { ReadmeService } from '../services/ReadmeService';
import type { ReadmeBookData } from '../types';

interface ReadmeBookViewerProps {
  readmeData: ReadmeBookData;
  className?: string;
}

interface IPFSContent {
  content: string | ArrayBuffer;
  contentType: string;
  gateway: string;
}

export function ReadmeBookViewer({ readmeData, className = '' }: ReadmeBookViewerProps) {
  const [ipfsContent, setIpfsContent] = useState<IPFSContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);

  const fetchContent = async () => {
    if (!readmeData.ipfsHash) {
      setError('No IPFS hash available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const content = await ReadmeService.fetchIPFSContent(readmeData.ipfsHash);
      if (content) {
        setIpfsContent(content);
        setShowContent(true);
      } else {
        setError('Failed to fetch book content from IPFS');
      }
    } catch (err) {
      setError('Error loading book content');
      console.error('IPFS content fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderBookInfo = () => (
    <div className="bg-gray-50 rounded-lg p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">
            {readmeData.bookTitle}
          </h3>
          <p className="text-gray-600 mb-2">by {readmeData.bookAuthor}</p>
          
          {readmeData.genre && (
            <span className="inline-block bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded">
              {readmeData.genre}
            </span>
          )}
        </div>
        
        <div className="text-sm text-gray-500">
          <div>📚 README Book NFT</div>
          {readmeData.chapterNumber && readmeData.totalChapters && (
            <div>Chapter {readmeData.chapterNumber} of {readmeData.totalChapters}</div>
          )}
        </div>
      </div>

      {readmeData.bookDescription && (
        <p className="text-gray-700 mb-4">{readmeData.bookDescription}</p>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-medium">Publisher:</span> {readmeData.publisher || 'PageDAO'}
        </div>
        {readmeData.publicationDate && (
          <div>
            <span className="font-medium">Published:</span> {readmeData.publicationDate}
          </div>
        )}
        {readmeData.pageCount && (
          <div>
            <span className="font-medium">Pages:</span> {readmeData.pageCount}
          </div>
        )}
        {readmeData.language && (
          <div>
            <span className="font-medium">Language:</span> {readmeData.language}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          <div>Polygon Contract: {readmeData.polygonContract}</div>
          <div>Token ID: {readmeData.polygonTokenId}</div>
          {readmeData.ipfsHash && (
            <div>IPFS: {readmeData.ipfsHash.substring(0, 20)}...</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (!ipfsContent) return null;

    const { content, contentType } = ipfsContent;

    // Handle PDF content
    if (contentType.includes('pdf') && content instanceof ArrayBuffer) {
      const blob = new Blob([content], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      return (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h4 className="font-medium text-gray-900">📄 Book Content (PDF)</h4>
            <a
              href={url}
              download={`${readmeData.bookTitle}.pdf`}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Download PDF
            </a>
          </div>
          <iframe
            src={url}
            className="w-full h-96 border-0"
            title={readmeData.bookTitle}
          />
        </div>
      );
    }

    // Handle HTML content
    if (contentType.includes('html') && typeof content === 'string') {
      return (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">📖 Book Content (HTML)</h4>
          </div>
          <div 
            className="p-6 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      );
    }

    // Handle plain text content
    if (typeof content === 'string') {
      return (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">📝 Book Content (Text)</h4>
          </div>
          <div className="p-6">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
              {content}
            </pre>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">
          Unsupported content type: {contentType}
        </p>
      </div>
    );
  };

  return (
    <div className={`readme-book-viewer ${className}`}>
      {renderBookInfo()}

      {readmeData.ipfsHash ? (
        <div>
          {!showContent ? (
            <div className="text-center">
              <button
                onClick={fetchContent}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                      <path fill="currentColor" strokeWidth="4" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading Book Content...
                  </span>
                ) : (
                  '📚 Read Book Content'
                )}
              </button>
              
              <p className="text-sm text-gray-500 mt-2">
                This will fetch the full book content from IPFS
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-900">Book Content</h4>
                <button
                  onClick={() => setShowContent(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕ Close
                </button>
              </div>
              
              {error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">{error}</p>
                  <button
                    onClick={fetchContent}
                    className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                renderContent()
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-gray-600">
            📚 No IPFS content hash available for this README book
          </p>
          {readmeData.marketplaceUrl && (
            <a
              href={readmeData.marketplaceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
            >
              View on Marketplace →
            </a>
          )}
        </div>
      )}
    </div>
  );
}