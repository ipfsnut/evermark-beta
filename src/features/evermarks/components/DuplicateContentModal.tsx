import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ExternalLink, Heart, Users, Calendar } from 'lucide-react';
import { type DuplicateCheckResponse } from '@/utils/contentIdentifiers';
import { shouldPreventDuplication, getConfidenceDescription } from '@/utils/contentIdentifiers';

interface DuplicateContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateInfo: DuplicateCheckResponse;
  onProceedAnyway?: () => void;
  onViewExisting: (tokenId: number) => void;
}

export function DuplicateContentModal({
  isOpen,
  onClose,
  duplicateInfo,
  onProceedAnyway,
  onViewExisting
}: DuplicateContentModalProps) {
  const { confidence, duplicateType, message, existingEvermark } = duplicateInfo;
  const isPrevented = shouldPreventDuplication(confidence);
  const confidenceDescription = getConfidenceDescription(confidence);
  
  // Get content type specific icons and labels
  const getContentTypeInfo = (type: string) => {
    switch (type) {
      case 'cast_hash':
        return {
          icon: '🗨️',
          label: 'Farcaster Cast',
          description: 'This cast has a unique identifier that guarantees it\'s identical content.'
        };
      case 'doi':
        return {
          icon: '📄',
          label: 'Research Paper (DOI)',
          description: 'DOI numbers uniquely identify academic publications.'
        };
      case 'isbn':
        return {
          icon: '📚',
          label: 'Book (ISBN)',
          description: 'ISBN numbers uniquely identify book editions.'
        };
      case 'tweet_id':
        return {
          icon: '🐦',
          label: 'Twitter/X Post',
          description: 'Tweet IDs uniquely identify posts on Twitter/X.'
        };
      case 'youtube_id':
        return {
          icon: '📺',
          label: 'YouTube Video',
          description: 'Video IDs uniquely identify YouTube content.'
        };
      case 'github_resource':
        return {
          icon: '💻',
          label: 'GitHub Resource',
          description: 'Repository and commit information identify specific code states.'
        };
      case 'normalized_url':
        return {
          icon: '🔗',
          label: 'Web Content',
          description: 'URL normalization helps identify similar web content.'
        };
      default:
        return {
          icon: '📎',
          label: 'Content',
          description: 'Content analysis detected potential similarity.'
        };
    }
  };

  const contentInfo = getContentTypeInfo(duplicateType);
  
  // Get appropriate warning color based on confidence
  const getWarningStyle = (confidence: string) => {
    switch (confidence) {
      case 'exact':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Duplicate Content Detected
          </DialogTitle>
          <DialogDescription>
            We found similar content that may already be preserved as an evermark.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Content Type Badge */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50">
            <span className="text-xl">{contentInfo.icon}</span>
            <div>
              <p className="font-medium text-sm">{contentInfo.label}</p>
              <p className="text-xs text-gray-600">{contentInfo.description}</p>
            </div>
          </div>

          {/* Confidence Warning */}
          <div className={`p-3 rounded-lg border ${getWarningStyle(confidence)}`}>
            <p className="text-sm font-medium mb-1">
              Confidence Level: {confidence.charAt(0).toUpperCase() + confidence.slice(1)}
            </p>
            <p className="text-xs">{confidenceDescription}</p>
          </div>

          {/* Duplicate Message */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">{message}</p>
          </div>

          {/* Existing Evermark Info */}
          {existingEvermark && (
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">
                    {existingEvermark.title}
                  </h4>
                  <p className="text-xs text-gray-600 truncate">
                    by {existingEvermark.author}
                  </p>
                </div>
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                  #{existingEvermark.token_id}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(existingEvermark.created_at)}
                  </span>
                  {existingEvermark.vote_count && existingEvermark.vote_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {existingEvermark.vote_count}
                    </span>
                  )}
                </div>
                {existingEvermark.leaderboard_rank && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Rank #{existingEvermark.leaderboard_rank}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action Message */}
          <div className="text-sm text-gray-600">
            {isPrevented ? (
              <p>
                <strong>This content cannot be duplicated.</strong> Instead, you can vote on the existing evermark to show your support.
              </p>
            ) : confidence === 'high' ? (
              <p>
                We recommend voting on the existing evermark instead of creating a duplicate. However, you can still proceed if this is truly different content.
              </p>
            ) : (
              <p>
                This might be similar content. Please review the existing evermark before proceeding.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col space-y-2">
          {/* Primary Actions */}
          <div className="flex w-full gap-2">
            {existingEvermark && (
              <Button
                variant="default"
                onClick={() => onViewExisting(existingEvermark.token_id)}
                className="flex-1 flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View Existing
              </Button>
            )}
            
            {!isPrevented && onProceedAnyway && (
              <Button
                variant="outline"
                onClick={onProceedAnyway}
                className="flex-1"
              >
                {confidence === 'high' ? 'Proceed Anyway' : 'Create New'}
              </Button>
            )}
          </div>

          {/* Secondary Actions */}
          <div className="flex w-full gap-2">
            <Button 
              variant="ghost" 
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DuplicateContentModal;