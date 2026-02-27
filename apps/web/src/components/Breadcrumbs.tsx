import React from 'react';
import { Link } from 'react-router-dom';
import { colors, transitions } from '../utils/styles';

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

/**
 * Visible breadcrumb navigation component.
 * Improves both UX (users can navigate up) and SEO (Google shows breadcrumbs in SERPs).
 * Pair with useStructuredData BreadcrumbList for JSON-LD structured data.
 */
const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  if (!items || items.length < 2) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        fontSize: '0.8rem',
        color: colors.textSecondary,
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.25rem',
      }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const path = item.url.replace('https://ks-atlas.com', '');

        return (
          <React.Fragment key={item.url}>
            {index > 0 && (
              <span style={{ color: colors.textMuted, margin: '0 0.15rem' }} aria-hidden="true">
                ›
              </span>
            )}
            {isLast ? (
              <span style={{ color: '#d1d5db' }} aria-current="page">
                {item.name}
              </span>
            ) : (
              <Link
                to={path}
                style={{
                  color: colors.textSecondary,
                  textDecoration: 'none',
                  transition: `color ${transitions.fast}`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = colors.primary; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = colors.textSecondary; }}
              >
                {item.name}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
