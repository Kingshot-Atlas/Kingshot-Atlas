import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { colors, radius, transition } from '../../utils/styles';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface BackLinkProps {
  to: string;
  label: string;
  variant?: 'primary' | 'secondary';
}

/**
 * Consistent back-navigation button used across all pages.
 * - `primary` (default): cyan-tinted ghost button — use for the main back action
 * - `secondary`: gray ghost button — use for less-prominent alternatives (e.g. "Back to Home" alongside "All Tools")
 */
const BackLink: React.FC<BackLinkProps> = ({ to, label, variant = 'primary' }) => {
  const isMobile = useIsMobile();
  const [hovered, setHovered] = useState(false);

  const isPrimary = variant === 'primary';
  const baseColor = isPrimary ? colors.primary : colors.textSecondary;
  const hoverColor = colors.primary;

  return (
    <Link
      to={to}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: isMobile ? '0.55rem 1rem' : '0.45rem 0.9rem',
        minHeight: isMobile ? '44px' : 'auto',
        backgroundColor: hovered ? `${hoverColor}10` : 'transparent',
        border: `1px solid ${hovered ? `${hoverColor}50` : isPrimary ? `${baseColor}30` : colors.border}`,
        borderRadius: radius.md,
        color: hovered ? hoverColor : baseColor,
        fontSize: isMobile ? '0.8rem' : '0.78rem',
        fontWeight: 500,
        textDecoration: 'none',
        transition: transition.fast,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontSize: '0.85em', lineHeight: 1 }}>←</span>
      {label}
    </Link>
  );
};

export default BackLink;
