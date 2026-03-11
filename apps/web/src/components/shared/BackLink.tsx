import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { colors, radius, transition } from '../../utils/styles';

interface BackLinkProps {
  to: string;
  label: string;
  variant?: 'primary' | 'secondary';
}

/**
 * Consistent back-navigation button used across all pages.
 * Always cyan text with a single ← arrow. The variant only affects border prominence:
 * - `primary` (default): cyan-tinted border
 * - `secondary`: subtle border — use for less-prominent alternatives (e.g. "Home" alongside "All Tools")
 */
const BackLink: React.FC<BackLinkProps> = ({ to, label, variant = 'primary' }) => {
  const [hovered, setHovered] = useState(false);

  const isPrimary = variant === 'primary';

  return (
    <Link
      to={to}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
        padding: '0.5rem 1rem',
        minHeight: '44px',
        backgroundColor: hovered ? `${colors.primary}10` : 'transparent',
        border: `1px solid ${hovered ? `${colors.primary}50` : isPrimary ? `${colors.primary}30` : `${colors.primary}18`}`,
        borderRadius: radius.md,
        color: colors.primary,
        fontSize: '0.8rem',
        fontWeight: 600,
        textDecoration: 'none',
        transition: transition.fast,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      ← {label}
    </Link>
  );
};

export default BackLink;
