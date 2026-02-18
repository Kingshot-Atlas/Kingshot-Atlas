import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

interface KingdomUserCount {
  kingdom_number: number;
  user_count: number;
}

/**
 * Heatmap visualization of Atlas user distribution across kingdoms.
 * Each cell = one kingdom, color intensity = number of linked users.
 * Fits fully in a single screen.
 */
export const UserHeatmap: React.FC = () => {
  const [data, setData] = useState<KingdomUserCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredKingdom, setHoveredKingdom] = useState<KingdomUserCount | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const fetchData = async () => {
      if (!supabase) return;
      try {
        // Single query: fetch linked_kingdom and home_kingdom, use COALESCE client-side
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('linked_kingdom, home_kingdom');

        if (error) throw error;

        // Count users per kingdom: prefer linked_kingdom, fall back to home_kingdom
        const countMap = new Map<number, number>();
        (profiles || []).forEach((p: { linked_kingdom: number | null; home_kingdom: number | null }) => {
          const k = p.linked_kingdom || p.home_kingdom;
          if (k && k > 0) countMap.set(k, (countMap.get(k) || 0) + 1);
        });

        const result: KingdomUserCount[] = [];
        countMap.forEach((count, kingdom) => {
          result.push({ kingdom_number: kingdom, user_count: count });
        });
        result.sort((a, b) => a.kingdom_number - b.kingdom_number);
        setData(result);
      } catch (err) {
        logger.error('UserHeatmap: failed to fetch data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const { maxCount, totalUsers, totalKingdoms, topKingdoms } = useMemo(() => {
    const max = data.reduce((m, d) => Math.max(m, d.user_count), 0);
    const total = data.reduce((s, d) => s + d.user_count, 0);
    const top = [...data].sort((a, b) => b.user_count - a.user_count).slice(0, 10);
    return { maxCount: max, totalUsers: total, totalKingdoms: data.length, topKingdoms: top };
  }, [data]);

  // Build a full kingdom map (1-300+) for heatmap grid
  const allKingdoms = useMemo(() => {
    const maxK = data.reduce((m, d) => Math.max(m, d.kingdom_number), 300);
    const countMap = new Map<number, number>();
    data.forEach(d => countMap.set(d.kingdom_number, d.user_count));
    const result: { kingdom_number: number; user_count: number }[] = [];
    for (let i = 1; i <= maxK; i++) {
      result.push({ kingdom_number: i, user_count: countMap.get(i) || 0 });
    }
    return result;
  }, [data]);

  const getColor = (count: number): string => {
    if (count === 0) return '#111116';
    const intensity = Math.min(count / Math.max(maxCount, 1), 1);
    // Cyan gradient: from very dim to bright
    if (intensity < 0.15) return '#0d2830';
    if (intensity < 0.3) return '#0f3d4a';
    if (intensity < 0.5) return '#115e6e';
    if (intensity < 0.7) return '#168a9e';
    if (intensity < 0.85) return '#1cb5cc';
    return '#22d3ee';
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#6b7280', textAlign: 'center' }}>
        Loading user distribution...
      </div>
    );
  }

  // Grid: 50 columns wide to fit all kingdoms densely
  const cols = 50;

  return (
    <div style={{ padding: '0.5rem 0' }}>
      {/* Summary Stats */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Users', value: totalUsers.toLocaleString(), color: '#22d3ee' },
          { label: 'Kingdoms with Users', value: totalKingdoms.toLocaleString(), color: '#22c55e' },
          { label: 'Most Populated', value: topKingdoms[0] ? `K${topKingdoms[0].kingdom_number} (${topKingdoms[0].user_count})` : '—', color: '#fbbf24' },
          { label: 'Avg Users/Kingdom', value: totalKingdoms > 0 ? (totalUsers / totalKingdoms).toFixed(1) : '0', color: '#a855f7' },
        ].map((stat, i) => (
          <div key={i} style={{
            padding: '0.6rem 1rem',
            backgroundColor: '#111116',
            borderRadius: '8px',
            border: '1px solid #1a1a1a',
            flex: '1 1 140px',
          }}>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: stat.color, marginTop: '0.15rem' }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Heatmap Grid */}
      <div style={{
        backgroundColor: '#0a0a0a',
        borderRadius: '10px',
        border: '1px solid #1a1a1a',
        padding: '0.75rem',
        position: 'relative',
      }}>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600, marginBottom: '0.5rem' }}>
          User Distribution Heatmap — Kingdoms 1–{allKingdoms.length}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: '1px',
        }}>
          {allKingdoms.map((k) => (
            <div
              key={k.kingdom_number}
              onMouseEnter={(e) => {
                setHoveredKingdom(k);
                setMousePos({ x: e.clientX, y: e.clientY });
              }}
              onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHoveredKingdom(null)}
              style={{
                height: '10px',
                backgroundColor: getColor(k.user_count),
                borderRadius: '1px',
                cursor: 'crosshair',
                transition: 'transform 0.1s',
                transform: hoveredKingdom?.kingdom_number === k.kingdom_number ? 'scale(2)' : 'scale(1)',
                zIndex: hoveredKingdom?.kingdom_number === k.kingdom_number ? 10 : 1,
                position: 'relative',
                minWidth: 0,
              }}
            />
          ))}
        </div>

        {/* Tooltip */}
        {hoveredKingdom && (
          <div style={{
            position: 'fixed',
            left: mousePos.x + 12,
            top: mousePos.y - 40,
            backgroundColor: '#1a1a22',
            border: '1px solid #333',
            borderRadius: '6px',
            padding: '0.4rem 0.6rem',
            fontSize: '0.75rem',
            color: '#fff',
            zIndex: 9999,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}>
            <span style={{ fontWeight: 700, color: '#22d3ee' }}>K{hoveredKingdom.kingdom_number}</span>
            {' — '}
            <span style={{ color: hoveredKingdom.user_count > 0 ? '#22c55e' : '#6b7280' }}>
              {hoveredKingdom.user_count} user{hoveredKingdom.user_count !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.6rem', color: '#6b7280' }}>0</span>
          <div style={{
            flex: 1,
            height: '8px',
            borderRadius: '4px',
            background: 'linear-gradient(90deg, #111116, #0d2830, #0f3d4a, #115e6e, #168a9e, #1cb5cc, #22d3ee)',
          }} />
          <span style={{ fontSize: '0.6rem', color: '#6b7280' }}>{maxCount}+</span>
        </div>
      </div>

      {/* Top 10 Kingdoms Table */}
      <div style={{ marginTop: '1rem' }}>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600, marginBottom: '0.4rem' }}>
          Top 10 Most Populated Kingdoms
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '0.35rem',
        }}>
          {topKingdoms.map((k, i) => (
            <div key={k.kingdom_number} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.6rem',
              backgroundColor: '#111116',
              borderRadius: '6px',
              border: '1px solid #1a1a1a',
            }}>
              <span style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: i < 3 ? '#22d3ee' : '#1a1a2a',
                color: i < 3 ? '#0a0a0a' : '#6b7280',
                fontSize: '0.6rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {i + 1}
              </span>
              <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.8rem' }}>
                K{k.kingdom_number}
              </span>
              <span style={{ marginLeft: 'auto', color: '#22d3ee', fontWeight: 700, fontSize: '0.8rem' }}>
                {k.user_count}
              </span>
              {/* Bar */}
              <div style={{
                width: '40px',
                height: '6px',
                backgroundColor: '#1a1a2a',
                borderRadius: '3px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${(k.user_count / maxCount) * 100}%`,
                  height: '100%',
                  backgroundColor: '#22d3ee',
                  borderRadius: '3px',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
