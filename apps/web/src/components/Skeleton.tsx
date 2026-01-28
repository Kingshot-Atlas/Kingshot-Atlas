import React from 'react';
import { COLORS } from '../constants';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  borderRadius = '4px',
  className = '',
}) => (
  <div
    className={`skeleton ${className}`}
    style={{
      width,
      height,
      borderRadius,
      backgroundColor: COLORS.BG_SECONDARY,
      animation: 'skeleton-pulse 1.5s ease-in-out infinite',
    }}
  />
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ 
  lines = 3,
  className = '' 
}) => (
  <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton 
        key={i} 
        width={i === lines - 1 ? '70%' : '100%'} 
        height="0.875rem" 
      />
    ))}
  </div>
);

export const KingdomCardSkeleton: React.FC = () => (
  <div
    style={{
      backgroundColor: COLORS.BG_SECONDARY,
      borderRadius: '12px',
      border: `1px solid ${COLORS.BORDER_DEFAULT}`,
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Skeleton width="80px" height="2rem" borderRadius="8px" />
      <Skeleton width="60px" height="1.5rem" borderRadius="6px" />
    </div>
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <Skeleton width="70px" height="1.25rem" borderRadius="4px" />
      <Skeleton width="90px" height="1.25rem" borderRadius="4px" />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Skeleton height="3rem" borderRadius="8px" />
      <Skeleton height="3rem" borderRadius="8px" />
    </div>
  </div>
);

export const KingdomGridSkeleton: React.FC<{ count?: number }> = ({ count = 12 }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '1rem',
    }}
  >
    {Array.from({ length: count }).map((_, i) => (
      <KingdomCardSkeleton key={i} />
    ))}
    <style>{`
      @keyframes skeleton-pulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 0.7; }
      }
    `}</style>
  </div>
);

export const ProfileSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <Skeleton width="80px" height="80px" borderRadius="50%" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Skeleton width="150px" height="1.5rem" />
        <Skeleton width="200px" height="1rem" />
      </div>
    </div>
    <Skeleton height="120px" borderRadius="12px" />
    <Skeleton height="200px" borderRadius="12px" />
    <style>{`
      @keyframes skeleton-pulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 0.7; }
      }
    `}</style>
  </div>
);

export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 5 }) => (
  <tr>
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} style={{ padding: '0.75rem' }}>
        <Skeleton height="1rem" />
      </td>
    ))}
  </tr>
);

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ 
  rows = 10, 
  columns = 5 
}) => (
  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </tbody>
    <style>{`
      @keyframes skeleton-pulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 0.7; }
      }
    `}</style>
  </table>
);

export default Skeleton;
