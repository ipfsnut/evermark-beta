import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft,
  ExternalLink,
  Share,
  MessageCircle,
  Calendar,
  User,
  Tag,
  CheckCircle,
  AlertCircle,
  Copy,
  Eye,
  Vote,
  FileText,
  Link as LinkIcon,
  Image,
  Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Feature imports
import { useEvermarksState, type Evermark } from '@/features/evermarks';
import { VotingPanel } from '@/features/voting';
import { useAppAuth } from '@/providers/AppContext';
import { useFarcasterUser } from '@/lib/farcaster';

// Utility function for responsive classes
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Simple mobile detection hook
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

// Share modal component
const ShareModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  evermark: Evermark;
}> = ({ isOpen, onClose, evermark }) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/evermark/${evermark.id}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h3 className="text-xl font-bold text-white">Share Evermark</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400 truncate mr-3">{shareUrl}</span>
              <button
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-2 px-3 py-1 rounded text-sm font-medium transition-colors",
                  copied 
                    ? "bg-green-600 text-white" 
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                )}
              >
                <Copy className="h-3 w-3" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out this Evermark: ${evermark.title}`)}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <span>🐦</span>
              Twitter
            </a>
            <a
              href={`https://warpcast.com/~/compose?text=${encodeURIComponent(`Check out this Evermark: ${evermark.title} ${shareUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <span>🚀</span>
              Farcaster
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

// Content type icon helper
const getContentTypeIcon = (contentType: Evermark['contentType']) => {
  switch (contentType) {
    case 'Cast':
      return <MessageCircle className="h-5 w-5" />;
    case 'DOI':
      return <FileText className="h-5 w-5" />;
    case 'ISBN':
      return <FileText className="h-5 w-5" />;
    case 'URL':
      return <LinkIcon className="h-5 w-5" />;
    default:
      return <FileText className="h-5 w-5" />;
  }
};

// Format content type for display
const formatContentType = (contentType: Evermark['contentType']) => {
  switch (contentType) {
    case 'Cast':
      return 'Farcaster Cast';
    case 'DOI':
      return 'Academic Paper';
    case 'ISBN':
      return 'Book';
    case 'URL':
      return 'Web Content';
    default:
      return 'Custom Content';
  }
};

export default function EvermarkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAppAuth();
  const { isInFarcaster } = useFarcasterUser();
  const isMobile = useIsMobile();
  
  const [evermark, setEvermark] = useState<Evermark | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showVoting, setShowVoting] = useState(false);

  const { loadEvermark } = useEvermarksState();

  // Load evermark data
  useEffect(() => {
    if (!id) {
      setError('Invalid evermark ID');
      setIsLoading(false);
      return;
    }

    const fetchEvermark = async () => {
      try {
        setIsLoading(true);
        const data = await loadEvermark(id);
        if (data) {
          setEvermark(data);
        } else {
          setError('Evermark not found');
        }
      } catch (error) {
        console.error('Error loading evermark:', error);
        setError('Failed to load evermark');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvermark();
  }, [id, loadEvermark]);

  // Handle voting toggle
  const handleVoteClick = () => {
    if (isAuthenticated) {
      setShowVoting(!showVoting);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading Evermark...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !evermark) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-red-400 mb-2">Evermark Not Found</h1>
          <p className="text-gray-400 mb-6">{error || 'The evermark you\'re looking for doesn\'t exist.'}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Go Back
            </button>
            <Link
              to="/explore"
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              Explore All
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gray-900/50 border-b border-gray-700 sticky top-0 z-40 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </button>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white rounded-lg transition-colors"
              >
                <Share className="h-4 w-4" />
                {!isMobile && 'Share'}
              </button>
              
              {isAuthenticated && (
                <button
                  onClick={handleVoteClick}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors font-medium",
                    showVoting
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white"
                  )}
                >
                  <Vote className="h-4 w-4" />
                  {!isMobile && (showVoting ? 'Hide Voting' : 'Vote')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className={cn(
          "gap-8",
          isMobile ? "space-y-8" : "grid grid-cols-1 lg:grid-cols-3"
        )}>
          {/* Main Content */}
          <div className={cn("space-y-8", !isMobile && "lg:col-span-2")}>
            {/* Hero Section */}
            <div className="space-y-6">
              {/* Content Type Badge */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-purple-900/30 text-purple-300 px-3 py-1 rounded-full border border-purple-500/30">
                  {getContentTypeIcon(evermark.contentType)}
                  <span className="text-sm font-medium">{formatContentType(evermark.contentType)}</span>
                </div>
                
                {evermark.verified && (
                  <div className="flex items-center gap-1 bg-green-900/30 text-green-300 px-3 py-1 rounded-full border border-green-500/30">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Verified</span>
                  </div>
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                {evermark.title}
              </h1>

              {/* Author and Date */}
              <div className="flex flex-wrap items-center gap-4 text-gray-400">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>by {evermark.author}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDistanceToNow(new Date(evermark.createdAt), { addSuffix: true })}</span>
                </div>
                {evermark.viewCount !== undefined && (
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <span>{evermark.viewCount.toLocaleString()} views</span>
                  </div>
                )}
              </div>
            </div>

            {/* Featured Image */}
            {evermark.image && (
              <div className="relative">
                <img
                  src={evermark.image}
                  alt={evermark.title}
                  className="w-full h-64 md:h-96 object-cover rounded-lg border border-gray-700"
                />
                {evermark.imageStatus !== 'processed' && (
                  <div className="absolute bottom-4 left-4 bg-black/80 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                    {evermark.imageStatus === 'processing' ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-3 w-3 border border-yellow-400 border-t-transparent mr-2"></div>
                        Processing...
                      </>
                    ) : evermark.imageStatus === 'failed' ? (
                      <>
                        <AlertCircle className="inline h-3 w-3 mr-1 text-red-400" />
                        Failed to process
                      </>
                    ) : (
                      <>
                        <Image className="inline h-3 w-3 mr-1 text-gray-400" />
                        No image
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {evermark.description && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-white mb-3">Description</h2>
                <p className="text-gray-300 leading-relaxed">{evermark.description}</p>
              </div>
            )}

            {/* Source Link */}
            {evermark.sourceUrl && (
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-blue-300 mb-3">Source</h2>
                <a
                  href={evermark.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors break-all"
                >
                  <ExternalLink className="h-4 w-4 flex-shrink-0" />
                  {evermark.sourceUrl}
                </a>
              </div>
            )}

            {/* Tags */}
            {evermark.tags.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-white">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {evermark.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 bg-purple-900/30 text-purple-300 px-3 py-1 rounded-full border border-purple-500/30"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Extended Metadata */}
            {evermark.extendedMetadata && Object.keys(evermark.extendedMetadata).some(key => {
              const metadata = evermark.extendedMetadata as Record<string, any>;
              return metadata[key] && key !== 'tags' && key !== 'customFields';
            }) && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Additional Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {evermark.extendedMetadata.doi && (
                    <div>
                      <span className="text-gray-400">DOI:</span>
                      <span className="ml-2 text-white font-mono">{evermark.extendedMetadata.doi}</span>
                    </div>
                  )}
                  {evermark.extendedMetadata.isbn && (
                    <div>
                      <span className="text-gray-400">ISBN:</span>
                      <span className="ml-2 text-white font-mono">{evermark.extendedMetadata.isbn}</span>
                    </div>
                  )}
                  {evermark.extendedMetadata.castData && (
                    <div className="md:col-span-2">
                      <span className="text-gray-400">Farcaster Cast:</span>
                      <div className="mt-2 bg-gray-700/50 p-3 rounded border border-gray-600">
                        <p className="text-gray-300">{evermark.extendedMetadata.castData.content}</p>
                        {evermark.extendedMetadata.castData.engagement && (
                          <div className="flex gap-4 mt-2 text-xs text-gray-400">
                            <span>❤️ {evermark.extendedMetadata.castData.engagement.likes}</span>
                            <span>🔄 {evermark.extendedMetadata.castData.engagement.recasts}</span>
                            <span>💬 {evermark.extendedMetadata.castData.engagement.replies}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Voting Panel */}
            {showVoting && isAuthenticated ? (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg">
                <div className="p-4 border-b border-gray-700">
                  <h3 className="font-semibold text-white">Vote on this Evermark</h3>
                </div>
                <div className="p-4">
                  <VotingPanel evermarkId={evermark.id} />
                </div>
              </div>
            ) : !isAuthenticated ? (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
                <Vote className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Vote on Content</h3>
                <p className="text-gray-400 mb-4">
                  Connect your wallet to vote on this evermark and earn rewards
                </p>
                <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-sm text-blue-300">
                    {isInFarcaster 
                      ? "🚀 Farcaster wallet integration ready"
                      : "🖥️ Connect any Ethereum wallet"
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
                <Vote className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Support This Content</h3>
                <p className="text-gray-400 mb-4">
                  Click the Vote button above to delegate your voting power to this evermark
                </p>
                <button
                  onClick={handleVoteClick}
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-500 hover:to-blue-500 transition-colors font-medium"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Start Voting
                </button>
              </div>
            )}

            {/* Stats */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <h3 className="font-semibold text-white mb-4">Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Created:</span>
                  <span className="text-white">{new Date(evermark.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Token ID:</span>
                  <span className="text-white font-mono">#{evermark.tokenId}</span>
                </div>
                {evermark.votes !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Votes:</span>
                    <span className="text-green-400 font-medium">{evermark.votes}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Creator:</span>
                  <span className="text-white truncate ml-2">{evermark.creator}</span>
                </div>
              </div>
            </div>

            {/* Technical Details */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <h3 className="font-semibold text-white mb-4">Technical Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Network:</span>
                  <span className="text-green-400">Base Mainnet</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Storage:</span>
                  <span className="text-cyan-400">IPFS + Blockchain</span>
                </div>
                {evermark.metadataURI && (
                  <div>
                    <span className="text-gray-400 block mb-1">Metadata URI:</span>
                    <a
                      href={evermark.metadataURI}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 transition-colors break-all text-xs"
                    >
                      {evermark.metadataURI}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <h3 className="font-semibold text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link
                  to="/explore"
                  className="w-full flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors group"
                >
                  <span className="text-white">Explore More</span>
                  <span className="text-gray-400 group-hover:text-white transition-colors">→</span>
                </Link>
                
                <Link
                  to="/leaderboard"
                  className="w-full flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors group"
                >
                  <span className="text-white">View Leaderboard</span>
                  <span className="text-gray-400 group-hover:text-white transition-colors">→</span>
                </Link>
                
                {isAuthenticated && (
                  <Link
                    to="/create"
                    className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-green-600/20 to-green-700/20 border border-green-500/30 hover:from-green-600/30 hover:to-green-700/30 rounded-lg transition-colors group"
                  >
                    <span className="text-green-400">Create Evermark</span>
                    <span className="text-green-400 group-hover:text-green-300 transition-colors">→</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        evermark={evermark}
      />
    </div>
  );
}