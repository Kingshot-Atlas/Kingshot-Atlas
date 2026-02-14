import React from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { colors } from '../../utils/styles';
import type { FundInfo, TeamMember } from './types';

interface RecruiterOnboardingProps {
  fund: FundInfo | null;
  team: TeamMember[];
  onDismiss: () => void;
  onNavigateTab: (tab: 'profile' | 'fund' | 'invites') => void;
}

const RecruiterOnboarding: React.FC<RecruiterOnboardingProps> = ({ fund, team, onDismiss, onNavigateTab }) => {
  const isMobile = useIsMobile();

  const steps = [
    { step: '1', icon: '👑', title: 'Claim Kingdom', desc: "You're the editor — manage your listing.", done: true },
    { step: '2', icon: '🎨', title: 'Set Vibe & Bio', desc: 'Add kingdom vibe and recruitment pitch.', done: !!(fund?.kingdom_vibe || fund?.recruitment_pitch), action: () => onNavigateTab('profile') },
    { step: '3', icon: '💰', title: 'Fund Listing', desc: 'Boost visibility with a contribution.', done: (fund?.balance || 0) > 0, action: () => onNavigateTab('fund') },
    { step: '4', icon: '👥', title: 'Invite Co-Editor', desc: 'Optional — add a co-editor to help.', done: team.some(t => t.role === 'co-editor' && (t.status === 'active' || t.status === 'pending')), action: () => onNavigateTab('invites') },
    { step: '5', icon: '📩', title: 'Start Recruiting', desc: 'Toggle recruiting on, send invites.', done: fund?.is_recruiting || false },
  ];

  return (
    <div style={{
      backgroundColor: '#22d3ee08',
      border: '1px solid #22d3ee20',
      borderRadius: '12px',
      padding: '1rem',
      marginBottom: '1rem',
      position: 'relative',
    }}>
      <button
        onClick={onDismiss}
        style={{
          position: 'absolute', top: '0.5rem', right: '0.5rem',
          background: 'none', border: 'none', color: colors.textMuted,
          cursor: 'pointer', fontSize: '1rem', padding: '0.25rem',
        }}
        aria-label="Dismiss onboarding"
      >
        ✕
      </button>
      <p style={{ color: '#22d3ee', fontSize: '0.8rem', fontWeight: '700', margin: '0 0 0.6rem 0' }}>
        Getting Started as a Recruiter
      </p>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.5rem', flexWrap: 'wrap' }}>
        {steps.map((s) => (
          <div key={s.step} onClick={() => !s.done && s.action?.()}  style={{
            flex: 1, minWidth: isMobile ? 'auto' : '110px',
            padding: '0.6rem',
            backgroundColor: s.done ? '#22c55e08' : '#0a0a0a',
            border: `1px solid ${s.done ? '#22c55e25' : '#1a1a1a'}`,
            borderRadius: '8px',
            textAlign: 'center',
            cursor: !s.done && s.action ? 'pointer' : 'default',
          }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>
              {s.done ? '✅' : s.icon}
            </div>
            <div style={{ color: s.done ? '#22c55e' : '#fff', fontSize: '0.75rem', fontWeight: '600' }}>
              {s.title}
            </div>
            <div style={{ color: colors.textMuted, fontSize: '0.6rem', marginTop: '0.15rem' }}>
              {s.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecruiterOnboarding;
