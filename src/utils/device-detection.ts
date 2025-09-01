// Enhanced device detection utilities combining multiple methods
import { useEffect, useState } from 'react';

/**
 * Detects if the user is on a mobile device using multiple methods
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') {
    return false; // SSR safety
  }

  // Method 1: User Agent detection (most reliable for actual mobile devices)
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
  const isMobileUA = mobileRegex.test(userAgent);

  // Method 2: Touch capability detection
  const hasTouch = 'ontouchstart' in window || 
                   navigator.maxTouchPoints > 0 || 
                   (navigator as any).msMaxTouchPoints > 0;

  // Method 3: Screen size detection
  const isMobileSize = window.innerWidth <= 768;

  // Method 4: CSS Media Query detection
  const mobileMediaQuery = window.matchMedia('(max-width: 768px)').matches;

  // Method 5: Device pixel ratio (high DPR often indicates mobile)
  const highDPR = window.devicePixelRatio > 1.5;

  // Method 6: Orientation API (mobile devices have this)
  const hasOrientation = 'orientation' in window;

  // Combine methods with weighted logic
  // If user agent says mobile, trust it
  if (isMobileUA) return true;
  
  // If it has touch AND small screen, it's likely mobile
  if (hasTouch && (isMobileSize || mobileMediaQuery)) return true;
  
  // If it has orientation API, high DPR, and small screen, likely mobile
  if (hasOrientation && highDPR && isMobileSize) return true;

  // Otherwise, fall back to screen size
  return isMobileSize || mobileMediaQuery;
}

/**
 * Detects if the device is a tablet
 */
export function isTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = navigator.userAgent || '';
  const isIPad = /iPad|Macintosh/i.test(userAgent) && 'ontouchstart' in window;
  const isAndroidTablet = /Android/i.test(userAgent) && !/Mobile/i.test(userAgent);
  
  // Screen size check for tablets (between phone and desktop)
  const isTabletSize = window.innerWidth > 768 && window.innerWidth <= 1024;
  
  return isIPad || isAndroidTablet || (isTabletSize && 'ontouchstart' in window);
}

/**
 * Get device type
 */
export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (isMobileDevice()) return 'mobile';
  if (isTabletDevice()) return 'tablet';
  return 'desktop';
}

/**
 * Enhanced hook for mobile detection with immediate accuracy
 */
export function useIsMobileDevice(): boolean {
  // Initialize with actual detection on first render
  const [isMobile, setIsMobile] = useState(() => {
    // Check if we already detected mobile in HTML
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('mobile-device')) {
      return true;
    }
    return isMobileDevice();
  });

  useEffect(() => {
    // Debounce the check to prevent rapid state changes
    let timeoutId: NodeJS.Timeout;
    
    const checkDevice = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const newIsMobile = isMobileDevice();
        setIsMobile(current => {
          // Only update if there's an actual change
          if (current !== newIsMobile) {
            console.log('Mobile detection changed:', newIsMobile);
            return newIsMobile;
          }
          return current;
        });
      }, 100); // Small debounce to prevent flashing
    };

    // Re-check on resize and orientation change
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);
    
    // Also listen for media query changes
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleMediaChange = () => {
      checkDevice();
    };
    
    // Modern way to listen to media query changes
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleMediaChange);
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } else {
        mediaQuery.removeListener(handleMediaChange);
      }
    };
  }, []);

  return isMobile;
}

/**
 * Hook to get device type
 */
export function useDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>(() => getDeviceType());

  useEffect(() => {
    const checkDevice = () => {
      setDeviceType(getDeviceType());
    };

    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  return deviceType;
}

/**
 * Hook for responsive breakpoints
 */
export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState(() => {
    if (typeof window === 'undefined') return 'sm';
    const width = window.innerWidth;
    if (width < 640) return 'sm';
    if (width < 768) return 'md';
    if (width < 1024) return 'lg';
    if (width < 1280) return 'xl';
    return '2xl';
  });

  useEffect(() => {
    const checkBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 640) setBreakpoint('sm');
      else if (width < 768) setBreakpoint('md');
      else if (width < 1024) setBreakpoint('lg');
      else if (width < 1280) setBreakpoint('xl');
      else setBreakpoint('2xl');
    };

    window.addEventListener('resize', checkBreakpoint);
    return () => window.removeEventListener('resize', checkBreakpoint);
  }, []);

  return breakpoint;
}