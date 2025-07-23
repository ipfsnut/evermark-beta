import { useState, useMemo } from 'react';
import { 
  History,
  Filter,
  Search,
  X,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ShieldCheck,
  Coins,
  Clock,
  Copy,
  ExternalLink
} from 'lucide-react';

interface TokenHistoryProps {
  className?: string;
}

export function TokenHistory({ className = '' }: TokenHistoryProps) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // TODO: Replace with real transaction fetching hook
  // const { transactions, isLoading, refetch } = useTokenHistory();
  const transactions: any[] = []; // Placeholder for now
  const isLoading = false;

  const formatTokenAmount = (amount: bigint, decimals = 2) => {
    const num = Number(amount) / 1e18;
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'transfer':
        return <ArrowUp className="h-4 w-4 text-red-400" />;
      case 'receive':
        return <ArrowDown className="h-4 w-4 text-green-400" />;
      case 'approve':
        return <ShieldCheck className="h-4 w-4 text-blue-400" />;
      default:
        return <Coins className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'transfer':
        return 'text-red-400';
      case 'receive':
        return 'text-green-400';
      case 'approve':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (filter !== 'all' && tx.type !== filter) return false;
      if (search && !tx.hash.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [transactions, filter, search]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-gray-800/50 border border-gray-700 rounded-lg shadow-lg ${className}`}>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-700 rounded w-1/4"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800/50 border border-gray-700 rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center">
            <History className="h-5 w-5 mr-2 text-purple-400" />
            Transaction History
          </h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center text-sm text-gray-400 hover:text-white transition-colors"
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
            <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-4 border-b border-gray-700 bg-gray-900/30">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Type Filter */}
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Type</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:border-purple-500"
              >
                <option value="all">All Types</option>
                <option value="transfer">Transfers</option>
                <option value="receive">Received</option>
                <option value="approve">Approvals</option>
              </select>
            </div>

            {/* Search */}
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:border-purple-500"
                  placeholder="Search by hash..."
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transactions List */}
      <div className="divide-y divide-gray-700">
        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center">
            <History className="mx-auto h-12 w-12 text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-2">No Transactions</h3>
            <p className="text-gray-500">
              {search || filter !== 'all' ? 'No transactions match your filters' : 'Your transaction history will appear here once you make some transactions'}
            </p>
          </div>
        ) : (
          filteredTransactions.map((tx) => (
            <div key={tx.id} className="p-4 hover:bg-gray-700/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-700/50 rounded-full">
                    {getTransactionIcon(tx.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-medium capitalize ${getTransactionColor(tx.type)}`}>
                        {tx.type}
                      </span>
                      <span className="text-xs text-gray-500 px-2 py-1 bg-green-900/30 border border-green-500/30 rounded">
                        {tx.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center text-xs text-gray-400 mt-1">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatTimeAgo(tx.timestamp)}
                      
                      <span className="mx-2">•</span>
                      
                      <button
                        onClick={() => copyToClipboard(tx.hash)}
                        className="flex items-center hover:text-white transition-colors"
                      >
                        <span className="font-mono">{tx.hash.slice(0, 8)}...</span>
                        <Copy className="h-3 w-3 ml-1" />
                      </button>
                      
                      <a
                        href={`https://basescan.org/tx/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-sm font-medium ${getTransactionColor(tx.type)}`}>
                    {tx.type === 'transfer' ? '-' : tx.type === 'receive' ? '+' : ''}
                    {formatTokenAmount(tx.amount)} EMARK
                  </div>
                  
                  {(tx.to || tx.from || tx.spender) && (
                    <div className="text-xs text-gray-400 mt-1 font-mono">
                      {tx.type === 'transfer' && `To: ${tx.to.slice(0, 6)}...${tx.to.slice(-4)}`}
                      {tx.type === 'receive' && `From: ${tx.from.slice(0, 6)}...${tx.from.slice(-4)}`}
                      {tx.type === 'approve' && `Spender: ${tx.spender.slice(0, 6)}...${tx.spender.slice(-4)}`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More */}
      {filteredTransactions.length > 0 && (
        <div className="p-4 border-t border-gray-700">
          <button className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Load More Transactions
          </button>
        </div>
      )}
    </div>
  );
}