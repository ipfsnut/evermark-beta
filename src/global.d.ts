/// <reference types="vite/client" />

// Global JSX namespace for React 19 compatibility
// This restores the global JSX namespace that many libraries still expect
declare global {
  /**
   * Global JSX namespace for backward compatibility with libraries
   * that haven't updated to React 19's React.JSX namespace yet
   */
  namespace JSX {
    // Import React JSX types into global namespace
    type Element = React.JSX.Element;
    type ElementType = React.JSX.ElementType;
    type ElementClass = React.JSX.ElementClass;
    type ElementAttributesProperty = React.JSX.ElementAttributesProperty;
    type ElementChildrenAttribute = React.JSX.ElementChildrenAttribute;
    type LibraryManagedAttributes<C, P> = React.JSX.LibraryManagedAttributes<C, P>;
    type IntrinsicAttributes = React.JSX.IntrinsicAttributes;
    type IntrinsicClassAttributes<T> = React.JSX.IntrinsicClassAttributes<T>;
    type IntrinsicElements = React.JSX.IntrinsicElements;
  }

  // Farcaster Frame SDK globals
  interface Window {
    FrameSDK?: {
      actions?: {
        ready?: (options?: { disableNativeGestures?: boolean }) => Promise<void>;
        openUrl?: (url: string) => void;
        close?: () => void;
      };
      context?: {
        user?: {
          fid?: number;
          username?: string;
          displayName?: string;
          pfpUrl?: string;
        };
        location?: string;
      };
    };
    __evermark_farcaster_detected?: boolean;
  }

  // Environment variables
  interface ImportMetaEnv {
    readonly VITE_THIRDWEB_CLIENT_ID: string;
    readonly VITE_CHAIN_ID: string;
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_FARCASTER_DEVELOPER_FID?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// Module declarations for assets
declare module '*.svg' {
  import type * as React from 'react';
  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>;
  const src: string;
  export default src;
  export { ReactComponent };
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.gif' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

declare module '*.ico' {
  const src: string;
  export default src;
}

declare module '*.bmp' {
  const src: string;
  export default src;
}

// CSS modules
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.sass' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// Export empty to make this file a module
export {};