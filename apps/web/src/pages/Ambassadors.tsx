import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { ReferralTier, REFERRAL_TIER_COLORS } from '../utils/constants';
import ReferralBadge from '../components/ReferralBadge';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { logger } from '../utils/logger';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';

interface AmbassadorProfile {
  id: string;
  username: string;
  linked_username: string | null;
  linked_avatar_url: string | null;
  linked_kingdom: number | null;
  linked_tc_level: number | null;
  alliance_tag: string | null;
  subscription_tier: string | null;
  referral_tier: string | null;
  referral_count: number;
}

// Referral tier sort priority (ambassador=0, consul=1, recruiter=2, scout=3)
const getReferralSortPriority = (tier: string | null): number => {
  switch (tier) {
    case 'ambassador': return 0;
    case 'consul': return 1;
    case 'recruiter': return 2;
    case 'scout': return 3;
    default: return 4;
  }
};

// Convert TC level to display string
const formatTCLevel = (level: number | null | undefined): string => {
  if (!level) return '';
  if (level <= 30) return `TC ${level}`;
  if (level <= 34) return 'TC 30';
  const tgTier = Math.floor((level - 35) / 5) + 1;
  return `TG${tgTier}`;
};

const SOURCE_META: Record<string, { label: string; icon: string; color: string }> = {
  referral_link: { label: 'Links', icon: '🔗', color: '#22d3ee' },
  endorsement: { label: 'Endorsements', icon: '🗳️', color: '#a855f7' },
  review_invite: { label: 'Reviews', icon: '⭐', color: '#fbbf24' },
  transfer_listing: { label: 'Transfers', icon: '🔄', color: '#22c55e' },
};

const Ambassadors: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle('Ambassador Network');
  useMetaTags(PAGE_META_TAGS.ambassadors);
  useStructuredData({ type: 'BreadcrumbList', data: PAGE_BREADCRUMBS.ambassadors });
  const isMobile = useIsMobile();
  const [ambassadors, setAmbassadors] = useState<AmbassadorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [monthlyJoins, setMonthlyJoins] = useState<number>(0);
  const [referrerSources, setReferrerSources] = useState<Map<string, Set<string>>>(new Map());
  const [globalSourceCounts, setGlobalSourceCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const fetchAmbassadors = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, linked_username, linked_avatar_url, linked_kingdom, linked_tc_level, alliance_tag, subscription_tier, referral_tier, referral_count')
          .not('referral_tier', 'is', null)
          .order('referral_count', { ascending: false });

        if (error) {
          logger.error('Failed to fetch ambassadors:', error);
          return;
        }

        setAmbassadors(data || []);

        // Fetch monthly verified referrals count
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from('referrals')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'verified')
          .gte('verified_at', startOfMonth.toISOString());
        setMonthlyJoins(count || 0);

        // Fetch referral source breakdown per referrer
        const { data: sourceData } = await supabase
          .from('referrals')
          .select('referrer_user_id, source')
          .eq('status', 'verified');
        if (sourceData) {
          const perReferrer = new Map<string, Set<string>>();
          const globalCounts = new Map<string, number>();
          sourceData.forEach((r: { referrer_user_id: string; source: string }) => {
            const src = r.source || 'referral_link';
            if (!perReferrer.has(r.referrer_user_id)) perReferrer.set(r.referrer_user_id, new Set());
            perReferrer.get(r.referrer_user_id)!.add(src);
            globalCounts.set(src, (globalCounts.get(src) || 0) + 1);
          });
          setReferrerSources(perReferrer);
          setGlobalSourceCounts(globalCounts);
        }
      } catch (err) {
        logger.error('Failed to fetch ambassadors:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAmbassadors();
  }, []);

  const filteredAmbassadors = ambassadors
    .filter(a => filterTier === 'all' || a.referral_tier === filterTier)
    .filter(a => filterSource === 'all' || (referrerSources.get(a.id)?.has(filterSource) ?? false))
    .sort((a, b) => {
      const tierDiff = getReferralSortPriority(a.referral_tier) - getReferralSortPriority(b.referral_tier);
      if (tierDiff !== 0) return tierDiff;
      return (b.referral_count || 0) - (a.referral_count || 0);
    });

  const tierCounts = {
    all: ambassadors.length,
    ambassador: ambassadors.filter(a => a.referral_tier === 'ambassador').length,
    consul: ambassadors.filter(a => a.referral_tier === 'consul').length,
    recruiter: ambassadors.filter(a => a.referral_tier === 'recruiter').length,
    scout: ambassadors.filter(a => a.referral_tier === 'scout').length,
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '1rem 0' : '2rem 0' }}>
      {/* Hero Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: isMobile ? '1.5rem' : '2rem',
        padding: isMobile ? '1.5rem 1rem' : '2rem',
        background: 'linear-gradient(180deg, #a24cf315 0%, transparent 100%)',
        borderRadius: '16px',
        border: '1px solid #a24cf330',
      }}>
        <h1 style={{
          fontFamily: FONT_DISPLAY,
          fontSize: isMobile ? '1.5rem' : '2rem',
          fontWeight: '800',
          color: '#fff',
          margin: '0 0 0.5rem',
          letterSpacing: '-0.02em',
        }}>
          <span style={{ color: '#fff' }}>Atlas</span>{' '}<span style={{ color: '#a24cf3' }}>Ambassadors</span>
        </h1>
        <p style={{
          color: '#9ca3af',
          fontSize: isMobile ? '0.85rem' : '0.95rem',
          margin: 0,
          lineHeight: 1.6,
          maxWidth: '520px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          {t('ambassadors.heroDesc', 'The players spreading data-driven dominance. More referrals, higher rank.')}
        </p>

        {monthlyJoins > 0 && (
          <div style={{
            marginTop: '0.75rem',
            fontSize: '0.8rem',
            color: '#22c55e',
            fontWeight: '600',
          }}>
            ⚡ {t('ambassadors.monthlyJoins', '{{count}} players joined via referrals this month', { count: monthlyJoins })}
          </div>
        )}

      </div>

      {/* Tier Perks — What You Unlock */}
      <div style={{
        marginBottom: isMobile ? '1.5rem' : '2rem',
        padding: isMobile ? '1.25rem 1rem' : '1.5rem',
        backgroundColor: '#111116',
        borderRadius: '16px',
        border: '1px solid #2a2a2a',
      }}>
        <h2 style={{
          fontFamily: FONT_DISPLAY,
          fontSize: isMobile ? '1rem' : '1.15rem',
          fontWeight: '700',
          color: '#fff',
          margin: '0 0 0.25rem',
          textAlign: 'center',
        }}>
          {t('ambassadors.everyReferral', 'Every Referral Counts. Every Tier Unlocks More.')}
        </h2>
        <p style={{
          color: '#6b7280',
          fontSize: '0.8rem',
          margin: '0 0 1.25rem',
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          {t('ambassadors.shareAtlasClimb', 'Share Atlas. Climb the ranks. The top recruiters don’t wait — they build networks.')}
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: isMobile ? '0.6rem' : '0.75rem',
        }}>
          {/* Scout */}
          <div style={{
            padding: isMobile ? '0.75rem' : '1rem',
            borderRadius: '12px',
            border: '1px solid #ffffff25',
            backgroundColor: '#ffffff08',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>🔍</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.15rem' }}>{t('ambassadors.scoutTitle', 'Scout')}</div>
            <div style={{ color: REFERRAL_TIER_COLORS.scout, fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t('ambassadors.scoutReq', '2 Referrals')}</div>
            <div style={{ color: '#9ca3af', fontSize: '0.68rem', lineHeight: 1.5 }}>
              {t('ambassadors.scoutDesc', 'Scout badge on your profile. Listed on the Ambassador Network page.')}
            </div>
          </div>

          {/* Recruiter */}
          <div style={{
            padding: isMobile ? '0.75rem' : '1rem',
            borderRadius: '12px',
            border: `1px solid ${REFERRAL_TIER_COLORS.recruiter}30`,
            backgroundColor: `${REFERRAL_TIER_COLORS.recruiter}08`,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>📢</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.15rem' }}>{t('ambassadors.recruiterTitle', 'Recruiter')}</div>
            <div style={{ color: REFERRAL_TIER_COLORS.recruiter, fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t('ambassadors.recruiterReq', '5 Referrals')}</div>
            <div style={{ color: '#9ca3af', fontSize: '0.68rem', lineHeight: 1.5 }}>
              {t('ambassadors.recruiterDesc', 'Recruiter badge on your profile. Highlighted in kingdom player lists.')}
            </div>
          </div>

          {/* Consul */}
          <div style={{
            padding: isMobile ? '0.75rem' : '1rem',
            borderRadius: '12px',
            border: `1px solid ${REFERRAL_TIER_COLORS.consul}30`,
            backgroundColor: `${REFERRAL_TIER_COLORS.consul}08`,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>⚖️</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.15rem' }}>{t('ambassadors.consulTitle', 'Consul')}</div>
            <div style={{ color: REFERRAL_TIER_COLORS.consul, fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t('ambassadors.consulReq', '10 Referrals')}</div>
            <div style={{ color: '#9ca3af', fontSize: '0.68rem', lineHeight: 1.5 }}>
              {t('ambassadors.consulDesc', 'Exclusive Consul role in Discord. Recognized voice in the community.')}
            </div>
          </div>

          {/* Ambassador */}
          <div style={{
            padding: isMobile ? '0.75rem' : '1rem',
            borderRadius: '12px',
            border: `1px solid ${REFERRAL_TIER_COLORS.ambassador}50`,
            backgroundColor: `${REFERRAL_TIER_COLORS.ambassador}10`,
            textAlign: 'center',
            boxShadow: `0 0 15px ${REFERRAL_TIER_COLORS.ambassador}15`,
          }}>
            <div style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>🏛️</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.15rem' }}>{t('ambassadors.ambassadorTitle', 'Ambassador')}</div>
            <div style={{ color: REFERRAL_TIER_COLORS.ambassador, fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t('ambassadors.ambassadorReq', '20 Referrals')}</div>
            <div style={{ color: '#9ca3af', fontSize: '0.68rem', lineHeight: 1.5 }}>
              {t('ambassadors.ambassadorDesc', 'Ambassador Discord role + badge. Priority support, #ambassadors-lounge access, leaderboard spotlight, and direct input on Atlas features.')}
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
          marginTop: '1.25rem',
        }}>
          <div style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: '#22c55e08',
            borderRadius: '8px',
            border: '1px solid #22c55e20',
          }}>
            <p style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 600, margin: 0 }}>
              ⚡ {t('ambassadors.spotsFillFast', 'Spots fill fast. The earlier you start, the higher you climb.')}
            </p>
          </div>
          <Link
            to="/profile#referral-program"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.6rem 1.5rem',
              backgroundColor: '#a24cf320',
              border: '1px solid #a24cf350',
              borderRadius: '10px',
              color: '#a24cf3',
              fontSize: '0.85rem',
              fontWeight: '600',
              textDecoration: 'none',
              minHeight: '44px',
              transition: 'all 0.2s',
            }}
          >
            {t('ambassadors.startRecruiting', 'Start Recruiting →')}
          </Link>
        </div>
      </div>

      {/* Filter chips — Tier */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '0.75rem',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        {[
          { key: 'all', label: t('common.all', 'All'), color: '#22d3ee' },
          { key: 'ambassador', label: '🏛️ ' + t('ambassadors.ambassadors', 'Ambassadors'), color: REFERRAL_TIER_COLORS.ambassador },
          { key: 'consul', label: '⚖️ ' + t('ambassadors.consuls', 'Consuls'), color: REFERRAL_TIER_COLORS.consul },
          { key: 'recruiter', label: '📢 ' + t('ambassadors.recruiters', 'Recruiters'), color: REFERRAL_TIER_COLORS.recruiter },
          { key: 'scout', label: '🔍 ' + t('ambassadors.scouts', 'Scouts'), color: REFERRAL_TIER_COLORS.scout },
        ].map(chip => (
          <button
            key={chip.key}
            onClick={() => setFilterTier(chip.key)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: '600',
              border: `1px solid ${filterTier === chip.key ? chip.color : '#2a2a2a'}`,
              backgroundColor: filterTier === chip.key ? `${chip.color}15` : 'transparent',
              color: filterTier === chip.key ? chip.color : '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minHeight: '36px',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {chip.label} ({tierCounts[chip.key as keyof typeof tierCounts]})
          </button>
        ))}
      </div>

      {/* Filter chips — Source */}
      {globalSourceCounts.size > 0 && (
        <div style={{
          display: 'flex',
          gap: '0.4rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          <span style={{ color: '#4b5563', fontSize: '0.7rem', alignSelf: 'center', marginRight: '0.25rem' }}>{t('ambassadors.source', 'Source:')}</span>
          {[
            { key: 'all', label: t('ambassadors.allSources', 'All Sources'), color: '#6b7280' },
            ...Array.from(globalSourceCounts.entries()).map(([src, count]) => ({
              key: src,
              label: `${SOURCE_META[src]?.icon || ''} ${SOURCE_META[src]?.label || src} (${count})`,
              color: SOURCE_META[src]?.color || '#6b7280',
            })),
          ].map(chip => (
            <button
              key={chip.key}
              onClick={() => setFilterSource(chip.key)}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '16px',
                fontSize: '0.65rem',
                fontWeight: '600',
                border: `1px solid ${filterSource === chip.key ? chip.color : '#2a2a2a'}`,
                backgroundColor: filterSource === chip.key ? `${chip.color}15` : 'transparent',
                color: filterSource === chip.key ? chip.color : '#4b5563',
                cursor: 'pointer',
                transition: 'all 0.2s',
                minHeight: '30px',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#6b7280',
          fontSize: '0.9rem',
        }}>
          {t('ambassadors.loading', 'Loading ambassadors...')}
        </div>
      ) : filteredAmbassadors.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          backgroundColor: '#111111',
          borderRadius: '12px',
          border: '1px solid #2a2a2a',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🏛️</div>
          <p style={{ color: '#9ca3af', fontSize: '0.95rem', margin: '0 0 0.5rem' }}>
            {t('ambassadors.noOneClaimed', "No one's claimed this tier yet.")}
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>
            {t('ambassadors.beTheFirst', 'Be the first. Share Atlas, rack up referrals, and own this leaderboard.')}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: isMobile ? '0.75rem' : '1rem',
        }}>
          {filteredAmbassadors.map((amb, index) => {
            const refTier = amb.referral_tier as ReferralTier;
            const tierColor = REFERRAL_TIER_COLORS[refTier] || '#ffffff';
            const isTopTier = refTier === 'ambassador' || refTier === 'consul';

            return (
              <Link
                key={amb.id}
                to={`/profile/${amb.id}`}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <div
                  style={{
                    backgroundColor: '#111116',
                    borderRadius: '12px',
                    padding: isMobile ? '1rem' : '1.25rem',
                    border: `2px solid ${tierColor}${isTopTier ? '60' : '30'}`,
                    transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.borderColor = tierColor;
                    e.currentTarget.style.boxShadow = `0 4px 20px ${tierColor}25`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = `${tierColor}${isTopTier ? '60' : '30'}`;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Rank number for ambassadors */}
                  {refTier === 'ambassador' && (
                    <div style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '12px',
                      backgroundColor: '#a24cf3',
                      color: '#fff',
                      fontSize: '0.6rem',
                      fontWeight: '700',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '10px',
                      letterSpacing: '0.05em',
                    }}>
                      #{index + 1}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {/* Avatar */}
                    <div style={{
                      width: isMobile ? '48px' : '56px',
                      height: isMobile ? '48px' : '56px',
                      borderRadius: '50%',
                      border: `2px solid ${tierColor}`,
                      overflow: 'hidden',
                      flexShrink: 0,
                      backgroundColor: '#1a1a1a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...(isTopTier ? { boxShadow: `0 0 10px ${tierColor}40` } : {}),
                    }}>
                      {amb.linked_avatar_url ? (
                        <img
                          src={amb.linked_avatar_url}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ fontSize: '1.25rem', color: tierColor, fontWeight: 'bold' }}>
                          {(amb.linked_username || amb.username || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                        {amb.alliance_tag && (
                          <span style={{ color: '#9ca3af', fontWeight: '600', fontSize: '0.85rem' }}>
                            [{amb.alliance_tag}]
                          </span>
                        )}
                        <span style={{
                          fontSize: '1rem',
                          fontWeight: '700',
                          color: '#fff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          ...(isTopTier ? neonGlow(tierColor) : {}),
                        }}>
                          {amb.linked_username || amb.username || 'Anonymous'}
                        </span>
                        <ReferralBadge tier={refTier} size="sm" />
                      </div>

                      {/* Stats row */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        fontSize: '0.75rem',
                        color: '#6b7280',
                      }}>
                        <span>
                          <strong style={{ color: tierColor }}>{amb.referral_count}</strong> {t('ambassadors.referrals', 'referrals')}
                        </span>
                        {amb.linked_kingdom && (
                          <span>
                            {t('common.kingdom', 'Kingdom')} <strong style={{ color: '#fff' }}>{amb.linked_kingdom}</strong>
                          </span>
                        )}
                        {amb.linked_tc_level && (
                          <span>{formatTCLevel(amb.linked_tc_level)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default Ambassadors;
