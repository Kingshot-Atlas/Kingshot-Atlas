import { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { COLORS } from '../constants';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Additional context to include in error reports */
  context?: Record<string, string | number | boolean>;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Report to Sentry with additional context
    Sentry.withScope((scope) => {
      // Add component stack as extra context
      scope.setExtra('componentStack', errorInfo.componentStack);
      
      // Add any custom context passed via props
      if (this.props.context) {
        Object.entries(this.props.context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }
      
      // Add current URL
      scope.setExtra('url', window.location.href);
      scope.setTag('error_boundary', 'true');
      
      Sentry.captureException(error);
    });
    
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px',
          padding: '2rem',
          backgroundColor: COLORS.BG_SECONDARY,
          borderRadius: '12px',
          border: `1px solid ${COLORS.BORDER_DEFAULT}`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ 
            color: COLORS.RED, 
            fontSize: '1.5rem', 
            fontWeight: 600,
            marginBottom: '0.5rem' 
          }}>
            Something went wrong
          </h2>
          <p style={{ 
            color: COLORS.GRAY, 
            marginBottom: '1.5rem',
            maxWidth: '400px' 
          }}>
            This section encountered an error. You can try again or navigate to another page.
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: COLORS.CYAN,
                color: COLORS.BG_PRIMARY,
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
              onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'transparent',
                color: COLORS.GRAY,
                border: `1px solid ${COLORS.BORDER_DEFAULT}`,
                borderRadius: '8px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = COLORS.GRAY}
              onMouseOut={(e) => e.currentTarget.style.borderColor = COLORS.BORDER_DEFAULT}
            >
              Go Home
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: COLORS.BG_PRIMARY,
              borderRadius: '8px',
              fontSize: '0.75rem',
              color: COLORS.RED,
              maxWidth: '100%',
              overflow: 'auto',
              textAlign: 'left',
            }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
