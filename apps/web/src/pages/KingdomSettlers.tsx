import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useActiveCampaign, useSettlerLeaderboard, useCampaignWinners, useKingdomSettlers } from '../hooks/useCampaignQueries';
import type { Campaign, KingdomSettlerStats, SettlerDetail } from '../hooks/useCampaignQueries';
import { formatPrize, getPrizeTierColor } from '../utils/campaignUtils';

// ─── Sub-components ───────────────────────────────────────────

const CampaignCountdown: React.FC<{ targetDate: string }> = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = React.useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  React.useEffect(() => {
    const update = () => {
      const now = Date.now();
      const target = new Date(targetDate).getTime();
      const diff = Math.max(0, target - now);
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const ended = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

  if (ended) {
    return <div style={{ color: '#fbbf24', fontFamily: "'Orbitron', sans-serif", fontSize: '1.25rem', fontWeight: 700 }}>Draw Time!</div>;
  }

  const boxStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.5rem 0.75rem',
    background: 'rgba(255,255,255,0.05)', borderRadius: 8, minWidth: 56,
  };
  const numStyle: React.CSSProperties = { fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem', fontWeight: 700, color: '#fff' };
  const labelStyle: React.CSSProperties = { fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 };

  return (
    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
      {[
        { val: timeLeft.days, label: 'Days' },
        { val: timeLeft.hours, label: 'Hrs' },
        { val: timeLeft.minutes, label: 'Min' },
        { val: timeLeft.seconds, label: 'Sec' },
      ].map(({ val, label }) => (
        <div key={label} style={boxStyle}>
          <span style={numStyle}>{String(val).padStart(2, '0')}</span>
          <span style={labelStyle}>{label}</span>
        </div>
      ))}
    </div>
  );
};

const QualificationChecker: React.FC<{ campaign: Campaign }> = ({ campaign }) => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();

  if (!user) {
    return (
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
          {t('campaign.qualificationTitle', 'Your Qualification Status')}
        </h3>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
          {t('campaign.signInToCheck', 'Sign in to check your qualification status.')}
        </p>
      </div>
    );
  }

  const checks = [
    { label: t('campaign.checkAtlas', 'Atlas account created'), done: true },
    { label: t('campaign.checkKingshot', { level: campaign.min_tc_level, defaultValue: 'Kingshot linked (TC {{level}}+)' }), done: !!profile?.linked_player_id && (profile?.linked_tc_level ?? 0) >= campaign.min_tc_level },
    { label: t('campaign.checkDiscord', 'Discord linked on Atlas'), done: !!profile?.discord_id },
    { label: t('campaign.checkServer', 'Joined Atlas Discord (Settler role)'), done: !!profile?.discord_id },
  ];

  const allDone = checks.every(c => c.done);

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '1.25rem', border: `1px solid ${allDone ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
      <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
        {t('campaign.qualificationTitle', 'Your Qualification Status')}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {checks.map((check, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>{check.done ? '✅' : '❌'}</span>
            <span style={{ color: check.done ? '#22c55e' : '#ef4444', fontSize: '0.875rem' }}>{check.label}</span>
          </div>
        ))}
      </div>
      {allDone ? (
        <p style={{ color: '#22c55e', fontSize: '0.875rem', marginTop: '0.75rem', fontWeight: 600 }}>
          {t('campaign.qualified', 'You\'re qualified! Your ticket counts for your kingdom.')}
        </p>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          {!profile?.linked_player_id && (
            <Link to="/profile" style={{ padding: '0.5rem 1rem', background: '#22d3ee', color: '#000', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
              {t('campaign.ctaLinkKingshot', 'Link Kingshot')}
            </Link>
          )}
          {!profile?.discord_id && (
            <Link to="/profile" style={{ padding: '0.5rem 1rem', background: '#7c3aed', color: '#fff', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
              {t('campaign.ctaLinkDiscord', 'Link Discord')}
            </Link>
          )}
          <a href="https://discord.gg/atlas-kingshot" target="_blank" rel="noopener noreferrer" style={{ padding: '0.5rem 1rem', background: '#5865F2', color: '#fff', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
            {t('campaign.ctaJoinDiscord', 'Join Discord Server')}
          </a>
        </div>
      )}
    </div>
  );
};

const PrizePoolVisual: React.FC<{ rewards: Campaign['rewards'] }> = ({ rewards }) => {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
      {rewards.map((r) => (
        <div
          key={r.draw_order}
          style={{
            padding: '0.4rem 0.75rem',
            borderRadius: 8,
            background: `${getPrizeTierColor(r.amount)}22`,
            border: `1px solid ${getPrizeTierColor(r.amount)}44`,
            color: getPrizeTierColor(r.amount),
            fontFamily: "'Orbitron', sans-serif",
            fontSize: '0.8rem',
            fontWeight: 700,
          }}
        >
          {formatPrize(r.amount)}
        </div>
      ))}
    </div>
  );
};

// ─── Settler Leaderboard ──────────────────────────────────────

const KingdomRow: React.FC<{
  rank: number;
  stats: KingdomSettlerStats;
  maxTickets: number;
  minTcLevel: number;
}> = ({ rank, stats, maxTickets, minTcLevel }) => {
  const [expanded, setExpanded] = useState(false);
  const { data: settlers, isLoading } = useKingdomSettlers(
    expanded ? stats.kingdom_number : 0,
    minTcLevel
  );

  const barWidth = maxTickets > 0 ? (stats.tickets / maxTickets) * 100 : 0;

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'grid', gridTemplateColumns: '40px 80px 1fr 80px 70px 24px',
          alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
          background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ color: '#6b7280', fontWeight: 600, fontSize: '0.875rem' }}>#{rank}</span>
        <Link
          to={`/kingdom/${stats.kingdom_number}`}
          onClick={(e) => e.stopPropagation()}
          style={{ color: '#22d3ee', fontWeight: 700, textDecoration: 'none', fontSize: '0.95rem' }}
        >
          K{stats.kingdom_number}
        </Link>
        <div style={{ position: 'relative', height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%', width: `${barWidth}%`,
            background: 'linear-gradient(90deg, #22d3ee, #06b6d4)', borderRadius: 4, transition: 'width 0.5s ease',
          }} />
        </div>
        <span style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: '0.95rem', textAlign: 'right' }}>
          {stats.tickets}
        </span>
        <span style={{ color: '#9ca3af', fontSize: '0.8rem', textAlign: 'right' }}>
          {stats.percentage.toFixed(1)}%
        </span>
        <span style={{ color: '#6b7280', fontSize: '0.75rem', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>
          ▼
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {isLoading ? (
            <p style={{ color: '#6b7280', fontSize: '0.8rem', padding: '0.5rem 0' }}>Loading settlers...</p>
          ) : settlers && settlers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem', maxHeight: 300, overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.25rem' }}>
                <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 600 }}>
                  🟢 Discord-Linked: {settlers.filter(s => s.status === 'qualifying').length}
                </span>
                <span style={{ color: '#eab308', fontSize: '0.75rem', fontWeight: 600 }}>
                  🟡 Needs Discord: {settlers.filter(s => s.status === 'needs_discord').length}
                </span>
                <span style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 600 }}>
                  ⚪ TC too low: {settlers.filter(s => s.status === 'tc_too_low').length}
                </span>
              </div>
              {settlers.map((s, i) => (
                <SettlerRow key={i} settler={s} />
              ))}
            </div>
          ) : (
            <p style={{ color: '#6b7280', fontSize: '0.8rem', padding: '0.5rem 0' }}>No settlers found</p>
          )}
        </div>
      )}
    </div>
  );
};

const SettlerRow: React.FC<{ settler: SettlerDetail }> = ({ settler }) => {
  const statusColor = settler.status === 'qualifying' ? '#22c55e' : settler.status === 'needs_discord' ? '#eab308' : '#6b7280';
  const statusIcon = settler.status === 'qualifying' ? '🟢' : settler.status === 'needs_discord' ? '🟡' : '⚪';
  const statusLabel = settler.status === 'qualifying' ? '' : settler.status === 'needs_discord' ? 'Link Discord!' : `TC ${settler.linked_tc_level}`;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.5rem',
      borderRadius: 6, background: 'rgba(255,255,255,0.02)',
    }}>
      <span style={{ fontSize: '0.7rem' }}>{statusIcon}</span>
      <span style={{ color: '#fff', fontSize: '0.8rem', flex: 1 }}>{settler.linked_username}</span>
      <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>TC {settler.linked_tc_level}</span>
      {statusLabel && <span style={{ color: statusColor, fontSize: '0.7rem', fontWeight: 600 }}>{statusLabel}</span>}
    </div>
  );
};

// ─── About Tab ────────────────────────────────────────────────

const AboutTab: React.FC<{ campaign: Campaign }> = ({ campaign }) => {
  const { t } = useTranslation();
  const totalPrizePool = campaign.rewards.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '2rem 0' }}>
        <h1 style={{
          fontFamily: "'Cinzel', 'Trajan Pro', serif",
          fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 700, color: '#fff', marginBottom: '0.5rem',
          textShadow: '0 0 30px rgba(34,211,238,0.3)',
        }}>
          KINGDOM <span style={{ color: '#22d3ee' }}>SETTLERS</span>
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '1rem', maxWidth: 600, margin: '0 auto 1.5rem' }}>
          {t('campaign.heroSubtitle', 'The more Settlers your kingdom has, the more raffle tickets you earn. Link your Discord and rally your kingdom!')}
        </p>
        <div style={{ display: 'inline-block', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 12, padding: '0.75rem 1.5rem' }}>
          <span style={{ color: '#fbbf24', fontFamily: "'Orbitron', sans-serif", fontSize: '1.25rem', fontWeight: 700 }}>
            ${totalPrizePool}
          </span>
          <span style={{ color: '#fbbf24', fontSize: '0.9rem', marginLeft: '0.5rem' }}>
            {t('campaign.prizePool', 'Prize Pool')}
          </span>
        </div>
      </div>

      {/* Countdown */}
      {campaign.draw_date && campaign.status !== 'completed' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: 1 }}>
            {t('campaign.drawIn', 'Live Draw In')}
          </p>
          <CampaignCountdown targetDate={campaign.draw_date} />
        </div>
      )}

      {/* Prize Pool Visual */}
      <div>
        <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', textAlign: 'center' }}>
          {t('campaign.prizes', '15 Prizes — Drawn Smallest to Largest')}
        </h3>
        <PrizePoolVisual rewards={campaign.rewards} />
      </div>

      {/* Qualification Checker */}
      <QualificationChecker campaign={campaign} />

      {/* Rules */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
          {t('campaign.howItWorks', 'How It Works')}
        </h3>
        <ol style={{ color: '#d1d5db', fontSize: '0.875rem', lineHeight: 1.8, paddingLeft: '1.25rem', margin: 0 }}>
          <li>{t('campaign.rule1', 'Link your Kingshot account on Atlas (TC 20+)')}</li>
          <li>{t('campaign.rule2', 'Link your Discord account on Atlas')}</li>
          <li>{t('campaign.rule3', 'Join the Kingshot Atlas Discord server to get the Settler role')}</li>
          <li>{t('campaign.rule4', 'Each qualifying Settler = 1 raffle ticket for their kingdom')}</li>
          <li>{t('campaign.rule5', 'Your kingdom needs at least 10 qualifying Settlers to enter')}</li>
          <li>{t('campaign.rule6', 'Prizes drawn live on Discord — smallest to biggest!')}</li>
          <li>{t('campaign.rule7', 'One prize per kingdom. If drawn again for higher prize → upgrade!')}</li>
        </ol>
      </div>

      {/* Campaign Number Badge */}
      <div style={{ textAlign: 'center' }}>
        <span style={{
          display: 'inline-block', padding: '0.4rem 1rem', borderRadius: 20,
          background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)',
          color: '#22d3ee', fontSize: '0.75rem', fontWeight: 600,
        }}>
          Campaign #{campaign.campaign_number}
        </span>
      </div>
    </div>
  );
};

// ─── Leaderboard Tab ──────────────────────────────────────────

const LeaderboardTab: React.FC<{ campaign: Campaign }> = ({ campaign }) => {
  const { t } = useTranslation();
  const { data: leaderboardData, isLoading } = useSettlerLeaderboard(campaign);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ height: 56, background: 'rgba(255,255,255,0.03)', borderRadius: 10, animation: 'pulse 1.5s infinite' }} />
        ))}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
      </div>
    );
  }

  const { qualifying = [], rising = [], totalTickets = 0 } = leaderboardData || {};
  const maxTickets = qualifying.length > 0 ? qualifying[0]!.tickets : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Stats Bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem',
      }}>
        {[
          { label: t('campaign.qualifyingKingdoms', 'Qualifying'), value: qualifying.length, color: '#22c55e' },
          { label: t('campaign.totalTickets', 'Total Tickets'), value: totalTickets, color: '#22d3ee' },
          { label: t('campaign.risingKingdoms', 'Rising'), value: rising.length, color: '#eab308' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '0.75rem',
            textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1.25rem', fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Qualifying Kingdoms */}
      {qualifying.length > 0 && (
        <div>
          <h3 style={{ color: '#22c55e', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🎫</span> {t('campaign.qualifyingSection', 'In the Raffle')} ({qualifying.length})
          </h3>
          {/* Column headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '40px 80px 1fr 80px 70px 24px',
            gap: '0.75rem', padding: '0 1rem 0.5rem', color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1,
          }}>
            <span>#</span>
            <span>{t('campaign.colKingdom', 'Kingdom')}</span>
            <span>{t('campaign.colProgress', 'Progress')}</span>
            <span style={{ textAlign: 'right' }}>{t('campaign.colTickets', 'Tickets')}</span>
            <span style={{ textAlign: 'right' }}>{t('campaign.colChance', 'Chance')}</span>
            <span />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {qualifying.map((k, i) => (
              <KingdomRow key={k.kingdom_number} rank={i + 1} stats={k} maxTickets={maxTickets} minTcLevel={campaign.min_tc_level} />
            ))}
          </div>
        </div>
      )}

      {/* Rising Kingdoms */}
      {rising.length > 0 && (
        <div>
          <h3 style={{ color: '#eab308', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🌱</span> {t('campaign.risingSection', 'Rising — Need More Settlers')} ({rising.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {rising.slice(0, 20).map((k, i) => (
              <div key={k.kingdom_number} style={{
                display: 'grid', gridTemplateColumns: '40px 80px 1fr 80px',
                alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem',
                background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>#{i + 1}</span>
                <Link to={`/kingdom/${k.kingdom_number}`} style={{ color: '#eab308', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>
                  K{k.kingdom_number}
                </Link>
                <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                  {k.tickets}/{campaign.min_settlers} settlers
                </div>
                <span style={{ color: '#6b7280', fontSize: '0.8rem', textAlign: 'right' }}>
                  {k.atlas_users} Atlas users
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Winners Tab ──────────────────────────────────────────────

const WinnersTab: React.FC<{ campaign: Campaign }> = ({ campaign }) => {
  const { t } = useTranslation();
  const { data: winners = [], isLoading } = useCampaignWinners(campaign.id);

  if (isLoading) {
    return <div style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>Loading winners...</div>;
  }

  if (winners.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎰</div>
        <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
          {t('campaign.noWinnersYet', 'No winners yet')}
        </h3>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          {t('campaign.winnersAfterDraw', 'Winners will appear here after the live draw.')}
        </p>
      </div>
    );
  }

  // Sort by prize amount descending for display
  const sortedWinners = [...winners].sort((a, b) => b.prize_amount - a.prize_amount || b.draw_order - a.draw_order);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: '1.5rem', color: '#fbbf24', marginBottom: '0.25rem' }}>
          {t('campaign.winnersTitle', 'Campaign Winners')}
        </h2>
        <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Campaign #{campaign.campaign_number}</span>
      </div>
      {sortedWinners.map((w) => (
        <div
          key={w.draw_order}
          style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            padding: '1rem 1.25rem', borderRadius: 12,
            background: `${getPrizeTierColor(w.prize_amount)}08`,
            border: `1px solid ${getPrizeTierColor(w.prize_amount)}33`,
          }}
        >
          <div style={{
            fontFamily: "'Orbitron', sans-serif", fontSize: '1.25rem', fontWeight: 700,
            color: getPrizeTierColor(w.prize_amount), minWidth: 60,
          }}>
            {formatPrize(w.prize_amount)}
          </div>
          <div style={{ flex: 1 }}>
            <Link to={`/kingdom/${w.kingdom_number}`} style={{
              color: '#fff', fontWeight: 700, fontSize: '1.1rem', textDecoration: 'none',
            }}>
              Kingdom {w.kingdom_number}
            </Link>
            <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
              {w.tickets_at_draw} tickets • {((w.tickets_at_draw / w.total_tickets_at_draw) * 100).toFixed(1)}% chance
              {w.is_upgrade && ' • ⬆ Upgraded'}
            </div>
          </div>
          {w.prize_amount >= 100 && <span style={{ fontSize: '1.5rem' }}>🥇</span>}
          {w.prize_amount >= 50 && w.prize_amount < 100 && <span style={{ fontSize: '1.25rem' }}>🥈</span>}
          {w.prize_amount >= 25 && w.prize_amount < 50 && <span style={{ fontSize: '1.1rem' }}>🥉</span>}
        </div>
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────

type CampaignTab = 'about' | 'leaderboard' | 'winners';

const KingdomSettlers: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<CampaignTab>('about');
  const { data: campaign, isLoading } = useActiveCampaign();

  const tabs: { id: CampaignTab; label: string }[] = useMemo(() => [
    { id: 'about', label: t('campaign.tabAbout', 'About') },
    { id: 'leaderboard', label: t('campaign.tabLeaderboard', 'Settlers') },
    { id: 'winners', label: t('campaign.tabWinners', 'Winners') },
  ], [t]);

  if (isLoading) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 0' }}>
        <div style={{ height: 200, background: 'rgba(255,255,255,0.03)', borderRadius: 12, animation: 'pulse 1.5s infinite' }} />
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '3rem 0', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏰</div>
        <h2 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
          {t('campaign.noCampaign', 'No Active Campaign')}
        </h2>
        <p style={{ color: '#6b7280' }}>{t('campaign.noCampaignDesc', 'Check back soon for the next Kingdom Settlers campaign!')}</p>
        <Link to="/" style={{ display: 'inline-block', marginTop: '1rem', padding: '0.75rem 1.5rem', background: '#22d3ee', color: '#000', borderRadius: 8, fontWeight: 600, textDecoration: 'none' }}>
          {t('common.backToHome', 'Back to Home')}
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Tab Navigation */}
      <div style={{
        display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)',
        borderRadius: 12, padding: '0.25rem', marginBottom: '1.5rem',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '0.65rem', border: 'none', borderRadius: 10, cursor: 'pointer',
              fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s',
              background: activeTab === tab.id ? 'rgba(34,211,238,0.15)' : 'transparent',
              color: activeTab === tab.id ? '#22d3ee' : '#6b7280',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'about' && <AboutTab campaign={campaign} />}
      {activeTab === 'leaderboard' && <LeaderboardTab campaign={campaign} />}
      {activeTab === 'winners' && <WinnersTab campaign={campaign} />}
    </div>
  );
};

export default KingdomSettlers;
