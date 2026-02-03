import React, { useState } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';

interface SupportButtonProps {
  variant?: 'default' | 'compact' | 'floating';
  className?: string;
}

const KOFI_URL = 'https://ko-fi.com/ksatlas';

const SupportButton: React.FC<SupportButtonProps> = ({ variant = 'default' }) => {
  const isMobile = useIsMobile();
  const [isHovered, setIsHovered] = useState(false);

  if (variant === 'floating') {
    return (
      <a
        href={KOFI_URL}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          position: 'fixed',
          bottom: isMobile ? '1rem' : '1.5rem',
          right: isMobile ? '1rem' : '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: isHovered ? '0.75rem 1.25rem' : '0.75rem',
          backgroundColor: '#FF6B8A',
          borderRadius: isHovered ? '25px' : '50%',
          color: '#fff',
          textDecoration: 'none',
          fontSize: '0.9rem',
          fontWeight: '600',
          boxShadow: '0 4px 20px rgba(255, 107, 138, 0.4)',
          transition: 'all 0.3s ease',
          zIndex: 50,
          overflow: 'hidden',
          whiteSpace: 'nowrap'
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311z"/>
        </svg>
        {isHovered && <span>Support Atlas</span>}
      </a>
    );
  }

  if (variant === 'compact') {
    return (
      <a
        href={KOFI_URL}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.5rem 0.875rem',
          backgroundColor: isHovered ? '#FF6B8A' : '#FF6B8A20',
          border: '1px solid #FF6B8A50',
          borderRadius: '8px',
          color: isHovered ? '#fff' : '#FF6B8A',
          textDecoration: 'none',
          fontSize: '0.85rem',
          fontWeight: '500',
          transition: 'all 0.2s'
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311z"/>
        </svg>
        Support
      </a>
    );
  }

  // Default variant - full button
  return (
    <a
      href={KOFI_URL}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1.5rem',
        backgroundColor: '#FF6B8A',
        border: 'none',
        borderRadius: '8px',
        color: '#fff',
        textDecoration: 'none',
        fontSize: isMobile ? '0.9rem' : '0.95rem',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        boxShadow: isHovered ? '0 4px 20px rgba(255, 107, 138, 0.4)' : '0 4px 15px rgba(255, 107, 138, 0.3)',
        transform: isHovered ? 'translateY(-2px)' : 'none'
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311z"/>
      </svg>
      Support Atlas on Ko-fi
    </a>
  );
};

export default SupportButton;
