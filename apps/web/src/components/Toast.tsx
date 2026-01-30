import React, { useState, createContext, useContext, useCallback } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const isMobile = useIsMobile();

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const getToastStyle = (type: string) => {
    switch (type) {
      case 'success': return { bg: '#22c55e', icon: '✓' };
      case 'error': return { bg: '#ef4444', icon: '✕' };
      case 'info': return { bg: '#22d3ee', icon: 'ℹ' };
      default: return { bg: '#22d3ee', icon: 'ℹ' };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container */}
      <div 
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: isMobile ? '80px' : '100px',
          right: isMobile ? '12px' : '20px',
          left: isMobile ? '12px' : 'auto',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          maxWidth: isMobile ? 'calc(100% - 24px)' : '320px'
        }}>
        {toasts.map((toast) => {
          const style = getToastStyle(toast.type);
          return (
            <div
              key={toast.id}
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: isMobile ? '0.875rem 1rem' : '0.75rem 1rem',
                backgroundColor: '#111111',
                border: `1px solid ${style.bg}`,
                borderRadius: '10px',
                boxShadow: `0 4px 20px ${style.bg}30`,
                animation: 'slideIn 0.3s ease',
                minWidth: isMobile ? 'auto' : '200px',
                width: isMobile ? '100%' : 'auto',
                cursor: 'pointer',
                minHeight: '44px'
              }}
              onClick={() => removeToast(toast.id)}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: style.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold'
              }}>
                {style.icon}
              </div>
              <span style={{ color: '#fff', fontSize: '0.9rem' }}>{toast.message}</span>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
