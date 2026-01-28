import React from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { neonGlow } from '../utils/styles';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

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
            The story behind Kingshot Atlas
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
            What is Kingshot Atlas?
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            Kingshot Atlas is a comprehensive analytics platform designed for Kingshot players who want to make informed decisions about Kingdom vs Kingdom (KvK) matchups. We aggregate and analyze historical KvK data to provide insights into kingdom performance, helping players understand the competitive landscape.
          </p>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7 }}>
            Whether you're looking to migrate to a new kingdom, scout your next opponent, or simply track your kingdom's progress, Kingshot Atlas provides the data you need in an intuitive, easy-to-understand format.
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
            Key Features
          </h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {[
              { title: 'Kingdom Directory', desc: 'Browse and search through hundreds of kingdoms with detailed performance metrics and tier rankings.' },
              { title: 'Atlas Score', desc: 'Our proprietary scoring system that evaluates kingdom strength based on historical KvK performance, win rates, and streaks.' },
              { title: 'Head-to-Head Comparison', desc: 'Compare any two kingdoms side-by-side to see how they stack up across all key metrics.' },
              { title: 'KvK History', desc: 'View complete KvK match history for any kingdom, including prep phase and battle phase results.' },
              { title: 'Tier Rankings', desc: 'Kingdoms are ranked into tiers (S, A, B, C) based on their Atlas Score for quick reference.' },
            ].map((feature, i) => (
              <div key={i} style={{ 
                backgroundColor: '#111111', 
                padding: isMobile ? '1rem' : '1.25rem', 
                borderRadius: '10px',
                border: '1px solid #2a2a2a'
              }}>
                <h3 style={{ color: '#22d3ee', fontSize: isMobile ? '0.9rem' : '0.95rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  {feature.title}
                </h3>
                <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.6 }}>
                  {feature.desc}
                </p>
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
            How the Atlas Score Works
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            The Atlas Score is a skill-based rating that reflects true kingdom performance, not just volume. It combines four key factors with specific weights:
          </p>
          
          <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { icon: '⚔️', title: 'Win Rate (70%)', desc: 'Combined Prep and Battle win rates, with Battle weighted higher (70/30 split)', color: '#f97316' },
              { icon: '👑', title: 'Domination Bonus (+30%)', desc: 'Kingdoms that win both phases (Dominations) get a significant score boost', color: '#22c55e' },
              { icon: '🏳️', title: 'Invasion Penalty (-20%)', desc: 'Kingdoms that lose both phases (Invasions) receive a score reduction', color: '#ef4444' },
              { icon: '📈', title: 'Recent Performance (30% weight)', desc: 'Your last 3 KvKs are weighted most heavily—recent performance matters most', color: '#eab308' },
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
              Scoring Formula
            </div>
            <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem', lineHeight: 1.6, margin: '0 0 0.5rem 0', fontFamily: 'monospace' }}>
              Base Score = (Win Rate × 0.7) + (Domination Rate × 0.3) - (Defeat Rate × 0.2)
            </p>
            <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem', lineHeight: 1.6, margin: 0 }}>
              Final Score = Base Score × (Recent Performance Weight) + Experience Modifier
            </p>
          </div>

          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem', lineHeight: 1.6 }}>
            Experience also plays a role—newer kingdoms receive a slight scaling factor until they've proven themselves across multiple KvKs.
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
            Tier Rankings
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            Kingdoms are classified into tiers based on their Atlas Score, which reflects their percentile ranking among all tracked kingdoms.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: '0.75rem' }}>
            {[
              { tier: 'S', range: '10.0+', color: '#fbbf24', desc: 'Elite', detail: 'Top 10% of kingdoms' },
              { tier: 'A', range: '7.0-9.9', color: '#22c55e', desc: 'Strong', detail: 'Top 25% of kingdoms' },
              { tier: 'B', range: '4.5-6.9', color: '#3b82f6', desc: 'Average', detail: 'Top 50% of kingdoms' },
              { tier: 'C', range: '2.5-4.4', color: '#9ca3af', desc: 'Below Average', detail: 'Top 75% of kingdoms' },
              { tier: 'D', range: '0-2.4', color: '#6b7280', desc: 'Developing', detail: 'Bottom 25% of kingdoms' },
            ].map((t, i) => (
              <div key={i} style={{ 
                backgroundColor: '#111111', 
                padding: '1rem', 
                borderRadius: '8px',
                border: '1px solid #2a2a2a',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: t.color, marginBottom: '0.25rem' }}>
                  {t.tier}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>{t.range}</div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.25rem' }}>{t.desc}</div>
                <div style={{ fontSize: '0.7rem', color: '#6b7280', fontStyle: 'italic' }}>{t.detail}</div>
              </div>
            ))}
          </div>
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
            Data & Disclaimer
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            Our data is sourced from community contributions and publicly available KvK results. While we strive for accuracy, KvK results can be complex and may not capture every nuance of a match.
          </p>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7 }}>
            Kingshot Atlas is a fan-made project and is not affiliated with or endorsed by the developers of Kingshot. Kingshot is a trademark of its respective owners.
          </p>
        </section>

        {/* Contact */}
        <section style={{ 
          backgroundColor: '#111111', 
          padding: isMobile ? '1.25rem' : '1.5rem', 
          borderRadius: '12px',
          border: '1px solid #2a2a2a',
          textAlign: 'center'
        }}>
          <h2 style={{ 
            fontSize: isMobile ? '1rem' : '1.1rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '0.75rem',
            fontFamily: "'Cinzel', serif"
          }}>
            Get in Touch
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.6, marginBottom: '1rem' }}>
            Have feedback, found an error, or want to contribute data? We'd love to hear from you.
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
          <Link to="/" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.85rem' }}>← Back to Directory</Link>
        </div>
      </div>
    </div>
  );
};

export default About;
