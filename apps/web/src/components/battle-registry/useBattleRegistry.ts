// ─── KvK Battle Registry — Custom Hook ─────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useGoldKingdoms } from '../../hooks/useGoldKingdoms';
import { useKvk11Promo } from '../../hooks/useKvk11Promo';
import { useToast } from '../Toast';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { registerChannel, unregisterChannel } from '../../lib/realtimeGuard';
import { logger } from '../../utils/logger';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  BattleRegistry, BattleRegistryEntry,
  ManagerEntry, ManagerSearchResult,
  RegistryView, TIME_SLOTS, TimeSlotRange,
} from './types';

// Helper: get effective time slots from an entry (supports both old and new format)
export function getEntryTimeSlots(entry: BattleRegistryEntry): TimeSlotRange[] {
  if (entry.time_slots && Array.isArray(entry.time_slots) && entry.time_slots.length > 0) {
    return entry.time_slots;
  }
  return [{ from: entry.time_slot, to: entry.time_slot_to ?? entry.time_slot }];
}

export function useBattleRegistry() {
  const { registryId } = useParams<{ registryId?: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const goldKingdoms = useGoldKingdoms();
  const { hasPromoAccess, isPromoActive, msRemaining: promoMsRemaining } = useKvk11Promo();
  const { showToast } = useToast();
  useDocumentTitle('KvK Battle Registry');

  // State
  const [view, setView] = useState<RegistryView>('landing');
  const [loading, setLoading] = useState(true);
  const [registry, setRegistry] = useState<BattleRegistry | null>(null);
  const [myRegistries, setMyRegistries] = useState<BattleRegistry[]>([]);
  const [entries, setEntries] = useState<BattleRegistryEntry[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [isEditorOrCoEditor, setIsEditorOrCoEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingEntry, setExistingEntry] = useState<BattleRegistryEntry | null>(null);
  const hasPrefilled = useRef(false);

  // Form state
  const [formUsername, setFormUsername] = useState('');
  const [formAlliance, setFormAlliance] = useState('');
  const [formTimeSlots, setFormTimeSlots] = useState<TimeSlotRange[]>([
    { from: TIME_SLOTS[0] ?? '12:00', to: TIME_SLOTS[TIME_SLOTS.length - 1] ?? '18:00' },
  ]);
  const [formInfantryTier, setFormInfantryTier] = useState<number | null>(null);
  const [formInfantryTg, setFormInfantryTg] = useState<number | null>(null);
  const [formCavalryTier, setFormCavalryTier] = useState<number | null>(null);
  const [formCavalryTg, setFormCavalryTg] = useState<number | null>(null);
  const [formArchersTier, setFormArchersTier] = useState<number | null>(null);
  const [formArchersTg, setFormArchersTg] = useState<number | null>(null);

  // Create registry state
  const [createKingdom, setCreateKingdom] = useState<number>(0);
  const [createKvkNumber, setCreateKvkNumber] = useState<number>(0);
  const [createNotes, setCreateNotes] = useState('');
  const [createWebhookUrl, setCreateWebhookUrl] = useState('');
  const [duplicateWarningRegistries, setDuplicateWarningRegistries] = useState<BattleRegistry[]>([]);

  // Manager assignment state
  const [assignManagerInput, setAssignManagerInput] = useState('');
  const [managerSearchResults, setManagerSearchResults] = useState<ManagerSearchResult[]>([]);
  const [managers, setManagers] = useState<ManagerEntry[]>([]);
  const [showManagerDropdown, setShowManagerDropdown] = useState(false);
  const managerSearchRef = useRef<HTMLDivElement>(null);

  // Kingdom registries for "Fill The Form" CTA
  const [kingdomRegistries, setKingdomRegistries] = useState<BattleRegistry[]>([]);

  // Registries the user has submitted to
  const [submittedRegistries, setSubmittedRegistries] = useState<BattleRegistry[]>([]);

  // ─── Data Fetching ─────────────────────────────────────────────────
  const fetchMyRegistries = useCallback(async () => {
    if (!user?.id || !supabase) return;
    try {
      const { data: created } = await supabase.from('battle_registries').select('*').eq('created_by', user.id).order('created_at', { ascending: false });
      const { data: mgrLinks } = await supabase.from('battle_registry_managers').select('registry_id').eq('user_id', user.id);
      let managedRegistries: BattleRegistry[] = [];
      if (mgrLinks && mgrLinks.length > 0) {
        const ids = mgrLinks.map(m => m.registry_id);
        const { data: mgrRegs } = await supabase.from('battle_registries').select('*').in('id', ids).order('created_at', { ascending: false });
        managedRegistries = mgrRegs || [];
      }
      // Also include registries for kingdoms where user is an editor/co-editor
      let editorRegistries: BattleRegistry[] = [];
      const { data: editorRoles } = await supabase.from('kingdom_editors').select('kingdom_number').eq('user_id', user.id).eq('status', 'active');
      if (editorRoles && editorRoles.length > 0) {
        const kNums = editorRoles.map(e => e.kingdom_number);
        const { data: edRegs } = await supabase.from('battle_registries').select('*').in('kingdom_number', kNums).order('created_at', { ascending: false });
        editorRegistries = edRegs || [];
      }
      const all = [...(created || []), ...managedRegistries, ...editorRegistries];
      const unique = all.filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);
      setMyRegistries(unique);
    } catch (err) { logger.error('Failed to fetch registries:', err); }
  }, [user?.id]);

  const fetchRegistry = useCallback(async (id: string) => {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('battle_registries').select('*').eq('id', id).single();
      if (data) {
        setRegistry(data);
        const isCreator = data.created_by === user?.id;
        if (user?.id) {
          const { data: editors } = await supabase.from('kingdom_editors').select('*')
            .eq('kingdom_number', data.kingdom_number).eq('status', 'active');
          const isEditor = (editors || []).some(e => e.user_id === user.id);
          setIsEditorOrCoEditor(isEditor || isCreator);
          setIsManager(isCreator || isEditor);
        } else {
          setIsManager(isCreator);
        }
        await fetchManagers(data.id);
      }
    } catch (err) { logger.error('Failed to fetch registry:', err); }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchEntries = useCallback(async (regId: string) => {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('battle_registry_entries').select('*').eq('registry_id', regId).order('created_at', { ascending: true });
      setEntries(data || []);
      if (user?.id && data) {
        const mine = data.find((e: BattleRegistryEntry) => e.user_id === user.id);
        if (mine && !hasPrefilled.current) { hasPrefilled.current = true; setExistingEntry(mine); prefillForm(mine); }
      }
    } catch (err) { logger.error('Failed to fetch entries:', err); }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchManagers = useCallback(async (regId: string) => {
    if (!supabase) return;
    try {
      const { data: mgrRows } = await supabase.from('battle_registry_managers').select('id, user_id').eq('registry_id', regId);
      if (mgrRows && mgrRows.length > 0) {
        const userIds = mgrRows.map(m => m.user_id);
        const { data: profiles } = await supabase.from('profiles').select('id, linked_username, username').in('id', userIds);
        const mgrs = mgrRows.map(m => {
          const p = (profiles || []).find(pr => pr.id === m.user_id);
          return { id: m.id, user_id: m.user_id, username: p?.linked_username || p?.username || 'Unknown' };
        });
        setManagers(mgrs);
        if (user?.id && mgrs.some(m => m.user_id === user.id)) {
          setIsManager(true);
        }
      } else {
        setManagers([]);
      }
    } catch (err) { logger.error('Failed to fetch managers:', err); }
  }, [user?.id]);

  const searchUsers = useCallback(async (query: string) => {
    if (!supabase || query.length < 2) { setManagerSearchResults([]); setShowManagerDropdown(false); return; }
    try {
      // Sanitize query: escape special Postgres LIKE/ILIKE characters
      const sanitized = query.replace(/[%_\\'"(),.:!]/g, '');
      if (sanitized.length < 2) { setManagerSearchResults([]); setShowManagerDropdown(false); return; }
      const { data } = await supabase.from('profiles')
        .select('id, linked_username, username, linked_player_id')
        .or(`linked_username.ilike.%${sanitized}%,linked_player_id.ilike.%${sanitized}%,username.ilike.%${sanitized}%`)
        .limit(8);
      setManagerSearchResults(data || []);
      setShowManagerDropdown((data || []).length > 0);
    } catch { setManagerSearchResults([]); }
  }, []);

  const prefillForm = (entry: BattleRegistryEntry) => {
    setFormUsername(entry.username);
    setFormAlliance(entry.alliance_tag);
    setFormTimeSlots(getEntryTimeSlots(entry));
    setFormInfantryTier(entry.infantry_tier);
    setFormInfantryTg(entry.infantry_tg);
    setFormCavalryTier(entry.cavalry_tier);
    setFormCavalryTg(entry.cavalry_tg);
    setFormArchersTier(entry.archers_tier);
    setFormArchersTg(entry.archers_tg);
  };

  // ─── Supabase Realtime ─────────────────────────────────────────────
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!registryId || !isSupabaseConfigured || !supabase) return;
    const client = supabase;
    const chName = `battle-registry-${registryId}`;
    if (!registerChannel(chName)) return;
    const channel = client
      .channel(chName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_registry_entries', filter: `registry_id=eq.${registryId}` },
        () => { fetchEntries(registryId); })
      .subscribe((status) => {
        logger.info(`Battle registry realtime: ${status}`);
      });
    channelRef.current = channel;
    return () => {
      if (channelRef.current && client) {
        client.removeChannel(channelRef.current);
        unregisterChannel(chName);
        channelRef.current = null;
      }
    };
  }, [registryId, fetchEntries]);

  // ─── Initialization ───────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      if (registryId) {
        await Promise.all([
          fetchRegistry(registryId),
          fetchEntries(registryId),
        ]);
      } else {
        await fetchMyRegistries();
      }
      if (profile) {
        if (!formUsername && profile.linked_username) setFormUsername(profile.linked_username);
        if (!formAlliance && profile.alliance_tag) setFormAlliance(profile.alliance_tag);
        if (!createKingdom && profile.linked_kingdom) setCreateKingdom(profile.linked_kingdom);
        if (profile.linked_kingdom && supabase && !registryId) {
          try {
            const { data: kr } = await supabase.from('battle_registries').select('*')
              .eq('kingdom_number', profile.linked_kingdom).in('status', ['active', 'closed'])
              .order('created_at', { ascending: false });
            setKingdomRegistries(kr || []);
          } catch { /* silent */ }
        }
        // Fetch registries the user has submitted to
        if (user?.id && supabase && !registryId) {
          try {
            const { data: subs } = await supabase.from('battle_registry_entries').select('registry_id').eq('user_id', user.id);
            if (subs && subs.length > 0) {
              const regIds = [...new Set(subs.map(s => s.registry_id))];
              const { data: regs } = await supabase.from('battle_registries').select('*')
                .in('id', regIds).in('status', ['active', 'closed'])
                .order('created_at', { ascending: false });
              setSubmittedRegistries(regs || []);
            }
          } catch { /* silent */ }
        }
        // Check editor/co-editor status for landing view
        if (user?.id && supabase && !registryId) {
          try {
            const { data: editors } = await supabase.from('kingdom_editors').select('*')
              .eq('user_id', user.id).eq('status', 'active');
            if (editors && editors.length > 0) setIsEditorOrCoEditor(true);
          } catch { /* silent */ }
          try {
            const { data: mgrLinks } = await supabase.from('battle_registry_managers').select('id').eq('user_id', user.id).limit(1);
            if (mgrLinks && mgrLinks.length > 0) setIsManager(true);
          } catch { /* silent */ }
        }
      }
      setLoading(false);
    };
    init();
  }, [registryId, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine view
  useEffect(() => {
    if (!registryId) { setView('landing'); return; }
    if (!user) { setView('gate'); return; }
    if (!profile?.linked_player_id) { setView('gate'); return; }
    if (registry) { setView(isManager ? 'manage' : 'form'); }
  }, [registryId, registry, isManager, user, profile]);

  // Click outside to close manager dropdown
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (managerSearchRef.current && !managerSearchRef.current.contains(e.target as Node)) {
        setShowManagerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => { if (assignManagerInput.trim().length >= 2) searchUsers(assignManagerInput.trim()); }, 300);
    return () => clearTimeout(timer);
  }, [assignManagerInput, searchUsers]);

  // Duplicate detection: warn if kingdom+kvk combo already exists
  useEffect(() => {
    if (!supabase || !createKingdom || !createKvkNumber || registryId) { setDuplicateWarningRegistries([]); return; }
    const client = supabase;
    const timer = setTimeout(async () => {
      try {
        const { data } = await client!.from('battle_registries').select('id, kingdom_number, kvk_number, status, created_at')
          .eq('kingdom_number', createKingdom).eq('kvk_number', createKvkNumber);
        setDuplicateWarningRegistries((data || []) as BattleRegistry[]);
      } catch { setDuplicateWarningRegistries([]); }
    }, 400);
    return () => clearTimeout(timer);
  }, [createKingdom, createKvkNumber, registryId]);

  // ─── Actions ───────────────────────────────────────────────────────
  const createRegistry = async () => {
    if (!supabase || !user?.id || !createKingdom) return;
    if (!profile?.is_admin && !isEditorOrCoEditor && !isManager) {
      showToast(t('battleRegistry.toastRoleRequired', 'Only Editors, Co-Editors, and Battle Managers can create registries.'), 'error');
      return;
    }
    if (!goldKingdoms.has(createKingdom) && !hasPromoAccess(createKingdom)) {
      showToast(t('battleRegistry.toastGoldOnly', 'Only Gold Tier kingdoms can use the KvK Battle Registry.'), 'error');
      return;
    }
    setSaving(true);
    try {
      // Only 1 active registry per kingdom at a time
      const { data: existing } = await supabase.from('battle_registries').select('id').eq('kingdom_number', createKingdom).eq('status', 'active');
      if (existing && existing.length > 0) {
        showToast(t('battleRegistry.toastDuplicate', 'An active registry already exists for this kingdom. Close or archive it first.'), 'error');
        setSaving(false);
        return;
      }
      const { data, error } = await supabase.from('battle_registries').insert({
        kingdom_number: createKingdom, created_by: user.id,
        kvk_number: createKvkNumber || null, notes: createNotes || null,
        discord_webhook_url: createWebhookUrl.trim() || null,
      }).select().single();
      if (error) throw error;
      if (data) {
        // Send Discord notification for new registry
        if (data.discord_webhook_url) {
          sendWebhookNotification(data.id, 'registry_created', {
            kingdom: createKingdom, kvk: createKvkNumber || undefined,
          }).catch(() => { /* silent — notification failure shouldn't block */ });
        }
        navigate(`/tools/battle-registry/${data.id}`);
      }
    } catch (err) { logger.error('Failed to create registry:', err); showToast(t('battleRegistry.toastCreateFailed', 'Failed to create registry.'), 'error'); }
    setSaving(false);
  };

  const submitEntry = async () => {
    if (!supabase || !user?.id || !registryId) return;
    if (!formUsername.trim() || !formAlliance.trim() || formAlliance.trim().length !== 3) {
      showToast(t('battleRegistry.toastAllianceRequired', 'Alliance tag must be exactly 3 characters.'), 'error');
      return;
    }
    // Validate time ranges
    for (const slot of formTimeSlots) {
      const fi = TIME_SLOTS.indexOf(slot.from);
      const ti = TIME_SLOTS.indexOf(slot.to);
      if (fi < 0 || ti < 0 || ti < fi) {
        showToast(t('battleRegistry.toastInvalidTimeRange', 'Invalid time range. "To" must be equal to or after "From".'), 'error');
        return;
      }
    }
    // Check for overlaps
    const sorted = [...formTimeSlots].sort((a, b) => TIME_SLOTS.indexOf(a.from) - TIME_SLOTS.indexOf(b.from));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      if (TIME_SLOTS.indexOf(curr.from) <= TIME_SLOTS.indexOf(prev.to)) {
        showToast(t('battleRegistry.toastOverlappingSlots', 'Time slots cannot overlap. Please fix your time ranges.'), 'error');
        return;
      }
    }
    setSaving(true);
    try {
      const firstSlot = formTimeSlots[0]!;
      const payload = {
        registry_id: registryId,
        user_id: user.id,
        username: formUsername.trim(),
        alliance_tag: formAlliance.trim().toUpperCase(),
        time_slot: firstSlot.from,
        time_slot_to: firstSlot.to,
        time_slots: formTimeSlots,
        infantry_tier: formInfantryTier,
        infantry_tg: formInfantryTg,
        cavalry_tier: formCavalryTier,
        cavalry_tg: formCavalryTg,
        archers_tier: formArchersTier,
        archers_tg: formArchersTg,
      };

      if (existingEntry) {
        const { error } = await supabase.from('battle_registry_entries')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', existingEntry.id);
        if (error) throw error;
        showToast(t('battleRegistry.toastUpdated', 'Registration updated!'), 'success');
      } else {
        const { error } = await supabase.from('battle_registry_entries').insert(payload);
        if (error) throw error;
        showToast(t('battleRegistry.toastSubmitted', 'Registration submitted!'), 'success');
        // Notify Discord on new entry
        if (registry?.discord_webhook_url) {
          sendWebhookNotification(registryId, 'entry_submitted', {
            username: formUsername.trim(), alliance: formAlliance.trim().toUpperCase(),
          }).catch(() => {});
        }
      }
      await fetchEntries(registryId);
    } catch (err) { logger.error('Failed to submit entry:', err); showToast(t('battleRegistry.toastSubmitFailed', 'Failed to submit registration.'), 'error'); }
    setSaving(false);
  };

  const closeRegistry = async () => {
    if (!supabase || !registry) return;
    try {
      await supabase.from('battle_registries').update({ status: 'closed' }).eq('id', registry.id);
      setRegistry({ ...registry, status: 'closed' });
      showToast(t('battleRegistry.toastClosed', 'Registry closed.'), 'success');
      if (registry.discord_webhook_url) {
        sendWebhookNotification(registry.id, 'registry_closed', { kingdom: registry.kingdom_number }).catch(() => {});
      }
    } catch (err) { logger.error('Failed to close registry:', err); }
  };

  const reopenRegistry = async () => {
    if (!supabase || !registry) return;
    try {
      await supabase.from('battle_registries').update({ status: 'active', locked_at: null, locked_by: null }).eq('id', registry.id);
      setRegistry({ ...registry, status: 'active', locked_at: null, locked_by: null });
      showToast(t('battleRegistry.toastReopened', 'Registry reopened.'), 'success');
      if (registry.discord_webhook_url) {
        sendWebhookNotification(registry.id, 'registry_reopened', { kingdom: registry.kingdom_number }).catch(() => {});
      }
    } catch (err) { logger.error('Failed to reopen registry:', err); }
  };

  const lockRegistry = async () => {
    if (!supabase || !registry || !user?.id) return;
    try {
      const now = new Date().toISOString();
      await supabase.from('battle_registries').update({ locked_at: now, locked_by: user.id }).eq('id', registry.id);
      setRegistry({ ...registry, locked_at: now, locked_by: user.id });
      showToast(t('battleRegistry.toastLocked', 'Registry locked. Only managers can edit entries.'), 'success');
      if (registry.discord_webhook_url) {
        sendWebhookNotification(registry.id, 'registry_locked', { kingdom: registry.kingdom_number }).catch(() => {});
      }
    } catch (err) { logger.error('Failed to lock registry:', err); }
  };

  const unlockRegistry = async () => {
    if (!supabase || !registry) return;
    try {
      await supabase.from('battle_registries').update({ locked_at: null, locked_by: null }).eq('id', registry.id);
      setRegistry({ ...registry, locked_at: null, locked_by: null });
      showToast(t('battleRegistry.toastUnlocked', 'Registry unlocked. Players can edit entries again.'), 'success');
    } catch (err) { logger.error('Failed to unlock registry:', err); }
  };

  const archiveRegistry = async () => {
    if (!supabase || !registry) return;
    try {
      await supabase.from('battle_registries').update({ status: 'archived' }).eq('id', registry.id);
      setRegistry({ ...registry, status: 'archived' });
      showToast(t('battleRegistry.toastArchived', 'Registry archived.'), 'success');
    } catch (err) { logger.error('Failed to archive registry:', err); }
  };

  const updateWebhookUrl = async (url: string) => {
    if (!supabase || !registry) return;
    try {
      await supabase.from('battle_registries').update({ discord_webhook_url: url.trim() || null }).eq('id', registry.id);
      setRegistry({ ...registry, discord_webhook_url: url.trim() || null });
      showToast(t('battleRegistry.toastWebhookSaved', 'Discord webhook URL saved.'), 'success');
    } catch (err) { logger.error('Failed to save webhook URL:', err); }
  };

  // ─── Discord Webhook Notification ──────────────────────────────────
  const sendWebhookNotification = async (regId: string, eventType: string, data?: Record<string, unknown>) => {
    if (!supabase) return;
    try {
      await supabase.functions.invoke('notify-battle-registry', {
        body: { registry_id: regId, event_type: eventType, data },
      });
    } catch (err) { logger.error('Webhook notification failed:', err); }
  };

  const addManager = async (userId: string, username: string) => {
    if (!supabase || !user?.id || !registry) return;
    try {
      const { data, error } = await supabase.from('battle_registry_managers').insert({
        registry_id: registry.id, user_id: userId, assigned_by: user.id,
      }).select().single();
      if (error) throw error;
      if (data) {
        setManagers(prev => [...prev, { id: data.id, user_id: userId, username }]);
        setAssignManagerInput('');
        setShowManagerDropdown(false);
        showToast(t('battleRegistry.toastManagerAdded', '{{username}} added as Battle Manager.', { username }), 'success');
      }
    } catch (err) { logger.error('Failed to add manager:', err); }
  };

  const removeManager = async (mgrId: string) => {
    if (!supabase) return;
    try {
      await supabase.from('battle_registry_managers').delete().eq('id', mgrId);
      setManagers(prev => prev.filter(m => m.id !== mgrId));
      showToast(t('battleRegistry.toastManagerRemoved', 'Battle Manager removed.'), 'success');
    } catch (err) { logger.error('Failed to remove manager:', err); }
  };

  const submitManualEntry = async (data: {
    username: string; alliance_tag: string;
    time_slots: TimeSlotRange[];
    infantry_tier: number | null; infantry_tg: number | null;
    cavalry_tier: number | null; cavalry_tg: number | null;
    archers_tier: number | null; archers_tg: number | null;
  }) => {
    if (!supabase || !user?.id || !registryId) return;
    if (!data.username.trim() || !data.alliance_tag.trim() || data.alliance_tag.trim().length !== 3) {
      showToast(t('battleRegistry.toastAllianceRequired', 'Alliance tag must be exactly 3 characters.'), 'error');
      return;
    }
    for (const slot of data.time_slots) {
      const fi = TIME_SLOTS.indexOf(slot.from), ti = TIME_SLOTS.indexOf(slot.to);
      if (fi < 0 || ti < 0 || ti < fi) {
        showToast(t('battleRegistry.toastInvalidTimeRange', 'Invalid time range. "To" must be equal to or after "From".'), 'error');
        return;
      }
    }
    const first = data.time_slots[0] ?? { from: TIME_SLOTS[0] ?? '12:00', to: TIME_SLOTS[TIME_SLOTS.length - 1] ?? '18:00' };
    setSaving(true);
    try {
      const payload = {
        registry_id: registryId,
        user_id: null,
        added_by: user.id,
        username: data.username.trim(),
        alliance_tag: data.alliance_tag.trim().toUpperCase(),
        time_slot: first.from,
        time_slot_to: first.to,
        time_slots: data.time_slots,
        infantry_tier: data.infantry_tier,
        infantry_tg: data.infantry_tg,
        cavalry_tier: data.cavalry_tier,
        cavalry_tg: data.cavalry_tg,
        archers_tier: data.archers_tier,
        archers_tg: data.archers_tg,
      };
      const { error } = await supabase.from('battle_registry_entries').insert(payload);
      if (error) throw error;
      showToast(t('battleRegistry.toastManualAdded', 'Player added manually.'), 'success');
      await fetchEntries(registryId);
    } catch (err) { logger.error('Failed to add manual entry:', err); showToast(t('battleRegistry.toastManualFailed', 'Failed to add player.'), 'error'); }
    setSaving(false);
  };

  const updateManualEntry = async (entryId: string, data: {
    username: string; alliance_tag: string;
    time_slots: TimeSlotRange[];
    infantry_tier: number | null; infantry_tg: number | null;
    cavalry_tier: number | null; cavalry_tg: number | null;
    archers_tier: number | null; archers_tg: number | null;
  }) => {
    if (!supabase || !user?.id || !registryId) return;
    if (!data.username.trim() || !data.alliance_tag.trim() || data.alliance_tag.trim().length !== 3) {
      showToast(t('battleRegistry.toastAllianceRequired', 'Alliance tag must be exactly 3 characters.'), 'error');
      return;
    }
    for (const slot of data.time_slots) {
      const fi = TIME_SLOTS.indexOf(slot.from), ti = TIME_SLOTS.indexOf(slot.to);
      if (fi < 0 || ti < 0 || ti < fi) {
        showToast(t('battleRegistry.toastInvalidTimeRange', 'Invalid time range. "To" must be equal to or after "From".'), 'error');
        return;
      }
    }
    const first = data.time_slots[0] ?? { from: TIME_SLOTS[0] ?? '12:00', to: TIME_SLOTS[TIME_SLOTS.length - 1] ?? '18:00' };
    setSaving(true);
    try {
      const { error } = await supabase.from('battle_registry_entries').update({
        username: data.username.trim(),
        alliance_tag: data.alliance_tag.trim().toUpperCase(),
        time_slot: first.from,
        time_slot_to: first.to,
        time_slots: data.time_slots,
        infantry_tier: data.infantry_tier,
        infantry_tg: data.infantry_tg,
        cavalry_tier: data.cavalry_tier,
        cavalry_tg: data.cavalry_tg,
        archers_tier: data.archers_tier,
        archers_tg: data.archers_tg,
        updated_at: new Date().toISOString(),
      }).eq('id', entryId);
      if (error) throw error;
      showToast(t('battleRegistry.toastManualUpdated', 'Player entry updated.'), 'success');
      await fetchEntries(registryId);
    } catch (err) { logger.error('Failed to update manual entry:', err); showToast(t('battleRegistry.toastManualUpdateFailed', 'Failed to update player entry.'), 'error'); }
    setSaving(false);
  };

  const deleteEntry = async (entryId: string) => {
    if (!supabase || !registryId) return;
    try {
      const { error } = await supabase.from('battle_registry_entries').delete().eq('id', entryId);
      if (error) throw error;
      showToast(t('battleRegistry.toastEntryDeleted', 'Entry removed.'), 'success');
      await fetchEntries(registryId);
    } catch (err) { logger.error('Failed to delete entry:', err); showToast(t('battleRegistry.toastDeleteFailed', 'Failed to remove entry.'), 'error'); }
  };

  return {
    // Params
    registryId, navigate, t, user, profile, isMobile,
    goldKingdoms, hasPromoAccess, isPromoActive, promoMsRemaining,
    // State
    view, setView, loading, registry, myRegistries, entries,
    isManager, isEditorOrCoEditor, saving, existingEntry,
    kingdomRegistries, submittedRegistries,
    // Form
    formUsername, setFormUsername, formAlliance, setFormAlliance,
    formTimeSlots, setFormTimeSlots,
    formInfantryTier, setFormInfantryTier, formInfantryTg, setFormInfantryTg,
    formCavalryTier, setFormCavalryTier, formCavalryTg, setFormCavalryTg,
    formArchersTier, setFormArchersTier, formArchersTg, setFormArchersTg,
    // Create
    createKingdom, setCreateKingdom, createKvkNumber, setCreateKvkNumber,
    createNotes, setCreateNotes,
    // Managers
    assignManagerInput, setAssignManagerInput,
    managerSearchResults, managers, showManagerDropdown, setShowManagerDropdown,
    managerSearchRef,
    // Create extras
    createWebhookUrl, setCreateWebhookUrl,
    duplicateWarningRegistries, setDuplicateWarningRegistries,
    // Actions
    createRegistry, submitEntry, submitManualEntry, updateManualEntry, deleteEntry,
    closeRegistry, reopenRegistry, lockRegistry, unlockRegistry, archiveRegistry,
    addManager, removeManager, updateWebhookUrl, sendWebhookNotification,
  };
}
