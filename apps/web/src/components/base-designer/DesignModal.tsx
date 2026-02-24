import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBaseDesigner } from '../../hooks/useBaseDesigner';
import { Button } from '../shared';

// ─── Save/Load Modal ───
interface DesignModalProps {
  mode: 'save' | 'load' | null;
  onClose: () => void;
  designer: ReturnType<typeof useBaseDesigner>;
}

const DesignModal: React.FC<DesignModalProps> = ({ mode, onClose, designer }) => {
  const { t } = useTranslation();
  const [saveName, setSaveName] = useState('');
  const [designs, setDesigns] = useState(designer.getSavedDesigns);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Refresh designs list and autofill name when modal opens/changes mode
  useEffect(() => {
    if (mode) {
      setDesigns(designer.getSavedDesigns());
      if (mode === 'save') setSaveName(designer.designName || 'Untitled Design');
      setSaveToast(null);
    }
  }, [mode, designer]);

  // Check if save name matches an existing design (case-insensitive)
  const willOverwrite = mode === 'save' && saveName.trim().length > 0 &&
    designs.some((d) => d.name.trim().toLowerCase() === saveName.trim().toLowerCase());

  if (!mode) return null;

  const handleSave = () => {
    const trimmed = saveName.trim();
    if (!trimmed) return;
    designer.setDesignName(trimmed);
    const result = designer.saveDesign(trimmed);
    setSaveToast(result.overwrote
      ? t('baseDesigner.overwriteSuccess', '"{{name}}" updated successfully.', { name: trimmed })
      : t('baseDesigner.saveSuccess', '"{{name}}" saved successfully.', { name: trimmed })
    );
    setTimeout(onClose, 1200);
  };

  const handleDelete = (designId: string, designName: string) => {
    if (confirm(t('baseDesigner.confirmDelete', 'Delete "{{name}}"?', { name: designName }))) {
      const updated = designer.deleteDesign(designId);
      setDesigns(updated);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#111',
        borderRadius: '12px',
        border: '1px solid #2a2a2a',
        padding: '1.5rem',
        maxWidth: '440px',
        width: '100%',
        maxHeight: '70vh',
        overflowY: 'auto',
      }} onClick={(e) => e.stopPropagation()}>
        {mode === 'save' && (
          <>
            <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '1rem' }}>💾 {t('baseDesigner.saveDesign', 'Save Design')}</h3>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              placeholder={t('baseDesigner.designNamePlaceholder', 'Design name...')}
              autoFocus
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${willOverwrite ? '#f59e0b' : '#333'}`,
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.85rem',
                marginBottom: willOverwrite ? '0.5rem' : '1rem',
                boxSizing: 'border-box',
              }}
            />
            {willOverwrite && (
              <div style={{ color: '#f59e0b', fontSize: '0.7rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                ⚠️ {t('baseDesigner.overwriteWarning', 'A design named "{{name}}" already exists. Saving will overwrite it.', { name: saveName.trim() })}
              </div>
            )}
            {saveToast && (
              <div style={{ color: '#22c55e', fontSize: '0.75rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                ✓ {saveToast}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <Button variant="ghost" size="sm" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
              <Button
                variant={willOverwrite ? 'secondary' : 'primary'}
                size="sm"
                onClick={handleSave}
                disabled={!saveName.trim()}
                style={willOverwrite ? { backgroundColor: '#f59e0b', color: '#000', borderColor: '#f59e0b' } : undefined}
              >{willOverwrite ? t('baseDesigner.overwriteBtn', 'Overwrite') : t('common.save', 'Save')}</Button>
            </div>
          </>
        )}

        {mode === 'load' && (
          <>
            <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '1rem' }}>📂 {t('baseDesigner.loadDesign', 'Load Design')}</h3>
            {designs.length === 0 ? (
              <p style={{ color: '#666', fontSize: '0.85rem' }}>{t('baseDesigner.noSavedDesigns', 'No saved designs yet.')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {designs.map((d) => (
                  <div key={d.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem', backgroundColor: '#1a1a1a', borderRadius: '6px', border: '1px solid #2a2a2a',
                  }}>
                    <div>
                      <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600' }}>{d.name}</div>
                      <div style={{ color: '#666', fontSize: '0.6rem' }}>
                        {d.buildings.length} {t('baseDesigner.buildings', 'buildings')} • {new Date(d.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <Button variant="secondary" size="sm" onClick={() => { designer.loadDesign(d.id); onClose(); }}>
                        {t('baseDesigner.loadBtn', 'Load')}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(d.id, d.name)}>
                        🗑️
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <Button variant="ghost" size="sm" onClick={onClose}>{t('baseDesigner.close', 'Close')}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DesignModal;
