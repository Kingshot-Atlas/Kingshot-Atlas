import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const EndorseButton: React.FC<{
  claimId: string;
  kingdomNumber: number;
  nomineeName?: string;
  onEndorsed: () => void;
}> = ({ claimId, kingdomNumber, nomineeName, onEndorsed }) => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyEndorsed, setAlreadyEndorsed] = useState(false);

  const isLinked = !!profile?.linked_player_id;
  const linkedKingdom = profile?.linked_kingdom;
  const meetsTcReq = (profile?.linked_tc_level || 0) >= 20;
  const isSameKingdom = linkedKingdom === kingdomNumber;
  const canEndorse = isLinked && meetsTcReq && isSameKingdom && !alreadyEndorsed;

  const checkExisting = useCallback(async () => {
    if (!supabase || !user) return;
    const { data } = await supabase
      .from('editor_endorsements')
      .select('id')
      .eq('editor_claim_id', claimId)
      .eq('endorser_user_id', user.id)
      .maybeSingle();
    setAlreadyEndorsed(!!data);
  }, [user, claimId]);

  useEffect(() => {
    checkExisting();
  }, [checkExisting]);

  const handleEndorse = async () => {
    if (!supabase || !user || !canEndorse) return;
    setSubmitting(true);
    setError(null);

    try {
      // Atomic RPC: inserts endorsement + increments count in one transaction
      const { data, error: rpcError } = await supabase
        .rpc('submit_endorsement', {
          p_claim_id: claimId,
          p_endorser_user_id: user.id,
        });

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      const result = data as { success: boolean; error?: string; new_count?: number; activated?: boolean } | null;

      if (!result?.success) {
        setError(result?.error || 'Failed to endorse');
        return;
      }

      setAlreadyEndorsed(true);
      onEndorsed();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to endorse';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div style={{
      backgroundColor: '#111111',
      border: '1px solid #22c55e25',
      borderRadius: '10px',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.5rem',
      textAlign: 'center',
    }}>
      <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600' }}>
        {t('editor.endorse', 'Endorse')} {nomineeName ? <span style={{ color: '#a855f7' }}>{nomineeName}</span> : t('recruiter.editor', 'Editor')} {t('editor.forKingdom', 'for')} K{kingdomNumber}
      </span>
      {!isLinked && (
        <p style={{ color: '#f59e0b', fontSize: '0.7rem', margin: 0 }}>
          {t('editor.linkToEndorse', 'Link your Kingshot account first to endorse.')}
        </p>
      )}
      {isLinked && !isSameKingdom && (
        <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: 0 }}>
          {t('editor.onlyMembers', 'Only members of Kingdom {{kingdom}} with TC20+ can endorse.', { kingdom: kingdomNumber })}
        </p>
      )}
      {isLinked && isSameKingdom && !meetsTcReq && (
        <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: 0 }}>
          {t('editor.tcRequired', 'TC Level 20+ required to endorse.')}
        </p>
      )}

      {error && (
        <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>{error}</span>
      )}

      {alreadyEndorsed ? (
        <span style={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: '600' }}>
          {t('editor.endorsed', '✓ Endorsed')}
        </span>
      ) : (
        <button
          onClick={handleEndorse}
          disabled={!canEndorse || submitting}
          style={{
            padding: '0.5rem 1.5rem',
            backgroundColor: canEndorse && !submitting ? '#22c55e' : '#22c55e20',
            border: 'none',
            borderRadius: '8px',
            color: canEndorse && !submitting ? '#000' : '#6b7280',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: canEndorse && !submitting ? 'pointer' : 'not-allowed',
            minHeight: '44px',
            whiteSpace: 'nowrap',
          }}
        >
          {submitting ? t('editor.endorsing', 'Endorsing...') : t('editor.endorse', 'Endorse')}
        </button>
      )}
    </div>
  );
};

export default EndorseButton;
