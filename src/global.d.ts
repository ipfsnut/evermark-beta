/// <reference types="vite/client" />

import type * as React from 'react';

// Fix React 18/19 type compatibility issues
declare module 'react' {
  // Override ReactNode to include JSX.Element
  type ReactNode = 
    | ReactElement 
    | string 
    | number 
    | boolean 
    | null 
    | undefined 
    | ReactFragment 
    | ReactPortal
    | JSX.Element;
}

// Global JSX namespace - use React's JSX types directly
declare global {
  namespace JSX {
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