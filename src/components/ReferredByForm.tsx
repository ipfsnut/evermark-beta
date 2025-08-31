import React, { useState, useCallback } from 'react';
import { UserPlusIcon, CheckCircleIcon, LoaderIcon, AlertCircleIcon } from 'lucide-react';
import { useActiveAccount } from 'thirdweb/react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/utils/responsive';

interface ReferredByFormProps {
  onComplete?: (referrer: string) => void;
  className?: string;
}

export function ReferredByForm({ onComplete, className = '' }: ReferredByFormProps) {
  const { isDark } = useTheme();
  const account = useActiveAccount();
  
  const [referrer, setReferrer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validateAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/i.test(address);
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!account?.address) {
      setError('Please connect your wallet first');
      return;
    }

    const trimmedReferrer = referrer.trim();
    
    if (trimmedReferrer && !validateAddress(trimmedReferrer)) {
      setError('Please enter a valid Ethereum address (0x...)');
      return;
    }

    if (trimmedReferrer.toLowerCase() === account.address.toLowerCase()) {
      setError('You cannot refer yourself');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Save referrer to user profile/settings
      const response = await fetch('/api/user-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Wallet-Address': account.address
        },
        body: JSON.stringify({
          referrer_address: trimmedReferrer || null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save referrer');
      }

      setSuccess(true);
      onComplete?.(trimmedReferrer);
      
      // Auto-close after success
      setTimeout(() => {
        setSuccess(false);
      }, 3000);

    } catch (error: any) {
      setError(error.message || 'Failed to save referrer');
    } finally {
      setIsSubmitting(false);
    }
  }, [account?.address, referrer, onComplete]);

  const handleSkip = useCallback(() => {
    onComplete?.('');
  }, [onComplete]);

  if (!account?.address) {
    return null;
  }

  if (success) {
    return (
      <div className={cn(
        "border rounded-lg p-6",
        isDark 
          ? "bg-green-900/30 border-green-500/50" 
          : "bg-green-100/80 border-green-300",
        className
      )}>
        <div className="text-center">
          <CheckCircleIcon className="mx-auto h-12 w-12 mb-4 text-green-400" />
          <h3 className={cn(
            "text-lg font-medium mb-2",
            isDark ? "text-green-300" : "text-green-700"
          )}>
            Referrer Saved!
          </h3>
          <p className={cn(
            "text-sm",
            isDark ? "text-green-200" : "text-green-600"
          )}>
            {referrer 
              ? `Your referrer will receive 10% of fees from your Evermark creations`
              : `You can always set a referrer later in your profile settings`
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "border rounded-lg p-6",
      isDark 
        ? "bg-gray-800/50 border-gray-700" 
        : "bg-white border-gray-300",
      className
    )}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
            <UserPlusIcon className="h-5 w-5 text-black" />
          </div>
          <div>
            <h3 className={cn(
              "text-lg font-bold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              Set Your Referrer
            </h3>
            <p className={cn(
              "text-sm",
              isDark ? "text-gray-400" : "text-gray-600"
            )}>
              Who introduced you to Evermark? (Optional)
            </p>
          </div>
        </div>

        {error && (
          <div className={cn(
            "p-3 rounded border flex items-start gap-2",
            isDark 
              ? "bg-red-900/30 text-red-300 border-red-500/30" 
              : "bg-red-100 text-red-700 border-red-300"
          )}>
            <AlertCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className={cn(
              "block text-sm font-medium",
              isDark ? "text-cyan-400" : "text-purple-600"
            )}>
              Referrer Address (Optional)
            </label>
            <input
              type="text"
              value={referrer}
              onChange={(e) => setReferrer(e.target.value)}
              placeholder="0x... (They'll get 10% of your minting fees)"
              disabled={isSubmitting}
              className={cn(
                "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-opacity-20 transition-colors",
                isSubmitting && "opacity-50 cursor-not-allowed",
                isDark 
                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-cyan-400" 
                  : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-purple-400 focus:ring-purple-400"
              )}
            />
            <p className={cn(
              "text-xs",
              isDark ? "text-gray-500" : "text-gray-600"
            )}>
              This person will receive 10% of the minting fee (0.000007 ETH) from all your future Evermark creations
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSkip}
              disabled={isSubmitting}
              className={cn(
                "flex-1 px-4 py-3 rounded-lg transition-colors",
                isSubmitting 
                  ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                  : (isDark 
                      ? "bg-gray-700 text-gray-300 hover:bg-gray-600" 
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300")
              )}
            >
              Skip for Now
            </button>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "flex-1 px-4 py-3 rounded-lg font-medium transition-colors",
                isSubmitting 
                  ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-400 to-purple-500 text-white hover:from-blue-300 hover:to-purple-400"
              )}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <LoaderIcon className="animate-spin h-4 w-4" />
                  Saving...
                </div>
              ) : (
                'Save Referrer'
              )}
            </button>
          </div>
        </form>

        <div className={cn(
          "text-xs p-3 rounded border",
          isDark 
            ? "bg-blue-900/30 text-blue-200 border-blue-500/30" 
            : "bg-blue-100/50 text-blue-600 border-blue-300"
        )}>
          <strong>How it works:</strong> Once set, this address will automatically receive 10% of the minting fee 
          from every Evermark you create. You can change this later in your profile settings.
        </div>
      </div>
    </div>
  );
}