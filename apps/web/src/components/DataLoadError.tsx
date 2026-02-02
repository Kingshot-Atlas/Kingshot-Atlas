/**
 * DataLoadError Component
 * ADR-011: Displays error state when Supabase data fails to load
 * Shows clear messaging instead of silently showing stale/no data
 */
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { dataLoadError } from '../services/api';

interface DataLoadErrorProps {
  onRetry?: () => void;
  className?: string;
}

export function DataLoadError({ onRetry, className = '' }: DataLoadErrorProps) {
  if (!dataLoadError) return null;

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-400 mb-2">
          Data Unavailable
        </h3>
        <p className="text-gray-400 mb-4">
          {dataLoadError}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        )}
        <p className="text-xs text-gray-500 mt-4">
          Kingdom data is fetched from our database. If this persists, please try again later.
        </p>
      </div>
    </div>
  );
}

export default DataLoadError;
