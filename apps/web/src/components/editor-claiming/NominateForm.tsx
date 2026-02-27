import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { supabase } from '../../lib/supabase';
import { FONT_DISPLAY } from '../../utils/styles';

const NominateForm: React.FC<{
  onNominated: () => void;
  onCancel: () => void;
}> = ({ onNominated, onCancel }) => {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkedKingdom = profile?.linked_kingdom;
  const linkedTcLevel = profile?.linked_tc_level;
  const isLinked = !!profile?.linked_player_id;
  const meetsTcReq = (linkedTcLevel || 0) >= 20;

  const canNominate = isLinked && meetsTcReq && linkedKingdom;

  const handleNominate = async () => {
    if (!supabase || !user || !linkedKingdom || !canNominate) return;

    setSubmitting(true);
    setError(null);

    try {
      // Check for existing claim
      const { data: existingClaim } = await supabase
        .from('kingdom_editors')
        .select('id, status')
        .eq('kingdom_number', linkedKingdom)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingClaim) {
        setError('You already have an editor claim for this kingdom.');
        return;
      }

      // Check if kingdom already has an active editor
      const { data: activeEditor } = await supabase
        .from('kingdom_editors')
        .select('id')
        .eq('kingdom_number', linkedKingdom)
        .eq('status', 'active')
        .eq('role', 'editor')
        .maybeSingle();

      if (activeEditor) {
        setError('This kingdom already has an active primary editor.');
        return;
      }

      // Create nomination
      const { error: insertError } = await supabase
        .from('kingdom_editors')
        .insert({
          kingdom_number: linkedKingdom,
          user_id: user.id,
          role: 'editor',
          status: 'pending',
          endorsement_count: 0,
          required_endorsements: 10,
        });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      onNominated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit nomination';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      backgroundColor: '#111111',
      border: '1px solid #2a2a2a',
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
    }}>
      <h3 style={{
        fontFamily: FONT_DISPLAY,
        fontSize: '1rem',
        color: '#fff',
        margin: '0 0 0.75rem 0',
      }}>
        {t('editor.claimYourKingdom', 'Claim Your Kingdom')}
      </h3>

      <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
        {t('editor.becomeEditorDesc', "Become the editor for your kingdom's Transfer Hub listing. As editor, you control recruitment settings, review applications, and manage your kingdom's public profile.")}
      </p>

      {/* Requirements Checklist */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '0.5rem',
        marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: isLinked ? '#22c55e' : '#ef4444', fontSize: '0.8rem' }}>
            {isLinked ? '✓' : '✗'}
          </span>
          <span style={{ color: isLinked ? '#d1d5db' : '#6b7280', fontSize: '0.8rem' }}>
            {t('editor.linkedAccount', 'Linked Kingshot account')} {linkedKingdom ? `(${t('editor.kingdom', 'Kingdom')} ${linkedKingdom})` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: meetsTcReq ? '#22c55e' : '#ef4444', fontSize: '0.8rem' }}>
            {meetsTcReq ? '✓' : '✗'}
          </span>
          <span style={{ color: meetsTcReq ? '#d1d5db' : '#6b7280', fontSize: '0.8rem' }}>
            {t('editor.tcLevel20', 'TC Level 20+')} {linkedTcLevel ? `(${t('editor.currently', 'currently')} TC${linkedTcLevel})` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>○</span>
          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
            {t('editor.endorsementsRequired', '10 endorsements from TC20+ kingdom members (after nomination)')}
          </span>
        </div>
      </div>

      {!isLinked && (
        <div style={{
          padding: '0.75rem',
          backgroundColor: '#f59e0b10',
          border: '1px solid #f59e0b25',
          borderRadius: '8px',
          marginBottom: '0.75rem',
        }}>
          <p style={{ color: '#f59e0b', fontSize: '0.8rem', margin: 0 }}>
            {t('editor.linkAccountFirst', 'Link your Kingshot account first. Go to your Profile page and use the "Link Kingshot Account" section.')}
          </p>
        </div>
      )}

      {error && (
        <div style={{
          padding: '0.6rem 0.75rem',
          backgroundColor: '#ef444415',
          border: '1px solid #ef444440',
          borderRadius: '8px',
          color: '#ef4444',
          fontSize: '0.8rem',
          marginBottom: '0.75rem',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'transparent',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            color: '#9ca3af',
            fontSize: '0.8rem',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          {t('editor.cancel', 'Cancel')}
        </button>
        <button
          onClick={handleNominate}
          disabled={!canNominate || submitting}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: canNominate && !submitting ? '#22d3ee' : '#22d3ee30',
            border: 'none',
            borderRadius: '8px',
            color: canNominate && !submitting ? '#000' : '#6b7280',
            fontSize: '0.8rem',
            fontWeight: '600',
            cursor: canNominate && !submitting ? 'pointer' : 'not-allowed',
            minHeight: '44px',
          }}
        >
          {submitting ? t('editor.submitting', 'Submitting...') : t('editor.nominateMyself', 'Nominate Myself')}
        </button>
      </div>
    </div>
  );
};

export default NominateForm;
