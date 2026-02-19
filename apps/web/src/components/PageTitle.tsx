import React from 'react';
import { neonGlow } from '../utils/styles';
import { useIsMobile } from '../hooks/useMediaQuery';

interface PageTitleProps {
  /** The full title text - will be split into first word (white) and rest (accent) */
  children: string;
  /** Accent color for the second part. Defaults to cyan (#22d3ee) */
  accentColor?: string;
  /** Optional tagline displayed below the title */
  tagline?: string;
  /** Font size for desktop. Mobile will be smaller. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Center the title */
  centered?: boolean;
  /** Additional className */
  className?: string;
}

const FONT_FAMILY = "'Trajan Pro', 'Cinzel', 'Times New Roman', serif";

const SIZE_MAP = {
  sm: { desktop: '1.5rem', mobile: '1.25rem' },
  md: { desktop: '2rem', mobile: '1.5rem' },
  lg: { desktop: '2.5rem', mobile: '1.75rem' },
  xl: { desktop: '3rem', mobile: '2rem' },
};

/**
 * PageTitle - Two-tone page header with Trajan Pro font
 * 
 * First word is white, remaining words use the accent color (cyan by default, pink for Support page)
 * 
 * @example
 * <PageTitle>KINGDOM DIRECTORY</PageTitle>
 * // Renders: "KINGDOM" in white, "DIRECTORY" in cyan
 * 
 * @example
 * <PageTitle accentColor="#ff6b8a">SUPPORT ATLAS</PageTitle>
 * // Renders: "SUPPORT" in white, "ATLAS" in pink
 */
const PageTitle: React.FC<PageTitleProps> = ({
  children,
  accentColor = '#22d3ee',
  tagline,
  size = 'lg',
  centered = true,
  className,
}) => {
  // Split title into first word and rest
  const words = children.trim().split(/\s+/);
  const firstWord = words[0] || '';
  const restWords = words.slice(1).join(' ');

  const isMobile = useIsMobile();
  const fontSize = isMobile ? SIZE_MAP[size].mobile : SIZE_MAP[size].desktop;

  return (
    <div
      className={className}
      style={{
        textAlign: centered ? 'center' : 'left',
        marginBottom: tagline ? '0.5rem' : '1.5rem',
      }}
    >
      <h1
        style={{
          fontFamily: FONT_FAMILY,
          fontSize,
          fontWeight: 700,
          letterSpacing: '0.05em',
          lineHeight: 1.2,
          margin: 0,
        }}
      >
        <span style={{ color: '#ffffff' }}>{firstWord}</span>
        {restWords && (
          <>
            {' '}
            <span style={{ ...neonGlow(accentColor) }}>{restWords}</span>
          </>
        )}
      </h1>
      {tagline && (
        <p
          style={{
            color: '#9ca3af',
            fontSize: isMobile ? '0.875rem' : '1rem',
            marginTop: '0.5rem',
            marginBottom: '1.5rem',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {tagline}
        </p>
      )}
    </div>
  );
};

export default PageTitle;
