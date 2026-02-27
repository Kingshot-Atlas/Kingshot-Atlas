import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBaseDesigner } from '../../hooks/useBaseDesigner';
import { useToolAccess } from '../../hooks/useToolAccess';
import { FONT_DISPLAY } from '../../utils/styles';
import { Button } from '../shared';

// ─── Access Gate ───
export const AccessGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hasAccess } = useToolAccess();
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!hasAccess) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2 style={{ color: '#fff', fontFamily: FONT_DISPLAY, fontSize: '1.5rem', marginBottom: '0.75rem' }}>{t('baseDesigner.pageTitle', 'Alliance Base Designer')}</h2>
        <p style={{ color: '#9ca3af', maxWidth: '400px', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          {t('baseDesigner.gateDesc', 'This tool is available to Atlas Supporters, Ambassadors, Discord Server Boosters, and Admins. Support Atlas to unlock powerful alliance management tools.')}
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button variant="primary" onClick={() => navigate('/support')}>
            {t('baseDesigner.becomeSupporter', 'Become a Supporter')}
          </Button>
          <Link to="/tools" style={{ textDecoration: 'none' }}>
            <Button variant="ghost">
              {t('baseDesigner.backToTools', 'Back to Tools')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};

// ─── Floating Map Controls (D-pad + Zoom) ───
export const MapControls: React.FC<{ designer: ReturnType<typeof useBaseDesigner>; isMobile: boolean }> = ({ designer, isMobile }) => {
  const sz = isMobile ? '38px' : '30px';
  const btn: React.CSSProperties = {
    width: sz, height: sz,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0d1117cc', border: '1px solid #1e2a35', borderRadius: '5px',
    color: '#9ca3af', cursor: 'pointer', fontSize: isMobile ? '0.9rem' : '0.75rem',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', touchAction: 'manipulation',
  };

  return (
    <div style={{ position: 'absolute', bottom: isMobile ? 10 : 12, right: isMobile ? 10 : 12, display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px' }}>
        <div />
        <button style={btn} onClick={designer.panUp} title="Pan Up">▲</button>
        <div />
        <button style={btn} onClick={designer.panLeft} title="Pan Left">◀</button>
        <button style={{ ...btn, fontSize: '0.55rem', color: '#22d3ee60' }} onClick={() => { designer.setCenterX(600); designer.setCenterY(600); }} title="Center">⊙</button>
        <button style={btn} onClick={designer.panRight} title="Pan Right">▶</button>
        <div />
        <button style={btn} onClick={designer.panDown} title="Pan Down">▼</button>
        <div />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <button style={btn} onClick={designer.zoomIn} title="Zoom In">＋</button>
        <button style={btn} onClick={designer.zoomOut} title="Zoom Out">−</button>
      </div>
    </div>
  );
};

// ─── Sidebar Section Header ───
export const SidebarSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid #1e2a35' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.5rem 0.75rem', backgroundColor: 'transparent', border: 'none',
          color: '#9ca3af', cursor: 'pointer', fontSize: '0.65rem', fontWeight: '700',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}
      >
        {title}
        <span style={{ fontSize: '0.55rem', color: '#4b5563' }}>{open ? '▼' : '▶'}</span>
      </button>
      {open && <div style={{ padding: '0 0.75rem 0.75rem' }}>{children}</div>}
    </div>
  );
};

// ─── Coordinate Search & Navigation ───
interface CoordinateSearchProps {
  onGo: (x: number, y: number) => void;
  onFocusBase: () => void;
  hasBuildings: boolean;
}
export const CoordinateSearch: React.FC<CoordinateSearchProps> = ({ onGo, onFocusBase, hasBuildings }) => {
  const [cx, setCx] = useState('600');
  const [cy, setCy] = useState('600');
  const { t } = useTranslation();
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.25rem 0.4rem', backgroundColor: '#0d1117',
    border: '1px solid #1e2a35', borderRadius: '4px', color: '#e5e7eb',
    fontSize: '0.7rem', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { color: '#6b7280', fontSize: '0.6rem', marginBottom: '2px' };
  const parse = (v: string) => Math.max(0, Math.min(1199, parseInt(v) || 0));

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.4rem', alignItems: 'end' }}>
        <div>
          <div style={labelStyle}>{t('baseDesigner.coordX', 'X')}</div>
          <input style={inputStyle} type="number" min={0} max={1199} value={cx}
            onChange={(e) => setCx(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onGo(parse(cx), parse(cy)); }} />
        </div>
        <div>
          <div style={labelStyle}>{t('baseDesigner.coordY', 'Y')}</div>
          <input style={inputStyle} type="number" min={0} max={1199} value={cy}
            onChange={(e) => setCy(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onGo(parse(cx), parse(cy)); }} />
        </div>
        <button
          onClick={() => onGo(parse(cx), parse(cy))}
          style={{
            padding: '0.25rem 0.5rem', backgroundColor: '#22d3ee15',
            border: '1px solid #22d3ee40', borderRadius: '4px',
            color: '#22d3ee', cursor: 'pointer', fontSize: '0.65rem', fontWeight: '600',
            whiteSpace: 'nowrap', height: 'fit-content',
          }}
        >{t('baseDesigner.go', 'Go')}</button>
      </div>
      {hasBuildings && (
        <button
          onClick={onFocusBase}
          style={{
            width: '100%', marginTop: '0.4rem', padding: '0.3rem',
            backgroundColor: '#22c55e15', border: '1px solid #22c55e40', borderRadius: '4px',
            color: '#22c55e', cursor: 'pointer', fontSize: '0.65rem', fontWeight: '600',
          }}
        >📍 {t('baseDesigner.focusOnBase', 'Focus on Base')}</button>
      )}
    </div>
  );
};
