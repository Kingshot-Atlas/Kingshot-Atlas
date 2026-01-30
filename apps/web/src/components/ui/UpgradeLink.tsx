import React from 'react';
import { Link } from 'react-router-dom';

interface UpgradeLinkProps {
  text?: string;
  to?: string;
  isAnonymous?: boolean;
  className?: string;
}

/**
 * Reusable upgrade/sign-in link component
 * Consistent styling for upsell prompts across the site
 * 
 * Usage:
 * <UpgradeLink /> - defaults to "Sign in for more" or "Upgrade to Pro"
 * <UpgradeLink text="View full history with Pro" />
 * <UpgradeLink isAnonymous text="Sign in to review" />
 */
const UpgradeLink: React.FC<UpgradeLinkProps> = ({
  text,
  to,
  isAnonymous = false,
  className
}) => {
  const linkText = text || (isAnonymous ? 'Sign in for more' : 'Upgrade to Pro');
  const linkTo = to || (isAnonymous ? '/profile' : '/upgrade');

  return (
    <Link
      to={linkTo}
      className={className}
      style={{
        color: '#22d3ee',
        textDecoration: 'none',
        fontWeight: '500',
        fontSize: '0.75rem',
        transition: 'opacity 0.15s'
      }}
      onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
        e.currentTarget.style.opacity = '0.8';
      }}
      onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
        e.currentTarget.style.opacity = '1';
      }}
    >
      {linkText}
    </Link>
  );
};

export default UpgradeLink;
