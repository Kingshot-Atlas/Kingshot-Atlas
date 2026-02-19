import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';

// Promo date constants — promo started Feb 19, ends Feb 28 22:00 UTC
const PROMO_START = '2026-02-19T00:00:00Z';
const PROMO_END = '2026-02-28T22:00:00Z';

interface FundedKingdom {
  kingdom_number: number;
  tier: string;
  balance: number;
  total_contributed: number;
  contributor_count: number;
  updated_at: string;
}

interface TierConversion {
  kingdom_number: number;
  tier: string;
  balance: number;
  updated_at: string;
}

export const PromoSection: React.FC = () => {
  const promoActive = Date.now() < new Date(PROMO_END).getTime();

  const [promoData, setPromoData] = useState<{
    fundedKingdoms: FundedKingdom[];
    tierConversions: TierConversion[];
    loading: boolean;
  }>({ fundedKingdoms: [], tierConversions: [], loading: true });

  const fetchPromoData = useCallback(async () => {
    if (!supabase) return;
    setPromoData(prev => ({ ...prev, loading: true }));
    try {
      // All kingdoms with fund activity updated during promo window
      const { data: funds } = await supabase
        .from('kingdom_funds')
        .select('kingdom_number, tier, balance, total_contributed, contributor_count, updated_at')
        .gte('updated_at', PROMO_START)
        .gt('total_contributed', 0)
        .order('total_contributed', { ascending: false });

      // Silver and Gold kingdoms (potential conversions)
      const { data: tiered } = await supabase
        .from('kingdom_funds')
        .select('kingdom_number, tier, balance, updated_at')
        .in('tier', ['silver', 'gold'])
        .order('tier', { ascending: false });

      setPromoData({
        fundedKingdoms: funds || [],
        tierConversions: tiered || [],
        loading: false,
      });
    } catch (err) {
      logger.error('Failed to fetch promo data:', err);
      setPromoData(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchPromoData();
  }, [fetchPromoData]);

  if (promoData.loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: colors.textMuted }}>Loading promo data...</div>;
  }

  const silverCount = promoData.tierConversions.filter(k => k.tier === 'silver').length;
  const goldCount = promoData.tierConversions.filter(k => k.tier === 'gold').length;
  const totalPromoContributions = promoData.fundedKingdoms.reduce((sum, k) => sum + Number(k.total_contributed), 0);
  const totalContributors = promoData.fundedKingdoms.reduce((sum, k) => sum + (k.contributor_count || 0), 0);

  const tierColor = (tier: string) => tier === 'gold' ? '#ffc30b' : tier === 'silver' ? '#d1d5db' : tier === 'bronze' ? '#cd7f32' : '#6b7280';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Promo Status */}
      <div style={{
        padding: '0.75rem 1rem',
        backgroundColor: promoActive ? '#22c55e10' : '#f9731610',
        border: `1px solid ${promoActive ? '#22c55e30' : '#f9731630'}`,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.8rem',
      }}>
        <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', backgroundColor: promoActive ? '#22c55e20' : '#f9731620', border: `1px solid ${promoActive ? '#22c55e40' : '#f9731640'}`, borderRadius: '3px', color: promoActive ? '#22c55e' : '#f97316', fontWeight: 700 }}>
          {promoActive ? 'ACTIVE' : 'ENDED'}
        </span>
        <span style={{ color: colors.textSecondary }}>
          Silver Tier → Gold Tools promo • Ends Feb 28 at 22:00 UTC
        </span>
      </div>

      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Silver Kingdoms', value: silverCount.toString(), color: '#d1d5db', icon: '🥈' },
          { label: 'Gold Kingdoms', value: goldCount.toString(), color: '#ffc30b', icon: '🥇' },
          { label: 'Promo Contributions', value: `$${totalPromoContributions.toFixed(2)}`, color: '#22c55e', icon: '💰' },
          { label: 'Total Contributors', value: totalContributors.toString(), color: '#a855f7', icon: '👥' },
        ].map((metric, i) => (
          <div key={i} style={{
            backgroundColor: colors.cardAlt, borderRadius: '10px', padding: '1rem',
            border: `1px solid ${colors.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem' }}>{metric.icon}</span>
              <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>{metric.label}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: metric.color }}>{metric.value}</div>
          </div>
        ))}
      </div>

      {/* Tier Breakdown */}
      <div style={{
        backgroundColor: colors.cardAlt, borderRadius: '10px', padding: '1rem',
        border: `1px solid ${colors.border}`,
      }}>
        <h4 style={{ color: colors.text, fontSize: '0.85rem', marginBottom: '0.75rem' }}>Current Silver & Gold Kingdoms</h4>
        {promoData.tierConversions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {promoData.tierConversions.map(k => (
              <div key={k.kingdom_number} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.5rem 0.75rem', backgroundColor: colors.bg, borderRadius: '6px',
                border: `1px solid ${colors.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600, color: colors.text, fontSize: '0.8rem' }}>K{k.kingdom_number}</span>
                  <span style={{
                    fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: '3px',
                    backgroundColor: `${tierColor(k.tier)}20`, color: tierColor(k.tier),
                    fontWeight: 700, textTransform: 'uppercase',
                  }}>{k.tier}</span>
                </div>
                <span style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
                  ${Number(k.balance).toFixed(2)} balance
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '1rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.8rem' }}>No Silver or Gold kingdoms yet</div>
        )}
      </div>

      {/* Fund Activity During Promo */}
      <div style={{
        backgroundColor: colors.cardAlt, borderRadius: '10px', padding: '1rem',
        border: `1px solid ${colors.border}`,
      }}>
        <h4 style={{ color: colors.text, fontSize: '0.85rem', marginBottom: '0.75rem' }}>Fund Activity During Promo</h4>
        {promoData.fundedKingdoms.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {promoData.fundedKingdoms.map(k => {
              const updDate = new Date(k.updated_at);
              return (
                <div key={k.kingdom_number} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem', backgroundColor: colors.bg, borderRadius: '6px',
                  border: `1px solid ${colors.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, color: colors.text, fontSize: '0.8rem' }}>K{k.kingdom_number}</span>
                    <span style={{
                      fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: '3px',
                      backgroundColor: `${tierColor(k.tier)}20`, color: tierColor(k.tier),
                      fontWeight: 700, textTransform: 'uppercase',
                    }}>{k.tier}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 600 }}>
                      ${Number(k.total_contributed).toFixed(2)}
                    </span>
                    <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
                      {k.contributor_count} contributor{k.contributor_count !== 1 ? 's' : ''}
                    </span>
                    <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
                      {updDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '1rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.8rem' }}>No fund activity during promo period yet</div>
        )}
      </div>
    </div>
  );
};
