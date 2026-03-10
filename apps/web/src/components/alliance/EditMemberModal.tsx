import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast';
import { Button } from '../shared';
import { inputBase, TROOP_COLORS, modalBackdrop, modalContent } from './allianceCenterConstants';
import { logAllianceActivity } from './logAllianceActivity';
import TroopSelect from './TroopSelect';
import type { AllianceMember, useAllianceCenter } from '../../hooks/useAllianceCenter';

// ─── Edit Member Modal ───
const EditMemberModal: React.FC<{
  member: AllianceMember;
  onUpdate: ReturnType<typeof useAllianceCenter>['updateMember'];
  onClose: () => void;
  restrictedMode?: boolean; // member self-edit: only troop fields
  allianceId?: string;
}> = ({ member, onUpdate, onClose, restrictedMode, allianceId }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user: authUser, profile: authProfile } = useAuth();
  const isMob = useIsMobile();
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'Tab' && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button, input, select, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  const [editName, setEditName] = useState(member.player_name);
  const [editNotes, setEditNotes] = useState(member.notes || '');
  const [infTier, setInfTier] = useState<number | null>(member.infantry_tier);
  const [infTg, setInfTg] = useState<number | null>(member.infantry_tg);
  const [cavTier, setCavTier] = useState<number | null>(member.cavalry_tier);
  const [cavTg, setCavTg] = useState<number | null>(member.cavalry_tg);
  const [arcTier, setArcTier] = useState<number | null>(member.archers_tier);
  const [arcTg, setArcTg] = useState<number | null>(member.archers_tg);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const data: Parameters<typeof onUpdate>[1] = {
      infantry_tier: infTier, infantry_tg: infTg,
      cavalry_tier: cavTier, cavalry_tg: cavTg,
      archers_tier: arcTier, archers_tg: arcTg,
    };
    if (!restrictedMode) {
      data.player_name = editName.trim();
      data.notes = editNotes.trim();
    }
    const result = await onUpdate(member.id, data);
    setSaving(false);
    if (result.success) {
      showToast(t('allianceCenter.memberUpdated', 'Member updated'), 'success');
      if (allianceId && authUser) {
        logAllianceActivity({
          allianceId,
          actorUserId: authUser.id,
          actorName: (authProfile as { username?: string } | null)?.username || authUser.email || 'Unknown',
          action: 'member_updated',
          targetName: member.player_name,
          details: { restrictedMode: !!restrictedMode },
        });
      }
      onClose();
    } else { showToast(result.error || t('allianceCenter.updateFailed', 'Failed to update'), 'error'); }
  };

  return (
    <div style={modalBackdrop(isMob)} onClick={onClose} role="dialog" aria-modal="true" aria-label={restrictedMode ? t('allianceCenter.editMyTroops', 'Edit My Troops') : t('allianceCenter.editMember', 'Edit Member')}>
      <div ref={dialogRef} onClick={e => e.stopPropagation()} style={modalContent(isMob, { maxWidth: '440px' })}>
        <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>
          {restrictedMode ? t('allianceCenter.editMyTroops', 'Edit My Troops') : t('allianceCenter.editMember', 'Edit Member')}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {!restrictedMode && (
            <div>
              <label style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>Username</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value.slice(0, 30))} style={inputBase} autoFocus />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <TroopSelect label="Infantry" color={TROOP_COLORS.infantry} tier={infTier} tg={infTg} onTierChange={setInfTier} onTgChange={setInfTg} />
            <TroopSelect label="Cavalry" color={TROOP_COLORS.cavalry} tier={cavTier} tg={cavTg} onTierChange={setCavTier} onTgChange={setCavTg} />
            <TroopSelect label="Archers" color={TROOP_COLORS.archers} tier={arcTier} tg={arcTg} onTierChange={setArcTier} onTgChange={setArcTg} />
          </div>
          {!restrictedMode && (
            <div>
              <label style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>Notes</label>
              <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value.slice(0, 200))} placeholder="Optional notes" maxLength={200} style={inputBase} />
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>{t('common.cancel', 'Cancel')}</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || (!restrictedMode && !editName.trim())} loading={saving} style={{ flex: 1 }}>
              {t('common.save', 'Save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditMemberModal;
