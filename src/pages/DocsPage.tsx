// src/pages/DocsPage.tsx - Documentation display page
/** @jsxImportSource react */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BookOpenIcon, FileTextIcon, ExternalLinkIcon, XIcon as _XIcon, ArrowLeftIcon } from 'lucide-react';
import { themeClasses, cn } from '@/utils/theme';
import { useTheme } from '../providers/ThemeProvider';
import { DocShareButton } from '../components/share/DocShareButton';

interface DocItem {
  id: string;
  title: string;
  description: string;
  filename: string;
  type: 'html' | 'md';
}

const DOCS_ITEMS: DocItem[] = [
  {
    id: 'whitepaper',
    title: 'Evermark Whitepaper',
    description: 'Comprehensive technical whitepaper covering platform architecture, tokenomics, and roadmap',
    filename: 'EVERMARK_WHITEPAPER.md',
    type: 'md'
  },
  {
    id: 'protocol-overview',
    title: 'Protocol Overview',
    description: 'Complete overview of the Evermark protocol architecture and features',
    filename: 'protocol-overview.md',
    type: 'md'
  },
  {
    id: 'token-economics',
    title: 'Token Economics',
    description: 'EMARK token distribution, staking mechanics, and economic model',
    filename: 'token-economics.md',
    type: 'md'
  },
  {
    id: 'curation-voting',
    title: 'Curation & Voting',
    description: 'How voting power works for content curation and ranking',
    filename: 'curation-voting.md',
    type: 'md'
  },
  {
    id: 'reward-system',
    title: 'Reward System',
    description: 'How staking rewards and content curation rewards work',
    filename: 'reward-system.md',
    type: 'md'
  },
  {
    id: 'technical-overview',
    title: 'Technical Overview',
    description: 'Smart contract architecture and technical implementation details',
    filename: 'technical-overview.md',
    type: 'md'
  },
  {
    id: 'beta-points',
    title: 'Beta Points System',
    description: 'How to earn and convert beta points to EMARK tokens',
    filename: 'beta-points.md',
    type: 'md'
  },
  {
    id: 'alpha-retirement',
    title: 'Alpha Retirement Notice',
    description: 'Important information about Alpha contract retirement and user fund refunds',
    filename: 'alpha-retirement.md',
    type: 'md'
  },
  {
    id: 'dual-rewards-system',
    title: '[DRAFT] Dual Rewards System',
    description: 'Proposed dual rewards architecture for stakers and leaderboard winners',
    filename: 'draft-dual-rewards-system.md',
    type: 'md'
  }
];

export default function DocsPage(): React.ReactNode {
  const { isDark } = useTheme();
  const { docId } = useParams<{ docId?: string }>();
  const navigate = useNavigate();
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Load document by ID from URL parameter
  useEffect(() => {
    if (docId) {
      const doc = DOCS_ITEMS.find(item => item.id === docId);
      if (doc) {
        loadDocContent(doc, false); // Don't update URL
      } else {
        setError(`Document "${docId}" not found`);
        setLoading(false);
      }
    } else {
      // Clear selection when no docId in URL
      setSelectedDoc(null);
      setContent('');
      setError('');
    }
  }, [docId]);

  const loadDocContent = async (docItem: DocItem, updateUrl: boolean = true) => {
    setLoading(true);
    setError('');
    
    try {
      const url = `/docs/${docItem.filename}`;
      console.log('Loading doc from:', url);
      
      // Add cache-busting and no-cache headers
      const response = await fetch(url, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load ${docItem.title} (${response.status} ${response.statusText})`);
      }
      
      const text = await response.text();
      console.log('Loaded doc content, length:', text.length);
      
      setContent(text);
      setSelectedDoc(docItem);
      
      // Update URL to make it shareable
      if (updateUrl) {
        navigate(`/docs/${docItem.id}`, { replace: true });
      }
    } catch (err) {
      console.error('Error loading doc:', err);
      setError(err instanceof Error ? err.message : 'Failed to load documentation');
      setContent('');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToList = () => {
    navigate('/docs');
  };

  const renderMarkdown = (markdown: string) => {
    // Enhanced markdown to HTML conversion with theme-aware classes
    const headingClass = isDark ? 'text-white' : 'text-gray-900';
    const textClass = isDark ? 'text-gray-300' : 'text-gray-700';
    const emphasisClass = isDark ? 'text-gray-400' : 'text-gray-600';
    const codeClass = isDark ? 'bg-gray-800 text-green-400' : 'bg-gray-100 text-gray-800';
    const linkClass = isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800';
    const listClass = isDark ? 'text-gray-300' : 'text-gray-700';
    const blockquoteClass = isDark ? 'border-gray-600 bg-gray-800/50 text-gray-300' : 'border-gray-300 bg-gray-100/50 text-gray-700';
    
    let html = markdown;
    
    // Handle code blocks first (to protect them from other replacements)
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/gim, (match, lang, code) => {
      return `<pre class="${codeClass} p-4 rounded-lg overflow-x-auto my-4"><code class="font-mono text-sm">${code.trim()}</code></pre>`;
    });
    
    // Handle headings
    html = html.replace(/^# (.*$)/gim, `<h1 class="text-3xl font-bold ${headingClass} mb-6 mt-8 first:mt-0">$1</h1>`);
    html = html.replace(/^## (.*$)/gim, `<h2 class="text-2xl font-semibold ${headingClass} mt-8 mb-4">$1</h2>`);
    html = html.replace(/^### (.*$)/gim, `<h3 class="text-xl font-medium ${headingClass} mt-6 mb-3">$1</h3>`);
    html = html.replace(/^#### (.*$)/gim, `<h4 class="text-lg font-medium ${headingClass} mt-4 mb-2">$1</h4>`);
    
    // Handle blockquotes
    html = html.replace(/^> (.*$)/gim, `<blockquote class="border-l-4 ${blockquoteClass} pl-4 py-2 my-4">$1</blockquote>`);
    
    // Handle links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, `<a href="$2" class="${linkClass} underline" target="_blank" rel="noopener noreferrer">$1</a>`);
    
    // Handle bold and italic
    html = html.replace(/\*\*(.*?)\*\*/gim, `<strong class="font-semibold ${headingClass}">$1</strong>`);
    html = html.replace(/\*(.*?)\*/gim, `<em class="italic ${emphasisClass}">$1</em>`);
    
    // Handle inline code
    html = html.replace(/`([^`]+)`/gim, `<code class="${codeClass} px-2 py-1 rounded font-mono text-sm">$1</code>`);
    
    // Handle unordered lists
    html = html.replace(/^\* (.*$)/gim, `<li class="${listClass} mb-1">$1</li>`);
    html = html.replace(/^- (.*$)/gim, `<li class="${listClass} mb-1">$1</li>`);
    
    // Handle ordered lists
    html = html.replace(/^\d+\. (.*$)/gim, `<li class="${listClass} mb-1">$1</li>`);
    
    // Wrap consecutive list items in ul/ol tags
    html = html.replace(/(<li[^>]*>.*<\/li>\s*)+/gim, (match) => {
      return `<ul class="list-disc pl-6 mb-4 space-y-1">${match}</ul>`;
    });
    
    // Handle horizontal rules
    html = html.replace(/^---$/gim, `<hr class="border-t ${isDark ? 'border-gray-600' : 'border-gray-300'} my-6" />`);
    
    // Split into paragraphs and wrap
    const lines = html.split('\n');
    const paragraphs: string[] = [];
    let currentParagraph = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) {
        if (currentParagraph) {
          paragraphs.push(currentParagraph);
          currentParagraph = '';
        }
        continue;
      }
      
      // Don't wrap certain elements in paragraphs
      if (trimmedLine.match(/^<(h[1-6]|ul|ol|pre|blockquote|hr)/)) {
        if (currentParagraph) {
          paragraphs.push(`<p class="${textClass} mb-4 leading-relaxed">${currentParagraph}</p>`);
          currentParagraph = '';
        }
        paragraphs.push(trimmedLine);
      } else {
        if (currentParagraph) currentParagraph += ' ';
        currentParagraph += trimmedLine;
      }
    }
    
    // Add final paragraph if exists
    if (currentParagraph) {
      paragraphs.push(`<p class="${textClass} mb-4 leading-relaxed">${currentParagraph}</p>`);
    }
    
    return paragraphs.join('\n');
  };

  return (
    <div className={themeClasses.page}>
      {/* Header */}
      <div className={cn(
        themeClasses.section,
        "border-b border-purple-400/30"
      )}>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-cyan-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50">
                <BookOpenIcon className="h-7 w-7 text-black" />
              </div>
              <h1 className={themeClasses.headingHero}>
                DOCUMENTATION <span className="text-2xl md:text-3xl text-cyan-400 font-normal">[BETA]</span>
              </h1>
            </div>
            
            <p className={cn(
              "max-w-3xl mx-auto text-lg",
              isDark ? "text-gray-300" : "text-gray-700"
            )}>
              Complete documentation for the Evermark Beta protocol, smart contracts, and features.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {!selectedDoc ? (
          /* Documentation Cards Grid */
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {DOCS_ITEMS.map((item) => (
                <div
                  key={item.id}
                  onClick={() => loadDocContent(item)}
                  className={cn(
                    themeClasses.cardInteractive,
                    "hover:scale-105"
                  )}
                >
                  <div className="flex items-start space-x-4">
                    <div className={cn(
                      "p-3 rounded-lg flex-shrink-0",
                      isDark ? "bg-purple-900/30 border border-purple-500/30" : "bg-purple-100/80 border border-purple-200"
                    )}>
                      <FileTextIcon className={cn(
                        "h-6 w-6",
                        isDark ? "text-purple-400" : "text-purple-600"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold mb-2 text-app-text-on-card">
                        {item.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-app-text-secondary">
                        {item.description}
                      </p>
                      <div className="mt-3 flex items-center">
                        <span className="text-xs px-2 py-1 rounded-full bg-app-bg-secondary text-app-text-secondary">
                          {item.type.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* External Resources */}
            <div className={themeClasses.card}>
              <h3 className={cn(
                "text-lg font-semibold mb-4",
                themeClasses.textOnCard
              )}>
                External Resources
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a
                  href="https://github.com/ipfsnut/evermark-contracts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    themeClasses.cardInteractive,
                    "flex items-center space-x-3"
                  )}
                >
                  <ExternalLinkIcon className="h-5 w-5 text-app-text-on-card" />
                  <div>
                    <div className="font-medium text-app-text-on-card">Smart Contracts</div>
                    <div className="text-sm text-app-text-secondary">View contract source code</div>
                  </div>
                </a>
                <a
                  href="https://github.com/ipfsnut/evermark-beta"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    themeClasses.cardInteractive,
                    "flex items-center space-x-3"
                  )}
                >
                  <ExternalLinkIcon className="h-5 w-5 text-app-text-on-card" />
                  <div>
                    <div className="font-medium text-app-text-on-card">Beta Application</div>
                    <div className="text-sm text-app-text-secondary">Frontend source code</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* Document Viewer */
          <div className={themeClasses.cardLarge}>
            {/* Document Header */}
            <div className="flex items-center justify-between p-6 border-b border-app-border">
              <div className="flex items-center space-x-4">
                <div className={cn(
                  "p-2 rounded-lg",
                  isDark ? "bg-purple-900/30 border border-purple-500/30" : "bg-purple-100/80 border border-purple-200"
                )}>
                  <BookOpenIcon className={cn(
                    "h-6 w-6",
                    isDark ? "text-purple-400" : "text-purple-600"
                  )} />
                </div>
                <div>
                  <h1 className={cn(
                    "text-2xl font-bold",
                    isDark ? "text-white" : "text-gray-900"
                  )}>{selectedDoc.title}</h1>
                  <p className={cn(
                    "text-sm mb-3",
                    isDark ? "text-gray-400" : "text-gray-600"
                  )}>{selectedDoc.description}</p>
                  
                  {/* Share buttons */}
                  <DocShareButton 
                    docTitle={selectedDoc.title}
                    docId={selectedDoc.id}
                    variant="default"
                    className="mt-2"
                  />
                </div>
              </div>
              <button
                onClick={handleBackToList}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-secondary"
                title="Back to documentation list"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                <span className="text-sm font-medium">Back to Docs</span>
              </button>
            </div>

            {/* Document Content */}
            <div className="p-8">
              {loading && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
                  <p className={cn(
                    "mt-2",
                    isDark ? "text-gray-400" : "text-gray-600"
                  )}>Loading documentation...</p>
                </div>
              )}

              {error && (
                <div className={cn(
                  "border rounded-lg p-4 mb-6",
                  isDark 
                    ? "bg-red-900/30 border-red-500/30" 
                    : "bg-red-100/50 border-red-300"
                )}>
                  <p className={cn(
                    isDark ? "text-red-200" : "text-red-700"
                  )}>{error}</p>
                </div>
              )}

              {content && !loading && !error && (
                <div className="prose max-w-none">
                  {selectedDoc.type === 'html' ? (
                    <div 
                      dangerouslySetInnerHTML={{ __html: content }}
                      className={cn(
                        "space-y-6",
                        !isDark && "prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900"
                      )}
                    />
                  ) : (
                    <div 
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                      className="space-y-6"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Floating share button for when viewing a specific document */}
      {selectedDoc && (
        <DocShareButton 
          docTitle={selectedDoc.title}
          docId={selectedDoc.id}
          variant="floating"
        />
      )}
    </div>
  );
}