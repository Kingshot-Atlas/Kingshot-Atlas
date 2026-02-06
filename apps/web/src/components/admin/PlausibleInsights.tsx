import React, { useState, useEffect } from 'react';
import { getAuthHeaders } from '../../services/authHeaders';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

interface BreakdownItem {
  [key: string]: string | number;
  visitors: number;
}

const COLORS = {
  primary: '#22d3ee',
  secondary: '#a855f7',
  success: '#22c55e',
  warning: '#fbbf24',
  muted: '#6b7280',
  border: '#2a2a2a',
  bg: '#111116',
};

const BAR_COLORS = ['#22d3ee', '#a855f7', '#22c55e', '#fbbf24', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#64748b'];

export const PlausibleInsights: React.FC = () => {
  const [sources, setSources] = useState<BreakdownItem[]>([]);
  const [countries, setCountries] = useState<BreakdownItem[]>([]);
  const [pages, setPages] = useState<BreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const authHeaders = await getAuthHeaders({ requireAuth: false });
      const opts = { headers: authHeaders };
      const [srcRes, geoRes, pgRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/admin/stats/plausible/breakdown?property=visit:source&period=30d`, opts),
        fetch(`${API_URL}/api/v1/admin/stats/plausible/breakdown?property=visit:country&period=30d`, opts),
        fetch(`${API_URL}/api/v1/admin/stats/plausible/breakdown?property=event:page&period=30d`, opts),
      ]);

      if (srcRes.ok) { const d = await srcRes.json(); setSources(d.results || []); }
      if (geoRes.ok) { const d = await geoRes.json(); setCountries(d.results || []); }
      if (pgRes.ok) { const d = await pgRes.json(); setPages(d.results || []); }

      if (!srcRes.ok && !geoRes.ok && !pgRes.ok) {
        setError('Plausible API not configured. Set PLAUSIBLE_API_KEY env var.');
      }
    } catch (e) {
      setError('Failed to load Plausible data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '1rem', color: COLORS.muted, fontSize: '0.85rem' }}>Loading insights...</div>;
  }

  if (error) {
    return (
      <div style={{
        padding: '1rem',
        backgroundColor: '#fbbf2410',
        border: `1px solid ${COLORS.border}`,
        borderRadius: '8px',
        color: COLORS.warning,
        fontSize: '0.85rem'
      }}>
        {error}
      </div>
    );
  }

  const maxVisitors = (items: BreakdownItem[]) => Math.max(...items.map(i => i.visitors), 1);

  const BarList: React.FC<{ items: BreakdownItem[]; labelKey: string; title: string; icon: string }> = ({ items, labelKey, title, icon }) => {
    if (items.length === 0) return null;
    const max = maxVisitors(items);
    return (
      <div style={{
        backgroundColor: COLORS.bg,
        borderRadius: '12px',
        border: `1px solid ${COLORS.border}`,
        padding: '1rem',
        flex: '1 1 300px',
        minWidth: 0,
      }}>
        <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>
          {icon} {title}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {items.slice(0, 8).map((item, i) => {
            const label = String(item[labelKey] || 'Direct / None');
            const pct = (item.visitors / max) * 100;
            return (
              <div key={i} style={{ position: 'relative', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, bottom: 0,
                  width: `${pct}%`,
                  backgroundColor: `${BAR_COLORS[i % BAR_COLORS.length]}15`,
                  borderRadius: '4px',
                }} />
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.3rem 0.5rem', position: 'relative', zIndex: 1,
                }}>
                  <span style={{ color: '#d1d5db', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                    {label}
                  </span>
                  <span style={{ color: BAR_COLORS[i % BAR_COLORS.length], fontSize: '0.8rem', fontWeight: 500 }}>
                    {item.visitors.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
      <BarList items={sources} labelKey="source" title="Traffic Sources" icon="🔗" />
      <BarList items={countries} labelKey="country" title="Countries" icon="🌍" />
      <BarList items={pages} labelKey="page" title="Top Pages" icon="📄" />
    </div>
  );
};
