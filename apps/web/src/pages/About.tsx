import React from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { neonGlow } from '../utils/styles';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import SupportButton from '../components/SupportButton';

const About: React.FC = () => {
  useDocumentTitle('About');
  const isMobile = useIsMobile();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hero Section - matching directory */}
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
            fontFamily: "'Cinzel', 'Times New Roman', serif"
          }}>
            <span style={{ color: '#fff' }}>ABOUT</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>US</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.75rem' }}>
            Know your enemy. Choose your allies. Dominate Kingshot.
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
        {/* What is Kingshot Atlas */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '1rem',
            fontFamily: "'Cinzel', serif"
          }}>
            Stop Guessing. Start Winning.
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            <span style={{ color: '#22d3ee' }}>Kingshot Atlas</span> is the only analytics platform built specifically for Kingshot players who refuse to leave victory to chance. We track every KvK result, analyze every kingdom's performance, and give you the intelligence you need to make decisions that actually matter.
          </p>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            Scouting your next KvK opponent? We've got their win rate, their streaks, and their weaknesses. Looking for a new home during Transfer? Find kingdoms that match your competitive level. Recruiting for your alliance? Show prospects exactly why your kingdom dominates.
          </p>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7 }}>
            No more guessing. No more blind migrations. No more surprises. Just <span style={{ color: '#22c55e' }}>data-driven dominance</span>.
          </p>
        </section>

        {/* Features */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '1rem',
            fontFamily: "'Cinzel', serif"
          }}>
            Your Competitive Edge
          </h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {[
              { title: 'Kingdom Directory', desc: 'Every kingdom. Every stat. Searchable, filterable, and ranked. Find exactly what you\'re looking for in seconds.', icon: '🗺️' },
              { title: 'Atlas Score', desc: 'Battle-tested rating that rewards experience and consistency. One number tells you who\'s a real threat vs a lucky newcomer.', icon: '⚡' },
              { title: 'Head-to-Head Comparison', desc: 'Pit any two kingdoms against each other. See who has the edge in Prep, Battle, and overall dominance.', icon: '⚔️' },
              { title: 'Complete KvK History', desc: 'Every match. Every result. Every streak. Know exactly what you\'re walking into before the gates open.', icon: '📜' },
              { title: 'Power Tier Rankings', desc: 'S-Tier elites to D-Tier underdogs. Instantly identify where any kingdom stands in the pecking order.', icon: '🏆' },
            ].map((feature, i) => (
              <div key={i} style={{ 
                backgroundColor: '#111111', 
                padding: isMobile ? '1rem' : '1.25rem', 
                borderRadius: '10px',
                border: '1px solid #2a2a2a',
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start'
              }}>
                <span style={{ fontSize: '1.5rem' }}>{feature.icon}</span>
                <div>
                  <h3 style={{ color: '#22d3ee', fontSize: isMobile ? '0.9rem' : '0.95rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    {feature.title}
                  </h3>
                  <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.6 }}>
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How Atlas Score Works */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '1rem',
            fontFamily: "'Cinzel', serif"
          }}>
            The Atlas Score: Your Kingdom's True Power Level
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            Stop guessing. Start winning. The Atlas Score measures what actually matters: <span style={{ color: '#22d3ee' }}>consistent performance</span>. Our formula rewards experience, punishes lucky streaks, and shows who really dominates. Here's the breakdown:
          </p>
          
          <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { icon: '⚔️', title: 'Win Rate (60%)', desc: 'Overall wins with experience scaling. Veterans get full credit—new kingdoms prove themselves first.', color: '#f97316' },
              { icon: '👑', title: 'Domination Pattern (25%)', desc: 'Win both phases consistently? That\'s dominance. Double wins boost your score, double losses hurt it.', color: '#22c55e' },
              { icon: '🔥', title: 'Recent Form (10%)', desc: 'Your last 3 KvKs matter. Hot streaks help, but consistency beats luck every time.', color: '#eab308' },
              { icon: '⚡', title: 'Streak Momentum (15%)', desc: 'Current win streaks and best-ever records. Battle streaks count more—that\'s when KvKs are won.', color: '#a855f7' },
            ].map((item, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: '0.75rem',
                backgroundColor: '#111111',
                padding: '0.875rem',
                borderRadius: '8px',
                border: '1px solid #2a2a2a'
              }}>
                <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                <div>
                  <div style={{ color: item.color, fontWeight: '600', fontSize: isMobile ? '0.85rem' : '0.9rem', marginBottom: '0.25rem' }}>{item.title}</div>
                  <div style={{ color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ 
            backgroundColor: '#0d1117', 
            padding: '1rem', 
            borderRadius: '8px', 
            border: '1px solid #22d3ee30',
            marginBottom: '1rem'
          }}>
            <div style={{ color: '#22d3ee', fontWeight: '600', fontSize: isMobile ? '0.85rem' : '0.9rem', marginBottom: '0.5rem' }}>
              Why It Works
            </div>
            <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem', lineHeight: 1.6, margin: '0 0 0.5rem 0' }}>
              • <strong>Experience matters:</strong> Kingdoms with 6+ KvKs get full scoring power
            </p>
            <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem', lineHeight: 1.6, margin: '0 0 0.5rem 0' }}>
              • <strong>Consistency over luck:</strong> No inflated scores from lucky 2-0 starts
            </p>
            <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem', lineHeight: 1.6, margin: 0 }}>
              • <strong>All performance counts:</strong> Streaks, recent trends, and domination patterns
            </p>
          </div>

          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem', lineHeight: 1.6 }}>
            Real data. Real results. No spin. That's how you know who to fear and who to target.
          </p>
        </section>

        {/* Tier Breakdown */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '1rem',
            fontFamily: "'Cinzel', serif"
          }}>
            The Tier System: Where Does Your Kingdom Rank?
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            Every kingdom earns their tier through battle. No politics, no favoritism—just cold, hard results.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: '0.75rem' }}>
            {[
              { tier: 'S', range: '8.9+', color: '#fbbf24', desc: 'Elite', detail: 'Top 3% - Apex predators' },
              { tier: 'A', range: '7.8-8.9', color: '#22c55e', desc: 'Formidable', detail: 'Top 10% - Serious contenders' },
              { tier: 'B', range: '6.4-7.8', color: '#3b82f6', desc: 'Competitive', detail: 'Top 25% - Solid performers' },
              { tier: 'C', range: '4.7-6.4', color: '#f97316', desc: 'Developing', detail: 'Top 50% - Room to grow' },
              { tier: 'D', range: '0-4.7', color: '#ef4444', desc: 'Struggling', detail: 'Bottom 50% - Rebuilding' },
            ].map((t, i) => (
              <div key={i} style={{ 
                backgroundColor: '#111111', 
                padding: '1rem', 
                borderRadius: '8px',
                border: `1px solid ${t.color}30`,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: t.color, marginBottom: '0.25rem' }}>
                  {t.tier}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>{t.range}</div>
                <div style={{ fontSize: '0.8rem', color: t.color, marginBottom: '0.25rem', fontWeight: '500' }}>{t.desc}</div>
                <div style={{ fontSize: '0.7rem', color: '#6b7280', fontStyle: 'italic' }}>{t.detail}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Origin Story */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '1rem',
            fontFamily: "'Cinzel', serif"
          }}>
            Built by a Player, For Players
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            Kingshot Atlas was born in <span style={{ color: '#22d3ee' }}>Kingdom 172</span>. The founder got tired of making transfer decisions based on rumors and Discord hearsay. Tired of walking into KvK blind. Tired of guessing.
          </p>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            So he built the tool he wished existed: a place where every kingdom's track record is laid bare. Real data. Real results. No spin.
          </p>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7 }}>
            Today, Atlas is powered by the community—players contributing data, reporting results, and helping each other make smarter decisions. This isn't a corporate product. It's a passion project built by someone who plays the game and wants to see the community thrive.
          </p>
        </section>

        {/* Data & Disclaimer */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '1rem',
            fontFamily: "'Cinzel', serif"
          }}>
            The Fine Print
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            Our data comes from community contributions and verified KvK results. We obsess over accuracy, but KvK is complex—edge cases exist. If you spot an error, let us know.
          </p>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7 }}>
            Kingshot Atlas is an independent fan project. We're not affiliated with or endorsed by the developers of Kingshot. We're just players who love the game.
          </p>
        </section>

        {/* Support Us */}
        <section style={{ 
          marginBottom: '2.5rem',
          backgroundColor: '#111111', 
          padding: isMobile ? '1.5rem' : '2rem', 
          borderRadius: '12px',
          border: '1px solid #FF5E5B30',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #111111 0%, #FF5E5B08 100%)'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 1rem',
            backgroundColor: '#FF5E5B20',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#FF5E5B">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </div>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '0.75rem',
            fontFamily: "'Cinzel', serif"
          }}>
            Fuel the Atlas
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.6, marginBottom: '1.25rem', maxWidth: '500px', margin: '0 auto 1.25rem' }}>
            Servers cost money. Development takes time. If Atlas has helped you make better decisions, consider throwing some support our way. Every bit helps keep the lights on and new features coming.
          </p>
          <SupportButton />
          <p style={{ 
            color: '#6b7280', 
            fontSize: '0.75rem', 
            marginTop: '1rem' 
          }}>
            Buy us a coffee, fund a feature, or just say thanks ☕
          </p>
        </section>

        {/* Contact */}
        <section style={{ 
          backgroundColor: '#111111', 
          padding: isMobile ? '1.25rem' : '1.5rem', 
          borderRadius: '12px',
          border: '1px solid #5865F230',
          textAlign: 'center'
        }}>
          <h2 style={{ 
            fontSize: isMobile ? '1rem' : '1.1rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '0.75rem',
            fontFamily: "'Cinzel', serif"
          }}>
            Join the Community
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.6, marginBottom: '1rem' }}>
            Got intel to share? Found a bug? Want to argue about tier rankings? Jump into our Discord. We're always looking for contributors, testers, and fellow data nerds.
          </p>
          <a
            href="https://discord.gg/aA3a7JGcHV"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#5865F2',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontWeight: '600',
              fontSize: isMobile ? '0.9rem' : '0.95rem',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 15px rgba(88, 101, 242, 0.3)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Join Our Discord
          </a>
        </section>

        {/* Back Link */}
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link to="/" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.85rem' }}>← Back to Home</Link>
        </div>
      </div>
    </div>
  );
};

export default About;
