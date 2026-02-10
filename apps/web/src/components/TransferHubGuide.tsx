import React, { useState } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAnalytics } from '../hooks/useAnalytics';
import { colors } from '../utils/styles';

const STORAGE_KEY = 'atlas_transfer_hub_guide_dismissed';

const TransferHubGuide: React.FC = () => {
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();
  const [isExpanded, setIsExpanded] = useState(() => {
    return !localStorage.getItem(STORAGE_KEY);
  });
  const [activeTab, setActiveTab] = useState<'recruit' | 'recruiter'>('recruit');

  const handleTabSwitch = (tab: 'recruit' | 'recruiter') => {
    setActiveTab(tab);
    trackFeature('Transfer Guide Tab Switch', { tab });
  };

  const handleDismiss = () => {
    setIsExpanded(false);
    localStorage.setItem(STORAGE_KEY, 'true');
    trackFeature('Transfer Guide Dismissed');
  };

  const handleToggle = () => {
    if (isExpanded) {
      handleDismiss();
    } else {
      setIsExpanded(true);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const recruitSteps = [
    {
      number: '1',
      title: 'Pick your mode',
      description: 'Select "I\'m Transferring" from the toggle at the top. This unlocks tools built for you.',
      icon: '🎯',
    },
    {
      number: '2',
      title: 'Create your Transfer Profile',
      description: 'Set your power, TC level, language, and what you\'re looking for. Kingdoms see this when you apply.',
      icon: '📋',
    },
    {
      number: '3',
      title: 'Browse & compare kingdoms',
      description: 'Every kingdom has an Atlas Score, KvK record, and community reviews. Use filters to narrow it down. Match Scores show how well you fit.',
      icon: '🔍',
    },
    {
      number: '4',
      title: 'Apply',
      description: 'Found the right one? Hit Apply. You can have up to 3 active applications. Track their status in My Applications.',
      icon: '🚀',
    },
  ];

  const recruiterSteps = [
    {
      number: '1',
      title: 'Claim your kingdom',
      description: 'Switch to "I\'m Recruiting" and claim editor rights. You need endorsements from kingdom members to activate.',
      icon: '👑',
    },
    {
      number: '2',
      title: 'Set up your listing',
      description: 'Open the Recruiter Dashboard. Add your pitch, requirements, languages, vibe tags, and event times. This is your kingdom\'s storefront.',
      icon: '📢',
    },
    {
      number: '3',
      title: 'Fund your listing (optional)',
      description: 'Contributing to your Kingdom Fund unlocks Bronze → Silver → Gold tiers with better visibility and features. Funds deplete ~$5/week.',
      icon: '💰',
    },
    {
      number: '4',
      title: 'Review applications',
      description: 'Applicants land in your inbox. View their profiles, mark as Interested, Accept, or Decline. The right players come to you.',
      icon: '📬',
    },
  ];

  const steps = activeTab === 'recruit' ? recruitSteps : recruiterSteps;

  return (
    <div style={{
      backgroundColor: '#111111',
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      marginBottom: '1rem',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
    }}>
      {/* Toggle Header */}
      <button
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: isMobile ? '0.75rem 1rem' : '0.75rem 1.25rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: colors.text,
          minHeight: '44px',
        }}
      >
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.85rem',
          fontWeight: '600',
        }}>
          <span style={{ fontSize: '1rem' }}>📖</span>
          <span>How the Transfer Hub Works</span>
          {!isExpanded && (
            <span style={{
              fontSize: '0.7rem',
              color: colors.textMuted,
              fontWeight: '400',
            }}>
              — tap to learn
            </span>
          )}
        </span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={colors.textSecondary} strokeWidth="2"
          style={{
            transform: isExpanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={{
          padding: isMobile ? '0 1rem 1rem' : '0 1.25rem 1.25rem',
          borderTop: `1px solid ${colors.border}`,
        }}>
          {/* Intro line */}
          <p style={{
            color: colors.textSecondary,
            fontSize: '0.8rem',
            margin: '0.75rem 0',
            lineHeight: 1.5,
          }}>
            No more blind transfers. Here's everything you need in 60 seconds.
          </p>

          {/* Tab Toggle: Recruit vs Recruiter */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}>
            <button
              onClick={() => handleTabSwitch('recruit')}
              style={{
                flex: 1,
                padding: '0.6rem 0.75rem',
                borderRadius: '8px',
                border: activeTab === 'recruit'
                  ? '1px solid #22d3ee40'
                  : `1px solid ${colors.border}`,
                backgroundColor: activeTab === 'recruit'
                  ? '#22d3ee10'
                  : 'transparent',
                color: activeTab === 'recruit'
                  ? '#22d3ee'
                  : colors.textSecondary,
                fontSize: '0.8rem',
                fontWeight: activeTab === 'recruit' ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 0.2s',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <span>🚀</span> I'm Transferring
            </button>
            <button
              onClick={() => handleTabSwitch('recruiter')}
              style={{
                flex: 1,
                padding: '0.6rem 0.75rem',
                borderRadius: '8px',
                border: activeTab === 'recruiter'
                  ? '1px solid #a855f740'
                  : `1px solid ${colors.border}`,
                backgroundColor: activeTab === 'recruiter'
                  ? '#a855f710'
                  : 'transparent',
                color: activeTab === 'recruiter'
                  ? '#a855f7'
                  : colors.textSecondary,
                fontSize: '0.8rem',
                fontWeight: activeTab === 'recruiter' ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 0.2s',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <span>📢</span> I'm Recruiting
            </button>
          </div>

          {/* Steps */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}>
            {steps.map((step) => (
              <div
                key={step.number}
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'flex-start',
                }}
              >
                {/* Step Number Circle */}
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: activeTab === 'recruit' ? '#22d3ee15' : '#a855f715',
                  border: `1px solid ${activeTab === 'recruit' ? '#22d3ee30' : '#a855f730'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  color: activeTab === 'recruit' ? '#22d3ee' : '#a855f7',
                  flexShrink: 0,
                  marginTop: '1px',
                }}>
                  {step.number}
                </div>
                {/* Step Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    marginBottom: '0.15rem',
                  }}>
                    <span style={{
                      color: colors.text,
                      fontWeight: '600',
                      fontSize: '0.82rem',
                    }}>
                      {step.title}
                    </span>
                  </div>
                  <p style={{
                    color: colors.textSecondary,
                    fontSize: '0.75rem',
                    margin: 0,
                    lineHeight: 1.5,
                  }}>
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Pro Tips */}
          <div style={{
            marginTop: '0.75rem',
            padding: '0.6rem 0.75rem',
            backgroundColor: '#0a0a0a',
            borderRadius: '8px',
            border: `1px solid ${colors.border}`,
          }}>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: '600',
              color: colors.warning,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
            }}>
              ⚡ Quick tip
            </span>
            <p style={{
              color: colors.textSecondary,
              fontSize: '0.75rem',
              margin: '0.25rem 0 0 0',
              lineHeight: 1.5,
            }}>
              {activeTab === 'recruit'
                ? 'The better your Transfer Profile, the higher your Match Score with kingdoms. Fill it out completely — recruiters notice.'
                : 'Kingdoms with active funds rank higher in listings. Even a Bronze tier gets you noticed over Standard listings.'}
            </p>
          </div>

          {/* Got it button */}
          <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
            <button
              onClick={handleDismiss}
              style={{
                padding: '0.4rem 1rem',
                backgroundColor: 'transparent',
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.textSecondary,
                fontSize: '0.75rem',
                cursor: 'pointer',
                minHeight: '36px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#22d3ee40';
                e.currentTarget.style.color = '#22d3ee';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.color = colors.textSecondary;
              }}
            >
              Got it, let's go
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferHubGuide;
