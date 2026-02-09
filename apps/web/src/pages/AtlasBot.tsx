import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';

const BOT_INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1465531618965061672&permissions=2147485696&scope=bot%20applications.commands';
const DISCORD_INVITE = 'https://discord.gg/cajcacDzGd';

interface CommandCardProps {
  command: string;
  description: string;
  example?: string;
  icon: string;
  accentColor: string;
}

const CommandCard: React.FC<CommandCardProps> = ({ command, description, example, icon, accentColor }) => {
  const isMobile = useIsMobile();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        backgroundColor: '#111111',
        borderRadius: '12px',
        border: `1px solid ${isHovered ? accentColor + '60' : '#2a2a2a'}`,
        padding: isMobile ? '1rem' : '1.25rem',
        transition: 'all 0.2s ease',
        transform: isHovered ? 'translateY(-2px)' : 'none',
        boxShadow: isHovered ? `0 4px 20px ${accentColor}15` : 'none'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <span style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', lineHeight: 1 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <code style={{
            color: accentColor,
            fontSize: isMobile ? '0.9rem' : '0.95rem',
            fontWeight: '600',
            fontFamily: "'Orbitron', monospace"
          }}>
            /{command}
          </code>
          <p style={{
            color: '#9ca3af',
            fontSize: isMobile ? '0.8rem' : '0.85rem',
            marginTop: '0.4rem',
            lineHeight: 1.5
          }}>
            {description}
          </p>
          {example && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.4rem 0.6rem',
              backgroundColor: '#0a0a0a',
              borderRadius: '6px',
              border: '1px solid #1f1f1f',
              fontSize: isMobile ? '0.7rem' : '0.75rem',
              color: '#6b7280',
              fontFamily: "'JetBrains Mono', monospace"
            }}>
              {example}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AtlasBot: React.FC = () => {
  useDocumentTitle('Atlas Discord Bot');
  useMetaTags(PAGE_META_TAGS.atlasBot);
  useStructuredData({ type: 'BreadcrumbList', data: PAGE_BREADCRUMBS.atlasBot });
  const isMobile = useIsMobile();

  const commands: CommandCardProps[] = [
    {
      command: 'kingdom',
      description: 'Pull up any kingdom\'s full dossier — Atlas Score, tier, KvK record, dominations, and invasions. Know exactly what you\'re up against.',
      example: '/kingdom 172',
      icon: '🏰',
      accentColor: '#22d3ee'
    },
    {
      command: 'compare',
      description: 'Head-to-head breakdown. Score, prep, battle, dominations — every stat side-by-side with clear winners marked. Stop guessing, start knowing.',
      example: '/compare 172 231',
      icon: '⚖️',
      accentColor: '#f97316'
    },
    {
      command: 'history',
      description: 'Every KvK a kingdom has ever fought. Matchups, prep and battle outcomes, page by page. Study their patterns before they study yours.',
      example: '/history 172',
      icon: '\ud83d\udcdc',
      accentColor: '#8b5cf6'
    },
    {
      command: 'predict',
      description: 'Data-driven matchup prediction weighted by Atlas Score, win rates, and domination history. See who the numbers favor before the castle burns.',
      example: '/predict 172 231',
      icon: '\ud83d\udd2e',
      accentColor: '#ec4899'
    },
    {
      command: 'rankings',
      description: 'The top 10 kingdoms by Atlas Score, ranked and tiered. One glance tells you who\'s running the game right now.',
      icon: '\ud83c\udfc6',
      accentColor: '#eab308'
    },
    {
      command: 'tier',
      description: 'Filter kingdoms by tier — S through D. Instantly see where any kingdom lands in the pecking order.',
      example: '/tier S',
      icon: '\u2b50',
      accentColor: '#fbbf24'
    },
    {
      command: 'countdownkvk',
      description: 'Live countdown to the next KvK. Days, hours, minutes — always know exactly when it\'s time to fight.',
      icon: '\u23f3',
      accentColor: '#22d3ee'
    },
    {
      command: 'countdowntransfer',
      description: 'Countdown to the next Transfer Event. Plan your move before the window opens — or miss it entirely.',
      icon: '\ud83d\udd04',
      accentColor: '#a855f7'
    }
  ];

  const features = [
    {
      title: 'Zero Setup',
      description: 'Invite it. Use it. That\'s the whole tutorial. No config files, no API keys, no databases.',
      icon: '⚡'
    },
    {
      title: 'Live Atlas Data',
      description: 'Same database powering ks-atlas.com. Updated after every KvK. No stale spreadsheets.',
      icon: '📡'
    },
    {
      title: 'Free Core',
      description: 'Every intel command, every server, no restrictions. Kingdom data should never be locked away.',
      icon: '🎁'
    }
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hero Section */}
      <div style={{
        padding: isMobile ? '2rem 1rem 1.5rem' : '3rem 2rem 2rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '700px', margin: '0 auto' }}>
          {/* Bot Avatar */}
          <img
            src="/AtlasBotAvatar.webp"
            alt="Atlas Discord Bot"
            style={{
              width: isMobile ? '80px' : '100px',
              height: isMobile ? '80px' : '100px',
              borderRadius: '50%',
              margin: '0 auto 1.25rem',
              display: 'block',
              border: '3px solid #22d3ee40',
              boxShadow: '0 0 30px rgba(34, 211, 238, 0.2), 0 0 60px rgba(34, 211, 238, 0.1)'
            }}
          />

          <h1 style={{
            fontSize: isMobile ? '1.75rem' : '2.5rem',
            fontWeight: 'bold',
            marginBottom: '0.75rem',
            fontFamily: FONT_DISPLAY
          }}>
            <span style={{ color: '#fff' }}>ATLAS</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem' }}>BOT</span>
          </h1>
          <p style={{
            color: '#9ca3af',
            fontSize: isMobile ? '0.95rem' : '1.1rem',
            maxWidth: '500px',
            margin: '0 auto 1.5rem',
            lineHeight: 1.6
          }}>
            Kingdom intelligence, delivered straight to your Discord server. No tab-switching. No delays. Just data.
          </p>

          {/* CTA Button */}
          <a
            href={BOT_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: isMobile ? '0.85rem 1.75rem' : '0.9rem 2rem',
              backgroundColor: '#22d3ee',
              border: 'none',
              borderRadius: '10px',
              color: '#0a0a0a',
              fontWeight: '700',
              fontSize: isMobile ? '0.95rem' : '1rem',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 20px rgba(34, 211, 238, 0.35)',
              letterSpacing: '0.01em'
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Add to Your Server
          </a>
          <p style={{
            color: '#6b7280',
            fontSize: '0.75rem',
            marginTop: '0.75rem'
          }}>
            Free for all Discord servers
          </p>

          {!isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #22d3ee)' }} />
              <div style={{ width: '6px', height: '6px', backgroundColor: '#22d3ee', transform: 'rotate(45deg)', boxShadow: '0 0 8px #22d3ee' }} />
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, #22d3ee, transparent)' }} />
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '1rem' : '2rem' }}>

        {/* How It Works */}
        <div style={{ marginBottom: isMobile ? '2rem' : '3rem' }}>
          <h2 style={{
            fontSize: isMobile ? '1.1rem' : '1.35rem',
            fontWeight: 'bold',
            color: '#fff',
            marginBottom: '0.4rem',
            fontFamily: FONT_DISPLAY,
            textAlign: 'center'
          }}>
            <span style={{ color: '#fff' }}>HOW IT</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.4rem' }}>WORKS</span>
          </h2>
          <p style={{
            color: '#6b7280',
            fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center',
            marginBottom: '1.5rem'
          }}>
            Three steps. Thirty seconds. Done.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: '1rem'
          }}>
            {[
              { step: '1', title: 'Invite', desc: 'Click "Add to Your Server" and pick your Discord server.', icon: '➕' },
              { step: '2', title: 'Slash', desc: 'Type / in any channel to see all available commands.', icon: '⌨️' },
              { step: '3', title: 'Dominate', desc: 'Get instant kingdom intel. Scout opponents. Win KvK.', icon: '👑' }
            ].map((item) => (
              <div key={item.step} style={{
                backgroundColor: '#111111',
                borderRadius: '12px',
                border: '1px solid #2a2a2a',
                padding: isMobile ? '1rem' : '1.25rem',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#22d3ee15',
                  border: '1px solid #22d3ee30',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 0.75rem',
                  fontSize: '1.1rem'
                }}>
                  {item.icon}
                </div>
                <h3 style={{
                  fontSize: isMobile ? '0.95rem' : '1rem',
                  fontWeight: '700',
                  color: '#fff',
                  marginBottom: '0.35rem'
                }}>
                  {item.title}
                </h3>
                <p style={{
                  color: '#9ca3af',
                  fontSize: isMobile ? '0.75rem' : '0.8rem',
                  lineHeight: 1.5
                }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Commands */}
        <div style={{ marginBottom: isMobile ? '2rem' : '3rem' }}>
          <h2 style={{
            fontSize: isMobile ? '1.1rem' : '1.35rem',
            fontWeight: 'bold',
            color: '#fff',
            marginBottom: '0.4rem',
            fontFamily: FONT_DISPLAY,
            textAlign: 'center'
          }}>
            <span style={{ color: '#fff' }}>SLASH</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.4rem' }}>COMMANDS</span>
          </h2>
          <p style={{
            color: '#6b7280',
            fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center',
            marginBottom: '1.5rem'
          }}>
            Everything you need, one slash away.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: '1rem'
          }}>
            {commands.map((cmd) => (
              <CommandCard key={cmd.command} {...cmd} />
            ))}
          </div>
        </div>

        {/* Premium Slash Commands */}
        <div style={{ marginBottom: isMobile ? '2rem' : '3rem' }}>
          <h2 style={{
            fontSize: isMobile ? '1.1rem' : '1.35rem',
            fontWeight: 'bold',
            color: '#fff',
            marginBottom: '0.4rem',
            fontFamily: FONT_DISPLAY,
            textAlign: 'center'
          }}>
            <span style={{ color: '#fff' }}>PREMIUM</span>
            <span style={{ ...neonGlow('#FF6B8A'), marginLeft: '0.4rem' }}>COMMANDS</span>
          </h2>
          <p style={{
            color: '#6b7280',
            fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center',
            marginBottom: '1.5rem'
          }}>
            Tactical tools built for players who coordinate to win.
          </p>

          <div
            style={{
              backgroundColor: '#111111',
              borderRadius: '16px',
              border: '1px solid #FF6B8A40',
              padding: isMobile ? '1.25rem' : '1.75rem',
              background: 'linear-gradient(135deg, #111111 0%, #FF6B8A08 100%)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: isMobile ? '1.5rem' : '1.75rem', lineHeight: 1 }}>⚔️</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <code style={{
                    color: '#FF6B8A',
                    fontSize: isMobile ? '1rem' : '1.1rem',
                    fontWeight: '700',
                    fontFamily: "'Orbitron', monospace"
                  }}>
                    /multirally
                  </code>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: '700',
                    color: '#FF6B8A',
                    backgroundColor: '#FF6B8A18',
                    border: '1px solid #FF6B8A30',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase'
                  }}>
                    Supporter
                  </span>
                </div>
              </div>
            </div>

            <p style={{
              color: '#d1d5db',
              fontSize: isMobile ? '0.85rem' : '0.9rem',
              lineHeight: 1.7,
              marginBottom: '1rem'
            }}>
              The difference between a coordinated castle hit and a wasted march is <strong style={{ color: '#fff' }}>timing</strong>. /multirally calculates the exact second each rally caller should start so that every rally lands on the same building within your desired gap — no spreadsheets, no guesswork.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: '0.75rem',
              marginBottom: '1.25rem'
            }}>
              {[
                { title: 'Pick Your Target', desc: "King's Castle or any Turret.", icon: '🏰' },
                { title: 'Enter March Times', desc: 'Each player\'s time to the target in minutes.', icon: '⏱️' },
                { title: 'Get the Call Order', desc: 'Exact delays so all rallies hit within seconds.', icon: '📋' }
              ].map((step) => (
                <div key={step.title} style={{
                  backgroundColor: '#0a0a0a',
                  borderRadius: '8px',
                  border: '1px solid #1f1f1f',
                  padding: '0.75rem',
                  textAlign: 'center'
                }}>
                  <span style={{ fontSize: '1.1rem', display: 'block', marginBottom: '0.35rem' }}>{step.icon}</span>
                  <h4 style={{ color: '#fff', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.2rem' }}>{step.title}</h4>
                  <p style={{ color: '#6b7280', fontSize: '0.72rem', lineHeight: 1.4 }}>{step.desc}</p>
                </div>
              ))}
            </div>

            <div style={{
              padding: '0.6rem 0.8rem',
              backgroundColor: '#0a0a0a',
              borderRadius: '8px',
              border: '1px solid #1f1f1f',
              fontSize: isMobile ? '0.7rem' : '0.75rem',
              color: '#6b7280',
              fontFamily: "'JetBrains Mono', monospace",
              marginBottom: '1.25rem'
            }}>
              /multirally target:Turret 1 players:PlayerB:18,PlayerA:15,PlayerC:22
            </div>

            <p style={{
              color: '#9ca3af',
              fontSize: isMobile ? '0.8rem' : '0.85rem',
              lineHeight: 1.6,
              marginBottom: '1rem'
            }}>
              The bot accounts for the 5-minute rally fill time plus each player's individual march time, then tells you <strong style={{ color: '#fff' }}>who calls first</strong> and the <strong style={{ color: '#fff' }}>exact delay</strong> between each subsequent call. Your rallies connect within a 1-second window. The enemy can't reinforce fast enough.
            </p>

            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'flex-start' : 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              padding: '0.85rem 1rem',
              backgroundColor: '#FF6B8A10',
              borderRadius: '10px',
              border: '1px solid #FF6B8A25'
            }}>
              <div>
                <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.8rem' : '0.85rem', fontWeight: '600', marginBottom: '0.15rem' }}>
                  3 free uses per day
                </p>
                <p style={{ color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.75rem' }}>
                  Atlas Supporters get unlimited access — every rally, every KvK.
                </p>
              </div>
              <Link
                to="/support"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#FF6B8A',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontWeight: '600',
                  fontSize: isMobile ? '0.8rem' : '0.85rem',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                Become a Supporter
              </Link>
            </div>
          </div>
        </div>

        {/* Why Atlas Bot */}
        <div style={{ marginBottom: isMobile ? '2rem' : '3rem' }}>
          <h2 style={{
            fontSize: isMobile ? '1.1rem' : '1.35rem',
            fontWeight: 'bold',
            color: '#fff',
            marginBottom: '1.5rem',
            fontFamily: FONT_DISPLAY,
            textAlign: 'center'
          }}>
            <span style={{ color: '#fff' }}>WHY</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.4rem' }}>ATLAS BOT</span>
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: '1rem'
          }}>
            {features.map((feature) => (
              <div key={feature.title} style={{
                backgroundColor: '#111111',
                borderRadius: '12px',
                border: '1px solid #2a2a2a',
                padding: isMobile ? '1rem' : '1.25rem',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.6rem' }}>{feature.icon}</span>
                <h3 style={{
                  fontSize: isMobile ? '0.95rem' : '1rem',
                  fontWeight: '700',
                  color: '#fff',
                  marginBottom: '0.35rem'
                }}>
                  {feature.title}
                </h3>
                <p style={{
                  color: '#9ca3af',
                  fontSize: isMobile ? '0.75rem' : '0.8rem',
                  lineHeight: 1.5
                }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{
          padding: isMobile ? '1.5rem' : '2rem',
          backgroundColor: '#111111',
          borderRadius: '16px',
          border: '1px solid #22d3ee30',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #111111 0%, #22d3ee08 100%)',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{
            fontSize: isMobile ? '1.1rem' : '1.25rem',
            fontWeight: 'bold',
            color: '#fff',
            marginBottom: '0.5rem',
            fontFamily: FONT_DISPLAY
          }}>
            Your server deserves better intel.
          </h3>
          <p style={{
            color: '#9ca3af',
            fontSize: isMobile ? '0.8rem' : '0.85rem',
            marginBottom: '1.25rem',
            maxWidth: '400px',
            margin: '0 auto 1.25rem',
            lineHeight: 1.6
          }}>
            Kingshot players across dozens of servers use Atlas Bot to scout opponents, compare kingdoms, and plan transfers — without leaving Discord.
          </p>
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <a
              href={BOT_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#22d3ee',
                border: 'none',
                borderRadius: '8px',
                color: '#0a0a0a',
                fontWeight: '600',
                fontSize: isMobile ? '0.9rem' : '0.95rem',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 15px rgba(34, 211, 238, 0.3)'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Add to Your Server
            </a>
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: 'transparent',
                border: '1px solid #5865F240',
                borderRadius: '8px',
                color: '#5865F2',
                fontWeight: '600',
                fontSize: isMobile ? '0.9rem' : '0.95rem',
                textDecoration: 'none',
                transition: 'all 0.2s ease'
              }}
            >
              Join Our Discord
            </a>
          </div>
        </div>

        {/* Back links */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1.5rem',
          paddingBottom: '1rem'
        }}>
          <Link to="/tools" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>
            ← All Tools
          </Link>
          <Link to="/" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.8rem' }}>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AtlasBot;
