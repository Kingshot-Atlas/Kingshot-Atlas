import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast';
import { FONT_DISPLAY } from '../../utils/styles';
import { Button } from '../shared';
import { ACCENT_DIM, ACCENT_BORDER, inputBase } from './allianceCenterConstants';
import type { useAllianceCenter } from '../../hooks/useAllianceCenter';

// ─── Create Alliance Form ───
const CreateAllianceForm: React.FC<{
  onCreated: () => void;
  createAlliance: ReturnType<typeof useAllianceCenter>['createAlliance'];
}> = ({ onCreated, createAlliance }) => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const isMobile = useIsMobile();
  const [tag, setTag] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const defaultKingdom = profile?.home_kingdom ?? profile?.linked_kingdom ?? 0;

  const handleCreate = async () => {
    if (!tag.trim() || !name.trim() || !defaultKingdom) return;
    setCreating(true);
    const result = await createAlliance({
      tag: tag.trim(),
      name: name.trim(),
      kingdom_number: defaultKingdom,
      description: description.trim() || undefined,
    });
    setCreating(false);
    if (result.success) {
      showToast(t('allianceCenter.created', 'Alliance center created!'), 'success');
      onCreated();
    } else {
      showToast(result.error || t('allianceCenter.createFailed', 'Failed to create alliance'), 'error');
    }
  };

  const lgInput: React.CSSProperties = { ...inputBase, padding: '0.6rem 0.75rem', borderRadius: '8px', fontSize: '0.9rem' };

  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '1.5rem' : '2rem' }}>
      <div style={{ width: '100%', maxWidth: '480px', backgroundColor: '#111111', borderRadius: '16px', border: `1px solid ${ACCENT_BORDER}`, padding: isMobile ? '1.5rem' : '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: ACCENT_DIM, border: `2px solid ${ACCENT_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.5rem' }}>🏰</div>
          <h2 style={{ color: '#fff', fontFamily: FONT_DISPLAY, fontSize: '1.25rem', marginBottom: '0.4rem' }}>
            {t('allianceCenter.createTitle', 'Create Your Alliance Center')}
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', lineHeight: 1.5 }}>
            {t('allianceCenter.createDesc', 'Set up your alliance hub. You can manage one alliance center and add up to 100 members.')}
          </p>
        </div>

        {!defaultKingdom && (
          <div style={{ padding: '0.75rem', marginBottom: '1rem', backgroundColor: '#f59e0b15', border: '1px solid #f59e0b30', borderRadius: '8px', fontSize: '0.8rem', color: '#f59e0b' }}>
            {t('allianceCenter.setKingdomFirst', 'Set your home kingdom in your profile first to create an alliance center.')}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '0.3rem' }}>
              {t('allianceCenter.tagLabel', 'Alliance Tag')} *
            </label>
            <input type="text" value={tag} onChange={e => setTag(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 3))} placeholder="e.g. ACE" maxLength={3} style={lgInput} />
            <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>Exactly 3 alphanumeric characters</span>
          </div>
          <div>
            <label style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '0.3rem' }}>
              {t('allianceCenter.nameLabel', 'Alliance Name')} *
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value.slice(0, 50))} placeholder="e.g. Alliance of Champions" maxLength={50} style={lgInput} />
          </div>
          <div>
            <label style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '0.3rem' }}>
              {t('allianceCenter.kingdomLabel', 'Kingdom')}
            </label>
            <div style={{ ...lgInput, backgroundColor: '#0a0a0a', color: '#6b7280', cursor: 'not-allowed' }}>
              {defaultKingdom ? `Kingdom #${defaultKingdom}` : 'Not set'}
            </div>
            <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>Based on your profile home kingdom</span>
          </div>
          <div>
            <label style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '0.3rem' }}>
              {t('allianceCenter.descriptionLabel', 'Description')}
            </label>
            <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 200))}
              placeholder={t('allianceCenter.descriptionPlaceholder', 'Optional — a short note about your alliance')}
              maxLength={200} rows={2} style={{ ...lgInput, resize: 'vertical', minHeight: '50px' }} />
          </div>
          <Button variant="primary" onClick={handleCreate}
            disabled={creating || !tag.trim() || tag.trim().length !== 3 || !name.trim() || !defaultKingdom}
            loading={creating} style={{ width: '100%', marginTop: '0.5rem' }}>
            {t('allianceCenter.createBtn', 'Create Alliance Center')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateAllianceForm;
