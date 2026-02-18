import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useToast } from '../Toast';
import { supabase } from '../../lib/supabase';
import { neonGlow, colors } from '../../utils/styles';
import { logger } from '../../utils/logger';
import { isReferralEligible } from '../../utils/constants';
import type { EditorInfo, FundInfo } from './types';

interface FundTabProps {
  fund: FundInfo | null;
  editorInfo: EditorInfo;
}

const FundTab: React.FC<FundTabProps> = ({ fund, editorInfo }) => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const { trackFeature } = useAnalytics();
  const { showToast } = useToast();
  const [contributions, setContributions] = useState<Array<{ id: string; amount: number; created_at: string }>>([]);
  const [loadingContributions, setLoadingContributions] = useState(false);

  useEffect(() => {
    if (fund && contributions.length === 0) {
      loadContributions();
    }
  }, [fund]);

  const loadContributions = async () => {
    if (!supabase || !editorInfo) return;
    setLoadingContributions(true);
    try {
      const { data } = await supabase
        .from('kingdom_fund_contributions')
        .select('id, amount, created_at')
        .eq('kingdom_number', editorInfo.kingdom_number)
        .order('created_at', { ascending: false })
        .limit(20);
      setContributions(data || []);
    } catch (err) {
      logger.error('FundTab: fetchContributions failed', err);
    } finally {
      setLoadingContributions(false);
    }
  };

  if (!fund) {
    return (
      <div style={{
        textAlign: 'center', padding: '2rem 1rem',
        backgroundColor: colors.surface, borderRadius: '12px',
        border: `1px solid ${colors.border}`,
      }}>
        <p style={{ color: colors.text, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          {t('recruiter.noKingdomFund', 'No Kingdom Fund Yet')}
        </p>
        <p style={{ color: colors.textMuted, fontSize: '0.8rem' }}>
          {t('recruiter.startFundDesc', 'Start a Kingdom Fund to unlock tier benefits and boost your listing visibility.')}
        </p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '1rem',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '1rem', marginBottom: '1rem',
      }}>
        <div>
          <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{t('recruiter.balance', 'Balance')}</span>
          <div style={{
            fontWeight: 'bold', fontSize: '1.2rem',
            ...neonGlow('#22c55e'),
          }}>
            ${Number(fund.balance).toFixed(2)}
          </div>
        </div>
        <div>
          <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{t('recruiter.tier', 'Tier')}</span>
          <div style={{
            color: fund.tier === 'gold' ? colors.gold : fund.tier === 'silver' ? '#d1d5db' : fund.tier === 'bronze' ? colors.bronze : colors.textMuted,
            fontWeight: 'bold', fontSize: '1.2rem',
            textTransform: 'capitalize',
          }}>
            {fund.tier}
          </div>
        </div>
      </div>
      <div style={{
        padding: '0.75rem',
        backgroundColor: colors.bg,
        borderRadius: '8px',
      }}>
        <p style={{ color: colors.textSecondary, fontSize: '0.75rem', margin: 0, lineHeight: 1.5 }}>
          Fund depletes ~$5/week. Current balance sustains the <strong style={{ color: colors.text }}>{fund.tier}</strong> tier
          for approximately <strong style={{ color: colors.text }}>{Math.max(1, Math.floor(Number(fund.balance) / 5))}</strong> more weeks.
          Share the kingdom link to encourage contributions.
        </p>
      </div>

      {/* Tier Comparison Table — matches Transfer Hub landing page */}
      {(() => {
        const tiers = [
          { key: 'standard', label: t('transferHubLanding.tierStandard', 'Standard'), sub: t('transferHubLanding.tierFree', '(Free)'), price: t('transferHubLanding.priceFree', 'Free'), color: colors.textMuted },
          { key: 'bronze', label: t('transferHubLanding.tierBronze', 'Bronze'), sub: '', price: '$25+', color: colors.bronze || '#cd7f32' },
          { key: 'silver', label: t('transferHubLanding.tierSilver', 'Silver'), sub: '', price: '$50+', color: '#d1d5db' },
          { key: 'gold', label: t('transferHubLanding.tierGold', 'Gold'), sub: '', price: '$100+', color: colors.gold || '#ffc30b' },
        ];
        const features: { label: string; minTier: string }[] = [
          { label: t('transferHubLanding.cmpBasicListing', 'Basic listing with Atlas Score & stats'), minTier: 'standard' },
          { label: t('transferHubLanding.cmpReviews', 'Community reviews from players'), minTier: 'standard' },
          { label: t('transferHubLanding.cmpMinReqs', 'Min TC & Power requirements shown'), minTier: 'bronze' },
          { label: t('transferHubLanding.cmpBrowseProfiles', 'Browse transferee profiles'), minTier: 'bronze' },
          { label: t('transferHubLanding.cmpVibeTags', 'Kingdom Policies & Vibe tags'), minTier: 'bronze' },
          { label: t('transferHubLanding.cmpInvites', 'Send invites to transferees'), minTier: 'silver' },
          { label: t('transferHubLanding.cmpBioLang', 'Kingdom Bio & Language display'), minTier: 'silver' },
          { label: t('transferHubLanding.cmpAlliance', 'Alliance Information schedule'), minTier: 'silver' },
          { label: t('transferHubLanding.cmpSlots', '+2 alliance slots (5 total)'), minTier: 'gold' },
          { label: t('transferHubLanding.cmpBadge', 'Gilded badge for all kingdom users'), minTier: 'gold' },
          { label: t('transferHubLanding.cmpGlow', 'Gold glow + priority placement'), minTier: 'gold' },
          { label: t('transferHubLanding.cmpPrepScheduler', 'KvK Prep Scheduler access'), minTier: 'gold' },
          { label: t('transferHubLanding.cmpBattlePlanner', 'KvK Battle Planner access'), minTier: 'gold' },
        ];
        const tierOrder = ['standard', 'bronze', 'silver', 'gold'];
        const isTierUnlocked = (featureTier: string, colTier: string) => tierOrder.indexOf(colTier) >= tierOrder.indexOf(featureTier);
        const getTierColor = (tier: string) => tier === 'gold' ? (colors.gold || '#ffc30b') : tier === 'silver' ? '#d1d5db' : tier === 'bronze' ? (colors.bronze || '#cd7f32') : '#ffffff';

        return (
          <div style={{ marginTop: '0.75rem', borderRadius: '10px', border: `1px solid ${colors.border}`, overflow: 'hidden', backgroundColor: '#0d0d0d' }}>
            <div style={{ padding: '0.75rem 0.75rem 0.5rem', textAlign: 'center' }}>
              <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>
                {t('recruiter.fundTierComparison', 'Kingdom Fund: Boost Your Listing')}
              </h3>
              <p style={{ color: colors.textMuted, fontSize: '0.6rem', margin: '0.25rem 0 0', lineHeight: 1.4 }}>
                {t('transferHubLanding.fundSubtitle', 'Recruiting is a team effort. Anyone in your kingdom can chip in to boost the listing.')}
              </p>
            </div>
            {/* Tier Header Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(4, 50px)', gap: 0, padding: '0 0.25rem', borderBottom: `1px solid ${colors.border}` }}>
              <div />
              {tiers.map(tier => (
                <div key={tier.key} style={{ textAlign: 'center', padding: '0.35rem 0.15rem', borderLeft: tier.key === fund.tier ? `1px solid ${tier.color}40` : 'none', borderRight: tier.key === fund.tier ? `1px solid ${tier.color}40` : 'none', borderTop: tier.key === fund.tier ? `2px solid ${tier.color}` : 'none', backgroundColor: tier.key === fund.tier ? `${tier.color}08` : 'transparent' }}>
                  <div style={{ color: tier.color, fontSize: '0.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{tier.label}</div>
                  <div style={{ color: colors.text, fontSize: '0.6rem', fontWeight: 700 }}>{tier.price}</div>
                </div>
              ))}
            </div>
            {/* Feature Rows */}
            {features.map((feat, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr repeat(4, 50px)', gap: 0, padding: '0 0.25rem', borderBottom: i < features.length - 1 ? `1px solid ${colors.border}05` : 'none', backgroundColor: i % 2 === 0 ? '#0d0d0d' : '#111111' }}>
                <div style={{ padding: '0.3rem 0.35rem', fontSize: '0.58rem', color: getTierColor(feat.minTier), fontWeight: feat.minTier !== 'standard' ? 600 : 400, display: 'flex', alignItems: 'center' }}>{feat.label}</div>
                {tiers.map(tier => {
                  const unlocked = isTierUnlocked(feat.minTier, tier.key);
                  return (
                    <div key={tier.key} style={{ textAlign: 'center', padding: '0.3rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: tier.key === fund.tier ? `1px solid ${tier.color}40` : 'none', borderRight: tier.key === fund.tier ? `1px solid ${tier.color}40` : 'none', backgroundColor: tier.key === fund.tier ? `${tier.color}05` : 'transparent' }}>
                      <span style={{ fontSize: '0.65rem', color: unlocked ? '#f59e0b' : '#333' }}>{unlocked ? '✓' : '—'}</span>
                    </div>
                  );
                })}
              </div>
            ))}
            {/* Current tier indicator */}
            <div style={{ padding: '0.4rem 0.5rem', textAlign: 'center', borderTop: `1px solid ${colors.border}` }}>
              <p style={{ color: colors.textMuted, fontSize: '0.55rem', margin: 0, fontStyle: 'italic' }}>
                {t('transferHubLanding.fundNote', 'Depositing is 100% optional. The Transfer Hub is free for everyone. Fund tiers just give your kingdom extra visibility.')}
              </p>
            </div>
          </div>
        );
      })()}
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => {
            const refParam = profile && isReferralEligible(profile) && profile.linked_username ? `&ref=${profile.linked_username}&src=transfer` : '';
            const url = `${window.location.origin}/transfer-hub?kingdom=${editorInfo.kingdom_number}${refParam}`;
            navigator.clipboard.writeText(url).then(() => {
              trackFeature('Listing Link Copied', { kingdom: editorInfo.kingdom_number, hasReferral: !!refParam });
              showToast('Listing link copied! Share to recruit transferees.', 'success');
            });
          }}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#22d3ee15',
            border: '1px solid #22d3ee30',
            borderRadius: '8px',
            color: '#22d3ee',
            fontSize: '0.8rem',
            fontWeight: '600',
            cursor: 'pointer',
            minHeight: '44px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
          }}
        >
          🔗 {t('recruiter.copyListingLink', 'Copy Listing Link')}
        </button>
        <button
          onClick={() => {
            const url = `${window.location.origin}/transfer-hub?fund=${editorInfo.kingdom_number}`;
            navigator.clipboard.writeText(url).then(() => {
              trackFeature('Contribution Link Copied', { kingdom: editorInfo.kingdom_number });
              showToast('Contribution link copied! Share with your kingdom.', 'success');
            });
          }}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#22c55e15',
            border: '1px solid #22c55e30',
            borderRadius: '8px',
            color: '#22c55e',
            fontSize: '0.8rem',
            fontWeight: '600',
            cursor: 'pointer',
            minHeight: '44px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
          }}
        >
          💰 {t('recruiter.copyContributionLink', 'Copy Contribution Link')}
        </button>
      </div>

      {/* Contribution History */}
      <div style={{ marginTop: '1rem' }}>
        <span style={{ color: colors.textSecondary, fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('recruiter.contributionHistory', 'Contribution History')}
        </span>
        {loadingContributions ? (
          <div style={{ padding: '1rem 0', color: colors.textMuted, fontSize: '0.8rem', textAlign: 'center' }}>{t('recruiter.loading', 'Loading...')}</div>
        ) : contributions.length === 0 ? (
          <div style={{
            marginTop: '0.5rem', padding: '0.75rem',
            backgroundColor: colors.bg, borderRadius: '8px',
            textAlign: 'center',
          }}>
            <p style={{ color: colors.textMuted, fontSize: '0.75rem', margin: 0 }}>
              {t('recruiter.noContributions', 'No contributions yet. Share the contribution link with your kingdom members!')}
            </p>
          </div>
        ) : (
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {contributions.map((c) => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.5rem 0.6rem',
                backgroundColor: colors.bg, borderRadius: '6px',
                border: '1px solid #1a1a1a',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.9rem' }}>💰</span>
                  <span style={{ color: '#22c55e', fontWeight: '600', fontSize: '0.85rem' }}>
                    ${Number(c.amount).toFixed(2)}
                  </span>
                </div>
                <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
                  {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            ))}
            {contributions.length > 0 && (
              <div style={{
                textAlign: 'center', padding: '0.4rem 0',
                borderTop: '1px solid #1a1a1a', marginTop: '0.2rem',
              }}>
                <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: '600' }}>
                  Total: ${contributions.reduce((sum, c) => sum + Number(c.amount), 0).toFixed(2)}
                </span>
                <span style={{ color: colors.textMuted, fontSize: '0.65rem', marginLeft: '0.5rem' }}>
                  ({contributions.length} contribution{contributions.length !== 1 ? 's' : ''})
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FundTab;
