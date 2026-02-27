import React, { useState, ReactNode } from 'react';
import { colors, transition } from '../../utils/styles';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface PageSectionProps {
  children: ReactNode;
  /** Section title text */
  title?: string;
  /** Emoji or icon to show before title */
  icon?: string;
  /** Accent color for the title and divider */
  accentColor?: string;
  /** Subtitle or description text below the title */
  subtitle?: string;
  /** Whether section is collapsible */
  collapsible?: boolean;
  /** Initial collapsed state (only used when collapsible=true) */
  defaultCollapsed?: boolean;
  /** Spacing preset: compact, default, relaxed */
  spacing?: 'compact' | 'default' | 'relaxed';
  /** Whether to show top divider line */
  divider?: boolean;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Additional CSS class names */
  className?: string;
  /** Right-aligned header actions (e.g., buttons, badges) */
  headerAction?: ReactNode;
}

const spacingMap = {
  compact: { gap: '0.5rem', padding: '0.75rem 0', titleMb: '0.5rem' },
  default: { gap: '0.75rem', padding: '1rem 0', titleMb: '0.75rem' },
  relaxed: { gap: '1rem', padding: '1.5rem 0', titleMb: '1rem' },
};

/**
 * Shared section wrapper for consistent spacing, headers, and dividers.
 *
 * @example
 * // Basic section with title
 * <PageSection title="Recommended Kingdoms" icon="🎯" accentColor="#22c55e">
 *   <KingdomListingCard ... />
 * </PageSection>
 *
 * @example
 * // Collapsible section
 * <PageSection title="Advanced Filters" collapsible defaultCollapsed>
 *   <FilterPanel ... />
 * </PageSection>
 *
 * @example
 * // Section with divider and header action
 * <PageSection title="Applications" divider headerAction={<Badge count={3} />}>
 *   <AppList ... />
 * </PageSection>
 */
const PageSection: React.FC<PageSectionProps> = ({
  children,
  title,
  icon,
  accentColor = colors.textSecondary,
  subtitle,
  collapsible = false,
  defaultCollapsed = false,
  spacing: spacingPreset = 'default',
  divider = false,
  style,
  className = '',
  headerAction,
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const isMobile = useIsMobile();
  const spacingValues = spacingMap[spacingPreset];

  const hasHeader = !!(title || icon || headerAction);

  return (
    <section
      className={className}
      style={{
        padding: spacingValues.padding,
        ...style,
      }}
    >
      {/* Top divider */}
      {divider && (
        <div style={{
          height: '1px',
          backgroundColor: colors.border,
          marginBottom: spacingValues.titleMb,
        }} />
      )}

      {/* Section header */}
      {hasHeader && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            marginBottom: collapsed ? 0 : spacingValues.titleMb,
            cursor: collapsible ? 'pointer' : undefined,
            userSelect: collapsible ? 'none' : undefined,
          }}
          onClick={collapsible ? () => setCollapsed(!collapsed) : undefined}
          onKeyDown={collapsible ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setCollapsed(!collapsed);
            }
          } : undefined}
          role={collapsible ? 'button' : undefined}
          tabIndex={collapsible ? 0 : undefined}
          aria-expanded={collapsible ? !collapsed : undefined}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
            {collapsible && (
              <span
                style={{
                  color: colors.textMuted,
                  fontSize: '0.7rem',
                  transition: transition.fast,
                  transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  display: 'inline-block',
                }}
                aria-hidden="true"
              >
                ▼
              </span>
            )}
            {icon && <span style={{ fontSize: isMobile ? '0.8rem' : '0.85rem' }}>{icon}</span>}
            {title && (
              <span style={{
                color: accentColor,
                fontSize: isMobile ? '0.8rem' : '0.85rem',
                fontWeight: 600,
                letterSpacing: '0.01em',
              }}>
                {title}
              </span>
            )}
            {subtitle && (
              <span style={{
                color: colors.textMuted,
                fontSize: '0.7rem',
              }}>
                {subtitle}
              </span>
            )}
          </div>
          {headerAction && <div style={{ flexShrink: 0 }}>{headerAction}</div>}
        </div>
      )}

      {/* Content */}
      {(!collapsible || !collapsed) && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: spacingValues.gap,
        }}>
          {children}
        </div>
      )}
    </section>
  );
};

export default React.memo(PageSection);
