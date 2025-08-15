// PWA Install Prompt for mobile users
import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { cn } from '../utils/responsive';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed or in standalone mode
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Listen for install prompt event (Android/Desktop Chrome)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after 30 seconds or on third visit
      const visits = parseInt(localStorage.getItem('evermark_visits') || '0') + 1;
      localStorage.setItem('evermark_visits', visits.toString());
      
      if (visits >= 3 || sessionStorage.getItem('show_install_prompt')) {
        setTimeout(() => setShowPrompt(true), visits >= 3 ? 3000 : 30000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Show iOS instructions if not in standalone mode
    if (iOS && !standalone) {
      const iosPromptShown = localStorage.getItem('ios_prompt_shown');
      if (!iosPromptShown) {
        setTimeout(() => setShowPrompt(true), 5000);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('PWA installed');
        setShowPrompt(false);
        setInstallPrompt(null);
      }
    } catch (error) {
      console.error('Install failed:', error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    if (isIOS) {
      localStorage.setItem('ios_prompt_shown', 'true');
    }
  };

  // Don't show if already installed or dismissed
  if (isStandalone || !showPrompt) return null;

  // iOS-specific instructions
  if (isIOS) {
    return (
      <div className={cn(
        'fixed bottom-20 left-4 right-4 z-50',
        'bg-gray-900 rounded-xl shadow-2xl p-4',
        'border border-gray-700',
        'animate-slide-up'
      )}>
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1"
        >
          <X className="h-5 w-5 text-gray-400" />
        </button>

        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <Smartphone className="h-8 w-8 text-green-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold mb-1">
              Install Evermark App
            </h3>
            <p className="text-gray-300 text-sm mb-3">
              Add to your home screen for the best experience
            </p>
            <div className="text-xs text-gray-400 space-y-1">
              <p>1. Tap the share button <span className="text-blue-400">􀈂</span></p>
              <p>2. Scroll and tap "Add to Home Screen"</p>
              <p>3. Tap "Add" in the top right</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Android/Desktop Chrome install prompt
  return (
    <div className={cn(
      'fixed bottom-20 left-4 right-4 z-50 max-w-md mx-auto',
      'bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl shadow-2xl p-4',
      'border border-gray-700',
      'animate-slide-up'
    )}>
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1"
      >
        <X className="h-5 w-5 text-gray-400 hover:text-white" />
      </button>

      <div className="flex items-center space-x-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-purple-500 rounded-lg flex items-center justify-center">
            <Download className="h-6 w-6 text-black" />
          </div>
        </div>
        
        <div className="flex-1">
          <h3 className="text-white font-semibold">
            Install Evermark
          </h3>
          <p className="text-gray-300 text-sm">
            Quick access from your home screen
          </p>
        </div>

        <button
          onClick={handleInstall}
          className={cn(
            'px-4 py-2 rounded-lg font-medium',
            'bg-gradient-to-r from-green-400 to-purple-500 text-black',
            'hover:shadow-lg hover:shadow-purple-500/30',
            'active:scale-95 transition-all'
          )}
        >
          Install
        </button>
      </div>
    </div>
  );
}