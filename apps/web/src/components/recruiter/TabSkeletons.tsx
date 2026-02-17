import React from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { colors } from '../../utils/styles';

const pulse = 'skeleton-pulse 1.5s ease-in-out infinite';

const Bar: React.FC<{ w: string; h?: string; mb?: string }> = ({ w, h = '0.7rem', mb = '0' }) => (
  <div style={{ width: w, height: h, backgroundColor: colors.surfaceHover, borderRadius: '4px', marginBottom: mb, animation: pulse }} />
);

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
    {children}
  </div>
);

// ─── Inbox Tab Skeleton ──────────────────────────────────────
export const InboxTabSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
    {/* Stats banner */}
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ flex: 1, padding: '0.5rem', backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '8px', textAlign: 'center' }}>
          <Bar w="40px" h="1rem" mb="0.3rem" />
          <Bar w="50px" h="0.5rem" />
        </div>
      ))}
    </div>
    {/* Filter row */}
    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.25rem' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ width: '70px', height: '28px', backgroundColor: colors.surfaceHover, borderRadius: '6px', animation: pulse }} />
      ))}
    </div>
    {/* Application cards */}
    {[1, 2, 3].map(i => (
      <Card key={i}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: colors.surfaceHover, animation: pulse }} />
            <div>
              <Bar w="100px" h="0.75rem" mb="0.3rem" />
              <Bar w="60px" h="0.55rem" />
            </div>
          </div>
          <Bar w="60px" h="24px" />
        </div>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {[1, 2].map(j => <Bar key={j} w="55px" h="18px" />)}
        </div>
      </Card>
    ))}
    <style>{`@keyframes skeleton-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>
  </div>
);

// ─── Browse Tab Skeleton ─────────────────────────────────────
export const BrowseTabSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
    {/* Budget banner */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '8px' }}>
      <Bar w="140px" h="0.7rem" />
      <Bar w="60px" h="28px" />
    </div>
    {/* Filter row */}
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ flex: '1 1 80px', minWidth: '80px' }}>
          <Bar w="40px" h="0.5rem" mb="0.2rem" />
          <div style={{ height: '36px', backgroundColor: colors.surfaceHover, borderRadius: '6px', animation: pulse }} />
        </div>
      ))}
    </div>
    {/* Transferee cards */}
    {[1, 2, 3, 4].map(i => (
      <Card key={i}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <Bar w="90px" h="0.8rem" />
            <Bar w="30px" h="0.55rem" />
          </div>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <Bar w="40px" h="18px" />
            <Bar w="40px" h="18px" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {[1, 2, 3].map(j => <Bar key={j} w="50px" h="16px" />)}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'space-between' }}>
          <Bar w="60px" h="24px" />
          <Bar w="80px" h="32px" />
        </div>
      </Card>
    ))}
    <style>{`@keyframes skeleton-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>
  </div>
);

// ─── Profile Tab Skeleton ────────────────────────────────────
export const ProfileTabSkeleton: React.FC = () => {
  const isMobile = useIsMobile();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Form fields */}
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i}>
          <Bar w="80px" h="0.55rem" mb="0.3rem" />
          <div style={{ height: isMobile ? '38px' : '40px', backgroundColor: colors.surfaceHover, borderRadius: '8px', animation: pulse }} />
        </div>
      ))}
      {/* Textarea */}
      <div>
        <Bar w="100px" h="0.55rem" mb="0.3rem" />
        <div style={{ height: '80px', backgroundColor: colors.surfaceHover, borderRadius: '8px', animation: pulse }} />
      </div>
      {/* Save button */}
      <Bar w="120px" h="40px" />
      <style>{`@keyframes skeleton-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>
    </div>
  );
};

// ─── Team Tab Skeleton ───────────────────────────────────────
export const TeamTabSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
    {/* Team members */}
    {[1, 2, 3].map(i => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '8px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: colors.surfaceHover, animation: pulse }} />
        <div style={{ flex: 1 }}>
          <Bar w="90px" h="0.7rem" mb="0.25rem" />
          <Bar w="55px" h="0.5rem" />
        </div>
        <Bar w="50px" h="22px" />
      </div>
    ))}
    {/* Invite co-editor */}
    <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px' }}>
      <Bar w="120px" h="0.7rem" mb="0.5rem" />
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <div style={{ flex: 1, height: '38px', backgroundColor: colors.surfaceHover, borderRadius: '8px', animation: pulse }} />
        <Bar w="80px" h="38px" />
      </div>
    </div>
    <style>{`@keyframes skeleton-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>
  </div>
);

// ─── Watchlist Tab Skeleton ──────────────────────────────────
export const WatchlistTabSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
    {/* Add form */}
    <div style={{ padding: '0.75rem', backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ flex: '1 1 100px' }}>
          <Bar w="50px" h="0.5rem" mb="0.2rem" />
          <div style={{ height: '36px', backgroundColor: colors.surfaceHover, borderRadius: '6px', animation: pulse }} />
        </div>
      ))}
      <div style={{ alignSelf: 'flex-end' }}>
        <Bar w="70px" h="36px" />
      </div>
    </div>
    {/* Watchlist items */}
    {[1, 2, 3].map(i => (
      <Card key={i}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Bar w="100px" h="0.7rem" mb="0.25rem" />
            <Bar w="65px" h="0.5rem" />
          </div>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <Bar w="40px" h="24px" />
            <Bar w="40px" h="24px" />
          </div>
        </div>
      </Card>
    ))}
    <style>{`@keyframes skeleton-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>
  </div>
);

// ─── Fund Tab Skeleton ───────────────────────────────────────
export const FundTabSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
    {/* Balance card */}
    <div style={{ padding: '1rem', backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '12px', textAlign: 'center' }}>
      <Bar w="60px" h="0.6rem" mb="0.5rem" />
      <Bar w="80px" h="1.5rem" mb="0.3rem" />
      <Bar w="100px" h="0.5rem" />
    </div>
    {/* Contribution history */}
    <Bar w="120px" h="0.7rem" mb="0.25rem" />
    {[1, 2, 3].map(i => (
      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '8px' }}>
        <Bar w="80px" h="0.6rem" />
        <Bar w="50px" h="0.6rem" />
      </div>
    ))}
    <style>{`@keyframes skeleton-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>
  </div>
);
