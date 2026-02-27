import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { FONT_DISPLAY } from '../../utils/styles';
import { EndorseButton } from '../EditorClaiming';

interface EndorseClaimData {
  id: string;
  kingdom_number: number;
  status: string;
  endorsement_count: number;
  required_endorsements: number;
  nominee_username: string;
  nominee_linked_username: string | null;
}

interface EndorsementOverlayProps {
  endorseClaimId: string;
  endorseClaimData: EndorseClaimData | null;
  endorseLoading: boolean;
  user: { id: string } | null;
  linkedPlayerId: string | null | undefined;
  onClose: () => void;
  onEndorsed: () => void;
}

const EndorsementOverlay: React.FC<EndorsementOverlayProps> = ({
  endorseClaimId,
  endorseClaimData,
  endorseLoading,
  user,
  linkedPlayerId,
  onClose,
  onEndorsed,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const handleClose = () => {
    onClose();
    // Clean URL
    const params = new URLSearchParams(window.location.search);
    params.delete('endorse');
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
        zIndex: 1100, padding: isMobile ? 0 : '1rem',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: '#111111', border: '1px solid #22c55e30',
          borderRadius: isMobile ? '16px 16px 0 0' : '16px',
          padding: isMobile ? '1.5rem 1.25rem' : '2rem',
          maxWidth: '480px', width: '100%',
          paddingBottom: isMobile ? 'max(1.5rem, env(safe-area-inset-bottom))' : '2rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {endorseLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>{t('transferHub.loadingEndorsement', 'Loading endorsement details...')}</div>
          </div>
        ) : !endorseClaimData ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{
              width: '50px', height: '50px', borderRadius: '50%',
              backgroundColor: '#ef444415', border: '2px solid #ef444430',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem', fontSize: '1.3rem',
            }}>✗</div>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: '1.1rem', color: '#fff', margin: '0 0 0.5rem 0' }}>
              {t('transferHub.endorsementNotFound', 'Endorsement Not Found')}
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
              {t('transferHub.endorsementInvalid', 'This endorsement link may be invalid or expired.')}
            </p>
            <button
              onClick={handleClose}
              style={{
                padding: '0.6rem 1.5rem', backgroundColor: '#22d3ee15',
                border: '1px solid #22d3ee40', borderRadius: '8px',
                color: '#22d3ee', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer',
                minHeight: '44px',
              }}
            >{t('transferHub.continueToHub', 'Continue to Transfer Hub')}</button>
          </div>
        ) : endorseClaimData.status !== 'pending' ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{
              width: '50px', height: '50px', borderRadius: '50%',
              backgroundColor: endorseClaimData.status === 'active' ? '#22c55e15' : endorseClaimData.status === 'cancelled' ? '#ef444415' : '#6b728015',
              border: `2px solid ${endorseClaimData.status === 'active' ? '#22c55e30' : endorseClaimData.status === 'cancelled' ? '#ef444430' : '#6b728030'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem', fontSize: '1.3rem',
            }}>{endorseClaimData.status === 'active' ? '✓' : endorseClaimData.status === 'cancelled' ? '🚫' : '—'}</div>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: '1.1rem', color: '#fff', margin: '0 0 0.5rem 0' }}>
              {endorseClaimData.status === 'active'
                ? t('transferHub.alreadyActivated', 'Already Activated!')
                : endorseClaimData.status === 'cancelled'
                  ? t('transferHub.nominationCancelled', 'Nomination Cancelled')
                  : t('transferHub.claimNoLongerActive', 'Claim No Longer Active')}
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
              {endorseClaimData.status === 'active'
                ? t('transferHub.nowEditor', '{{name}} is now the editor of Kingdom {{num}}.', { name: endorseClaimData.nominee_linked_username || endorseClaimData.nominee_username, num: endorseClaimData.kingdom_number })
                : endorseClaimData.status === 'cancelled'
                  ? t('transferHub.nominationCancelledDesc', 'Another user was endorsed as editor for Kingdom {{num}}. This nomination is no longer active.', { num: endorseClaimData.kingdom_number })
                  : t('transferHub.noLongerAccepting', 'This editor claim is no longer accepting endorsements.')}
            </p>
            <button
              onClick={handleClose}
              style={{
                padding: '0.6rem 1.5rem', backgroundColor: '#22d3ee15',
                border: '1px solid #22d3ee40', borderRadius: '8px',
                color: '#22d3ee', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer',
                minHeight: '44px',
              }}
            >{t('transferHub.continueToHub', 'Continue to Transfer Hub')}</button>
          </div>
        ) : !user ? (
          /* Not logged in — prompt to sign in */
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{
              width: '50px', height: '50px', borderRadius: '50%',
              backgroundColor: '#a855f715', border: '2px solid #a855f730',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem', fontSize: '1.3rem',
            }}>🗳️</div>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: '1.1rem', color: '#fff', margin: '0 0 0.5rem 0' }}>
              Endorse {endorseClaimData.nominee_linked_username || endorseClaimData.nominee_username}
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0 0 0.5rem 0', lineHeight: 1.5 }}>
              <span style={{ color: '#a855f7', fontWeight: 600 }}>{endorseClaimData.nominee_linked_username || endorseClaimData.nominee_username}</span> is claiming
              Kingdom <strong style={{ color: '#22d3ee' }}>{endorseClaimData.kingdom_number}</strong> and needs endorsements from kingdom members.
            </p>
            <div style={{
              padding: '0.5rem 0.75rem', backgroundColor: '#0a0a0a',
              borderRadius: '8px', border: '1px solid #2a2a2a',
              marginBottom: '1rem', fontSize: '0.8rem', color: '#6b7280',
            }}>
              {endorseClaimData.endorsement_count}/{endorseClaimData.required_endorsements} endorsements
            </div>
            <p style={{ color: '#f59e0b', fontSize: '0.8rem', margin: '0 0 1rem 0' }}>
              {t('transferHub.signInToEndorse', 'Sign in to endorse this candidate.')}
            </p>
            <Link
              to="/profile"
              onClick={() => {
                if (endorseClaimId) localStorage.setItem('atlas_pending_endorsement', endorseClaimId);
              }}
              style={{
                display: 'inline-block', padding: '0.6rem 1.5rem',
                backgroundColor: '#a855f7', color: '#fff', borderRadius: '8px',
                fontWeight: '600', fontSize: '0.85rem', textDecoration: 'none',
                minHeight: '44px', lineHeight: '44px',
              }}
            >{t('transferHub.signInToEndorseBtn', 'Sign In to Endorse')}</Link>
            <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.75rem 0 0 0', lineHeight: 1.4 }}>
              {t('transferHub.afterSignIn', 'After signing in, return to the Transfer Hub to complete your endorsement.')}
            </p>
          </div>
        ) : !linkedPlayerId ? (
          /* Logged in but not linked — prompt to link */
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{
              width: '50px', height: '50px', borderRadius: '50%',
              backgroundColor: '#f59e0b15', border: '2px solid #f59e0b30',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem', fontSize: '1.3rem',
            }}>🔗</div>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: '1.1rem', color: '#fff', margin: '0 0 0.5rem 0' }}>
              Link Your Kingshot Account
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0 0 0.5rem 0', lineHeight: 1.5 }}>
              To endorse <span style={{ color: '#a855f7', fontWeight: 600 }}>{endorseClaimData.nominee_linked_username || endorseClaimData.nominee_username}</span> for
              Kingdom <strong style={{ color: '#22d3ee' }}>{endorseClaimData.kingdom_number}</strong>, you need to link your in-game account first.
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0 0 1rem 0' }}>
              {t('transferHub.verifiesKingdom', 'This verifies which kingdom you belong to and your TC level.')}
            </p>
            <Link
              to="/profile"
              onClick={() => {
                if (endorseClaimId) localStorage.setItem('atlas_pending_endorsement', endorseClaimId);
              }}
              style={{
                display: 'inline-block', padding: '0.6rem 1.5rem',
                backgroundColor: '#f59e0b', color: '#000', borderRadius: '8px',
                fontWeight: '600', fontSize: '0.85rem', textDecoration: 'none',
                minHeight: '44px', lineHeight: '44px',
              }}
            >{t('transferHub.linkAccountBtn', 'Link Account')}</Link>
            <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.75rem 0 0 0', lineHeight: 1.4 }}>
              {t('transferHub.afterLinking', 'After linking, return to the Transfer Hub to complete your endorsement.')}
            </p>
          </div>
        ) : (
          /* Logged in and linked — show the EndorseButton */
          <div style={{ padding: '0.5rem 0' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{
                width: '50px', height: '50px', borderRadius: '50%',
                backgroundColor: '#22c55e15', border: '2px solid #22c55e30',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 0.75rem', fontSize: '1.3rem',
              }}>🗳️</div>
              <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: '1.1rem', color: '#fff', margin: '0 0 0.25rem 0' }}>
                Endorse for K{endorseClaimData.kingdom_number}
              </h2>
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0 0 0.5rem 0' }}>
                <span style={{ color: '#a855f7', fontWeight: 600 }}>{endorseClaimData.nominee_linked_username || endorseClaimData.nominee_username}</span> needs
                {' '}{endorseClaimData.required_endorsements - endorseClaimData.endorsement_count} more endorsement{endorseClaimData.required_endorsements - endorseClaimData.endorsement_count !== 1 ? 's' : ''}
              </p>
            </div>
            <EndorseButton
              claimId={endorseClaimData.id}
              kingdomNumber={endorseClaimData.kingdom_number}
              nomineeName={endorseClaimData.nominee_linked_username || endorseClaimData.nominee_username}
              onEndorsed={onEndorsed}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default EndorsementOverlay;
