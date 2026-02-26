import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useToast } from '../Toast';
import { neonGlow, colors } from '../../utils/styles';
import { isReferralEligible } from '../../utils/constants';
import { useFundTransactions, useKingdomFund } from '../../hooks/useKingdomProfileQueries';
import type { EditorInfo, FundInfo } from './types';

interface FundTabProps {
  fund: FundInfo | null;
  editorInfo: EditorInfo;
}

type FundSubTab = 'overview' | 'activity';

const FundTab: React.FC<FundTabProps> = ({ fund, editorInfo }) => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const { trackFeature } = useAnalytics();
  const { showToast } = useToast();
  const [subTab, setSubTab] = useState<FundSubTab>('overview');
  const { data: transactions = [], isLoading: loadingTransactions } = useFundTransactions(editorInfo?.kingdom_number);
  const { data: fundQuery } = useKingdomFund(editorInfo?.kingdom_number);
  const gracePeriodUntil = fundQuery?.gracePeriodUntil;
  const isInGracePeriod = gracePeriodUntil ? new Date(gracePeriodUntil) > new Date() : false;

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

  const graceDaysLeft = gracePeriodUntil ? Math.max(0, Math.ceil((new Date(gracePeriodUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <div style={{
      backgroundColor: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '1rem',
    }}>
      {/* Grace Period Alert Banner */}
      {isInGracePeriod && (
        <div style={{
          padding: '0.75rem',
          backgroundColor: '#f59e0b12',
          border: '1px solid #f59e0b40',
          borderRadius: '8px',
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
        }}>
          <span style={{ fontSize: '1rem', flexShrink: 0, lineHeight: 1.3 }}>⚠️</span>
          <div>
            <p style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600, margin: '0 0 0.25rem' }}>
              {t('recruiter.gracePeriodTitle', 'Tier Grace Period Active')}
            </p>
            <p style={{ color: '#d97706', fontSize: '0.7rem', margin: 0, lineHeight: 1.4 }}>
              {t('recruiter.gracePeriodDesc', 'Your fund balance dropped below the {{tier}} tier threshold. You have {{days}} day(s) to top up before your tier is reduced. Share the contribution link with your kingdom!', { tier: fund.tier, days: graceDaysLeft })}
            </p>
          </div>
        </div>
      )}

      {/* Sub-tab Navigation */}
      <div style={{
        display: 'flex', gap: '0.25rem',
        marginBottom: '0.75rem',
        borderBottom: `1px solid ${colors.border}`,
        paddingBottom: '0.5rem',
      }}>
        {([
          { key: 'overview' as FundSubTab, label: t('recruiter.fundOverview', 'Overview') },
          { key: 'activity' as FundSubTab, label: t('recruiter.fundActivityTab', 'Activity') + (transactions.length > 0 ? ` (${transactions.length})` : '') },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            style={{
              padding: '0.4rem 0.75rem',
              backgroundColor: subTab === tab.key ? '#22d3ee15' : 'transparent',
              border: subTab === tab.key ? '1px solid #22d3ee30' : '1px solid transparent',
              borderRadius: '6px',
              color: subTab === tab.key ? '#22d3ee' : colors.textMuted,
              fontSize: '0.75rem',
              fontWeight: subTab === tab.key ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW SUB-TAB */}
      {subTab === 'overview' && (
        <>
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
              {t('recruiter.fundDepletionInfo', 'Fund depletes ~$5/week starting Feb 23. Current balance sustains the {{tier}} tier for approximately {{weeks}} more weeks. Share the kingdom link to encourage contributions.', { tier: fund.tier, weeks: Math.max(1, Math.floor(Number(fund.balance) / 5)) })}
            </p>
          </div>

          {/* Tier Comparison Table */}
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
              { label: t('transferHubLanding.cmpBioLang', 'Kingdom Bio & Language display'), minTier: 'standard' },
              { label: t('transferHubLanding.cmpMinReqs', 'Min TC & Power requirements shown'), minTier: 'bronze' },
              { label: t('transferHubLanding.cmpBrowseProfiles', 'Browse recruit candidates'), minTier: 'bronze' },
              { label: t('transferHubLanding.cmpVibeTags', 'Kingdom Policies & Vibe tags'), minTier: 'bronze' },
              { label: t('transferHubLanding.cmpInvites', 'Send invites to recruit candidates'), minTier: 'silver' },
              { label: t('transferHubLanding.cmpAlliance', 'Alliance Information & Schedules'), minTier: 'silver' },
              { label: t('transferHubLanding.cmpPrepScheduler', 'KvK Prep Scheduler access'), minTier: 'silver' },
              { label: t('transferHubLanding.cmpBadge', 'Gilded badge for all kingdom users'), minTier: 'gold' },
              { label: t('transferHubLanding.cmpGlow', 'Gold glow + priority placement'), minTier: 'gold' },
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(4, 50px)', gap: 0, padding: '0 0.25rem', borderBottom: `1px solid ${colors.border}` }}>
                  <div />
                  {tiers.map(tier => (
                    <div key={tier.key} style={{ textAlign: 'center', padding: '0.35rem 0.15rem', borderLeft: tier.key === fund.tier ? `1px solid ${tier.color}40` : 'none', borderRight: tier.key === fund.tier ? `1px solid ${tier.color}40` : 'none', borderTop: tier.key === fund.tier ? `2px solid ${tier.color}` : 'none', backgroundColor: tier.key === fund.tier ? `${tier.color}08` : 'transparent' }}>
                      <div style={{ color: tier.color, fontSize: '0.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{tier.label}</div>
                      <div style={{ color: colors.text, fontSize: '0.6rem', fontWeight: 700 }}>{tier.price}</div>
                    </div>
                  ))}
                </div>
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
                const refParam = profile && isReferralEligible(profile) && profile.linked_username ? `&ref=${encodeURIComponent(profile.linked_username)}&src=transfer` : '';
                const url = `${window.location.origin}/transfer-hub?kingdom=${editorInfo.kingdom_number}${refParam}`;
                navigator.clipboard.writeText(url).then(() => {
                  trackFeature('Listing Link Copied', { kingdom: editorInfo.kingdom_number, hasReferral: !!refParam });
                  showToast(t('recruiter.listingLinkCopied', 'Listing link copied! Share to find recruit candidates.'), 'success');
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
                  showToast(t('recruiter.contributionLinkCopied', 'Contribution link copied! Share with your kingdom.'), 'success');
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
        </>
      )}

      {/* ACTIVITY SUB-TAB */}
      {subTab === 'activity' && (
        <div>
          <p style={{ color: colors.textMuted, fontSize: '0.7rem', margin: '0 0 0.75rem', lineHeight: 1.4 }}>
            {t('recruiter.activityDescription', 'All contributions and weekly maintenance charges for your kingdom fund.')}
          </p>
          {loadingTransactions ? (
            <div style={{ padding: '1rem 0', color: colors.textMuted, fontSize: '0.8rem', textAlign: 'center' }}>{t('recruiter.loading', 'Loading...')}</div>
          ) : transactions.length === 0 ? (
            <div style={{
              padding: '1.5rem',
              backgroundColor: colors.bg, borderRadius: '8px',
              textAlign: 'center',
            }}>
              <p style={{ color: colors.textMuted, fontSize: '0.8rem', margin: 0 }}>
                {t('recruiter.noTransactions', 'No transactions yet. Share the contribution link with your kingdom members!')}
              </p>
            </div>
          ) : (
            <>
              {/* Summary bar */}
              {(() => {
                const totalIn = transactions.filter(tx => tx.type === 'contribution').reduce((s, tx) => s + tx.amount, 0);
                const totalOut = transactions.filter(tx => tx.type === 'depletion').reduce((s, tx) => s + Math.abs(tx.amount), 0);
                return (
                  <div style={{
                    display: 'flex', gap: '1rem', justifyContent: 'center',
                    padding: '0.5rem', marginBottom: '0.5rem',
                    backgroundColor: colors.bg, borderRadius: '8px',
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#22c55e', fontSize: '0.9rem', fontWeight: 700 }}>
                        ${totalIn.toFixed(2)}
                      </div>
                      <div style={{ color: colors.textMuted, fontSize: '0.6rem' }}>
                        {t('recruiter.totalIn', 'Total In')}
                      </div>
                    </div>
                    {totalOut > 0 && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: 700 }}>
                          ${totalOut.toFixed(2)}
                        </div>
                        <div style={{ color: colors.textMuted, fontSize: '0.6rem' }}>
                          {t('recruiter.totalOut', 'Total Out')}
                        </div>
                      </div>
                    )}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#22d3ee', fontSize: '0.9rem', fontWeight: 700 }}>
                        {transactions.length}
                      </div>
                      <div style={{ color: colors.textMuted, fontSize: '0.6rem' }}>
                        {t('recruiter.totalTransactions', 'Transactions')}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Transaction list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {transactions.map((tx) => {
                  const isDepletion = tx.type === 'depletion';
                  const isContribution = tx.type === 'contribution';
                  return (
                    <div key={tx.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.5rem 0.6rem',
                      backgroundColor: colors.bg, borderRadius: '6px',
                      border: `1px solid ${isDepletion ? '#ef444420' : '#1a1a1a'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem' }}>{isDepletion ? '📉' : isContribution ? '💰' : '🔧'}</span>
                        <div>
                          <span style={{
                            color: isDepletion ? '#ef4444' : '#22c55e',
                            fontWeight: '600', fontSize: '0.85rem',
                          }}>
                            {isDepletion ? '' : '+'}${Math.abs(tx.amount).toFixed(2)}
                          </span>
                          <span style={{ color: colors.textMuted, fontSize: '0.65rem', marginLeft: '0.5rem' }}>
                            → ${tx.balance_after.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: colors.textMuted, fontSize: '0.6rem' }}>
                          {isDepletion ? t('recruiter.weeklyMaintenance', 'Weekly maintenance') : t('recruiter.contributionLabel', 'Contribution')}
                        </div>
                        <div style={{ color: colors.textMuted, fontSize: '0.6rem' }}>
                          {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        {tx.description && tx.description.includes('grace') && (
                          <div style={{ color: '#f59e0b', fontSize: '0.55rem', marginTop: '0.15rem' }}>
                            {t('recruiter.gracePeriodNote', 'Grace period')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FundTab;
