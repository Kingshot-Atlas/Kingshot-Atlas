import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KVKRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { contributorService } from '../services/contributorService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

interface ReportKvKErrorModalProps {
  kingdomNumber: number;
  kvkRecords: KVKRecord[];
  isOpen: boolean;
  onClose: () => void;
}

const ERROR_TYPE_KEYS = [
  { key: 'wrong_opponent', i18nKey: 'wrongOpponent' },
  { key: 'wrong_prep_result', i18nKey: 'wrongPrep' },
  { key: 'wrong_battle_result', i18nKey: 'wrongBattle' },
  { key: 'wrong_both_results', i18nKey: 'wrongBoth' },
  { key: 'missing_kvk', i18nKey: 'missingKvk' },
  { key: 'duplicate_kvk', i18nKey: 'duplicateEntry' },
  { key: 'other', i18nKey: 'otherError' },
];

const ReportKvKErrorModal: React.FC<ReportKvKErrorModalProps> = ({ 
  kingdomNumber, 
  kvkRecords, 
  isOpen, 
  onClose 
}) => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [selectedKvK, setSelectedKvK] = useState<number | null>(null);
  const [errorType, setErrorType] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const sortedKvKs = [...kvkRecords].sort((a, b) => b.kvk_number - a.kvk_number);
  const selectedKvKRecord = sortedKvKs.find(k => k.kvk_number === selectedKvK);

  const handleSubmit = async () => {
    // Must be authenticated to submit (RLS requires submitted_by = auth.uid())
    if (!user?.id) {
      showToast(t('reportKvkError.signInRequired'), 'error');
      return;
    }

    if (!errorType) {
      showToast(t('reportKvkError.selectErrorTypeError'), 'error');
      return;
    }

    if (errorType !== 'missing_kvk' && !selectedKvK) {
      showToast(t('reportKvkError.selectKvkError'), 'error');
      return;
    }

    if (!description.trim()) {
      showToast(t('reportKvkError.describeError'), 'error');
      return;
    }

    setSubmitting(true);
    try {
      // B4: Check for duplicate
      const duplicate = await contributorService.checkDuplicate('kvkError', {
        kingdom_number: kingdomNumber,
        kvk_number: selectedKvK,
        error_type: errorType
      });
      if (duplicate.isDuplicate) {
        showToast(t('reportKvkError.duplicateError'), 'error');
        setSubmitting(false);
        return;
      }

      // Store in Supabase - single source of truth (ADR-010)
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Database unavailable');
      }

      const { error } = await supabase
        .from('kvk_errors')
        .insert({
          kingdom_number: kingdomNumber,
          kvk_number: selectedKvK,
          error_type: errorType,
          error_type_label: ERROR_TYPE_KEYS.find(e => e.key === errorType)?.i18nKey ? t(`reportKvkError.${ERROR_TYPE_KEYS.find(e => e.key === errorType)!.i18nKey}`) : errorType,
          current_data: selectedKvKRecord ? {
            opponent: selectedKvKRecord.opponent_kingdom,
            prep_result: selectedKvKRecord.prep_result,
            battle_result: selectedKvKRecord.battle_result
          } : null,
          description,
          submitted_by: user?.id,
          submitted_by_name: profile?.username || 'Anonymous',
          status: 'pending'
        });

      if (error) {
        logger.error('Failed to submit KvK error:', error.message, error.code, error.details, error.hint);
        throw new Error(`Failed to submit: ${error.message}`);
      }

      // B3: Track submission for contributor stats
      if (user?.id) {
        contributorService.trackNewSubmission(user.id, profile?.username || 'Anonymous', 'kvkError');
      }

      showToast(t('reportKvkError.successToast'), 'success');
      onClose();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('KvK error submission failed:', errorMessage, err);
      showToast(t('reportKvkError.failedToast'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#131318',
          borderRadius: '16px',
          border: '1px solid #2a2a2a',
          padding: '1.5rem',
          maxWidth: '450px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🚩</span> {t('reportKvkError.title')}
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              Kingdom {kingdomNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              fontSize: '1.5rem',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Select KvK */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            {t('reportKvkError.whichKvk')}
          </label>
          <select
            value={selectedKvK || ''}
            onChange={(e) => setSelectedKvK(e.target.value ? parseInt(e.target.value) : null)}
            style={{
              width: '100%',
              padding: '0.65rem',
              backgroundColor: '#0a0a0a',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.85rem'
            }}
          >
            <option value="">{t('reportKvkError.selectKvk')}</option>
            {sortedKvKs.map(kvk => (
              <option key={kvk.kvk_number} value={kvk.kvk_number}>
                KvK #{kvk.kvk_number} vs Kingdom {kvk.opponent_kingdom} 
                ({kvk.prep_result === 'Win' || kvk.prep_result === 'W' ? 'W' : 'L'}/
                {kvk.battle_result === 'Win' || kvk.battle_result === 'W' ? 'W' : 'L'})
              </option>
            ))}
          </select>
        </div>

        {/* Show current data if KvK selected */}
        {selectedKvKRecord && (
          <div style={{ 
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#0a0a0a',
            borderRadius: '8px',
            border: '1px solid #1f1f1f'
          }}>
            <div style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: '0.5rem' }}>{t('reportKvkError.currentData')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.8rem' }}>
              <div>
                <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>{t('reportKvkError.opponent')}</div>
                <div style={{ color: '#22d3ee' }}>K{selectedKvKRecord.opponent_kingdom}</div>
              </div>
              <div>
                <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>{t('reportKvkError.prep')}</div>
                <div style={{ color: selectedKvKRecord.prep_result === 'Win' || selectedKvKRecord.prep_result === 'W' ? '#22c55e' : '#ef4444' }}>
                  {selectedKvKRecord.prep_result === 'Win' || selectedKvKRecord.prep_result === 'W' ? t('reportKvkError.win') : t('reportKvkError.loss')}
                </div>
              </div>
              <div>
                <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>{t('reportKvkError.battle')}</div>
                <div style={{ color: selectedKvKRecord.battle_result === 'Win' || selectedKvKRecord.battle_result === 'W' ? '#22c55e' : '#ef4444' }}>
                  {selectedKvKRecord.battle_result === 'Win' || selectedKvKRecord.battle_result === 'W' ? t('reportKvkError.win') : t('reportKvkError.loss')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Type */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            {t('reportKvkError.whatsWrong')}
          </label>
          <select
            value={errorType}
            onChange={(e) => setErrorType(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem',
              backgroundColor: '#0a0a0a',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.85rem'
            }}
          >
            <option value="">{t('reportKvkError.selectErrorType')}</option>
            {ERROR_TYPE_KEYS.map(et => (
              <option key={et.key} value={et.key}>{t(`reportKvkError.${et.i18nKey}`)}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            {t('reportKvkError.describeCorrect')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('reportKvkError.descPlaceholder')}
            rows={3}
            style={{
              width: '100%',
              padding: '0.65rem',
              backgroundColor: '#0a0a0a',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.85rem',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Notice */}
        <div style={{
          padding: '0.65rem',
          backgroundColor: '#22d3ee10',
          border: '1px solid #22d3ee30',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          <div style={{ color: '#22d3ee', fontSize: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <span>ℹ️</span>
            <span>{t('reportKvkError.reviewNotice')}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.6rem 1rem',
              backgroundColor: 'transparent',
              border: '1px solid #3a3a3a',
              borderRadius: '8px',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            {t('reportKvkError.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !errorType || !description.trim()}
            style={{
              padding: '0.6rem 1rem',
              backgroundColor: errorType && description.trim() ? '#ef4444' : '#1a1a1a',
              border: 'none',
              borderRadius: '8px',
              color: errorType && description.trim() ? '#fff' : '#6b7280',
              cursor: errorType && description.trim() ? 'pointer' : 'not-allowed',
              fontSize: '0.85rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {submitting && <span className="loading-spinner" style={{ width: '14px', height: '14px' }} />}
            🚩 {t('reportKvkError.submitReport')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportKvKErrorModal;
