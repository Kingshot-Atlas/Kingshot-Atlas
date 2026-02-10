import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { neonGlow } from '../utils/styles';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

interface KingdomData {
  id: number;
  atlas_score: number;
  rank: number;
  total_wins: number;
  total_losses: number;
  kvk_count: number;
}

const KingdomLeaderboardPosition: React.FC<{
  kingdomId: number | null;
  themeColor: string;
  isMobile: boolean;
}> = ({ kingdomId, themeColor, isMobile }) => {
  const [kingdom, setKingdom] = useState<KingdomData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!kingdomId) {
      setKingdom(null);
      return;
    }
    
    setLoading(true);
    fetch(`${API_BASE}/api/v1/kingdoms/${kingdomId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setKingdom({
            id: data.id ?? data.kingdom_number ?? kingdomId,
            atlas_score: data.atlas_score ?? data.overall_score ?? 0,
            rank: data.rank ?? 0,
            total_wins: data.total_wins ?? (data.prep_wins ?? 0) + (data.battle_wins ?? 0),
            total_losses: data.total_losses ?? (data.prep_losses ?? 0) + (data.battle_losses ?? 0),
            kvk_count: data.kvk_count ?? data.total_kvks ?? 0,
          });
        }
      })
      .catch(() => setKingdom(null))
      .finally(() => setLoading(false));
  }, [kingdomId]);

  if (!kingdomId) return null;
  if (loading) return (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '12px',
      padding: '1rem',
      marginBottom: '1.5rem',
      border: '1px solid #2a2a2a',
    }}>
      <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>Loading kingdom data...</div>
    </div>
  );
  if (!kingdom) return null;

  return (
    <Link to={`/kingdom/${kingdom.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        backgroundColor: '#111111',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.25rem',
        marginBottom: '1.5rem',
        border: `1px solid ${themeColor}30`,
        cursor: 'pointer',
        transition: 'border-color 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '1.1rem' }}>🏆</span>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>
            User&apos;s Kingdom Rankings
          </h3>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: '0.75rem',
        }}>
          <div style={{ padding: '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Kingdom</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff' }}>{kingdom.id}</div>
          </div>
          <div style={{ padding: '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Atlas Score</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', ...neonGlow(themeColor) }}>{kingdom.atlas_score.toFixed(2)}</div>
          </div>
          <div style={{ padding: '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Rank</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', ...neonGlow(themeColor) }}>#{kingdom.rank}</div>
          </div>
          <div style={{ padding: '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Experience</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff' }}>{kingdom.kvk_count} KvKs</div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default KingdomLeaderboardPosition;
