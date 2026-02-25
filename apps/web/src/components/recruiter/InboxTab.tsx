import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../utils/styles';
import { ApplicationCard } from './index';
import WatchlistTab from './WatchlistTab';
import type { IncomingApplication, EditorInfo } from './types';
import { formatTCLevel, inputStyle } from './types';
import { supabase } from '../../lib/supabase';

const downloadApprovedCSV = (apps: IncomingApplication[]) => {
  const headers = ['Player ID', 'Username', 'Kingdom', 'TC Level', 'Power', 'Language', 'KvK Availability', 'Applied At', 'Note'];
  const rows = apps.map(app => [
    app.profile?.linked_player_id || '',
    app.profile?.username || 'Anonymous',
    app.profile?.current_kingdom?.toString() || '',
    app.profile?.tc_level ? formatTCLevel(app.profile.tc_level) : '',
    app.profile?.power_million ? `${app.profile.power_million}M` : app.profile?.power_range || '',
    app.profile?.main_language || '',
    app.profile?.kvk_availability || '',
    new Date(app.applied_at).toLocaleDateString(),
    app.applicant_note || '',
  ]);
  const csvContent = [headers, ...rows].map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `approved_applicants_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

interface InboxTabProps {
  listingViews?: number;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  activeApps: IncomingApplication[];
  approvedApps: IncomingApplication[];
  closedApps: IncomingApplication[];
  filteredApps: IncomingApplication[];
  handleStatusChange: (applicationId: string, newStatus: string) => Promise<void>;
  updating: string | null;
  fundTier?: string;
  perAppUnreadCounts?: Record<string, number>;
  perAppLastMessages?: Record<string, { message: string; created_at: string }>;
  kingdomNumber?: number;
  editorInfo?: EditorInfo | null;
}

const InboxTab: React.FC<InboxTabProps> = ({
  listingViews: _listingViews,
  filterStatus,
  setFilterStatus,
  activeApps,
  approvedApps,
  closedApps,
  filteredApps,
  handleStatusChange,
  updating,
  fundTier,
  perAppUnreadCounts,
  perAppLastMessages,
  kingdomNumber,
  editorInfo,
}) => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'tc_desc' | 'power_desc'>('newest');

  // External Recruits Tracker state
  type ExternalRecruit = {
    id: string;
    type: 'individual' | 'group';
    username?: string;
    player_id?: string;
    from_kingdom?: number;
    power_million?: number;
    tc_level?: number;
    contact_username?: string;
    contact_kingdom?: number;
    player_count?: number;
    note?: string;
    created_at: string;
  };
  const [externalRecruits, setExternalRecruits] = useState<ExternalRecruit[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<'individual' | 'group'>('individual');
  const [addForm, setAddForm] = useState({ username: '', player_id: '', from_kingdom: '', power_million: '', tc_level: '', contact_username: '', contact_kingdom: '', player_count: '', note: '' });
  const [addingSaving, setAddingSaving] = useState(false);

  // Fetch external recruits
  useEffect(() => {
    if (!supabase || !kingdomNumber) return;
    supabase
      .from('external_recruits')
      .select('*')
      .eq('kingdom_number', kingdomNumber)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setExternalRecruits(data as ExternalRecruit[]);
      });
  }, [kingdomNumber]);

  const externalPlayerCount = useMemo(() => {
    return externalRecruits.reduce((sum, r) => sum + (r.type === 'group' ? (r.player_count || 0) : 1), 0);
  }, [externalRecruits]);

  const handleAddRecruit = useCallback(async () => {
    if (!supabase || !kingdomNumber || addingSaving) return;
    setAddingSaving(true);
    try {
      const row: Record<string, unknown> = {
        kingdom_number: kingdomNumber,
        type: addMode,
      };
      if (addMode === 'individual') {
        if (!addForm.username.trim()) { setAddingSaving(false); return; }
        row.username = addForm.username.trim();
        if (addForm.player_id.trim()) row.player_id = addForm.player_id.trim();
        if (addForm.from_kingdom) row.from_kingdom = parseInt(addForm.from_kingdom);
        if (addForm.power_million) row.power_million = parseFloat(addForm.power_million);
        if (addForm.tc_level) row.tc_level = parseInt(addForm.tc_level);
      } else {
        if (!addForm.contact_username.trim() || !addForm.player_count) { setAddingSaving(false); return; }
        row.contact_username = addForm.contact_username.trim();
        if (addForm.contact_kingdom) row.contact_kingdom = parseInt(addForm.contact_kingdom);
        row.player_count = parseInt(addForm.player_count);
      }
      if (addForm.note.trim()) row.note = addForm.note.trim();
      const { data, error } = await supabase.from('external_recruits').insert(row).select().single();
      if (error) {
        console.error('Failed to save external recruit:', error);
        return;
      }
      if (data) {
        setExternalRecruits(prev => [data as ExternalRecruit, ...prev]);
        setAddForm({ username: '', player_id: '', from_kingdom: '', power_million: '', tc_level: '', contact_username: '', contact_kingdom: '', player_count: '', note: '' });
        setShowAddForm(false);
      }
    } finally {
      setAddingSaving(false);
    }
  }, [supabase, kingdomNumber, addMode, addForm, addingSaving]);

  const handleDeleteRecruit = useCallback(async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('external_recruits').delete().eq('id', id);
    if (!error) setExternalRecruits(prev => prev.filter(r => r.id !== id));
  }, [supabase]);

  const visibleApps = useMemo(() => {
    let apps = [...filteredApps];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      apps = apps.filter(app => {
        const name = (app.profile?.username || '').toLowerCase();
        const note = (app.applicant_note || '').toLowerCase();
        const lang = (app.profile?.main_language || '').toLowerCase();
        return name.includes(q) || note.includes(q) || lang.includes(q);
      });
    }
    switch (sortBy) {
      case 'oldest': apps.sort((a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime()); break;
      case 'tc_desc': apps.sort((a, b) => (b.profile?.tc_level || 0) - (a.profile?.tc_level || 0)); break;
      case 'power_desc': apps.sort((a, b) => (b.profile?.power_million || 0) - (a.profile?.power_million || 0)); break;
      default: apps.sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()); break;
    }
    return apps;
  }, [filteredApps, searchQuery, sortBy]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === visibleApps.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleApps.map(a => a.id)));
    }
  }, [selectedIds.size, visibleApps]);

  const handleBulkAction = useCallback(async (newStatus: string) => {
    if (selectedIds.size === 0 || bulkUpdating) return;
    setBulkUpdating(true);
    try {
      const promises = Array.from(selectedIds).map(id => handleStatusChange(id, newStatus));
      await Promise.all(promises);
      setSelectedIds(new Set());
    } finally {
      setBulkUpdating(false);
    }
  }, [selectedIds, bulkUpdating, handleStatusChange]);

  return (
    <div>
      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button
          onClick={() => setFilterStatus('active')}
          style={{
            padding: '0.3rem 0.6rem',
            backgroundColor: filterStatus === 'active' ? '#22d3ee10' : 'transparent',
            border: `1px solid ${filterStatus === 'active' ? '#22d3ee30' : '#2a2a2a'}`,
            borderRadius: '6px',
            color: filterStatus === 'active' ? '#22d3ee' : '#6b7280',
            fontSize: '0.75rem',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          {t('recruiter.active', 'Active')} ({activeApps.length})
        </button>
        <button
          onClick={() => setFilterStatus('approved')}
          style={{
            padding: '0.3rem 0.6rem',
            backgroundColor: filterStatus === 'approved' ? '#22c55e10' : 'transparent',
            border: `1px solid ${filterStatus === 'approved' ? '#22c55e30' : '#2a2a2a'}`,
            borderRadius: '6px',
            color: filterStatus === 'approved' ? '#22c55e' : '#6b7280',
            fontSize: '0.75rem',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          {t('recruiter.approved', 'Approved')} ({approvedApps.length})
        </button>
        <button
          onClick={() => setFilterStatus('closed')}
          style={{
            padding: '0.3rem 0.6rem',
            backgroundColor: filterStatus === 'closed' ? '#22d3ee10' : 'transparent',
            border: `1px solid ${filterStatus === 'closed' ? '#22d3ee30' : '#2a2a2a'}`,
            borderRadius: '6px',
            color: filterStatus === 'closed' ? '#22d3ee' : '#6b7280',
            fontSize: '0.75rem',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          {t('recruiter.past', 'Past')} ({closedApps.length})
        </button>
        <button
          onClick={() => setFilterStatus('watchlist')}
          style={{
            padding: '0.3rem 0.6rem',
            backgroundColor: filterStatus === 'watchlist' ? '#a855f710' : 'transparent',
            border: `1px solid ${filterStatus === 'watchlist' ? '#a855f730' : '#2a2a2a'}`,
            borderRadius: '6px',
            color: filterStatus === 'watchlist' ? '#a855f7' : '#6b7280',
            fontSize: '0.75rem',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          {t('recruiter.watchlist', 'Watchlist')}
        </button>
      </div>

      {/* Watchlist Section */}
      {filterStatus === 'watchlist' && editorInfo && (
        <WatchlistTab editorInfo={editorInfo} />
      )}

      {/* Search & Sort */}
      {filterStatus !== 'watchlist' && filteredApps.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('recruiter.searchApplicants', 'Search applicants...')}
            style={{ ...inputStyle, flex: 1, fontSize: '0.75rem', minHeight: '36px', padding: '0.3rem 0.5rem' }}
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            style={{ ...inputStyle, width: 'auto', minWidth: '110px', fontSize: '0.7rem', minHeight: '36px', cursor: 'pointer' }}
          >
            <option value="newest">{t('recruiter.sortNewest', 'Newest')}</option>
            <option value="oldest">{t('recruiter.sortOldest', 'Oldest')}</option>
            <option value="tc_desc">{t('recruiter.sortTcHigh', 'TC (High)')}</option>
            <option value="power_desc">{t('recruiter.sortPowerHigh', 'Power (High)')}</option>
          </select>
        </div>
      )}

      {/* CSV Download for Gold tier */}
      {filterStatus !== 'watchlist' && fundTier === 'gold' && filterStatus === 'approved' && approvedApps.length > 0 && (
        <button
          onClick={() => downloadApprovedCSV(approvedApps)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.75rem',
            marginBottom: '0.75rem',
            backgroundColor: '#ffc30b10',
            border: '1px solid #ffc30b30',
            borderRadius: '6px',
            color: '#ffc30b',
            fontSize: '0.7rem',
            fontWeight: '600',
            cursor: 'pointer',
            minHeight: '36px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {t('recruiter.downloadCsv', 'Download CSV')} ({approvedApps.length} {t('recruiter.approved', 'approved')})
        </button>
      )}

      {/* External Recruits Tracker — only in Approved tab */}
      {filterStatus === 'approved' && (
        <div style={{ marginBottom: '0.75rem' }}>
          {/* Summary Banner */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginBottom: '0.5rem',
          }}>
            <div style={{ backgroundColor: '#22d3ee08', border: '1px solid #22d3ee20', borderRadius: '8px', padding: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.5rem', color: '#22d3ee', fontWeight: '600', marginBottom: '0.1rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('recruiter.atlasRecruits', 'Atlas')}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#22d3ee' }}>{approvedApps.length}</div>
            </div>
            <div style={{ backgroundColor: '#a855f708', border: '1px solid #a855f720', borderRadius: '8px', padding: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.5rem', color: '#a855f7', fontWeight: '600', marginBottom: '0.1rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('recruiter.externalRecruits', 'External')}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#a855f7' }}>{externalPlayerCount}</div>
            </div>
            <div style={{ backgroundColor: '#22c55e08', border: '1px solid #22c55e20', borderRadius: '8px', padding: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.5rem', color: '#22c55e', fontWeight: '600', marginBottom: '0.1rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('recruiter.totalRecruits', 'Total')}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#22c55e' }}>{approvedApps.length + externalPlayerCount}</div>
            </div>
          </div>

          {/* External Recruits Section */}
          <div style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: externalRecruits.length > 0 || showAddForm ? '0.5rem' : '0' }}>
              <span style={{ fontSize: '0.7rem', color: colors.textSecondary, fontWeight: '600' }}>
                {t('recruiter.externalRecruitsLabel', 'External Recruits')}
                {externalRecruits.length > 0 && <span style={{ color: colors.textMuted, fontWeight: '400' }}> ({externalPlayerCount})</span>}
              </span>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                style={{
                  padding: '0.2rem 0.5rem', backgroundColor: showAddForm ? '#ef444412' : '#a855f712',
                  border: `1px solid ${showAddForm ? '#ef444430' : '#a855f730'}`, borderRadius: '6px',
                  color: showAddForm ? '#ef4444' : '#a855f7', fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer', minHeight: '28px',
                }}
              >
                {showAddForm ? t('common.cancel', 'Cancel') : `+ ${t('recruiter.addExternal', 'Add')}`}
              </button>
            </div>

            {/* Add Form */}
            {showAddForm && (
              <div style={{ marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: '#a855f706', border: '1px solid #a855f715', borderRadius: '8px' }}>
                {/* Mode Toggle */}
                <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem' }}>
                  {(['individual', 'group'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setAddMode(m)}
                      style={{
                        flex: 1, padding: '0.3rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer', minHeight: '32px',
                        backgroundColor: addMode === m ? '#a855f715' : 'transparent',
                        border: `1px solid ${addMode === m ? '#a855f740' : colors.border}`,
                        color: addMode === m ? '#a855f7' : colors.textMuted,
                      }}
                    >
                      {m === 'individual' ? `👤 ${t('recruiter.individual', 'Individual')}` : `👥 ${t('recruiter.group', 'Group')}`}
                    </button>
                  ))}
                </div>

                {addMode === 'individual' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                    <input value={addForm.username} onChange={e => setAddForm(p => ({ ...p, username: e.target.value }))} placeholder={t('recruiter.usernamePlaceholder', 'Username *')} style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '34px', gridColumn: '1 / -1' }} />
                    <input value={addForm.from_kingdom} onChange={e => setAddForm(p => ({ ...p, from_kingdom: e.target.value.replace(/\D/g, '') }))} placeholder={t('recruiter.kingdomPlaceholder', 'From Kingdom')} style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '34px' }} inputMode="numeric" />
                    <input value={addForm.player_id} onChange={e => setAddForm(p => ({ ...p, player_id: e.target.value }))} placeholder={t('recruiter.playerIdPlaceholder', 'Player ID')} style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '34px' }} />
                    <input value={addForm.power_million} onChange={e => setAddForm(p => ({ ...p, power_million: e.target.value.replace(/[^0-9.]/g, '') }))} placeholder={t('recruiter.powerPlaceholder', 'Power (M)')} style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '34px' }} inputMode="decimal" />
                    <input value={addForm.tc_level} onChange={e => setAddForm(p => ({ ...p, tc_level: e.target.value.replace(/\D/g, '') }))} placeholder={t('recruiter.tcLevelPlaceholder', 'TC Level')} style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '34px' }} inputMode="numeric" />
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                    <input value={addForm.contact_username} onChange={e => setAddForm(p => ({ ...p, contact_username: e.target.value }))} placeholder={t('recruiter.contactNamePlaceholder', 'Contact name *')} style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '34px', gridColumn: '1 / -1' }} />
                    <input value={addForm.contact_kingdom} onChange={e => setAddForm(p => ({ ...p, contact_kingdom: e.target.value.replace(/\D/g, '') }))} placeholder={t('recruiter.kingdomPlaceholder', 'From Kingdom')} style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '34px' }} inputMode="numeric" />
                    <input value={addForm.player_count} onChange={e => setAddForm(p => ({ ...p, player_count: e.target.value.replace(/\D/g, '') }))} placeholder={t('recruiter.playerCountPlaceholder', 'Players *')} style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '34px' }} inputMode="numeric" />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem' }}>
                  <input value={addForm.note} onChange={e => setAddForm(p => ({ ...p, note: e.target.value }))} placeholder={t('recruiter.notePlaceholder', 'Note (optional)')} maxLength={200} style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '34px', flex: 1 }} />
                  <button
                    onClick={handleAddRecruit}
                    disabled={addingSaving}
                    style={{
                      padding: '0.35rem 0.75rem', backgroundColor: '#a855f715', border: '1px solid #a855f740',
                      borderRadius: '6px', color: '#a855f7', fontSize: '0.65rem', fontWeight: '700', cursor: addingSaving ? 'not-allowed' : 'pointer',
                      opacity: addingSaving ? 0.5 : 1, minHeight: '34px', whiteSpace: 'nowrap',
                    }}
                  >
                    {addingSaving ? '...' : t('recruiter.save', 'Save')}
                  </button>
                </div>
              </div>
            )}

            {/* Recruits List */}
            {externalRecruits.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {externalRecruits.map(r => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.5rem',
                    backgroundColor: r.type === 'group' ? '#a855f706' : 'transparent',
                    border: `1px solid ${colors.border}`, borderRadius: '6px',
                  }}>
                    <span style={{ fontSize: '0.7rem' }}>{r.type === 'group' ? '👥' : '👤'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.7rem', color: colors.text, fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.type === 'individual' ? r.username : r.contact_username}
                        {r.type === 'group' && <span style={{ color: '#a855f7', fontWeight: '700', marginLeft: '0.3rem' }}>×{r.player_count}</span>}
                      </div>
                      <div style={{ fontSize: '0.55rem', color: colors.textMuted, display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {(r.from_kingdom || r.contact_kingdom) && <span>K{r.from_kingdom || r.contact_kingdom}</span>}
                        {r.power_million && <span>{r.power_million}M</span>}
                        {r.tc_level && <span>TC{r.tc_level}</span>}
                        {r.note && <span style={{ color: '#6b7280' }}>• {r.note}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteRecruit(r.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.7rem', cursor: 'pointer', padding: '0.2rem', opacity: 0.6, flexShrink: 0 }}
                      title={t('common.delete', 'Delete')}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {externalRecruits.length === 0 && !showAddForm && (
              <p style={{ fontSize: '0.6rem', color: colors.textMuted, margin: '0.25rem 0 0', textAlign: 'center' }}>
                {t('recruiter.noExternalRecruits', 'Track recruits from outside Atlas here')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bulk Select Bar */}
      {filterStatus !== 'watchlist' && visibleApps.length > 1 && filterStatus === 'active' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          marginBottom: '0.5rem', padding: '0.4rem 0.6rem',
          backgroundColor: selectedIds.size > 0 ? '#3b82f608' : 'transparent',
          border: `1px solid ${selectedIds.size > 0 ? '#3b82f625' : 'transparent'}`,
          borderRadius: '8px', transition: 'all 0.15s',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.7rem', color: colors.textSecondary }}>
            <input
              type="checkbox"
              checked={selectedIds.size === visibleApps.length && visibleApps.length > 0}
              onChange={toggleAll}
              style={{ accentColor: '#3b82f6', width: '14px', height: '14px' }}
            />
            {t('recruiter.selectAll', 'Select All')} ({selectedIds.size}/{visibleApps.length})
          </label>
          {selectedIds.size > 0 && (
            <div style={{ display: 'flex', gap: '0.3rem', marginLeft: 'auto' }}>
              {['viewed', 'interested', 'declined'].map(status => {
                const fallbackColor = { bg: '#3b82f615', border: '#3b82f630', text: '#3b82f6' };
                const btnColors: Record<string, { bg: string; border: string; text: string }> = {
                  viewed: fallbackColor,
                  interested: { bg: '#a855f715', border: '#a855f730', text: '#a855f7' },
                  declined: { bg: '#ef444415', border: '#ef444430', text: '#ef4444' },
                };
                const c = btnColors[status] || fallbackColor;
                return (
                  <button
                    key={status}
                    onClick={() => handleBulkAction(status)}
                    disabled={bulkUpdating}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: c.bg,
                      border: `1px solid ${c.border}`,
                      borderRadius: '5px',
                      color: c.text,
                      fontSize: '0.6rem',
                      fontWeight: '600',
                      cursor: bulkUpdating ? 'not-allowed' : 'pointer',
                      opacity: bulkUpdating ? 0.5 : 1,
                      textTransform: 'capitalize',
                      minHeight: '28px',
                    }}
                  >
                    {bulkUpdating ? '...' : status === 'viewed' ? t('appCard.markViewed', 'Mark Viewed') : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {filterStatus !== 'watchlist' && (visibleApps.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '2rem 1rem',
          backgroundColor: colors.surface, borderRadius: '10px',
          border: `1px solid ${colors.border}`,
        }}>
          <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>
            {searchQuery.trim()
              ? t('recruiter.noMatchingApps', 'No applications match your search')
              : filterStatus === 'active' ? t('recruiter.noActiveApps', 'No active applications') : filterStatus === 'approved' ? t('recruiter.noApprovedApps', 'No approved applications') : t('recruiter.noPastApps', 'No past applications')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {visibleApps.map((app) => (
            <div key={app.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
              {filterStatus === 'active' && visibleApps.length > 1 && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(app.id)}
                  onChange={() => toggleSelect(app.id)}
                  style={{ accentColor: '#3b82f6', width: '14px', height: '14px', marginTop: '0.85rem', flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <ApplicationCard
                  application={app}
                  onStatusChange={handleStatusChange}
                  updating={updating}
                  unreadCount={perAppUnreadCounts?.[app.id] || 0}
                  kingdomNumber={kingdomNumber}
                  lastMessagePreview={perAppLastMessages?.[app.id]?.message}
                  lastMessageAt={perAppLastMessages?.[app.id]?.created_at}
                />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default InboxTab;
