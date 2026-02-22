import React from 'react';
import { Link } from 'react-router-dom';

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
        color: '#9ca3af',
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
              <span style={{ color: '#4b5563', margin: '0 0.15rem' }} aria-hidden="true">
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
                  color: '#9ca3af',
                  textDecoration: 'none',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#22d3ee'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; }}
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
