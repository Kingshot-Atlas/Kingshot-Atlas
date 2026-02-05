import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useAuth } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
import SupportButton from '../components/SupportButton';
import { getCheckoutUrl } from '../lib/stripe';

const SupportAtlas: React.FC = () => {
  useDocumentTitle('Support Atlas');
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { tier, refreshSubscription } = usePremium();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  
  const isSuccess = searchParams.get('success') === 'true';
  const isCanceled = searchParams.get('canceled') === 'true';
  const sessionId = searchParams.get('session_id');
  
  useEffect(() => {
    if (isSuccess && sessionId) {
      refreshSubscription?.();
      const timer = setTimeout(() => setSearchParams({}), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isSuccess, sessionId, refreshSubscription, setSearchParams]);
  
  useEffect(() => {
    if (isCanceled) {
      const timer = setTimeout(() => setSearchParams({}), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isCanceled, setSearchParams]);

  const supporterPerks = [
    { icon: '⭐', text: 'Supporter Badge', desc: 'Pink badge on your profile' },
    { icon: '💜', text: 'Discord Supporter Role', desc: 'Exclusive pink role in Discord' },
    { icon: '🎙️', text: 'Exclusive Discord Channel', desc: 'Access to supporter-only discussions' },
    { icon: '🚀', text: 'Early Access to New Features', desc: 'Be the first to try upcoming tools' },
    { icon: '🚫', text: 'Ad-Free Experience', desc: 'Clean, distraction-free browsing' },
  ];

  const handleStripeCheckout = () => {
    if (!user) {
      alert('Please sign in to become a Supporter');
      return;
    }
    const checkoutUrl = getCheckoutUrl('pro', 'monthly', user.id);
    window.location.href = checkoutUrl;
  };

  const freeFeatures = [
    { icon: '📜', text: 'Full KvK History', desc: 'Every match, every result, every kingdom' },
    { icon: '⚡', text: 'Atlas Score & Rankings', desc: 'See where every kingdom stands' },
    { icon: '⚔️', text: 'Kingdom Comparison', desc: 'Compare up to 2 kingdoms side-by-side' },
    { icon: '🎯', text: 'Score Simulator', desc: 'Project future scores based on outcomes' },
    { icon: '📊', text: 'Detailed Kingdom Profiles', desc: 'Full stats and performance history' },
    { icon: '📅', text: 'Event Calendar', desc: 'KvK and Transfer Event schedules' },
  ];

  const isSupporter = tier === 'pro' || tier === 'recruiter';

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
            <span style={{ color: '#fff' }}>SUPPORT</span>
            <span style={{ ...neonGlow('#FF6B8A'), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>ATLAS</span>
          </h1>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.85rem' : '0.95rem', marginBottom: '0.75rem', maxWidth: '500px', margin: '0 auto 0.75rem' }}>
            Atlas is a community project built by players, for players. Your support keeps the lights on and new features coming.
          </p>
          {!isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #FF6B8A)' }} />
              <div style={{ width: '6px', height: '6px', backgroundColor: '#FF6B8A', transform: 'rotate(45deg)', boxShadow: '0 0 8px #FF6B8A' }} />
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, #FF6B8A, transparent)' }} />
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '1.5rem 1rem' : '2rem' }}>
        {/* Success Message */}
        {isSuccess && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            backgroundColor: '#22c55e15',
            border: '1px solid #22c55e50',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <span style={{ fontSize: '1.5rem' }}>🎉</span>
            <div>
              <div style={{ color: '#22c55e', fontWeight: '600', marginBottom: '0.25rem' }}>
                Thank you for your support!
              </div>
              <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                You&apos;re now an Atlas Supporter. Welcome to the family!
              </div>
            </div>
          </div>
        )}
        
        {/* Canceled Message */}
        {isCanceled && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            backgroundColor: '#f59e0b15',
            border: '1px solid #f59e0b50',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <span style={{ fontSize: '1.25rem' }}>ℹ️</span>
            <div style={{ color: '#f59e0b', fontSize: '0.9rem' }}>
              No worries — you can support anytime. We appreciate you being here!
            </div>
          </div>
        )}
        
        {/* Current Supporter Badge - Compact inline with manage link */}
        {isSupporter && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '0.75rem 1rem',
            backgroundColor: '#FF6B8A15',
            border: '1px solid #FF6B8A40',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#FF6B8A', fontSize: '1rem' }}>�</span>
              <span style={{ color: '#FF6B8A', fontWeight: '600', fontSize: '0.9rem' }}>
                You&apos;re a Supporter!
              </span>
            </div>
            <button
              onClick={async () => {
                if (!user) return;
                setIsLoading(true);
                try {
                  const portalUrl = await import('../lib/stripe').then(m => m.createPortalSession(user.id));
                  window.location.href = portalUrl;
                } catch (error) {
                  console.error('Portal error:', error);
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              style={{
                padding: '0.35rem 0.75rem',
                backgroundColor: 'transparent',
                border: '1px solid #FF6B8A40',
                borderRadius: '6px',
                color: '#FF6B8A',
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: isLoading ? 'wait' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? 'Opening...' : 'Manage'}
            </button>
          </div>
        )}

        {/* Monthly Supporter Subscription - Main CTA */}
        <section style={{ 
          marginBottom: '2rem',
          backgroundColor: '#111111', 
          padding: isMobile ? '1.5rem' : '2rem', 
          borderRadius: '16px',
          border: '2px solid #FF6B8A50',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #111111 0%, #FF6B8A10 100%)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Recommended badge */}
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            padding: '0.25rem 0.6rem',
            backgroundColor: '#FF6B8A',
            color: '#000',
            fontSize: '0.7rem',
            fontWeight: '700',
            borderRadius: '4px',
            textTransform: 'uppercase'
          }}>
            ⭐ Recommended
          </div>
          
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 1rem',
            backgroundColor: '#FF6B8A20',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="#FF6B8A">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </div>
          <h2 style={{ 
            fontSize: isMobile ? '1.25rem' : '1.5rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '0.5rem',
            fontFamily: FONT_DISPLAY
          }}>
            Atlas Supporter
          </h2>
          <div style={{ 
            fontSize: isMobile ? '1.75rem' : '2rem', 
            fontWeight: 'bold', 
            color: '#FF6B8A', 
            marginBottom: '0.5rem' 
          }}>
            $4.99<span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 'normal' }}>/month</span>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1rem' }}>
            Cancel anytime • Manage via Stripe
          </p>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
            Get the Supporter Badge, Discord role, ad-free experience, and help fund Atlas development.
          </p>
          
          {isSupporter ? (
            <button
              disabled
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 2rem',
                background: '#22c55e',
                border: 'none',
                borderRadius: '10px',
                color: '#000',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: 'default',
              }}
            >
              ✓ You&apos;re a Supporter!
            </button>
          ) : user ? (
            <button
              onClick={handleStripeCheckout}
              disabled={isLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 2rem',
                background: 'linear-gradient(135deg, #FF6B8A 0%, #ff8fa8 100%)',
                border: 'none',
                borderRadius: '10px',
                color: '#000',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(255, 107, 138, 0.4)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                opacity: isLoading ? 0.7 : 1
              }}
            >
              💖 Become a Supporter
            </button>
          ) : (
            <Link
              to="/login?redirect=/support"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 2rem',
                background: 'linear-gradient(135deg, #FF6B8A 0%, #ff8fa8 100%)',
                border: 'none',
                borderRadius: '10px',
                color: '#000',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(255, 107, 138, 0.4)',
                textDecoration: 'none',
              }}
            >
              🔐 Sign In to Subscribe
            </Link>
          )}
          
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '1rem' }}>
            Want to give more? You can increase your amount in the Stripe portal after subscribing.
          </p>
        </section>

        {/* Ko-fi One-Time Donation */}
        <section style={{ 
          marginBottom: '2.5rem',
          backgroundColor: '#111111', 
          padding: isMobile ? '1.25rem' : '1.5rem', 
          borderRadius: '12px',
          border: '1px solid #2a2a2a',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>☕</span>
            <h3 style={{ color: '#fff', fontWeight: '600', fontSize: '1rem', margin: 0 }}>
              One-Time Donation
            </h3>
          </div>
          <p style={{ color: '#9ca3af', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1rem', maxWidth: '450px', margin: '0 auto 1rem' }}>
            Prefer a one-time contribution? Buy us a coffee on Ko-fi. Every bit helps keep the servers running.
          </p>
          <SupportButton />
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.75rem', fontStyle: 'italic' }}>
            Note: One-time donations don&apos;t include the Supporter badge or Discord role.
          </p>
        </section>

        {/* Supporter Perks */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '0.5rem',
            fontFamily: FONT_DISPLAY,
            textAlign: 'center'
          }}>
            Supporter Perks
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1.25rem' }}>
            A small thank you for helping us grow
          </p>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {supporterPerks.map((perk, i) => (
              <div key={i} style={{
                backgroundColor: '#111111',
                padding: '1rem 1.25rem',
                borderRadius: '10px',
                border: '1px solid #2a2a2a',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <span style={{ fontSize: '1.5rem' }}>{perk.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: '0.25rem' }}>
                    <span style={{ color: '#fff', fontWeight: '600', fontSize: '0.95rem' }}>{perk.text}</span>
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{perk.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* What's Free Section */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '0.5rem',
            fontFamily: FONT_DISPLAY,
            textAlign: 'center'
          }}>
            What Everyone Gets — Free
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1.25rem' }}>
            Atlas is built for the community. These features are free forever.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
            {freeFeatures.map((feature, i) => (
              <div key={i} style={{
                backgroundColor: '#111111',
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid #22d3ee20',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <span style={{ fontSize: '1.25rem' }}>{feature.icon}</span>
                <div>
                  <div style={{ color: '#22d3ee', fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                    {feature.text}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{feature.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Coming Soon Teaser */}
        <section style={{ 
          marginBottom: '2.5rem',
          backgroundColor: '#111111', 
          padding: isMobile ? '1.25rem' : '1.5rem', 
          borderRadius: '12px',
          border: '1px solid #a855f730',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🚀</span>
            <h3 style={{ color: '#a855f7', fontWeight: '600', fontSize: '1rem', margin: 0 }}>
              Coming Soon: Atlas Recruiter
            </h3>
          </div>
          <p style={{ color: '#9ca3af', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
            Designed for alliance leaders and kingdom managers. Claim your kingdom, manage your public profile, 
            track recruitment interest, and more. Stay tuned!
          </p>
        </section>

        {/* Why Support */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '1rem',
            fontFamily: FONT_DISPLAY,
            textAlign: 'center'
          }}>
            Why Support Atlas?
          </h2>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {[
              { icon: '🛠️', title: 'Fund Development', desc: 'New features, better performance, more data—your support makes it happen.' },
              { icon: '🖥️', title: 'Keep Servers Running', desc: 'Hosting isn\'t free. Your support covers infrastructure costs.' },
              { icon: '🤝', title: 'Community First', desc: 'No corporate overlords. Just players helping players.' },
              { icon: '💡', title: 'Shape the Future', desc: 'Supporters get early access and input on what we build next.' },
            ].map((item, i) => (
              <div key={i} style={{
                backgroundColor: '#111111',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid #2a2a2a',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                <div>
                  <div style={{ color: '#fff', fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                    {item.title}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Alternative Ways to Support */}
        <section style={{ 
          marginBottom: '2rem',
          backgroundColor: '#111111', 
          padding: isMobile ? '1.25rem' : '1.5rem', 
          borderRadius: '12px',
          border: '1px solid #2a2a2a',
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#fff', fontWeight: '600', fontSize: '1rem', marginBottom: '0.75rem' }}>
            Other Ways to Help
          </h3>
          <p style={{ color: '#9ca3af', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1rem' }}>
            Not everyone can donate, and that&apos;s totally fine! Here&apos;s how you can still help:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem' }}>
            <Link to="/contribute-data" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#f9731620',
              border: '1px solid #f9731640',
              borderRadius: '8px',
              color: '#f97316',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: '500'
            }}>
              📊 Submit KvK Data
            </Link>
            <a href="https://discord.gg/cajcacDzGd" target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#5865F220',
              border: '1px solid #5865F240',
              borderRadius: '8px',
              color: '#5865F2',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: '500'
            }}>
              💬 Join Discord
            </a>
            <button onClick={() => {
              if (navigator.share) {
                navigator.share({ title: 'Kingshot Atlas', url: 'https://ks-atlas.com' });
              } else {
                navigator.clipboard.writeText('https://ks-atlas.com');
              }
            }} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#22d3ee20',
              border: '1px solid #22d3ee40',
              borderRadius: '8px',
              color: '#22d3ee',
              fontSize: '0.85rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}>
              📤 Share Atlas
            </button>
          </div>
        </section>

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

export default SupportAtlas;
