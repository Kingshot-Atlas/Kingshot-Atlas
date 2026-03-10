import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { tcLevelToTG } from '../../hooks/useAllianceEventCoordinator';
import { FONT_DISPLAY } from '../../utils/styles';
import { ACCENT, TROOP_COLORS, langName } from './allianceCenterConstants';
import BearTierBarChart from './BearTierBarChart';
import type { AllianceMember, PlayerProfileData, ApiPlayerData } from '../../hooks/useAllianceCenter';

// ─── Alliance Charts Section (Distribution Analytics) ───
const AllianceChartsSection: React.FC<{
  members: AllianceMember[];
  profilesMap: Map<string, PlayerProfileData>;
  apiPlayerData: Map<string, ApiPlayerData>;
  registryTroopData: Map<string, { infantry_tier: number; infantry_tg: number; cavalry_tier: number; cavalry_tg: number; archers_tier: number; archers_tg: number; updated_at: string }>;
  allianceId: string;
  isMobile: boolean;
  t: (key: string, fallback: string, opts?: Record<string, unknown>) => string;
}> = ({ members, profilesMap, apiPlayerData, registryTroopData, allianceId, isMobile, t }) => {
  const [expanded, setExpanded] = useState(members.length >= 5);

  // ── Bear Rally Tier Distribution (from Supabase bear_rally_lists) ──
  const { data: bearTierDist = [] } = useQuery<[string, number][]>({
    queryKey: ['alliance-bear-tier-dist', allianceId],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase) return [];
      const { data, error } = await supabase
        .from('bear_rally_lists')
        .select('players, updated_at')
        .eq('alliance_id', allianceId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      if (error || !data?.players) return [];
      const players = data.players as Array<{ tier?: string; bearScore?: number }>;
      const TIER_ORDER = ['SS', 'S', 'A', 'B', 'C', 'D'] as const;
      const counts = new Map<string, number>();
      for (const p of players) {
        if (p.tier && TIER_ORDER.includes(p.tier as typeof TIER_ORDER[number])) {
          counts.set(p.tier, (counts.get(p.tier) || 0) + 1);
        }
      }
      return TIER_ORDER
        .filter(t => counts.has(t))
        .map(t => [t, counts.get(t)!] as [string, number]);
    },
    enabled: !!allianceId,
    staleTime: 5 * 60 * 1000,
  });

  // ── TC Level / TG Distribution (descending) ──
  const tgDist = useMemo(() => {
    const counts = new Map<string, number>();
    members.forEach(m => {
      const prof = m.player_id ? profilesMap.get(m.player_id) : undefined;
      const api = m.player_id ? apiPlayerData.get(m.player_id) : undefined;
      const tcLevel = prof?.linked_tc_level ?? api?.town_center_level ?? null;
      const label = tcLevelToTG(tcLevel);
      if (label) counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => {
        const order = ['TC30', 'TG1', 'TG2', 'TG3', 'TG4', 'TG5', 'TG6', 'TG7', 'TG8'];
        return order.indexOf(b[0]) - order.indexOf(a[0]);
      });
  }, [members, profilesMap, apiPlayerData]);

  // ── Troop Tier Distribution — separate per troop type, sorted descending ──
  const buildTroopDist = useCallback((getTier: (m: AllianceMember, reg?: { infantry_tier: number; infantry_tg: number; cavalry_tier: number; cavalry_tg: number; archers_tier: number; archers_tg: number }) => { tier: number | null | undefined; tg: number | null | undefined }): [string, number][] => {
    const counts = new Map<string, number>();
    members.forEach(m => {
      const reg = m.player_id ? registryTroopData.get(m.player_id) : undefined;
      const { tier, tg } = getTier(m, reg);
      if (tier) {
        const label = tg != null && tg > 0 ? `T${tier}/TG${tg}` : `T${tier}`;
        counts.set(label, (counts.get(label) || 0) + 1);
      }
    });
    return [...counts.entries()]
      .sort((a, b) => {
        const parseLabel = (s: string): [number, number] => {
          const m = s.match(/T(\d+)(?:\/TG(\d+))?/);
          return m ? [Number(m[1]), Number(m[2] || 0)] : [0, 0];
        };
        const pa = parseLabel(a[0]);
        const pb = parseLabel(b[0]);
        return pb[0] !== pa[0] ? pb[0] - pa[0] : pb[1] - pa[1];
      });
  }, [members, registryTroopData]);

  const infantryDist = useMemo(() => buildTroopDist((m, reg) => ({
    tier: m.infantry_tier ?? reg?.infantry_tier, tg: m.infantry_tier ? m.infantry_tg : reg?.infantry_tg,
  })), [buildTroopDist]);
  const cavalryDist = useMemo(() => buildTroopDist((m, reg) => ({
    tier: m.cavalry_tier ?? reg?.cavalry_tier, tg: m.cavalry_tier ? m.cavalry_tg : reg?.cavalry_tg,
  })), [buildTroopDist]);
  const archersDist = useMemo(() => buildTroopDist((m, reg) => ({
    tier: m.archers_tier ?? reg?.archers_tier, tg: m.archers_tier ? m.archers_tg : reg?.archers_tg,
  })), [buildTroopDist]);

  // ── Language Distribution ──
  const langDist = useMemo(() => {
    const counts = new Map<string, number>();
    members.forEach(m => {
      const prof = m.player_id ? profilesMap.get(m.player_id) : undefined;
      const name = prof ? langName(prof.language) : null;
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [members, profilesMap]);

  const hasData = tgDist.length > 0 || infantryDist.length > 0 || cavalryDist.length > 0 || archersDist.length > 0 || langDist.length > 0 || bearTierDist.length > 0;
  if (!hasData) return null;

  const BarChart: React.FC<{ data: [string, number][]; color: string; maxVal?: number }> = ({ data, color, maxVal }) => {
    const max = maxVal ?? Math.max(...data.map(d => d[1]), 1);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        {data.map(([label, count]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ color: '#9ca3af', fontSize: '0.65rem', fontWeight: 600, width: isMobile ? '52px' : '60px', textAlign: 'right', flexShrink: 0 }}>{label}</span>
            <div style={{ flex: 1, height: '14px', backgroundColor: '#1a1a20', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(count / max) * 100}%`, backgroundColor: color, borderRadius: '3px', opacity: 0.75, minWidth: '2px', transition: 'width 0.3s' }} />
            </div>
            <span style={{ color: '#e5e7eb', fontSize: '0.65rem', fontWeight: 700, width: '22px', textAlign: 'right', flexShrink: 0 }}>{count}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: '#111111', borderRadius: '12px', border: `1px solid ${ACCENT}30`, marginBottom: '1.5rem', overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '0.75rem 1rem' : '0.75rem 1.25rem', minHeight: isMobile ? '44px' : undefined,
          backgroundColor: 'transparent', border: 'none',
          cursor: 'pointer', color: '#fff', textAlign: 'left',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>📊</span>
          <h3 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 700, margin: 0, fontFamily: FONT_DISPLAY }}>
            {t('allianceCenter.chartsTitle', 'Alliance Analytics')}
          </h3>
          <span style={{ fontSize: '0.6rem', fontWeight: 600, padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: ACCENT + '20', color: ACCENT }}>
            {t('allianceCenter.chartsCount', '{{count}} members', { count: members.length })}
          </span>
        </div>
        {!expanded && (() => {
          const chartCount = [infantryDist, cavalryDist, archersDist, tgDist, langDist, bearTierDist].filter(d => d.length > 0).length;
          return chartCount > 0 ? (
            <span style={{ fontSize: '0.6rem', color: '#6b7280', fontWeight: 500 }}>
              {t('allianceCenter.chartsAvailable', '{{count}} charts available', { count: chartCount })}
            </span>
          ) : null;
        })()}
        <span style={{ color: '#6b7280', fontSize: '0.75rem', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>

      {expanded && (
        <div style={{ padding: isMobile ? '0 1rem 1rem' : '0 1.25rem 1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
            {/* ── Left Column: Troop Stats ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Infantry Tier */}
              {infantryDist.length > 0 && (
                <div style={{ backgroundColor: '#0d1117', borderRadius: '10px', border: '1px solid #1e1e24', padding: '0.75rem' }}>
                  <h4 style={{ color: TROOP_COLORS.infantry, fontSize: '0.75rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    🗡️ {t('allianceCenter.chartsInfantry', 'Infantry')}
                  </h4>
                  <BarChart data={infantryDist} color={TROOP_COLORS.infantry} />
                </div>
              )}

              {/* Cavalry Tier */}
              {cavalryDist.length > 0 && (
                <div style={{ backgroundColor: '#0d1117', borderRadius: '10px', border: '1px solid #1e1e24', padding: '0.75rem' }}>
                  <h4 style={{ color: TROOP_COLORS.cavalry, fontSize: '0.75rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    🐎 {t('allianceCenter.chartsCavalry', 'Cavalry')}
                  </h4>
                  <BarChart data={cavalryDist} color={TROOP_COLORS.cavalry} />
                </div>
              )}

              {/* Archers Tier */}
              {archersDist.length > 0 && (
                <div style={{ backgroundColor: '#0d1117', borderRadius: '10px', border: '1px solid #1e1e24', padding: '0.75rem' }}>
                  <h4 style={{ color: TROOP_COLORS.archers, fontSize: '0.75rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    🏹 {t('allianceCenter.chartsArchers', 'Archers')}
                  </h4>
                  <BarChart data={archersDist} color={TROOP_COLORS.archers} />
                </div>
              )}
            </div>

            {/* ── Right Column: TC Level & Languages ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Town Center Level Distribution */}
              {tgDist.length > 0 && (
                <div style={{ backgroundColor: '#0d1117', borderRadius: '10px', border: '1px solid #1e1e24', padding: '0.75rem' }}>
                  <h4 style={{ color: '#e5e7eb', fontSize: '0.75rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    🏰 {t('allianceCenter.chartsTcDist', 'Town Center Level')}
                  </h4>
                  <BarChart data={tgDist} color="#22d3ee" />
                </div>
              )}

              {/* Language Distribution */}
              {langDist.length > 0 && (
                <div style={{ backgroundColor: '#0d1117', borderRadius: '10px', border: '1px solid #1e1e24', padding: '0.75rem' }}>
                  <h4 style={{ color: '#e5e7eb', fontSize: '0.75rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    🌐 {t('allianceCenter.chartsLangDist', 'Languages Spoken')}
                  </h4>
                  <BarChart data={langDist} color="#a855f7" />
                </div>
              )}

              {/* Bear Rally Tier Distribution */}
              {bearTierDist.length > 0 && (
                <div style={{ backgroundColor: '#0d1117', borderRadius: '10px', border: '1px solid #1e1e24', padding: '0.75rem' }}>
                  <h4 style={{ color: '#e5e7eb', fontSize: '0.75rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    🐻 {t('allianceCenter.chartsBearTier', 'Bear Rally Tiers')}
                  </h4>
                  <BearTierBarChart data={bearTierDist} isMobile={isMobile} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllianceChartsSection;
