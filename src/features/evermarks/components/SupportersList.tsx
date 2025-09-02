import React, { useState, useEffect } from 'react';
import { Users, Heart } from 'lucide-react';

interface Supporter {
  user_id: string;
  total_emark: number;
  vote_count: number;
  display_address: string;
  latest_vote: string;
}

interface SupportersListProps {
  evermarkId: string;
  cycle?: number;
  limit?: number;
}

export function SupportersList({ evermarkId, cycle = 3, limit = 5 }: SupportersListProps) {
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSupporters() {
      try {
        setLoading(true);
        const response = await fetch(
          `/.netlify/functions/get-evermark-supporters?evermark_id=${evermarkId}&cycle=${cycle}&limit=${limit}`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch supporters');
        }
        
        const result = await response.json();
        setSupporters(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchSupporters();
  }, [evermarkId, cycle, limit]);

  if (loading) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg">
        <div className="p-4 border-b border-gray-700">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Users className="h-4 w-4" />
            Top Supporters
          </h3>
        </div>
        <div className="p-4">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-3 bg-gray-700 rounded w-24 mb-1"></div>
                  <div className="h-2 bg-gray-700 rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg">
        <div className="p-4 border-b border-gray-700">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Users className="h-4 w-4" />
            Top Supporters
          </h3>
        </div>
        <div className="p-4 text-gray-400 text-sm">
          Unable to load supporters
        </div>
      </div>
    );
  }

  if (supporters.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg">
        <div className="p-4 border-b border-gray-700">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Users className="h-4 w-4" />
            Top Supporters
          </h3>
        </div>
        <div className="p-4 text-gray-400 text-sm text-center">
          No supporters yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg">
      <div className="p-4 border-b border-gray-700">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Users className="h-4 w-4" />
          Top Supporters
        </h3>
      </div>
      <div className="p-4 space-y-3">
        {supporters.map((supporter, index) => (
          <div key={supporter.user_id} className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-purple-600/20 border border-purple-500/30 rounded-full text-xs font-medium text-purple-300">
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-gray-300 truncate">
                  {supporter.display_address}
                </span>
                <Heart className="h-3 w-3 text-red-400 flex-shrink-0" />
              </div>
              <div className="text-xs text-gray-500">
                {supporter.total_emark.toFixed(2)} EMARK
                {supporter.vote_count > 1 && ` • ${supporter.vote_count} votes`}
              </div>
            </div>
          </div>
        ))}
        {supporters.length >= limit && (
          <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-700">
            Showing top {limit} supporters
          </div>
        )}
      </div>
    </div>
  );
}