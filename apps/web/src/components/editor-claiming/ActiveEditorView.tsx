import React from 'react';
import { useTranslation } from 'react-i18next';
import type { EditorClaim } from './types';

interface ActiveEditorViewProps {
  myClaim: EditorClaim;
  linkedKingdom: number | undefined;
  kingdomMismatch: boolean;
  showStepDown: boolean;
  setShowStepDown: (v: boolean) => void;
  handleStepDown: () => void;
  steppingDown: boolean;
}

const ActiveEditorView: React.FC<ActiveEditorViewProps> = ({
  myClaim, linkedKingdom, kingdomMismatch,
  showStepDown, setShowStepDown, handleStepDown, steppingDown,
}) => {
  const { t } = useTranslation();

  return (
    <div style={{
      backgroundColor: kingdomMismatch ? '#f9731608' : '#22c55e08',
      border: `1px solid ${kingdomMismatch ? '#f9731625' : '#22c55e25'}`,
      borderRadius: '10px',
      padding: '0.6rem 0.75rem',
      height: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Kingdom mismatch warning */}
      {kingdomMismatch && (
        <div style={{
          backgroundColor: '#f9731610',
          border: '1px solid #f9731630',
          borderRadius: '6px',
          padding: '0.4rem 0.6rem',
          marginBottom: '0.4rem',
          textAlign: 'center',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          <p style={{ color: '#f97316', fontSize: '0.65rem', margin: 0, lineHeight: 1.3 }}>
            {t('editor.kingdomMismatch', "You're linked to Kingdom {{linked}} but still editor of Kingdom {{editor}}. Consider stepping down.", { linked: linkedKingdom, editor: myClaim.kingdom_number })}
          </p>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ color: '#22c55e', fontWeight: '600', fontSize: '0.85rem' }}>
          Kingdom {myClaim.kingdom_number}
        </span>
        <span style={{
          padding: '0.1rem 0.4rem',
          backgroundColor: '#22c55e15',
          border: '1px solid #22c55e30',
          borderRadius: '4px',
          fontSize: '0.55rem',
          color: '#22c55e',
          fontWeight: 'bold',
          textTransform: 'uppercase',
        }}>
          {myClaim.role}
        </span>
      </div>
      <p style={{ color: '#6b7280', fontSize: '0.65rem', margin: '0.15rem 0 0 0', lineHeight: 1.3, textAlign: 'center' }}>
        {t('editor.youManage', "You manage this kingdom's")} <br />{t('editor.transferHubListing', 'Transfer Hub listing.')}
      </p>
      {/* Step Down button */}
      {myClaim.role === 'editor' && (
        <div style={{ marginTop: '0.4rem', textAlign: 'center' }}>
          {showStepDown ? (
            <div style={{
              padding: '0.5rem',
              backgroundColor: '#ef444408',
              border: '1px solid #ef444420',
              borderRadius: '6px',
              marginTop: '0.2rem',
            }}>
              <p style={{ color: '#ef4444', fontSize: '0.65rem', margin: '0 0 0.3rem 0', lineHeight: 1.3 }}>
                {t('editor.stepDownConfirm', 'Step down as editor? If there are co-editors, the most senior one will be promoted automatically. Otherwise the kingdom becomes open for new claims.')}
              </p>
              <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                <button
                  onClick={handleStepDown}
                  disabled={steppingDown}
                  style={{
                    padding: '0.3rem 0.75rem', backgroundColor: '#ef4444',
                    border: 'none', borderRadius: '5px',
                    color: '#fff', fontSize: '0.65rem', fontWeight: '600',
                    cursor: steppingDown ? 'default' : 'pointer', minHeight: '32px',
                    opacity: steppingDown ? 0.5 : 1,
                  }}
                >
                  {steppingDown ? '...' : t('editor.confirmStepDown', 'Confirm Step Down')}
                </button>
                <button
                  onClick={() => setShowStepDown(false)}
                  style={{
                    padding: '0.3rem 0.75rem', backgroundColor: 'transparent',
                    border: '1px solid #333', borderRadius: '5px',
                    color: '#9ca3af', fontSize: '0.65rem', fontWeight: '600',
                    cursor: 'pointer', minHeight: '32px',
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowStepDown(true)}
              style={{
                padding: '0.2rem 0.5rem', backgroundColor: 'transparent',
                border: '1px solid #33333380', borderRadius: '4px',
                color: '#6b7280', fontSize: '0.55rem', fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              {t('editor.stepDown', 'Step Down')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ActiveEditorView;
