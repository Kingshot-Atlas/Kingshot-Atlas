import React, { ReactNode } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';

interface Props {
  children: ReactNode;
}

/**
 * ErrorBoundary wrapper that automatically captures route context
 * for better error reporting in Sentry
 */
const RouteErrorBoundary: React.FC<Props> = ({ children }) => {
  const params = useParams();
  const location = useLocation();
  
  // Build context from route params
  const context: Record<string, string | number | boolean> = {
    pathname: location.pathname,
  };
  
  // Add route params to context
  if (params.kingdomNumber) {
    context.kingdomNumber = parseInt(params.kingdomNumber, 10) || params.kingdomNumber;
  }
  if (params.userId) {
    context.userId = params.userId;
  }
  
  return (
    <ErrorBoundary context={context}>
      {children}
    </ErrorBoundary>
  );
};

export default RouteErrorBoundary;
