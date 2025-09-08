import React from 'react';
import { 
  XIcon, 
  ExternalLinkIcon,
  ShareIcon,
  UserIcon,
  CalendarIcon,
  TagIcon,
  LinkIcon,
  VoteIcon
} from 'lucide-react';
import { Formatters } from '../../../utils/formatters';
import type { Evermark } from '../types';
import { UnifiedEvermarkImage } from '../../../components/images/UnifiedEvermarkImage';
import { ReadmeBookViewer } from './ReadmeBookViewer';

interface EvermarkModalProps {
  evermark: Evermark | null;
  isOpen: boolean;
  onClose: () => void;
  onVote?: (evermarkId: string) => void;
  onShare?: (evermark: Evermark) => void;
  className?: string;
}

export function EvermarkModal({
  evermark,
  isOpen,
  onClose,
  onVote,
  onShare,
  className = ''
}: EvermarkModalProps) {

  if (!isOpen || !evermark) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleVoteClick = () => {
    onVote?.(evermark.id);
  };

  const handleShareClick = () => {
    onShare?.(evermark);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className={`relative bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white truncate">
            {evermark.title}
          </h2>
          <div className="flex items-center gap-2">
            {onShare && (
              <button
                onClick={handleShareClick}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                title="Share"
              >
                <ShareIcon className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              title="Close"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Image */}
          {(evermark.image || evermark.supabaseImageUrl) && (
            <div className="relative">
              <UnifiedEvermarkImage
                evermark={evermark}
                variant="hero"
                alt={evermark.title}
                className="w-full rounded-lg border border-gray-600"
              />
              {evermark.verified && (
                <div className="absolute top-3 right-3 bg-green-600 rounded-full p-2">
                  <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center text-gray-300">
              <UserIcon className="h-4 w-4 mr-2 text-gray-400" />
              <span>Created by {evermark.author}</span>
            </div>
            <div className="flex items-center text-gray-300">
              <CalendarIcon className="h-4 w-4 mr-2 text-gray-400" />
              <span>{Formatters.formatRelativeTime(evermark.createdAt)}</span>
            </div>
          </div>

          {/* Description */}
          {evermark.description && (
            <div>
              <h3 className="text-lg font-medium text-white mb-2">Description</h3>
              <p className="text-gray-300 leading-relaxed">{evermark.description}</p>
            </div>
          )}

          {/* Source URL and README Book Links */}
          {evermark.sourceUrl && (
            <div>
              <h3 className="text-lg font-medium text-white mb-2">
                {evermark.contentType === 'README' ? 'Links' : 'Source'}
              </h3>
              
              {evermark.contentType === 'README' ? (
                <div className="space-y-3">
                  {/* Get NFT Book Link */}
                  <a
                    href={evermark.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-cyan-400 hover:text-cyan-300 transition-colors break-all"
                  >
                    <LinkIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                    Get this NFT Book on OpenSea
                    <ExternalLinkIcon className="h-3 w-3 ml-1 flex-shrink-0" />
                  </a>
                  
                  {/* Read Book Link */}
                  {evermark.extendedMetadata?.readmeData?.ipfsHash && (
                    <div>
                      <a
                        href={`https://ipfs.nftbookbazaar.com/ipfs/${evermark.extendedMetadata?.readmeData?.ipfsHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-green-400 hover:text-green-300 transition-colors bg-green-900/20 px-4 py-2 rounded-lg border border-green-500/30"
                      >
                        <span className="mr-2">📖</span>
                        Read Full Book Content
                        <ExternalLinkIcon className="h-3 w-3 ml-1 flex-shrink-0" />
                      </a>
                      <p className="text-xs text-gray-400 mt-1">
                        Access the complete book content stored on IPFS
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <a
                  href={evermark.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-cyan-400 hover:text-cyan-300 transition-colors break-all"
                >
                  <LinkIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                  {evermark.sourceUrl}
                  <ExternalLinkIcon className="h-3 w-3 ml-1 flex-shrink-0" />
                </a>
              )}
            </div>
          )}

          {/* Tags */}
          {evermark.tags.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-white mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {evermark.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center bg-purple-900/30 text-purple-300 px-3 py-1 rounded-full border border-purple-500/30"
                  >
                    <TagIcon className="h-3 w-3 mr-1" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Extended Metadata */}
          {evermark.extendedMetadata && (
            <div>
              <h3 className="text-lg font-medium text-white mb-3">Additional Information</h3>
              <div className="bg-gray-800/50 rounded-lg p-4 space-y-2 text-sm">
                {evermark.extendedMetadata.doi && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">DOI:</span>
                    <span className="text-white font-mono">{evermark.extendedMetadata.doi}</span>
                  </div>
                )}
                {evermark.extendedMetadata.isbn && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">ISBN:</span>
                    <span className="text-white font-mono">{evermark.extendedMetadata.isbn}</span>
                  </div>
                )}
                {evermark.extendedMetadata.castData && (
                  <div>
                    <span className="text-gray-400">Farcaster Cast:</span>
                    <div className="mt-2 bg-gray-700/50 p-3 rounded border border-gray-600">
                      <p className="text-gray-300 mb-2">{evermark.extendedMetadata.castData.content}</p>
                      {evermark.extendedMetadata.castData.engagement && (
                        <div className="flex gap-4 text-xs text-gray-400">
                          <span>❤️ {evermark.extendedMetadata.castData.engagement.likes}</span>
                          <span>🔄 {evermark.extendedMetadata.castData.engagement.recasts}</span>
                          <span>💬 {evermark.extendedMetadata.castData.engagement.replies}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {evermark.extendedMetadata.readmeData && (
                  <div>
                    <span className="text-gray-400">README Book Details:</span>
                    <div className="mt-2 bg-gray-700/50 p-3 rounded border border-gray-600">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-gray-200 font-medium">{evermark.extendedMetadata.readmeData.bookTitle}</div>
                          <div className="text-gray-400 text-sm">by {evermark.extendedMetadata.readmeData.bookAuthor}</div>
                        </div>
                        {evermark.extendedMetadata.readmeData.genre && (
                          <span className="bg-blue-800/50 text-blue-200 text-xs px-2 py-1 rounded">
                            {evermark.extendedMetadata.readmeData.genre}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                        <div>Publisher: {evermark.extendedMetadata.readmeData.publisher || 'PageDAO'}</div>
                        {evermark.extendedMetadata.readmeData.publicationDate && (
                          <div>Published: {evermark.extendedMetadata.readmeData.publicationDate}</div>
                        )}
                        {evermark.extendedMetadata.readmeData.pageCount && (
                          <div>Pages: {evermark.extendedMetadata.readmeData.pageCount}</div>
                        )}
                        {evermark.extendedMetadata.readmeData.chapterNumber && evermark.extendedMetadata.readmeData.totalChapters && (
                          <div>Chapter: {evermark.extendedMetadata.readmeData.chapterNumber} of {evermark.extendedMetadata.readmeData.totalChapters}</div>
                        )}
                      </div>
                      {evermark.extendedMetadata.readmeData.ipfsHash && (
                        <div className="mt-2 pt-2 border-t border-gray-600">
                          <div className="flex items-center gap-2 text-xs text-green-400">
                            <span>🟢 Full content available on IPFS</span>
                            <span className="font-mono bg-gray-800/50 px-2 py-1 rounded">
                              {evermark.extendedMetadata.readmeData.ipfsHash.substring(0, 12)}...
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* README Book Viewer - Show if it's a README book with data */}
          {evermark.contentType === 'README' && evermark.extendedMetadata?.readmeData && (
            <div>
              <h3 className="text-lg font-medium text-white mb-3">📖 Book Reader</h3>
              <ReadmeBookViewer 
                readmeData={evermark.extendedMetadata.readmeData}
                className="bg-gray-800/50 rounded-lg"
              />
            </div>
          )}

          {/* Stats */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-white mb-3">Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold text-cyan-400">#{evermark.tokenId}</div>
                <div className="text-gray-400">Token ID</div>
              </div>
              {evermark.votes !== undefined && (
                <div className="text-center">
                  <div className="text-lg font-bold text-green-400">{evermark.votes}</div>
                  <div className="text-gray-400">Votes</div>
                </div>
              )}
              {evermark.viewCount !== undefined && (
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-400">{evermark.viewCount.toLocaleString()}</div>
                  <div className="text-gray-400">Views</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-lg font-bold text-purple-400">{evermark.contentType}</div>
                <div className="text-gray-400">Type</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center p-6 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            Created {Formatters.formatRelativeTime(evermark.createdAt)}
          </div>
          
          <div className="flex gap-3">
            {onVote && (
              <button
                onClick={handleVoteClick}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-500 hover:to-blue-500 transition-colors font-medium"
              >
                <VoteIcon className="h-4 w-4" />
                Vote
              </button>
            )}
            
            {evermark.sourceUrl && (
              <a
                href={evermark.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <ExternalLinkIcon className="h-4 w-4" />
                View Source
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
