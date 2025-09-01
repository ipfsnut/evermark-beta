// src/components/ui/ErrorBoundary.tsx - Error boundary for graceful error handling
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangleIcon, RefreshCwIcon, HomeIcon } from 'lucide-react';
import { themeClasses } from '../../utils/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true, 
      error 
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 React Error Boundary caught an error:', error, errorInfo);
    
    // Log to external service in production
    if (import.meta.env.PROD) {
      // TODO: Integrate with error reporting service (e.g., Sentry)
      // Example: Sentry.captureException(error, { contexts: { errorInfo } });
    }

    this.setState({
      error,
      errorInfo
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  public override render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI with cyber theme
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            {/* Error icon */}
            <div className="mx-auto mb-6 w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
              <AlertTriangleIcon className="h-8 w-8 text-red-500" />
            </div>

            {/* Error message */}
            <h1 className={themeClasses.errorHeading}>
              Something went wrong
            </h1>
            <p className="text-gray-400 mb-6">
              We encountered an unexpected error. This has been logged and we&apos;ll investigate.
            </p>

            {/* Error details in development */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6 text-left bg-gray-900 border border-gray-700 rounded-lg p-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-300 mb-2">
                  Error Details (Development)
                </summary>
                <div className="text-xs text-red-400 font-mono">
                  <div className="mb-2">
                    <strong>Error:</strong> {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <div className="mb-2">
                      <strong>Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap text-xs">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                  {this.state.errorInfo && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap text-xs">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center px-4 py-2 bg-cyber-primary text-black font-medium rounded-lg hover:bg-opacity-90 transition-colors"
              >
                <RefreshCwIcon className="h-4 w-4 mr-2" />
                Try Again
              </button>
              
              <button
                onClick={this.handleReload}
                className="inline-flex items-center px-4 py-2 bg-gray-800 text-white border border-gray-600 font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                <RefreshCwIcon className="h-4 w-4 mr-2" />
                Reload Page
              </button>
              
              <a
                href="/"
                className="inline-flex items-center px-4 py-2 bg-gray-700 text-gray-300 font-medium rounded-lg hover:bg-gray-600 transition-colors"
              >
                <HomeIcon className="h-4 w-4 mr-2" />
                Go Home
              </a>
            </div>

            {/* Help text */}
            <div className="mt-8 text-xs text-gray-500">
              <p>If this problem persists, please contact support.</p>
              {import.meta.env.DEV && (
                <p className="mt-1">Check the browser console for more details.</p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}