import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { colors, neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { logger } from '../utils/logger';
import { getTransferGroupOptions, parseTransferGroupValue } from '../config/transferGroups';
import { useActiveCampaign, useSettlerLeaderboard } from '../hooks/useCampaignQueries';

type TabType = 'colonies' | 'settlers';

interface KingdomCommunity {
  kingdom_number: number;
  player_count: number;
  atlas_score: number | null;
  current_rank: number | null;
  fund_tier: string;
}

const FUND_TIER_COLORS: Record<string, string> = {
  gold: '#ffc30b',
  silver: '#e0e0e0',
  bronze: '#cd7f32',
  standard: colors.textMuted,
};

const FUND_TIER_LABELS: Record<string, string> = {
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
  standard: '',
};

const ITEMS_PER_PAGE = 25;

const getCardStyle = (tier: string, tierColor: string): React.CSSProperties => {
  switch (tier) {
    case 'gold':
      return {
        background: `linear-gradient(135deg, ${tierColor}0c 0%, ${tierColor}04 100%)`,
        border: `1px solid ${tierColor}45`,
        boxShadow: `0 0 20px ${tierColor}12, inset 0 1px 0 ${tierColor}18`,
      };
    case 'silver':
      return {
        background: `linear-gradient(135deg, #c0c0c012 0%, #e8e8e806 50%, #a8a8a808 100%)`,
        border: `1px solid #c0c0c050`,
        boxShadow: `0 0 18px #c0c0c018, 0 0 6px #e0e0e010, inset 0 1px 0 #ffffff18`,
      };
    case 'bronze':
      return {
        background: `linear-gradient(135deg, ${tierColor}0a 0%, #b4540008 100%)`,
        border: `1px solid ${tierColor}35`,
        boxShadow: `0 0 12px ${tierColor}0a, inset 0 1px 0 ${tierColor}12`,
      };
    default:
      return {
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
      };
  }
};

const KingdomCommunities: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  useDocumentTitle(t('kingdomCommunities.title', 'Kingdom Colonies'));
  useMetaTags(PAGE_META_TAGS.kingdomCommunities);
  useStructuredData({ type: 'BreadcrumbList', data: PAGE_BREADCRUMBS.kingdomCommunities });

  const [activeTab, setActiveTab] = useState<TabType>('colonies');
  const [communities, setCommunities] = useState<KingdomCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [transferGroupFilter, setTransferGroupFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Campaign data for Settlers tab
  const { data: campaign } = useActiveCampaign();
  const { data: leaderboardData, isLoading: settlersLoading } = useSettlerLeaderboard(campaign);
  const settlerKingdoms = leaderboardData?.qualifying ?? [];
  const risingKingdoms = leaderboardData?.rising ?? [];
  const totalSettlerTickets = leaderboardData?.totalTickets ?? 0;

  useEffect(() => {
    const fetchCommunities = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setLoading(false);
        return;
      }

      try {
        // Fetch profiles with linked accounts and TC20+
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('linked_kingdom')
          .not('linked_kingdom', 'is', null)
          .not('linked_username', 'is', null)
          .gte('linked_tc_level', 20);

        if (profilesError) throw profilesError;

        // Count players per kingdom
        const kingdomCounts: Record<number, number> = {};
        (profiles || []).forEach(p => {
          if (p.linked_kingdom) {
            kingdomCounts[p.linked_kingdom] = (kingdomCounts[p.linked_kingdom] || 0) + 1;
          }
        });

        // Filter kingdoms with at least 1 player
        const kingdomNumbers = Object.keys(kingdomCounts).map(Number);
        if (kingdomNumbers.length === 0) {
          setCommunities([]);
          setLoading(false);
          return;
        }

        // Fetch kingdom data (atlas score, rank)
        const { data: kingdoms, error: kingdomsError } = await supabase
          .from('kingdoms')
          .select('kingdom_number, atlas_score, current_rank')
          .in('kingdom_number', kingdomNumbers);

        if (kingdomsError) throw kingdomsError;

        // Fetch fund tiers
        const { data: funds, error: fundsError } = await supabase
          .from('kingdom_funds')
          .select('kingdom_number, tier')
          .in('kingdom_number', kingdomNumbers);

        if (fundsError) throw fundsError;

        const kingdomMap = new Map((kingdoms || []).map(k => [k.kingdom_number, k]));
        const fundMap = new Map((funds || []).map(f => [f.kingdom_number, f.tier]));

        const result: KingdomCommunity[] = kingdomNumbers.map(kn => ({
          kingdom_number: kn,
          player_count: kingdomCounts[kn]!,
          atlas_score: kingdomMap.get(kn)?.atlas_score ? Number(kingdomMap.get(kn)!.atlas_score) : null,
          current_rank: kingdomMap.get(kn)?.current_rank || null,
          fund_tier: fundMap.get(kn) || 'standard',
        })).sort((a, b) => b.player_count - a.player_count);

        setCommunities(result);
      } catch (err) {
        logger.error('[KingdomCommunities] Failed to fetch:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCommunities();
  }, []);

  const filteredCommunities = useMemo(() => {
    let result = communities;
    if (searchQuery) {
      const q = searchQuery.replace(/\D/g, '');
      if (q) result = result.filter(c => c.kingdom_number.toString().includes(q));
    }
    if (transferGroupFilter !== 'all') {
      const range = parseTransferGroupValue(transferGroupFilter);
      if (range) {
        const [min, max] = range;
        result = result.filter(c => c.kingdom_number >= min && c.kingdom_number <= max);
      }
    }
    return result;
  }, [communities, searchQuery, transferGroupFilter]);

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [searchQuery, transferGroupFilter]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount(prev => Math.min(prev + ITEMS_PER_PAGE, filteredCommunities.length));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [filteredCommunities.length]);

  const visibleCommunities = filteredCommunities.slice(0, visibleCount);
  const totalPlayers = useMemo(() => communities.reduce((sum, c) => sum + c.player_count, 0), [communities]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: colors.textMuted }}>{t('common.loading', 'Loading...')}</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg }}>
      {/* Hero Section */}
      <div style={{
        padding: isMobile ? '1.25rem 1rem 1rem' : '1.75rem 2rem 1.25rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{
            fontSize: isMobile ? '1.5rem' : '2rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            fontFamily: FONT_DISPLAY
          }}>
            <span style={{ color: '#fff' }}>{t('kingdomCommunities.heroTitle1', 'KINGDOM')}</span>
            <span style={{ ...neonGlow(colors.primary), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>
              {t('kingdomCommunities.heroTitle2', 'COLONIES')}
            </span>
          </h1>
          <p style={{ color: colors.textMuted, fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.5rem', lineHeight: 1.6 }}>
            {t('kingdomCommunities.heroSubtitle', 'The most active kingdoms on Atlas. Bigger colony = stronger intelligence.')}
          </p>
          <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '0.75rem' }}>
            <span style={{ color: colors.primary, fontWeight: '700' }}>{communities.length}</span> {t('kingdomCommunities.statsKingdoms', 'kingdoms')} · <span style={{ color: colors.primary, fontWeight: '700' }}>{totalPlayers}</span> {t('kingdomCommunities.statsPlayers', 'verified players')}
          </p>

          {!isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '50px', height: '2px', background: `linear-gradient(90deg, transparent, ${colors.primary})` }} />
              <div style={{ width: '6px', height: '6px', backgroundColor: colors.primary, transform: 'rotate(45deg)', boxShadow: `0 0 8px ${colors.primary}` }} />
              <div style={{ width: '50px', height: '2px', background: `linear-gradient(90deg, ${colors.primary}, transparent)` }} />
            </div>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '0.75rem 1rem 0' : '1rem 2rem 0' }}>
        <div style={{
          display: 'flex',
          gap: '0.25rem',
          backgroundColor: colors.surface,
          borderRadius: '10px',
          padding: '4px',
          border: `1px solid ${colors.border}`,
        }}>
          {(['colonies', 'settlers'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: isMobile ? '0.6rem 0.75rem' : '0.6rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: isMobile ? '0.8rem' : '0.85rem',
                fontWeight: activeTab === tab ? '700' : '500',
                color: activeTab === tab ? '#fff' : colors.textMuted,
                backgroundColor: activeTab === tab ? `${colors.primary}20` : 'transparent',
                borderBottom: activeTab === tab ? `2px solid ${colors.primary}` : '2px solid transparent',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                minHeight: '44px',
              }}
            >
              {tab === 'colonies' ? '🏰' : '⚔️'}
              {tab === 'colonies'
                ? t('kingdomCommunities.tabColonies', 'Colonies')
                : t('kingdomCommunities.tabSettlers', 'Settlers')}
              {tab === 'settlers' && settlerKingdoms.length > 0 && (
                <span style={{
                  fontSize: '0.65rem',
                  backgroundColor: `${colors.primary}30`,
                  color: colors.primary,
                  padding: '0.1rem 0.4rem',
                  borderRadius: '6px',
                  fontWeight: '600',
                }}>
                  {settlerKingdoms.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem 2rem' }}>

        {/* ═══ COLONIES TAB ═══ */}
        {activeTab === 'colonies' && (
          <>
        {/* Info Banner - centered */}
        <div style={{
          padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem',
          marginBottom: '1.5rem',
          backgroundColor: `${colors.primary}08`,
          border: `1px solid ${colors.primary}20`,
          borderRadius: '10px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.25rem', marginBottom: '0.3rem' }}>📢</div>
          <p style={{ color: colors.text, fontSize: '0.8rem', fontWeight: '600', margin: 0, marginBottom: '0.25rem' }}>
            {t('kingdomCommunities.ctaTitle', 'Rally your kingdom to climb the ranks')}
          </p>
          <p style={{ color: colors.textMuted, fontSize: '0.75rem', margin: 0, lineHeight: 1.5 }}>
            {t('kingdomCommunities.ctaDescription', 'Every linked player with TC20+ counts toward your kingdom\'s colony rank. Invite your alliance — the bigger your presence, the stronger your kingdom\'s Atlas intelligence.')}
          </p>
        </div>

        {/* Search + Tier Filter */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('kingdomCommunities.searchPlaceholder', 'Search by kingdom number...')}
            style={{
              flex: '1 1 250px',
              maxWidth: '400px',
              padding: '0.75rem 1rem',
              minHeight: isMobile ? '44px' : 'auto',
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              color: '#fff',
              fontSize: isMobile ? '16px' : '0.9rem',
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = colors.primary}
            onBlur={(e) => e.target.style.borderColor = colors.border}
          />
          <select
            value={transferGroupFilter}
            onChange={(e) => setTransferGroupFilter(e.target.value)}
            style={{
              padding: '0.6rem 2rem 0.6rem 0.75rem',
              minHeight: isMobile ? '44px' : 'auto',
              backgroundColor: colors.surface,
              border: `1px solid ${transferGroupFilter !== 'all' ? colors.primary + '60' : colors.border}`,
              borderRadius: '8px',
              color: transferGroupFilter !== 'all' ? colors.primary : colors.text,
              fontSize: isMobile ? '16px' : '0.85rem',
              fontWeight: transferGroupFilter !== 'all' ? '600' : '400',
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.5rem center',
              backgroundSize: '1rem',
            }}
          >
            <option value="all">All Transfer Groups</option>
            {getTransferGroupOptions().map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Kingdom List */}
        {filteredCommunities.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            backgroundColor: colors.surface,
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔍</div>
            <p style={{ color: colors.text, fontSize: '1rem', fontWeight: '600' }}>
              {t('kingdomCommunities.noResults', 'No kingdoms found')}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {visibleCommunities.map((community, index) => {
              const tierColor = FUND_TIER_COLORS[community.fund_tier] || colors.textMuted;
              const tierLabel = FUND_TIER_LABELS[community.fund_tier];
              const isGold = community.fund_tier === 'gold';
              const isBronze = community.fund_tier === 'bronze';
              const isPremium = isGold || community.fund_tier === 'silver' || isBronze;
              const rank = index + 1;
              const isTop3 = rank <= 3;
              const cardStyle = getCardStyle(community.fund_tier, tierColor);
              const playerCountColor = isPremium ? tierColor : colors.text;

              return (
                <Link
                  key={community.kingdom_number}
                  to={`/kingdom/${community.kingdom_number}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: isMobile ? '0.75rem' : '1rem',
                      padding: isMobile ? '0.75rem' : '0.85rem 1.25rem',
                      borderRadius: '10px',
                      transition: 'all 0.2s ease',
                      ...cardStyle,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = isPremium ? `${tierColor}70` : `${colors.primary}40`;
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = isPremium ? `${tierColor}45` : colors.border;
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    {/* Rank */}
                    <div style={{
                      width: '36px',
                      textAlign: 'center',
                      flexShrink: 0,
                    }}>
                      {isTop3 ? (
                        <span style={{ fontSize: '1.25rem' }}>
                          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
                        </span>
                      ) : (
                        <span style={{
                          color: colors.primary,
                          fontSize: '0.85rem',
                          fontWeight: '600',
                        }}>
                          #{rank}
                        </span>
                      )}
                    </div>

                    {/* Kingdom Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.95rem',
                          fontWeight: '700',
                          color: isPremium ? tierColor : colors.text,
                          ...(isGold || community.fund_tier === 'silver' ? neonGlow(tierColor) : {}),
                        }}>
                          Kingdom {community.kingdom_number}
                        </span>
                        {isPremium && tierLabel && (
                          <span style={{
                            fontSize: '0.55rem',
                            padding: '0.15rem 0.45rem',
                            backgroundColor: `${tierColor}18`,
                            border: `1px solid ${tierColor}40`,
                            borderRadius: '4px',
                            color: tierColor,
                            fontWeight: '700',
                            letterSpacing: '0.8px',
                            textTransform: 'uppercase',
                          }}>
                            {tierLabel.toUpperCase()}
                          </span>
                        )}
                      </div>
                      {community.atlas_score !== null && (
                        <div style={{ fontSize: '0.7rem', color: colors.textMuted, marginTop: '0.15rem' }}>
                          Atlas Score: <span style={{ color: colors.primary, fontWeight: '600' }}>{community.atlas_score.toFixed(1)}</span>
                          {community.current_rank && (
                            <span style={{ marginLeft: '0.5rem' }}>
                              Rank: <span style={{ color: colors.primary, fontWeight: '600' }}>#{community.current_rank}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Player Count */}
                    <div style={{
                      textAlign: 'right',
                      flexShrink: 0,
                    }}>
                      <div style={{
                        fontSize: isMobile ? '1rem' : '1.15rem',
                        fontWeight: '700',
                        color: playerCountColor,
                        ...(isPremium ? neonGlow(tierColor) : {}),
                      }}>
                        {community.player_count}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: colors.textMuted }}>
                        {community.player_count === 1 ? 'player' : 'players'}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {/* Infinite scroll sentinel */}
            {visibleCount < filteredCommunities.length && (
              <div ref={sentinelRef} style={{ textAlign: 'center', padding: '1.5rem', color: colors.textMuted, fontSize: '0.8rem' }}>
                Loading more kingdoms...
              </div>
            )}
          </div>
        )}

        {/* Footer (colonies) */}
        <div style={{ textAlign: 'center', marginTop: '2rem', paddingBottom: '2rem' }}>
          <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '1rem', lineHeight: 1.6 }}>
            {t('kingdomCommunities.footer', 'Only players who have linked their Kingshot account with TC20+ are counted. Rankings update in real-time.')}
          </p>
          <Link to="/" style={{ color: colors.primary, textDecoration: 'none', fontSize: '0.85rem' }}>
            {t('common.backToHome', '← Back to Home')}
          </Link>
        </div>
          </>
        )}

        {/* ═══ SETTLERS TAB ═══ */}
        {activeTab === 'settlers' && (
          <>
            {/* Campaign Link Banner */}
            <Link
              to="/campaigns/kingdom-settlers"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem',
                marginBottom: '1.5rem',
                background: 'linear-gradient(135deg, #22d3ee08 0%, #06b6d408 100%)',
                border: `1px solid ${colors.primary}30`,
                borderRadius: '12px',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>⚔️</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: colors.primary, fontSize: '0.85rem', fontWeight: '700' }}>
                  {t('kingdomCommunities.settlersCampaignTitle', 'Kingdom Settlers Campaign #1')}
                </div>
                <div style={{ color: colors.textMuted, fontSize: '0.75rem', marginTop: '0.15rem' }}>
                  {t('kingdomCommunities.settlersCampaignDesc', 'Real prizes for kingdoms with the most settlers. See campaign details →')}
                </div>
              </div>
              <span style={{ color: colors.primary, fontSize: '1.2rem' }}>→</span>
            </Link>

            {/* Settler Stats */}
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              marginBottom: '1.5rem',
              flexWrap: 'wrap',
            }}>
              <div style={{
                flex: '1 1 120px',
                padding: '0.75rem 1rem',
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '10px',
                textAlign: 'center',
              }}>
                <div style={{ color: colors.primary, fontSize: '1.25rem', fontWeight: '700' }}>{settlerKingdoms.length}</div>
                <div style={{ color: colors.textMuted, fontSize: '0.7rem' }}>
                  {t('kingdomCommunities.settlersQualified', 'Qualified Kingdoms')}
                </div>
              </div>
              <div style={{
                flex: '1 1 120px',
                padding: '0.75rem 1rem',
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '10px',
                textAlign: 'center',
              }}>
                <div style={{ color: colors.primary, fontSize: '1.25rem', fontWeight: '700' }}>{totalSettlerTickets}</div>
                <div style={{ color: colors.textMuted, fontSize: '0.7rem' }}>
                  {t('kingdomCommunities.settlersTotalTickets', 'Total Tickets')}
                </div>
              </div>
              <div style={{
                flex: '1 1 120px',
                padding: '0.75rem 1rem',
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '10px',
                textAlign: 'center',
              }}>
                <div style={{ color: '#fbbf24', fontSize: '1.25rem', fontWeight: '700' }}>{risingKingdoms.length}</div>
                <div style={{ color: colors.textMuted, fontSize: '0.7rem' }}>
                  {t('kingdomCommunities.settlersRising', 'Rising (Not Yet Qualified)')}
                </div>
              </div>
            </div>

            {/* Settler Kingdom List */}
            {settlersLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: colors.textMuted }}>
                {t('common.loading', 'Loading...')}
              </div>
            ) : settlerKingdoms.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                backgroundColor: colors.surface,
                borderRadius: '12px',
                border: `1px solid ${colors.border}`,
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚔️</div>
                <p style={{ color: colors.text, fontSize: '1rem', fontWeight: '600' }}>
                  {t('kingdomCommunities.settlersNoKingdoms', 'No kingdoms have qualified yet')}
                </p>
                <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  {t('kingdomCommunities.settlersNoKingdomsDesc', 'Kingdoms need at least 3 settlers (linked players with TC20+) to qualify.')}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {settlerKingdoms.map((kingdom, index) => {
                  const rank = index + 1;
                  const isTop3 = rank <= 3;
                  return (
                    <Link
                      key={kingdom.kingdom_number}
                      to={`/kingdom/${kingdom.kingdom_number}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: isMobile ? '0.75rem' : '1rem',
                          padding: isMobile ? '0.75rem' : '0.85rem 1.25rem',
                          borderRadius: '10px',
                          transition: 'all 0.2s ease',
                          backgroundColor: colors.surface,
                          border: `1px solid ${isTop3 ? colors.primary + '30' : colors.border}`,
                          ...(isTop3 ? { boxShadow: `0 0 12px ${colors.primary}08` } : {}),
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = `${colors.primary}40`;
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = isTop3 ? `${colors.primary}30` : colors.border;
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        {/* Rank */}
                        <div style={{ width: '36px', textAlign: 'center', flexShrink: 0 }}>
                          {isTop3 ? (
                            <span style={{ fontSize: '1.25rem' }}>
                              {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
                            </span>
                          ) : (
                            <span style={{ color: colors.primary, fontSize: '0.85rem', fontWeight: '600' }}>
                              #{rank}
                            </span>
                          )}
                        </div>

                        {/* Kingdom Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: '700', color: colors.text }}>
                            Kingdom {kingdom.kingdom_number}
                          </span>
                          <div style={{ fontSize: '0.7rem', color: colors.textMuted, marginTop: '0.15rem' }}>
                            {kingdom.atlas_users} {t('kingdomCommunities.settlersCount', 'settlers')}
                          </div>
                        </div>

                        {/* Tickets */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{
                            fontSize: isMobile ? '1rem' : '1.15rem',
                            fontWeight: '700',
                            color: colors.primary,
                          }}>
                            {kingdom.tickets}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: colors.textMuted }}>
                            {kingdom.tickets === 1 ? 'ticket' : 'tickets'}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {/* Rising Kingdoms */}
                {risingKingdoms.length > 0 && (
                  <>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      margin: '1rem 0 0.5rem',
                    }}>
                      <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }} />
                      <span style={{ color: '#fbbf24', fontSize: '0.75rem', fontWeight: '600' }}>
                        {t('kingdomCommunities.settlersRisingTitle', 'Rising — Almost There')}
                      </span>
                      <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }} />
                    </div>
                    {risingKingdoms.map(kingdom => (
                      <Link
                        key={kingdom.kingdom_number}
                        to={`/kingdom/${kingdom.kingdom_number}`}
                        style={{ textDecoration: 'none' }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: isMobile ? '0.75rem' : '1rem',
                          padding: isMobile ? '0.6rem 0.75rem' : '0.7rem 1.25rem',
                          borderRadius: '10px',
                          backgroundColor: colors.surface,
                          border: `1px solid ${colors.border}`,
                          opacity: 0.7,
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                        >
                          <div style={{ width: '36px', textAlign: 'center', flexShrink: 0 }}>
                            <span style={{ color: '#fbbf24', fontSize: '0.75rem' }}>↑</span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: colors.textMuted }}>
                              Kingdom {kingdom.kingdom_number}
                            </span>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#fbbf24' }}>
                              {kingdom.atlas_users}
                            </div>
                            <div style={{ fontSize: '0.6rem', color: colors.textMuted }}>
                              {t('kingdomCommunities.settlersCount', 'settlers')}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Footer (settlers) */}
            <div style={{ textAlign: 'center', marginTop: '2rem', paddingBottom: '2rem' }}>
              <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '1rem', lineHeight: 1.6 }}>
                {t('kingdomCommunities.settlersFooter', 'Kingdoms need 3+ settlers (linked players with TC20+) to qualify. Ticket allocation is based on settler count.')}
              </p>
              <Link to="/campaigns/kingdom-settlers" style={{ color: colors.primary, textDecoration: 'none', fontSize: '0.85rem', fontWeight: '600' }}>
                {t('kingdomCommunities.viewCampaign', 'View Campaign Details →')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default KingdomCommunities;
