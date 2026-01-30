import React from 'react';
import { Link } from 'react-router-dom';

interface DataLimitChipProps {
  showing: number;
  total: number;
  label?: string;
  showUpgradeLink?: boolean;
  upgradeText?: string;
  upgradeTo?: string;
  isAnonymous?: boolean;
}

/**
 * Reusable "Showing X of Y" chip component
 * Used for displaying data limits with optional upgrade prompts
 * 
 * Usage:
 * <DataLimitChip showing={5} total={9} label="KvKs" />
 * <DataLimitChip showing={3} total={9} label="KvKs" showUpgradeLink upgradeText="View full history with Pro" />
 */
const DataLimitChip: React.FC<DataLimitChipProps> = ({
  showing,
  total,
  label = '',
  showUpgradeLink = false,
  upgradeText,
  upgradeTo = '/upgrade',
  isAnonymous = false
}) => {
  const displayLabel = label ? ` ${label}` : '';
  const linkText = upgradeText || (isAnonymous ? 'Sign in for more' : 'View full history with Pro');
  const linkTo = isAnonymous ? '/profile' : upgradeTo;

  return (
    <div style={{
      padding: '0.5rem 0.75rem',
      backgroundColor: '#22d3ee10',
      border: '1px solid #22d3ee30',
      borderRadius: '6px',
      fontSize: '0.75rem',
      color: '#6b7280',
      textAlign: 'center',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem',
      flexWrap: 'wrap',
      justifyContent: 'center'
    }}>
      <span>
        Showing <span style={{ color: '#22d3ee', fontWeight: '500' }}>{showing}</span> of <span style={{ fontWeight: '500' }}>{total}</span>{displayLabel}
      </span>
      {showUpgradeLink && (
        <>
          <span style={{ color: '#3a3a3a' }}>·</span>
          <Link
            to={linkTo}
            style={{
              color: '#22d3ee',
              textDecoration: 'none',
              fontWeight: '500',
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
        </>
      )}
    </div>
  );
};

export default DataLimitChip;
