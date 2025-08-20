// src/pages/DocsPage.tsx - Documentation display page
import { useState } from 'react';
import { BookOpenIcon, FileTextIcon, ExternalLinkIcon, XIcon } from 'lucide-react';
import { cn } from '@/utils/responsive';
import { useTheme } from '@/providers/ThemeProvider';

interface DocItem {
  id: string;
  title: string;
  description: string;
  filename: string;
  type: 'html' | 'md';
}

const DOCS_ITEMS: DocItem[] = [
  {
    id: 'readme',
    title: 'Getting Started',
    description: 'Introduction to Evermark Beta, setup instructions, and quick start guide',
    filename: 'README.md',
    type: 'md'
  },
  {
    id: 'protocol-overview',
    title: 'Protocol Overview',
    description: 'Complete overview of the Evermark protocol architecture and features',
    filename: 'protocol-overview.html',
    type: 'html'
  },
  {
    id: 'token-economics',
    title: 'Token Economics',
    description: 'EMARK token distribution, staking mechanics, and economic model',
    filename: 'token-economics.md',
    type: 'md'
  },
  {
    id: 'governance-voting',
    title: 'Governance & Voting',
    description: 'How voting power works and governance participation',
    filename: 'governance-voting.md',
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
    id: 'dropped-features',
    title: 'Beta vs Alpha Changes',
    description: 'Features that were modified or removed in the Beta version',
    filename: 'dropped-features.md',
    type: 'md'
  }
];

export default function DocsPage() {
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const { isDark } = useTheme();

  const loadDocContent = async (docItem: DocItem) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/docs/${docItem.filename}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${docItem.title}`);
      }
      
      const text = await response.text();
      setContent(text);
      setSelectedDoc(docItem);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documentation');
      setContent('');
    } finally {
      setLoading(false);
    }
  };

  const renderMarkdown = (markdown: string) => {
    // Enhanced markdown to HTML conversion with theme-aware classes
    const headingClass = isDark ? 'text-white' : 'text-gray-900';
    const textClass = isDark ? 'text-gray-300' : 'text-gray-700';
    const emphasisClass = isDark ? 'text-gray-300' : 'text-gray-600';
    const codeClass = isDark 
      ? 'bg-gray-800 text-purple-300' 
      : 'bg-yellow-100 text-purple-700';
    
    return markdown
      .replace(/^# (.*$)/gim, `<h1 class="text-3xl font-bold ${headingClass} mb-6">$1</h1>`)
      .replace(/^## (.*$)/gim, `<h2 class="text-2xl font-semibold ${headingClass} mt-8 mb-4">$1</h2>`)
      .replace(/^### (.*$)/gim, `<h3 class="text-xl font-medium ${headingClass} mt-6 mb-3">$1</h3>`)
      .replace(/\*\*(.*)\*\*/gim, `<strong class="font-semibold ${headingClass}">$1</strong>`)
      .replace(/\*(.*)\*/gim, `<em class="italic ${emphasisClass}">$1</em>`)
      .replace(/`([^`]*)`/gim, `<code class="${codeClass} px-2 py-1 rounded font-mono text-sm">$1</code>`)
      .replace(/\n\n/gim, `</p><p class="${textClass} mb-4">`)
      .replace(/^(?!<[h|p])/gim, `<p class="${textClass} mb-4">`)
      .replace(/\n/gim, '<br />');
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-200",
      isDark ? "bg-gray-900 text-white" : "bg-yellow-50 text-gray-900"
    )}>
      {/* Header */}
      <div className={cn(
        "border-b border-purple-400/30",
        isDark 
          ? "bg-gradient-to-r from-gray-900 via-black to-gray-900" 
          : "bg-gradient-to-r from-yellow-100 via-yellow-50 to-yellow-100"
      )}>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-cyan-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50">
                <BookOpenIcon className="h-7 w-7 text-black" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-purple-400 via-cyan-400 to-green-500 bg-clip-text text-transparent">
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
                    "rounded-lg p-6 border transition-all duration-200 cursor-pointer hover:scale-105",
                    isDark 
                      ? "bg-gray-800/50 border-gray-700 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/20" 
                      : "bg-white/90 border-yellow-200 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/20"
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
                      <h3 className={cn(
                        "text-lg font-semibold mb-2",
                        isDark ? "text-white" : "text-gray-900"
                      )}>
                        {item.title}
                      </h3>
                      <p className={cn(
                        "text-sm leading-relaxed",
                        isDark ? "text-gray-400" : "text-gray-600"
                      )}>
                        {item.description}
                      </p>
                      <div className="mt-3 flex items-center">
                        <span className={cn(
                          "text-xs px-2 py-1 rounded-full",
                          isDark 
                            ? "bg-gray-700 text-gray-300" 
                            : "bg-yellow-100 text-gray-700"
                        )}>
                          {item.type.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* External Resources */}
            <div className={cn(
              "rounded-lg p-6 border",
              isDark 
                ? "bg-gray-800/30 border-gray-700" 
                : "bg-white/60 border-yellow-200"
            )}>
              <h3 className={cn(
                "text-lg font-semibold mb-4",
                isDark ? "text-white" : "text-gray-900"
              )}>
                External Resources
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a
                  href="https://github.com/ipfsnut/evermark-contracts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center space-x-3 p-4 rounded-lg border transition-colors",
                    isDark 
                      ? "bg-gray-700/30 border-gray-600 hover:border-purple-400/50 text-purple-400 hover:text-purple-300" 
                      : "bg-yellow-50 border-yellow-300 hover:border-purple-400/50 text-purple-600 hover:text-purple-500"
                  )}
                >
                  <ExternalLinkIcon className="h-5 w-5" />
                  <div>
                    <div className="font-medium">Smart Contracts</div>
                    <div className={cn(
                      "text-sm",
                      isDark ? "text-gray-400" : "text-gray-600"
                    )}>View contract source code</div>
                  </div>
                </a>
                <a
                  href="https://github.com/ipfsnut/evermark-beta"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center space-x-3 p-4 rounded-lg border transition-colors",
                    isDark 
                      ? "bg-gray-700/30 border-gray-600 hover:border-purple-400/50 text-purple-400 hover:text-purple-300" 
                      : "bg-yellow-50 border-yellow-300 hover:border-purple-400/50 text-purple-600 hover:text-purple-500"
                  )}
                >
                  <ExternalLinkIcon className="h-5 w-5" />
                  <div>
                    <div className="font-medium">Beta Application</div>
                    <div className={cn(
                      "text-sm",
                      isDark ? "text-gray-400" : "text-gray-600"
                    )}>Frontend source code</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* Document Viewer */
          <div className={cn(
            "rounded-lg shadow-lg border",
            isDark 
              ? "bg-gray-800/50 border-gray-700" 
              : "bg-white/90 border-yellow-200"
          )}>
            {/* Document Header */}
            <div className={cn(
              "flex items-center justify-between p-6 border-b",
              isDark ? "border-gray-700" : "border-yellow-200"
            )}>
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
                    "text-sm",
                    isDark ? "text-gray-400" : "text-gray-600"
                  )}>{selectedDoc.description}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  isDark 
                    ? "text-gray-400 hover:text-white hover:bg-gray-700" 
                    : "text-gray-600 hover:text-gray-900 hover:bg-yellow-100"
                )}
                title="Back to documentation list"
              >
                <XIcon className="h-5 w-5" />
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
    </div>
  );
}