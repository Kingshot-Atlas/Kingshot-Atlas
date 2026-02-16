import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Kingdom } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { contributorService } from '../services/contributorService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

interface ReportDataModalProps {
  kingdom: Kingdom;
  isOpen: boolean;
  onClose: () => void;
}

interface DataCorrection {
  field: string;
  currentValue: string;
  suggestedValue: string;
}

const CORRECTABLE_FIELDS = [
  { key: 'prep_wins', label: 'Prep Wins', type: 'number' },
  { key: 'prep_losses', label: 'Prep Losses', type: 'number' },
  { key: 'battle_wins', label: 'Battle Wins', type: 'number' },
  { key: 'battle_losses', label: 'Battle Losses', type: 'number' },
  { key: 'total_kvks', label: 'Total KvKs', type: 'number' },
  { key: 'most_recent_status', label: 'Transfer Status', type: 'select', options: ['Leading', 'Ordinary', 'Unannounced'] },
];

const ReportDataModal: React.FC<ReportDataModalProps> = ({ kingdom, isOpen, onClose }) => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [corrections, setCorrections] = useState<DataCorrection[]>([]);
  const [selectedField, setSelectedField] = useState('');
  const [suggestedValue, setSuggestedValue] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const getCurrentValue = (field: string): string => {
    const fieldKey = field as keyof Kingdom;
    const value = kingdom[fieldKey];
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return value;
    return 'N/A';
  };

  const handleAddCorrection = () => {
    if (!selectedField || !suggestedValue) return;
    
    const fieldConfig = CORRECTABLE_FIELDS.find(f => f.key === selectedField);
    if (!fieldConfig) return;

    const currentValue = getCurrentValue(selectedField);
    if (currentValue === suggestedValue) {
      showToast(t('reportData.sameValue'), 'error');
      return;
    }

    setCorrections([...corrections, {
      field: fieldConfig.label,
      currentValue,
      suggestedValue
    }]);
    setSelectedField('');
    setSuggestedValue('');
  };

  const handleRemoveCorrection = (index: number) => {
    setCorrections(corrections.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (corrections.length === 0) {
      showToast(t('reportData.addAtLeastOne'), 'error');
      return;
    }

    setSubmitting(true);
    try {
      // B4: Check for duplicates
      for (const c of corrections) {
        const duplicate = await contributorService.checkDuplicate('correction', {
          kingdom_number: kingdom.kingdom_number,
          field: c.field,
          suggested_value: c.suggestedValue
        });
        if (duplicate.isDuplicate) {
          showToast(t('reportData.duplicatePending', { field: c.field }), 'error');
          setSubmitting(false);
          return;
        }
      }

      // Store in Supabase - single source of truth (ADR-010)
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Database unavailable');
      }

      // Insert each correction into Supabase
      for (const c of corrections) {
        const { error } = await supabase
          .from('data_corrections')
          .insert({
            kingdom_number: kingdom.kingdom_number,
            field: c.field,
            current_value: c.currentValue,
            suggested_value: c.suggestedValue,
            reason: notes || '',
            submitted_by: user?.id,
            submitted_by_name: profile?.username || 'Anonymous',
            status: 'pending'
          });

        if (error) {
          logger.error('Failed to submit data correction:', error.message);
          throw new Error(`Failed to submit: ${error.message}`);
        }
      }

      showToast(t('reportData.successToast'), 'success');
      onClose();
    } catch (err) {
      showToast(t('reportData.failedToast'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldConfig = CORRECTABLE_FIELDS.find(f => f.key === selectedField);

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
          maxWidth: '500px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
              {t('reportData.title')}
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              Kingdom {kingdom.kingdom_number}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              fontSize: '1.5rem',
              lineHeight: 1,
              padding: '0.5rem',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Add Correction Form */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            {t('reportData.selectField')}
          </label>
          <select
            value={selectedField}
            onChange={(e) => {
              setSelectedField(e.target.value);
              setSuggestedValue('');
            }}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#0a0a0a',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.9rem',
              marginBottom: '0.75rem'
            }}
          >
            <option value="">{t('reportData.selectFieldPlaceholder')}</option>
            {CORRECTABLE_FIELDS.map(f => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>

          {selectedField && (
            <>
              <div style={{ 
                display: 'flex', 
                gap: '1rem', 
                marginBottom: '0.75rem',
                padding: '0.75rem',
                backgroundColor: '#1a1a20',
                borderRadius: '8px'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.25rem' }}>{t('reportData.currentValue')}</div>
                  <div style={{ color: '#ef4444', fontWeight: '600' }}>{getCurrentValue(selectedField)}</div>
                </div>
                <div style={{ color: '#3a3a3a', display: 'flex', alignItems: 'center' }}>→</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.25rem' }}>{t('reportData.correctValue')}</div>
                  {fieldConfig?.type === 'select' ? (
                    <select
                      value={suggestedValue}
                      onChange={(e) => setSuggestedValue(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #22c55e50',
                        borderRadius: '6px',
                        color: '#22c55e',
                        fontSize: '0.9rem'
                      }}
                    >
                      <option value="">Select...</option>
                      {fieldConfig.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      value={suggestedValue}
                      onChange={(e) => setSuggestedValue(e.target.value)}
                      placeholder={t('reportData.enterCorrectValue')}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #22c55e50',
                        borderRadius: '6px',
                        color: '#22c55e',
                        fontSize: '0.9rem'
                      }}
                    />
                  )}
                </div>
              </div>
              <button
                onClick={handleAddCorrection}
                disabled={!suggestedValue}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: suggestedValue ? '#22c55e20' : '#1a1a1a',
                  border: `1px solid ${suggestedValue ? '#22c55e50' : '#2a2a2a'}`,
                  borderRadius: '6px',
                  color: suggestedValue ? '#22c55e' : '#6b7280',
                  cursor: suggestedValue ? 'pointer' : 'not-allowed',
                  fontSize: '0.85rem',
                  fontWeight: '500'
                }}
              >
                {t('reportData.addCorrection')}
              </button>
            </>
          )}
        </div>

        {/* Corrections List */}
        {corrections.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              {t('reportData.correctionsToSubmit', { count: corrections.length })}
            </div>
            {corrections.map((c, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#1a1a20',
                  borderRadius: '6px',
                  marginBottom: '0.5rem'
                }}
              >
                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: '#9ca3af' }}>{c.field}:</span>{' '}
                  <span style={{ color: '#ef4444', textDecoration: 'line-through' }}>{c.currentValue}</span>
                  <span style={{ color: '#6b7280' }}> → </span>
                  <span style={{ color: '#22c55e' }}>{c.suggestedValue}</span>
                </div>
                <button
                  onClick={() => handleRemoveCorrection(i)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#6b7280',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            {t('reportData.additionalNotes')}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('reportData.notesPlaceholder')}
            rows={3}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#0a0a0a',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.9rem',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Notice */}
        <div style={{
          padding: '0.75rem',
          backgroundColor: '#eab30810',
          border: '1px solid #eab30830',
          borderRadius: '8px',
          marginBottom: '1.5rem'
        }}>
          <div style={{ color: '#eab308', fontSize: '0.8rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <span>⚠️</span>
            <span>{t('reportData.reviewWarning')}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.25rem',
              backgroundColor: 'transparent',
              border: '1px solid #3a3a3a',
              borderRadius: '8px',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            {t('reportData.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={corrections.length === 0 || submitting}
            style={{
              padding: '0.75rem 1.25rem',
              backgroundColor: corrections.length > 0 ? '#22d3ee' : '#1a1a1a',
              border: 'none',
              borderRadius: '8px',
              color: corrections.length > 0 ? '#000' : '#6b7280',
              cursor: corrections.length > 0 ? 'pointer' : 'not-allowed',
              fontSize: '0.9rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {submitting && <span className="loading-spinner" style={{ width: '14px', height: '14px' }} />}
            {t('reportData.submitForReview')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportDataModal;
