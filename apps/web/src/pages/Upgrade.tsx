import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { neonGlow } from '../utils/styles';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useAuth } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
import { getCheckoutUrlAsync } from '../lib/stripe';

const Upgrade: React.FC = () => {
  useDocumentTitle('Atlas Upgrade');
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { tier, refreshSubscription } = usePremium();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [isLoading, setIsLoading] = useState<'pro' | 'recruiter' | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  
  // Check for success/canceled states from Stripe redirect
  const isSuccess = searchParams.get('success') === 'true';
  const isCanceled = searchParams.get('canceled') === 'true';
  const sessionId = searchParams.get('session_id');
  
  // Handle successful checkout - refresh subscription and clear URL params
  useEffect(() => {
    if (isSuccess && sessionId) {
      // Refresh subscription status from Supabase
      refreshSubscription?.();
      
      // Clear URL params after 5 seconds to clean up the URL
      const timer = setTimeout(() => {
        setSearchParams({});
      }, 5000);
      
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isSuccess, sessionId, refreshSubscription, setSearchParams]);
  
  // Clear canceled state after showing message
  useEffect(() => {
    if (isCanceled) {
      const timer = setTimeout(() => {
        setSearchParams({});
      }, 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isCanceled, setSearchParams]);

  const handleUpgrade = async (selectedTier: 'pro' | 'recruiter') => {
    if (!user) {
      navigate('/profile');
      return;
    }
    
    setIsLoading(selectedTier);
    setCheckoutError(null);
    
    try {
      // Get checkout URL via API (with fallback to payment links)
      const checkoutUrl = await getCheckoutUrlAsync(
        selectedTier, 
        billingCycle, 
        user.id,
        user.email || undefined
      );
      
      // If it's Ko-fi, open in new tab; otherwise redirect
      if (checkoutUrl.includes('ko-fi.com')) {
        window.open(checkoutUrl, '_blank');
        setIsLoading(null);
      } else {
        window.location.href = checkoutUrl;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setCheckoutError(error instanceof Error ? error.message : 'Failed to start checkout. Please try again.');
      setIsLoading(null);
    }
  };

  const proFeatures = [
    { icon: '🎯', text: 'Score Simulator — Predict future Atlas Scores' },
    { icon: '👀', text: 'Kingdom Watchlist — Monitor up to 20 rivals', comingSoon: true },
    { icon: '⚖️', text: 'Multi-Compare — Up to 5 kingdoms side-by-side' },
    { icon: '🔍', text: 'Advanced Filters — Power search tools' },
    { icon: '⚡', text: 'Priority Submissions — Faster data processing' },
    { icon: '🚫', text: 'Ad-Free — Clean, distraction-free experience' },
    { icon: '🚀', text: 'Early Access — First to try new features' },
    { icon: '⭐', text: 'Pro Badge — Stand out in the community' },
    { icon: '💎', text: 'Discord Role — Exclusive Pro role & badge' },
  ];

  // Comparison table data
  const comparisonData = [
    { feature: 'KvK History', free: 'Full', pro: 'Full', recruiter: 'Full' },
    { feature: 'Kingdom Profiles', free: '✓', pro: '✓', recruiter: '✓' },
    { feature: 'Compare Kingdoms', free: '2', pro: '5', recruiter: '5' },
    { feature: 'Watchlist Slots', free: '3', pro: '20', recruiter: '50' },
    { feature: 'Score Simulator', free: '—', pro: '✓', recruiter: '✓' },
    { feature: 'Advanced Filters', free: '—', pro: '✓', recruiter: '✓' },
    { feature: 'Ad-Free', free: '—', pro: '✓', recruiter: '✓' },
    { feature: 'Priority Support', free: '—', pro: '✓', recruiter: '✓' },
    { feature: 'Claim Kingdom', free: '—', pro: '—', recruiter: '✓' },
    { feature: 'Recruiter Tools', free: '—', pro: '—', recruiter: '✓' },
  ];

  const recruiterFeatures = [
    { icon: '✅', text: 'Everything in Pro, plus:' },
    { icon: '👑', text: 'Claim Kingdom — Official representative status', comingSoon: true },
    { icon: '📊', text: 'Recruiter Dashboard — Track who\'s looking', comingSoon: true },
    { icon: '🖼️', text: 'Custom Banner — Make your kingdom stand out', comingSoon: true },
    { icon: '📬', text: 'Recruit Inbox — Receive transfer interest', comingSoon: true },
    { icon: '🏅', text: 'Recruiter Badge — Premium status in the community' },
    { icon: '💜', text: 'Discord Role — Exclusive Recruiter role & badge' },
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

  // Calculate savings
  const proYearlySavings = (pricing.pro.monthly * 12) - pricing.pro.yearly;
  const recruiterYearlySavings = (pricing.recruiter.monthly * 12) - pricing.recruiter.yearly;

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
            <span style={{ color: '#fff' }}>ATLAS</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>UPGRADE</span>
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
                Welcome to Atlas {tier === 'recruiter' ? 'Recruiter' : 'Pro'}!
              </div>
              <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                Your subscription is now active. Enjoy your premium features!
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
              Checkout canceled. No worries — you can upgrade anytime.
            </div>
          </div>
        )}
        
        {/* Error Message */}
        {checkoutError && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            backgroundColor: '#ef444415',
            border: '1px solid #ef444450',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <div>
              <div style={{ color: '#ef4444', fontWeight: '600', marginBottom: '0.25rem' }}>
                Checkout Error
              </div>
              <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                {checkoutError}
              </div>
            </div>
          </div>
        )}
        
        {/* Current Tier Badge with Management Options - only show when logged in with paid tier */}
        {user && tier !== 'free' && tier !== 'anonymous' && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            backgroundColor: tier === 'recruiter' ? '#a855f715' : '#22d3ee15',
            border: `1px solid ${tier === 'recruiter' ? '#a855f740' : '#22d3ee40'}`,
            borderRadius: '10px'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.25rem' }}>⭐</span>
                <div>
                  <div style={{ color: tier === 'recruiter' ? '#a855f7' : '#22d3ee', fontWeight: '600' }}>
                    You&apos;re on Atlas {tier === 'recruiter' ? 'Recruiter' : 'Pro'}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    Thank you for supporting Atlas!
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={async () => {
                    if (!user) return;
                    setIsLoading('pro');
                    try {
                      const portalUrl = await import('../lib/stripe').then(m => m.createPortalSession(user.id));
                      window.location.href = portalUrl;
                    } catch (error) {
                      console.error('Portal error:', error);
                      setCheckoutError('Unable to open billing portal. Please try from your Profile page or email support@ks-atlas.com');
                      setIsLoading(null);
                    }
                  }}
                  disabled={isLoading !== null}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'transparent',
                    border: `1px solid ${tier === 'recruiter' ? '#a855f750' : '#22d3ee50'}`,
                    borderRadius: '8px',
                    color: tier === 'recruiter' ? '#a855f7' : '#22d3ee',
                    fontSize: '0.85rem',
                    fontWeight: '500',
                    cursor: isLoading ? 'wait' : 'pointer',
                    opacity: isLoading ? 0.7 : 1,
                  }}
                >
                  {isLoading === 'pro' ? 'Opening...' : '⚙️ Manage Billing'}
                </button>
                <button
                  onClick={async () => {
                    if (!user) return;
                    const confirmed = window.confirm('Are you sure you want to cancel? You can always resubscribe later.');
                    if (!confirmed) return;
                    setIsLoading('recruiter');
                    try {
                      const portalUrl = await import('../lib/stripe').then(m => m.createPortalSession(user.id));
                      window.location.href = portalUrl;
                    } catch (error) {
                      console.error('Portal error:', error);
                      setCheckoutError('Unable to open cancellation portal. Please email support@ks-atlas.com');
                      setIsLoading(null);
                    }
                  }}
                  disabled={isLoading !== null}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'transparent',
                    border: '1px solid #ef444450',
                    borderRadius: '8px',
                    color: '#ef4444',
                    fontSize: '0.85rem',
                    fontWeight: '500',
                    cursor: isLoading ? 'wait' : 'pointer',
                    opacity: isLoading ? 0.7 : 1,
                  }}
                >
                  {isLoading === 'recruiter' ? 'Opening...' : 'Cancel Subscription'}
                </button>
              </div>
            </div>
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

        {/* Savings Banner - shows when yearly is selected */}
        {billingCycle === 'yearly' && (
          <div style={{ 
            marginBottom: '1.5rem',
            padding: '0.75rem 1rem',
            background: 'linear-gradient(135deg, #22c55e15 0%, #22c55e08 100%)',
            border: '1px solid #22c55e40',
            borderRadius: '10px',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              💰 You&apos;re saving with yearly billing
            </span>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <span>
                <span style={{ color: '#22d3ee', fontWeight: '600', fontSize: '0.85rem' }}>Pro: </span>
                <span style={{ color: '#22c55e', fontWeight: '700', fontSize: '0.85rem' }}>
                  Save ${proYearlySavings.toFixed(2)}/yr
                </span>
              </span>
              <span>
                <span style={{ color: '#a855f7', fontWeight: '600', fontSize: '0.85rem' }}>Recruiter: </span>
                <span style={{ color: '#22c55e', fontWeight: '700', fontSize: '0.85rem' }}>
                  Save ${recruiterYearlySavings.toFixed(2)}/yr
                </span>
              </span>
            </div>
          </div>
        )}

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

        {/* Comparison Table */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ 
            fontSize: '1.1rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '1rem',
            textAlign: 'center'
          }}>
            Compare Plans
          </h2>
          <div style={{ 
            overflowX: 'auto',
            backgroundColor: '#0d0d0d',
            borderRadius: '16px',
            border: '1px solid #1f1f1f',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)'
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'separate',
              borderSpacing: 0,
              fontSize: isMobile ? '0.8rem' : '0.9rem',
              tableLayout: 'fixed'
            }}>
              <colgroup>
                <col style={{ width: isMobile ? '40%' : '40%' }} />
                <col style={{ width: isMobile ? '20%' : '20%' }} />
                <col style={{ width: isMobile ? '20%' : '20%' }} />
                <col style={{ width: isMobile ? '20%' : '20%' }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #141414 100%)' }}>
                  <th style={{ 
                    padding: '1rem 1.25rem', 
                    textAlign: 'left', 
                    color: '#6b7280', 
                    fontWeight: '600',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid #2a2a2a'
                  }}>Feature</th>
                  <th style={{ 
                    padding: '1rem 0.5rem', 
                    textAlign: 'center', 
                    color: '#6b7280', 
                    fontWeight: '600',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid #2a2a2a'
                  }}>Free</th>
                  <th style={{ 
                    padding: '1rem 0.5rem', 
                    textAlign: 'center', 
                    color: '#22d3ee', 
                    fontWeight: '700',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '2px solid #22d3ee40',
                    background: 'linear-gradient(180deg, #22d3ee08 0%, transparent 100%)'
                  }}>Pro</th>
                  <th style={{ 
                    padding: '1rem 0.5rem', 
                    textAlign: 'center', 
                    color: '#a855f7', 
                    fontWeight: '700',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '2px solid #a855f740',
                    background: 'linear-gradient(180deg, #a855f708 0%, transparent 100%)'
                  }}>Recruiter</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, i) => (
                  <tr 
                    key={i} 
                    style={{ 
                      backgroundColor: i % 2 === 0 ? 'transparent' : '#0a0a0a',
                      transition: 'background-color 0.15s'
                    }}
                  >
                    <td style={{ 
                      padding: '0.85rem 1.25rem', 
                      color: '#e5e7eb',
                      fontWeight: '500',
                      borderBottom: i < comparisonData.length - 1 ? '1px solid #1a1a1a' : 'none'
                    }}>{row.feature}</td>
                    <td style={{ 
                      padding: '0.85rem 0.5rem', 
                      textAlign: 'center', 
                      color: row.free === '—' ? '#3f3f46' : '#9ca3af',
                      fontWeight: row.free === '—' ? '400' : '600',
                      borderBottom: i < comparisonData.length - 1 ? '1px solid #1a1a1a' : 'none'
                    }}>{row.free}</td>
                    <td style={{ 
                      padding: '0.85rem 0.5rem', 
                      textAlign: 'center', 
                      color: row.pro === '✓' ? '#22d3ee' : row.pro === '—' ? '#3f3f46' : '#22d3ee',
                      fontWeight: '600',
                      background: 'linear-gradient(180deg, #22d3ee05 0%, transparent 100%)',
                      borderBottom: i < comparisonData.length - 1 ? '1px solid #1a1a1a' : 'none'
                    }}>{row.pro}</td>
                    <td style={{ 
                      padding: '0.85rem 0.5rem', 
                      textAlign: 'center', 
                      color: row.recruiter === '✓' ? '#a855f7' : row.recruiter === '—' ? '#3f3f46' : '#a855f7',
                      fontWeight: '600',
                      background: 'linear-gradient(180deg, #a855f705 0%, transparent 100%)',
                      borderBottom: i < comparisonData.length - 1 ? '1px solid #1a1a1a' : 'none'
                    }}>{row.recruiter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>


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
