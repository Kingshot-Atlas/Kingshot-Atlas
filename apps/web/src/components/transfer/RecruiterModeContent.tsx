import React, { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import EditorClaiming from '../EditorClaiming';
import ErrorBoundary from '../ErrorBoundary';
import TransferHubErrorFallback from './TransferHubErrorFallback';
import { colors } from '../../utils/styles';
import type { BoardMode } from '../KingdomListingCard';

const RecruiterDashboard = lazy(() => import('../RecruiterDashboard'));

interface RecruiterModeContentProps {
  mode: BoardMode;
  user: { id: string } | null;
  linkedKingdom: number | null | undefined;
  isEditor: boolean;
  isMobile: boolean;
  newAppCount: number;
  pendingCoEditorCount: number;
  showRecruiterDash: boolean;
  onShowAuthGate: (type: 'login' | 'link') => void;
  onSetShowRecruiterDash: (show: boolean) => void;
  onEditorActivated: () => void;
  trackFeature: (name: string, props?: Record<string, string | number | boolean>) => void;
}

const RecruiterModeContent: React.FC<RecruiterModeContentProps> = ({
  mode,
  user,
  linkedKingdom,
  isEditor,
  isMobile,
  newAppCount,
  pendingCoEditorCount,
  showRecruiterDash,
  onShowAuthGate,
  onSetShowRecruiterDash,
  onEditorActivated,
  trackFeature,
}) => {
  const { t } = useTranslation();

  if (mode !== 'recruiting') return null;

  return (
    <>
      {/* Recruiter Mode: Sign-in prompt for guests */}
      {!user && (
        <div style={{
          textAlign: 'center',
          padding: '2rem 1rem',
          backgroundColor: '#111111',
          borderRadius: '12px',
          border: '1px solid #2a2a2a',
          marginBottom: '1rem',
        }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.75rem' }}>👑</span>
          <p style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.3rem' }}>
            {t('transferHub.signInToRecruit', 'Sign In to Recruit')}
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1rem', maxWidth: '400px', margin: '0 auto 1rem' }}>
            {t('transferHub.signInRecruitDesc', 'Sign in and link your Kingshot account to claim your kingdom, set up your listing, and review transfer applications.')}
          </p>
          <button
            onClick={() => onShowAuthGate('login')}
            style={{
              display: 'inline-block',
              padding: '0.6rem 1.5rem',
              backgroundColor: '#a855f7',
              color: '#fff',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '0.85rem',
              border: 'none',
              cursor: 'pointer',
              minHeight: '44px',
              lineHeight: '44px',
            }}>
            {t('common.signIn', 'Sign In')}
          </button>
        </div>
      )}

      {/* Recruiter Mode: No linked kingdom empty state */}
      {user && !linkedKingdom && (
        <div style={{
          textAlign: 'center',
          padding: '2rem 1rem',
          backgroundColor: '#111111',
          borderRadius: '12px',
          border: '1px solid #2a2a2a',
          marginBottom: '1rem',
        }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.75rem' }}>🏰</span>
          <p style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.3rem' }}>
            {t('transferHub.linkAccount', 'Link Your Kingshot Account')}
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1rem', maxWidth: '400px', margin: '0 auto 1rem' }}>
            {t('transferHub.linkAccountDesc', 'To recruit for your kingdom, you need to link your in-game account first. This tells us which kingdom you represent.')}
          </p>
          <Link to="/profile" style={{
            display: 'inline-block',
            padding: '0.6rem 1.5rem',
            backgroundColor: '#a855f7',
            color: '#fff',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '0.85rem',
            textDecoration: 'none',
            minHeight: '44px',
            lineHeight: '44px',
          }}>
            {t('transferHub.goToProfile', 'Go to Profile')}
          </Link>
        </div>
      )}

      {/* Recruiter Mode: Editor Claiming + Dashboard Access */}
      {user && linkedKingdom && (
        <div style={{
          marginBottom: '1rem',
          display: 'grid',
          gridTemplateColumns: isEditor ? '1fr 1fr' : '1fr',
          gap: '0.75rem',
          maxWidth: isMobile ? '100%' : '500px',
          margin: '0 auto 1rem',
        }}>
          <EditorClaiming onEditorActivated={onEditorActivated} />
          {isEditor && (
            <button
              onClick={() => {
                trackFeature('Recruiter Dashboard Open');
                onSetShowRecruiterDash(true);
                // Track weekly streak
                const now = new Date();
                const weekKey = `${now.getFullYear()}-W${Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7)}`;
                const streakData = JSON.parse(localStorage.getItem('atlas_editor_streak') || '{"weeks":[],"current":0}');
                if (!streakData.weeks.includes(weekKey)) {
                  streakData.weeks.push(weekKey);
                  // Calculate current streak
                  const sorted = streakData.weeks.sort().reverse();
                  let streak = 1;
                  for (let i = 1; i < sorted.length; i++) {
                    const [y1, w1] = sorted[i - 1].split('-W').map(Number);
                    const [y2, w2] = sorted[i].split('-W').map(Number);
                    if ((y1 === y2 && w1 - w2 === 1) || (y1 - y2 === 1 && w2 === 52 && w1 === 1)) {
                      streak++;
                    } else break;
                  }
                  streakData.current = streak;
                  localStorage.setItem('atlas_editor_streak', JSON.stringify(streakData));
                }
              }}
              style={{
                padding: '0.6rem 1rem',
                backgroundColor: '#a855f710',
                border: '1px solid #a855f730',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                minHeight: '44px',
                position: 'relative',
              }}
            >
              <span style={{ color: '#a855f7', fontSize: '0.75rem', fontWeight: '600' }}>
                {t('transferHub.recruiterDashboard', 'Recruiter Dashboard')}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{
                  padding: '0.15rem 0.6rem',
                  backgroundColor: '#a855f720',
                  border: '1px solid #a855f740',
                  borderRadius: '6px',
                  fontSize: '0.6rem',
                  color: '#a855f7',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}>
                  {t('transferHub.open', 'Open')}
                </span>
                {(() => {
                  const streakData = JSON.parse(localStorage.getItem('atlas_editor_streak') || '{"weeks":[],"current":0}');
                  return streakData.current >= 2 ? (
                    <span style={{
                      padding: '0.1rem 0.35rem',
                      backgroundColor: '#f9731615',
                      border: '1px solid #f9731630',
                      borderRadius: '4px',
                      fontSize: '0.55rem',
                      color: '#f97316',
                      fontWeight: '700',
                    }}>
                      🔥 {streakData.current}w
                    </span>
                  ) : null;
                })()}
              </div>
              {(newAppCount > 0 || pendingCoEditorCount > 0) && (
                <div style={{ position: 'absolute', top: '-4px', right: '-4px', display: 'flex', gap: '0.2rem' }}>
                  {newAppCount > 0 && (
                    <span style={{
                      backgroundColor: '#ef4444',
                      color: '#fff',
                      fontSize: '0.6rem',
                      fontWeight: '700',
                      borderRadius: '999px',
                      padding: '0.1rem 0.35rem',
                      minWidth: '16px',
                      textAlign: 'center',
                      lineHeight: '1.2',
                      boxShadow: '0 2px 6px rgba(239,68,68,0.4)',
                    }}>
                      {newAppCount > 9 ? '9+' : newAppCount}
                    </span>
                  )}
                  {pendingCoEditorCount > 0 && (
                    <span style={{
                      backgroundColor: '#a855f7',
                      color: '#fff',
                      fontSize: '0.6rem',
                      fontWeight: '700',
                      borderRadius: '999px',
                      padding: '0.1rem 0.35rem',
                      minWidth: '16px',
                      textAlign: 'center',
                      lineHeight: '1.2',
                      boxShadow: '0 2px 6px rgba(168,85,247,0.4)',
                    }}>
                      {pendingCoEditorCount > 9 ? '9+' : pendingCoEditorCount}
                    </span>
                  )}
                </div>
              )}
            </button>
          )}
        </div>
      )}

      {/* Recruiter Dashboard Modal */}
      {showRecruiterDash && (
        <ErrorBoundary
          fallback={<TransferHubErrorFallback section="Recruiter Dashboard" onRetry={() => { onSetShowRecruiterDash(false); setTimeout(() => onSetShowRecruiterDash(true), 100); }} />}
          context={{ section: 'RecruiterDashboard', mode }}
        >
          <Suspense fallback={<div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>Loading...</div>}>
            <RecruiterDashboard onClose={() => onSetShowRecruiterDash(false)} />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
};

export default RecruiterModeContent;
