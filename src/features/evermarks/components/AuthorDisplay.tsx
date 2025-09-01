import { useState } from 'react';
import { ChevronDown, ChevronUp, User } from 'lucide-react';

interface AuthorInfo {
  given?: string;
  family?: string;
  name?: string;
  orcid?: string;
}

interface AuthorDisplayProps {
  author: string;
  metadata?: {
    academic?: {
      authors?: AuthorInfo[];
      primaryAuthor?: string;
      journal?: string;
    };
  };
  className?: string;
  showExpandable?: boolean;
}

export function AuthorDisplay({ 
  author, 
  metadata, 
  className = '', 
  showExpandable = true 
}: AuthorDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const academicData = metadata?.academic;
  const hasMultipleAuthors = academicData?.authors && academicData.authors.length > 1;
  
  // If no academic metadata or single author, show simple display
  if (!hasMultipleAuthors) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <User className="h-4 w-4 flex-shrink-0" />
        <span>by {author}</span>
      </div>
    );
  }

  const totalAuthors = academicData.authors?.length || 0;
  const displayAuthor = academicData.primaryAuthor || author;

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 flex-shrink-0" />
        <span>by {displayAuthor}</span>
        {showExpandable && hasMultipleAuthors && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            aria-label={isExpanded ? 'Hide all authors' : 'Show all authors'}
          >
            <span>{totalAuthors} authors</span>
            {isExpanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        )}
      </div>
      
      {isExpanded && academicData.authors && (
        <div className="mt-3 pl-6 space-y-1 text-sm text-gray-300">
          <div className="font-medium">All Authors:</div>
          {academicData.authors.map((authorInfo, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-6 text-gray-500">{index + 1}.</span>
              <span>{authorInfo.name}</span>
              {authorInfo.orcid && (
                <a
                  href={`https://orcid.org/${authorInfo.orcid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-1 py-0.5 bg-green-700 hover:bg-green-600 rounded text-white transition-colors"
                  title="View ORCID profile"
                >
                  ORCID
                </a>
              )}
            </div>
          ))}
          {academicData.journal && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <span className="text-gray-400">Published in: </span>
              <span className="text-gray-300">{academicData.journal}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AuthorDisplay;