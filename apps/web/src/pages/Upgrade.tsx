import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { neonGlow } from '../utils/styles';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useAuth } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
import { getCheckoutUrl } from '../lib/stripe';

const Upgrade: React.FC = () => {
  useDocumentTitle('Upgrade to Pro');
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { tier } = usePremium();
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [isLoading, setIsLoading] = useState<'pro' | 'recruiter' | null>(null);

  const handleUpgrade = (selectedTier: 'pro' | 'recruiter') => {
    if (!user) {
      navigate('/profile');
      return;
    }
    
    setIsLoading(selectedTier);
    
    // Get checkout URL (Stripe Payment Link or Ko-fi fallback)
    const checkoutUrl = getCheckoutUrl(selectedTier, billingCycle, user.id);
    
    // If it's Ko-fi, open in new tab; otherwise redirect
    if (checkoutUrl.includes('ko-fi.com')) {
      window.open(checkoutUrl, '_blank');
      setIsLoading(null);
    } else {
      window.location.href = checkoutUrl;
    }
  };

  const proFeatures = [
    { icon: '📜', text: 'Full KvK History — Every match, every outcome' },
    { icon: '📈', text: 'Score Timeline — Track performance over time' },
    { icon: '👀', text: 'Kingdom Watchlist — Monitor up to 20 rivals', comingSoon: true },
    { icon: '⚖️', text: 'Multi-Compare — Up to 5 kingdoms side-by-side' },
    { icon: '⚡', text: 'Priority Support — Faster response times' },
    { icon: '⭐', text: 'Pro Badge — Stand out in the community' },
    { icon: '👾', text: 'Discord Role — Exclusive Pro role & badge' },
  ];

  const recruiterFeatures = [
    { icon: '✅', text: 'Everything in Pro, plus:' },
    { icon: '👑', text: 'Claim Kingdom — Official representative status', comingSoon: true },
    { icon: '📈', text: 'Recruiter Dashboard — Track who\'s looking', comingSoon: true },
    { icon: '🖼️', text: 'Custom Banner — Make your kingdom stand out', comingSoon: true },
    { icon: '📬', text: 'Recruit Inbox — Receive transfer interest', comingSoon: true },
    { icon: '�', text: 'Discord Role — Exclusive Recruiter role & badge' },
  ];

  const pricing = {
    pro: {
      monthly: 4.99,
      yearly: 39.99,
      yearlyMonthly: 3.33,
    },
    recruiter: {
      monthly: 14.99,
      yearly: 119.99,
      yearlyMonthly: 9.99,
    },
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
            fontFamily: "'Cinzel', 'Times New Roman', serif"
          }}>
            <span style={{ color: '#fff' }}>UPGRADE TO</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>PRO</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.75rem' }}>
            Stop guessing. Start winning.
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

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '1.5rem 1rem' : '2rem' }}>
        {/* Current Tier Badge - only show when logged in with paid tier */}
        {user && tier !== 'free' && tier !== 'anonymous' && (
          <div style={{
            textAlign: 'center',
            marginBottom: '1.5rem',
            padding: '0.75rem',
            backgroundColor: tier === 'recruiter' ? '#a855f720' : '#22d3ee20',
            border: `1px solid ${tier === 'recruiter' ? '#a855f750' : '#22d3ee50'}`,
            borderRadius: '8px'
          }}>
            <span style={{ color: tier === 'recruiter' ? '#a855f7' : '#22d3ee', fontWeight: '600' }}>
              ✓ You're currently on Atlas {tier === 'recruiter' ? 'Recruiter' : 'Pro'}
            </span>
          </div>
        )}

        {/* Billing Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'flex',
            backgroundColor: '#111111',
            borderRadius: '8px',
            padding: '4px',
            border: '1px solid #2a2a2a'
          }}>
            <button
              onClick={() => setBillingCycle('monthly')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: billingCycle === 'monthly' ? '#22d3ee' : 'transparent',
                color: billingCycle === 'monthly' ? '#000' : '#9ca3af',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: billingCycle === 'yearly' ? '#22d3ee' : 'transparent',
                color: billingCycle === 'yearly' ? '#000' : '#9ca3af',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Yearly
              <span style={{
                marginLeft: '0.5rem',
                padding: '0.15rem 0.4rem',
                backgroundColor: billingCycle === 'yearly' ? '#22c55e' : '#22c55e30',
                color: billingCycle === 'yearly' ? '#fff' : '#22c55e',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: '700'
              }}>
                SAVE 33%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', 
          gap: '1.5rem',
          marginBottom: '2.5rem'
        }}>
          {/* Pro Tier */}
          <div style={{
            backgroundColor: '#111111',
            border: '2px solid #22d3ee50',
            borderRadius: '16px',
            padding: isMobile ? '1.5rem' : '2rem',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #22d3ee, #3b82f6)'
            }} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#22d3ee">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
              </svg>
              <h2 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Atlas Pro</h2>
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
              For players who play to win
            </p>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ color: '#22d3ee', fontSize: '2.5rem', fontWeight: 'bold' }}>
                ${billingCycle === 'yearly' ? pricing.pro.yearlyMonthly.toFixed(2) : pricing.pro.monthly.toFixed(2)}
              </span>
              <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>/month</span>
              {billingCycle === 'yearly' && (
                <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Billed ${pricing.pro.yearly}/year
                </div>
              )}
            </div>

            <button
              onClick={() => handleUpgrade('pro')}
              disabled={isLoading !== null}
              style={{
                width: '100%',
                padding: '0.875rem',
                backgroundColor: isLoading === 'pro' ? '#22d3ee80' : '#22d3ee',
                border: 'none',
                borderRadius: '8px',
                color: '#000',
                fontSize: '0.95rem',
                fontWeight: '700',
                cursor: isLoading ? 'wait' : 'pointer',
                marginBottom: '1.5rem',
                transition: 'all 0.2s'
              }}
            >
              {isLoading === 'pro' ? 'Redirecting...' : user ? 'Get Pro' : 'Sign In to Upgrade'}
            </button>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {proFeatures.map((feature, i) => (
                <li key={i} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.5rem 0',
                  borderBottom: i < proFeatures.length - 1 ? '1px solid #1f1f1f' : 'none',
                  opacity: feature.comingSoon ? 0.7 : 1
                }}>
                  <span style={{ fontSize: '1rem' }}>{feature.icon}</span>
                  <span style={{ color: '#d1d5db', fontSize: '0.85rem' }}>
                    {feature.text}
                    {feature.comingSoon && (
                      <span style={{ 
                        marginLeft: '0.5rem', 
                        fontSize: '0.65rem', 
                        padding: '0.1rem 0.35rem', 
                        backgroundColor: '#6b728020', 
                        color: '#9ca3af', 
                        borderRadius: '4px',
                        fontWeight: '500'
                      }}>SOON</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Recruiter Tier */}
          <div style={{
            backgroundColor: '#111111',
            border: '2px solid #a855f750',
            borderRadius: '16px',
            padding: isMobile ? '1.5rem' : '2rem',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #a855f7, #ec4899)'
            }} />
            
            <div style={{
              position: 'absolute',
              top: '1rem',
              right: '-2rem',
              backgroundColor: '#a855f7',
              color: '#fff',
              padding: '0.25rem 2rem',
              fontSize: '0.7rem',
              fontWeight: '700',
              transform: 'rotate(45deg)'
            }}>
              BEST VALUE
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#a855f7">
                <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
              </svg>
              <h2 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Atlas Recruiter</h2>
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
              For leaders who build dynasties
            </p>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ color: '#a855f7', fontSize: '2.5rem', fontWeight: 'bold' }}>
                ${billingCycle === 'yearly' ? pricing.recruiter.yearlyMonthly.toFixed(2) : pricing.recruiter.monthly.toFixed(2)}
              </span>
              <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>/month</span>
              {billingCycle === 'yearly' && (
                <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Billed ${pricing.recruiter.yearly}/year
                </div>
              )}
            </div>

            <button
              onClick={() => handleUpgrade('recruiter')}
              disabled={isLoading !== null}
              style={{
                width: '100%',
                padding: '0.875rem',
                backgroundColor: isLoading === 'recruiter' ? '#a855f780' : '#a855f7',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: '700',
                cursor: isLoading ? 'wait' : 'pointer',
                marginBottom: '1.5rem',
                transition: 'all 0.2s'
              }}
            >
              {isLoading === 'recruiter' ? 'Redirecting...' : user ? 'Get Recruiter' : 'Sign In to Upgrade'}
            </button>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {recruiterFeatures.map((feature, i) => (
                <li key={i} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.5rem 0',
                  borderBottom: i < recruiterFeatures.length - 1 ? '1px solid #1f1f1f' : 'none',
                  opacity: feature.comingSoon ? 0.7 : 1
                }}>
                  <span style={{ fontSize: '1rem' }}>{feature.icon}</span>
                  <span style={{ color: '#d1d5db', fontSize: '0.85rem' }}>
                    {feature.text}
                    {feature.comingSoon && (
                      <span style={{ 
                        marginLeft: '0.5rem', 
                        fontSize: '0.65rem', 
                        padding: '0.1rem 0.35rem', 
                        backgroundColor: '#6b728020', 
                        color: '#9ca3af', 
                        borderRadius: '4px',
                        fontWeight: '500'
                      }}>SOON</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* FAQ */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ 
            fontSize: '1.1rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '1rem',
            textAlign: 'center'
          }}>
            Frequently Asked Questions
          </h2>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {[
              { q: 'Can I cancel anytime?', a: 'Yes! Cancel anytime with one click. No questions asked, no hidden fees.' },
              { q: 'What payment methods do you accept?', a: 'We accept all major credit cards, PayPal, and Apple Pay through Stripe.' },
              { q: 'Is there a free trial?', a: 'The free tier gives you access to core features. Upgrade when you need more!' },
              { q: 'Can I switch between plans?', a: 'Absolutely. Upgrade or downgrade anytime, and we\'ll prorate the difference.' },
            ].map((faq, i) => (
              <div key={i} style={{
                backgroundColor: '#111111',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid #2a2a2a'
              }}>
                <div style={{ color: '#fff', fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  {faq.q}
                </div>
                <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                  {faq.a}
                </div>
              </div>
            ))}
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

export default Upgrade;
