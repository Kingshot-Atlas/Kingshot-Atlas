import React from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

interface ChangelogEntry {
  date: string;
  version?: string;
  new?: string[];
  fixed?: string[];
  improved?: string[];
}

const changelogData: ChangelogEntry[] = [
  {
    date: 'February 3, 2026',
    version: '1.5.0',
    new: [
      '💛 Atlas Supporter — Atlas Pro rebranded. Same features, clearer name. Support at ks-atlas.com/support',
      '🔔 In-app notifications — Real-time alerts when your submissions are approved or need attention',
      '🤖 Atlas Discord bot — Use /kingdom and /compare commands right in your server',
      '💬 Feedback widget — Report bugs or request features from any page',
    ],
    fixed: [
      'Discord bot stability — Fixed 4+ days of intermittent 502/503 errors',
      'Profile bio saves correctly — No more changes lost after refresh',
      'Mobile Discord login — Clear guidance that OAuth opens in browser',
      'Missing KvK chip — Now shows on both desktop and mobile',
    ],
    improved: [
      '👤 My Profile redesign — Centered avatar, tier-colored borders, bio section, display name privacy',
      '👁️ Public profiles — Cleaner display with Kingshot avatar/username',
      '🏰 Kingdom profiles — Bye outcome support, score freshness indicator',
      '📊 Contribute data — Submissions now sync across all your devices',
      '⚡ Faster page loads — Removed ~2MB of legacy data, added skeleton loaders',
    ],
  },
  {
    date: 'January 30, 2026',
    version: '1.4.0',
    new: [
      '🆓 KvK History is now FREE — Full battle history for all users. No paywall.',
      '💳 Stripe payments live — Upgrade to Pro or Recruiter with real checkout.',
      '⚖️ Compare limits updated — Anonymous: login required | Free: 2 | Pro/Recruiter: 5',
    ],
    fixed: [
      'Atlas Score accuracy — Fixed formula bug deflating scores by ~10%',
      'Player verification — "Failed to verify" error resolved',
      'Kingdom profiles — No more "Kingdom not found" for valid kingdoms',
      'Profile page — Fixed race condition showing wrong error',
    ],
    improved: [
      'Upgrade page redesign with accurate feature comparison',
      'Tier thresholds unified across website and Discord bot',
    ],
  },
  {
    date: 'January 29, 2026 (Night)',
    version: '1.3.0',
    new: [
      '📅 Daily updates now post to Discord at 02:00 UTC — never miss a change',
      '🔮 "Coming Soon" page — see what\'s cooking before anyone else',
      '🧪 Frontend testing infrastructure — more stable releases ahead',
      '📊 Data quality monitoring — your data, bulletproof',
    ],
    improved: [
      'Streamlined agent system with 3 new specialists',
      'Activity tracking for transparent development',
    ],
  },
  {
    date: 'January 29, 2026 (Evening)',
    version: '1.2.0',
    new: [
      '⚖️ Multi-Compare now supports 5 kingdoms — Pro users, go wild',
      '🎭 Discord roles dropping soon for Pro & Recruiter subscribers',
      '🏰 Claim Kingdom preview — verify you\'re the real deal',
    ],
    improved: [
      'Radar charts got a glow-up — cleaner, centered, sexier',
      'Stat labels are bolder — no more squinting',
      'Quick Compare icon swapped to ⚖️ — because balance matters',
      'Cinzel font finally loading right — titles look royal now',
    ],
    fixed: [
      'Pro badge only shows when you\'re actually logged in (oops)',
      'Removed vaporware from upgrade page — honesty policy',
    ],
  },
  {
    date: 'January 29, 2026',
    version: '1.1.0',
    new: [
      '🤖 Atlas Discord bot is LIVE — 9 slash commands at your fingertips',
      '📢 Auto patch notes in Discord — updates delivered fresh',
      '🔍 /kingdom command — lookup any kingdom without leaving Discord',
      '⚔️ /compare command — head-to-head matchups on demand',
      '⏰ /countdown command — know exactly when KvK drops',
    ],
    improved: [
      'Discord webhooks for instant notifications',
      'Mobile comparison views actually work now',
    ],
  },
  {
    date: 'January 28, 2026',
    version: '1.0.0',
    new: [
      '🎉 Atlas goes live — stop guessing, start winning',
      '🏆 1,190 kingdoms tracked and scored',
      '📊 Atlas Score system — S/A/B/C/D tiers at a glance',
    ],
    improved: [
      'Complete backend overhaul for speed',
      'Agent team restructured for faster updates',
    ],
  },
];

const Changelog: React.FC = () => {
  useDocumentTitle('Changelog');
  const isMobile = useIsMobile();

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'new': return '✨';
      case 'fixed': return '🐛';
      case 'improved': return '🔧';
      default: return '📝';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'new': return '#22d3ee';
      case 'fixed': return '#ef4444';
      case 'improved': return '#22c55e';
      default: return '#9ca3af';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'new': return 'New';
      case 'fixed': return 'Fixed';
      case 'improved': return 'Improved';
      default: return 'Changes';
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
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
            <span style={{ color: '#fff' }}>CHANGE</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>LOG</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.75rem' }}>
            Track every update. Know what&apos;s new. Stay ahead.
          </p>
          {!isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #22d3ee)' }} />
              <div style={{ width: '6px', height: '6px', backgroundColor: '#22d3ee', transform: 'rotate(45deg)', boxShadow: '0 0 8px #22d3ee' }} />
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, #22d3ee, transparent)' }} />
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '1.5rem 1rem' : '2rem' }}>
        {/* Legend */}
        <div style={{ 
          display: 'flex', 
          gap: '1.5rem', 
          marginBottom: '2rem',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          {['new', 'fixed', 'improved'].map((cat) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>{getCategoryIcon(cat)}</span>
              <span style={{ color: getCategoryColor(cat), fontSize: '0.85rem', fontWeight: '500' }}>
                {getCategoryLabel(cat)}
              </span>
            </div>
          ))}
        </div>

        {/* Changelog Entries */}
        <div style={{ position: 'relative' }}>
          {/* Timeline line */}
          <div style={{
            position: 'absolute',
            left: isMobile ? '8px' : '12px',
            top: '24px',
            bottom: '24px',
            width: '2px',
            backgroundColor: '#2a2a2a',
          }} />

          {changelogData.map((entry, index) => (
            <div 
              key={index} 
              style={{ 
                position: 'relative',
                marginBottom: '2rem',
                paddingLeft: isMobile ? '2rem' : '2.5rem',
              }}
            >
              {/* Timeline dot */}
              <div style={{
                position: 'absolute',
                left: isMobile ? '2px' : '6px',
                top: '6px',
                width: '14px',
                height: '14px',
                backgroundColor: '#22d3ee',
                borderRadius: '50%',
                boxShadow: '0 0 10px #22d3ee50',
                border: '2px solid #0a0a0a',
              }} />

              {/* Entry card */}
              <div style={{
                backgroundColor: '#111111',
                borderRadius: '12px',
                border: '1px solid #2a2a2a',
                overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{
                  padding: isMobile ? '1rem' : '1.25rem',
                  borderBottom: '1px solid #2a2a2a',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}>
                  <div>
                    <h2 style={{ 
                      color: '#fff', 
                      fontSize: isMobile ? '1rem' : '1.1rem', 
                      fontWeight: '600',
                      marginBottom: '0.25rem',
                    }}>
                      {entry.date}
                    </h2>
                    {entry.version && (
                      <span style={{
                        color: '#22d3ee',
                        fontSize: '0.75rem',
                        backgroundColor: '#22d3ee15',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                      }}>
                        v{entry.version}
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: isMobile ? '1rem' : '1.25rem' }}>
                  {entry.new && entry.new.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h3 style={{ 
                        color: getCategoryColor('new'), 
                        fontSize: '0.9rem', 
                        fontWeight: '600',
                        marginBottom: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}>
                        {getCategoryIcon('new')} {getCategoryLabel('new')}
                      </h3>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                        {entry.new.map((item, i) => (
                          <li key={i} style={{ 
                            color: '#9ca3af', 
                            fontSize: isMobile ? '0.85rem' : '0.9rem',
                            lineHeight: 1.6,
                            marginBottom: '0.25rem',
                          }}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {entry.fixed && entry.fixed.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h3 style={{ 
                        color: getCategoryColor('fixed'), 
                        fontSize: '0.9rem', 
                        fontWeight: '600',
                        marginBottom: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}>
                        {getCategoryIcon('fixed')} {getCategoryLabel('fixed')}
                      </h3>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                        {entry.fixed.map((item, i) => (
                          <li key={i} style={{ 
                            color: '#9ca3af', 
                            fontSize: isMobile ? '0.85rem' : '0.9rem',
                            lineHeight: 1.6,
                            marginBottom: '0.25rem',
                          }}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {entry.improved && entry.improved.length > 0 && (
                    <div>
                      <h3 style={{ 
                        color: getCategoryColor('improved'), 
                        fontSize: '0.9rem', 
                        fontWeight: '600',
                        marginBottom: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}>
                        {getCategoryIcon('improved')} {getCategoryLabel('improved')}
                      </h3>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                        {entry.improved.map((item, i) => (
                          <li key={i} style={{ 
                            color: '#9ca3af', 
                            fontSize: isMobile ? '0.85rem' : '0.9rem',
                            lineHeight: 1.6,
                            marginBottom: '0.25rem',
                          }}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Discord CTA */}
        <div style={{ 
          backgroundColor: '#111111', 
          padding: isMobile ? '1.25rem' : '1.5rem', 
          borderRadius: '12px',
          border: '1px solid #5865F230',
          textAlign: 'center',
          marginTop: '2rem',
        }}>
          <h3 style={{ 
            color: '#fff', 
            fontSize: isMobile ? '0.95rem' : '1rem', 
            fontWeight: '600',
            marginBottom: '0.5rem',
          }}>
            Get Updates First
          </h3>
          <p style={{ 
            color: '#9ca3af', 
            fontSize: isMobile ? '0.8rem' : '0.85rem', 
            marginBottom: '1rem',
          }}>
            Join our Discord to get patch notes delivered automatically.
          </p>
          <a
            href="https://discord.gg/cajcacDzGd"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.25rem',
              backgroundColor: '#5865F2',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontWeight: '600',
              fontSize: isMobile ? '0.85rem' : '0.9rem',
              textDecoration: 'none',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Join Discord
          </a>
        </div>

        {/* Back Link */}
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link to="/" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.85rem' }}>
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Changelog;
