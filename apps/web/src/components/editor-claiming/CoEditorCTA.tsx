import React from 'react';
import { useTranslation } from 'react-i18next';

const MAX_CO_EDITORS_PER_KINGDOM = 5;

interface CoEditorCTAProps {
  hasActiveEditor: boolean;
  linkedKingdom: number | undefined;
  isMobile: boolean;
  canBeCoEditor: boolean;
  isLinked: boolean;
  meetsTcReq: boolean;
  submittingCoEditor: boolean;
  coEditorCount: number;
  coEditorError: string | null;
  handleBecomeCoEditor: () => void;
  setShowNominate: (v: boolean) => void;
}

const CoEditorCTA: React.FC<CoEditorCTAProps> = ({
  hasActiveEditor, linkedKingdom, isMobile,
  canBeCoEditor, isLinked, meetsTcReq,
  submittingCoEditor, coEditorCount, coEditorError,
  handleBecomeCoEditor, setShowNominate,
}) => {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Primary CTA: Become Editor */}
      {!hasActiveEditor && (
        <div style={{
          backgroundColor: '#a855f708',
          border: '1px solid #a855f725',
          borderRadius: '12px',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}>
          <div>
            <span style={{ color: '#a855f7', fontWeight: '600', fontSize: '0.85rem' }}>
              {t('editor.becomeEditor', 'Become a Kingdom Editor')}
            </span>
            <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.2rem 0 0 0' }}>
              {linkedKingdom
                ? t('editor.claimKingdomDesc', 'Claim Kingdom {{kingdom}} to manage its recruitment listing.', { kingdom: linkedKingdom })
                : t('editor.linkFirst', 'Link your Kingshot account first, then claim your kingdom.')}
            </p>
          </div>
          <button
            onClick={() => setShowNominate(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#a855f7',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              minHeight: '44px',
            }}
          >
            {t('editor.claimKingdom', 'Claim Kingdom')}
          </button>
        </div>
      )}

      {/* Co-Editor CTA: When kingdom already has an active editor */}
      {hasActiveEditor && linkedKingdom && (
        <div style={{
          backgroundColor: '#a855f708',
          border: '1px solid #a855f725',
          borderRadius: '12px',
          padding: '0.75rem 1rem',
        }}>
          <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: '0.75rem', flexDirection: isMobile ? 'column' : 'row' }}>
            <div>
              <span style={{ color: '#a855f7', fontWeight: '600', fontSize: '0.85rem' }}>
                {t('editor.becomeCoEditor', 'Become a Co-Editor')}
              </span>
              <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.2rem 0 0 0' }}>
                {t('editor.becomeCoEditorDesc', 'Kingdom {{kingdom}} already has an editor. Join as a co-editor to help manage the Transfer Hub listing.', { kingdom: linkedKingdom })}
                {coEditorCount > 0 && (
                  <span style={{ color: '#a855f7' }}> {t('editor.coEditorSlotsUsed', '({{count}}/{{max}} co-editor slots used)', { count: coEditorCount, max: MAX_CO_EDITORS_PER_KINGDOM })}</span>
                )}
              </p>
              <p style={{ color: '#4b5563', fontSize: '0.65rem', margin: '0.2rem 0 0 0' }}>
                {t('editor.noEndorsementsRequired', 'No endorsements required. The editor will be notified of your request.')}
              </p>
            </div>
            <button
              onClick={handleBecomeCoEditor}
              disabled={!canBeCoEditor || submittingCoEditor}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: canBeCoEditor && !submittingCoEditor ? '#a855f7' : '#a855f730',
                border: 'none',
                borderRadius: '8px',
                color: canBeCoEditor && !submittingCoEditor ? '#fff' : '#6b7280',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: canBeCoEditor && !submittingCoEditor ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
                minHeight: '44px',
                flexShrink: 0,
                width: isMobile ? '100%' : 'auto',
              }}
            >
              {submittingCoEditor ? t('editor.requesting', 'Requesting...') : t('editor.requestCoEditor', 'Request Co-Editor')}
            </button>
          </div>

          {coEditorError && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.4rem 0.6rem',
              backgroundColor: '#ef444415',
              border: '1px solid #ef444440',
              borderRadius: '6px',
              color: '#ef4444',
              fontSize: '0.75rem',
            }}>
              {coEditorError}
            </div>
          )}

          {!isLinked && (
            <p style={{ color: '#f59e0b', fontSize: '0.7rem', margin: '0.4rem 0 0 0' }}>
              {t('editor.linkAccountCoEditor', 'Link your Kingshot account first to become a co-editor.')}
            </p>
          )}
          {isLinked && !meetsTcReq && (
            <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.4rem 0 0 0' }}>
              {t('editor.tcRequiredCoEditor', 'TC Level 20+ required to become a co-editor.')}
            </p>
          )}
          {coEditorCount >= MAX_CO_EDITORS_PER_KINGDOM && (
            <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.4rem 0 0 0' }}>
              {t('editor.maxCoEditors', 'This kingdom has reached the maximum of {{max}} co-editors.', { max: MAX_CO_EDITORS_PER_KINGDOM })}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CoEditorCTA;
