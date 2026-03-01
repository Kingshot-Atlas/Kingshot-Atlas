import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { neonGlow, FONT_DISPLAY, colors } from '../utils/styles';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const CODES_CACHE_KEY = 'atlas_gift_codes_cache';
const CODES_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

interface GiftCode {
  code: string;
  expire_date?: string;
  is_expired?: boolean;
}

interface RawGiftCode {
  code?: string;
  title?: string;
  expire_date?: string;
  expiresAt?: string;
  is_expired?: boolean;
}

interface SavedPlayerId {
  id: string;
  player_id: string;
  label: string | null;
  sort_order: number;
}

const MAX_ALT_IDS = 5;

const GiftCodes: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('giftCodes.pageTitle', 'Gift Codes'));
  useMetaTags(PAGE_META_TAGS.giftCodes);
  useStructuredData({ type: 'BreadcrumbList', data: PAGE_BREADCRUMBS.tools });
  const isMobile = useIsMobile();
  const { showToast } = useToast();
  const { user, profile } = useAuth();

  const [codes, setCodes] = useState<GiftCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [codesSource, setCodesSource] = useState<string>('');
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Player ID list state
  const [savedIds, setSavedIds] = useState<SavedPlayerId[]>([]);
  const [newPlayerId, setNewPlayerId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [addingId, setAddingId] = useState(false);
  const [copiedPid, setCopiedPid] = useState<string | null>(null);
  const [showPlayerIds, setShowPlayerIds] = useState(true);

  // Fetch saved player IDs
  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from('user_saved_player_ids')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data) setSavedIds(data as SavedPlayerId[]);
      });
  }, [user]);

  const handleAddPlayerId = useCallback(async () => {
    if (!supabase || !user || !newPlayerId.trim() || addingId) return;
    if (savedIds.length >= MAX_ALT_IDS) {
      showToast(t('giftCodes.maxIdsReached', `Maximum ${MAX_ALT_IDS} alt IDs allowed`), 'error');
      return;
    }
    setAddingId(true);
    try {
      const { data, error } = await supabase
        .from('user_saved_player_ids')
        .insert({
          user_id: user.id,
          player_id: newPlayerId.trim(),
          label: newLabel.trim() || null,
          sort_order: savedIds.length,
        })
        .select()
        .single();
      if (error) {
        if (error.code === '23505') {
          showToast(t('giftCodes.duplicateId', 'This Player ID is already saved'), 'error');
        } else {
          showToast(t('giftCodes.addIdError', 'Failed to save Player ID'), 'error');
        }
        return;
      }
      if (data) {
        setSavedIds(prev => [...prev, data as SavedPlayerId]);
        setNewPlayerId('');
        setNewLabel('');
        showToast(t('giftCodes.idAdded', 'Player ID saved'), 'success');
      }
    } finally {
      setAddingId(false);
    }
  }, [supabase, user, newPlayerId, newLabel, addingId, savedIds.length, showToast, t]);

  const handleRemovePlayerId = useCallback(async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('user_saved_player_ids').delete().eq('id', id);
    if (!error) setSavedIds(prev => prev.filter(s => s.id !== id));
  }, [supabase]);

  const copyPlayerId = useCallback((pid: string) => {
    navigator.clipboard.writeText(pid).then(() => {
      setCopiedPid(pid);
      showToast(t('giftCodes.idCopied', { id: pid, defaultValue: `Copied ${pid}` }), 'success');
      setTimeout(() => setCopiedPid(null), 2000);
    }).catch(() => showToast('Failed to copy', 'error'));
  }, [showToast, t]);

  const copyAllPlayerIds = useCallback(() => {
    const ids: string[] = [];
    if (profile?.linked_player_id) ids.push(profile.linked_player_id);
    ids.push(...savedIds.map(s => s.player_id));
    if (ids.length === 0) return;
    navigator.clipboard.writeText(ids.join('\n')).then(() => {
      showToast(t('giftCodes.allIdsCopied', { count: ids.length, defaultValue: `Copied ${ids.length} Player IDs` }), 'success');
    }).catch(() => showToast('Failed to copy', 'error'));
  }, [profile, savedIds, showToast, t]);

  // Fetch active codes (forceRefresh bypasses cache)
  const fetchCodes = useCallback(async (forceRefresh = false, silent = false) => {
    // Check cache first (skip if forcing refresh)
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(CODES_CACHE_KEY);
        if (cached) {
          const { codes: cachedCodes, timestamp, source } = JSON.parse(cached);
          if (Date.now() - timestamp < CODES_CACHE_TTL && cachedCodes?.length > 0) {
            setCodes(cachedCodes);
            setCodesSource(source);
            setLoadingCodes(false);
            return;
          }
        }
      } catch { /* ignore cache errors */ }
    }

    setLoadingCodes(true);
    try {
      // Try backend proxy first, fall back to direct kingshot.net fetch
      let rawCodes: RawGiftCode[] = [];
      let source = 'unknown';

      try {
        const response = await fetch(`${API_BASE}/api/v1/player-link/gift-codes`);
        if (response.ok) {
          const data = await response.json();
          rawCodes = data.codes || [];
          source = data.source || 'backend';
        }
      } catch { /* backend unavailable */ }

      // Fallback: fetch directly from kingshot.net if backend failed
      if (rawCodes.length === 0) {
        try {
          const directRes = await fetch('https://kingshot.net/api/gift-codes');
          if (directRes.ok) {
            const directData = await directRes.json();
            const giftCodes = directData?.data?.giftCodes || directData?.codes || [];
            rawCodes = giftCodes;
            source = 'kingshot.net (direct)';
          }
        } catch { /* direct fetch also failed */ }
      }

      const fetchedCodes: GiftCode[] = rawCodes
        .filter((c: RawGiftCode) => !c.is_expired)
        .map((c: RawGiftCode) => ({
          code: c.code || c.title || '',
          expire_date: c.expire_date || c.expiresAt,
        }))
        .filter((c: GiftCode) => c.code);
      setCodes(fetchedCodes);
      setCodesSource(source);
      if (fetchedCodes.length > 0) {
        localStorage.setItem(CODES_CACHE_KEY, JSON.stringify({
          codes: fetchedCodes,
          timestamp: Date.now(),
          source,
        }));
      }
      if (forceRefresh && !silent && fetchedCodes.length > 0) {
        showToast(t('giftCodes.refreshed', `Found ${fetchedCodes.length} active codes`), 'success');
      }
      if (rawCodes.length === 0 && !silent) {
        showToast(t('giftCodes.noCodesUnavailable', 'Could not fetch gift codes right now. Try again later.'), 'error');
      }
    } catch {
      showToast(t('giftCodes.noCodesUnavailable', 'Could not fetch gift codes right now. Try again later.'), 'error');
    } finally {
      setLoadingCodes(false);
    }
  }, [showToast, t]);

  useEffect(() => { fetchCodes(true, true); }, [fetchCodes]);

  // Format expiration countdown
  const getExpirationCountdown = (expireDate?: string): string | null => {
    if (!expireDate) return null;
    const expiry = new Date(expireDate).getTime();
    const now = Date.now();
    const diff = expiry - now;
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 7) return null; // Only show countdown for codes expiring within 7 days
    if (days > 0) return `${days}d ${hours}h left`;
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m left`;
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      showToast(t('giftCodes.codeCopied', { code, defaultValue: `Copied ${code}` }), 'success');
      setTimeout(() => setCopiedCode(null), 2000);
    }).catch(() => showToast('Failed to copy', 'error'));
  };

  const copyAllCodes = () => {
    const allCodes = codes.map(c => c.code).join('\n');
    navigator.clipboard.writeText(allCodes).then(() => {
      setCopiedAll(true);
      showToast(t('giftCodes.copiedAll', { count: codes.length, defaultValue: `Copied ${codes.length} codes to clipboard` }), 'success');
      setTimeout(() => setCopiedAll(false), 2000);
    }).catch(() => showToast('Failed to copy', 'error'));
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg }}>
      {/* Hero */}
      <div style={{
        padding: isMobile ? '1.5rem 1rem 1rem' : '2rem 2rem 1.25rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #1a1400 0%, #0a0a0a 100%)',
      }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h1 style={{
            fontSize: isMobile ? '1.5rem' : '2rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            fontFamily: FONT_DISPLAY,
            letterSpacing: '0.05em',
          }}>
            <span style={{ color: colors.text }}>GIFT</span>
            <span style={{ ...neonGlow(colors.amber), marginLeft: '0.5rem' }}>CODES</span>
          </h1>
          <p style={{ color: colors.textSecondary, fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.75rem' }}>
            {t('giftCodes.heroSubtitleDisplay', 'Active Kingshot gift codes in one place. Copy and redeem them in-game.')}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes giftPop { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes giftShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .gift-pill:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.3); }
        .gift-action-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.15); }
      `}</style>

      <div style={{ maxWidth: '750px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem' }}>
        {/* Codes Grid */}
        {loadingCodes ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: '0.75rem',
          }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: '120px', borderRadius: '14px', backgroundColor: colors.surface,
                border: '1px solid #1a1a1a', animation: 'pulse 1.5s infinite',
              }} />
            ))}
          </div>
        ) : codes.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '2rem',
            backgroundColor: colors.surface, borderRadius: '12px', border: `1px solid ${colors.border}`,
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📭</div>
            <p style={{ color: colors.textMuted, fontSize: '0.85rem', marginBottom: '1rem' }}>
              {t('giftCodes.noCodesEmpty', 'No active gift codes found right now. Check back later!')}
            </p>
            <button
              onClick={() => fetchCodes(true)}
              disabled={loadingCodes}
              className="gift-action-btn"
              style={{
                padding: '0.4rem 1rem', borderRadius: '8px',
                border: `1px solid ${colors.amber}40`, backgroundColor: `${colors.amber}12`,
                color: colors.amber, fontSize: '0.8rem', fontWeight: '600',
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}
            >
              🔄 {t('giftCodes.refresh', 'Refresh Codes')}
            </button>
          </div>
        ) : (
          <>
            {/* Code pills grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : codes.length < 3 ? `repeat(${codes.length}, 1fr)` : 'repeat(3, 1fr)',
              gap: '0.75rem',
            }}>
              {codes.map((gc, idx) => {
                const countdown = getExpirationCountdown(gc.expire_date);
                const isCopied = copiedCode === gc.code;

                return (
                  <div
                    key={gc.code}
                    className="gift-pill"
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center',
                      padding: '1.25rem 0.75rem 1rem',
                      borderRadius: '14px',
                      backgroundColor: isCopied ? '#22c55e06' : '#111111',
                      border: `1px solid ${isCopied ? '#22c55e40' : '#2a2a2a'}`,
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      animation: `giftPop 0.3s ease ${idx * 0.08}s both`,
                      cursor: 'default',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Shimmer overlay for active codes */}
                    {!isCopied && (
                      <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.03), transparent)',
                        backgroundSize: '200% 100%',
                        animation: 'giftShimmer 3s ease infinite',
                      }} />
                    )}

                    {/* Code text */}
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: isMobile ? '1rem' : '1.1rem',
                      fontWeight: '700',
                      color: isCopied ? '#22c55e' : '#e5e7eb',
                      letterSpacing: '0.04em',
                      textAlign: 'center',
                      marginBottom: '0.15rem',
                    }}>
                      {gc.code}
                    </div>

                    {/* Expiration countdown */}
                    {countdown && (
                      <div style={{
                        fontSize: '0.55rem', fontWeight: 600, marginBottom: '0.3rem',
                        color: countdown === 'Expired' ? colors.error : !countdown.includes('d') ? colors.amber : colors.textMuted,
                      }}>
                        {countdown === 'Expired' ? '⛔ Expired' : `⏳ ${countdown}`}
                      </div>
                    )}

                    {/* Copy button */}
                    <button
                      onClick={() => copyCode(gc.code)}
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.4rem 1.25rem',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        letterSpacing: '0.03em',
                        cursor: 'pointer',
                        backgroundColor: isCopied ? '#22c55e' : colors.amber,
                        color: '#000',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        minWidth: '90px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {isCopied ? `✓ ${t('giftCodes.copiedShort', 'Copied')}` : `📋 ${t('giftCodes.copy', 'Copy')}`}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '0.5rem', marginTop: '1.25rem', maxWidth: '320px', marginLeft: 'auto', marginRight: 'auto',
            }}>
              {/* Copy All Codes */}
              <button
                onClick={copyAllCodes}
                className="gift-action-btn"
                style={{
                  width: '100%',
                  padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  border: `1px solid ${copiedAll ? '#22c55e40' : colors.amber + '50'}`,
                  backgroundColor: copiedAll ? '#22c55e12' : `${colors.amber}15`,
                  color: copiedAll ? '#22c55e' : colors.amber,
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  fontFamily: FONT_DISPLAY,
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  letterSpacing: '0.03em',
                }}
              >
                {copiedAll
                  ? `✓ ${t('giftCodes.allCopied', { count: codes.length, defaultValue: `All ${codes.length} Codes Copied` })}`
                  : `📋 ${t('giftCodes.copyAll', 'Copy All Codes')}`}
              </button>

              {/* Refresh Codes */}
              <button
                onClick={() => fetchCodes(true)}
                disabled={loadingCodes}
                className="gift-action-btn"
                style={{
                  width: '100%',
                  padding: '0.4rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #1a1a1a',
                  backgroundColor: 'transparent',
                  color: '#4b5563',
                  fontSize: '0.7rem',
                  fontWeight: '500',
                  cursor: loadingCodes ? 'default' : 'pointer',
                  opacity: loadingCodes ? 0.4 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                🔄 {t('giftCodes.refresh', 'Refresh Codes')}
              </button>
            </div>
          </>
        )}

        {/* Player ID List — logged-in users only */}
        {user && (
          <div style={{
            marginTop: '1.25rem', padding: isMobile ? '0.75rem' : '1rem',
            backgroundColor: colors.surface, borderRadius: '12px', border: `1px solid #22d3ee20`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showPlayerIds ? '0.6rem' : 0 }}>
              <h3 style={{ color: '#22d3ee', fontSize: '0.8rem', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🎮 {t('giftCodes.playerIds', 'Your Player IDs')}
              </h3>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {(profile?.linked_player_id || savedIds.length > 0) && (
                  <button
                    onClick={copyAllPlayerIds}
                    className="gift-action-btn"
                    style={{
                      padding: '0.25rem 0.5rem', borderRadius: '6px',
                      border: '1px solid #22d3ee30', backgroundColor: '#22d3ee10',
                      color: '#22d3ee', fontSize: '0.6rem', fontWeight: '600', cursor: 'pointer',
                    }}
                  >
                    📋 {t('giftCodes.copyAllIds', 'Copy All')}
                  </button>
                )}
                <button
                  onClick={() => setShowPlayerIds(!showPlayerIds)}
                  style={{
                    padding: '0.25rem 0.5rem', borderRadius: '6px',
                    border: `1px solid ${colors.border}`, backgroundColor: 'transparent',
                    color: colors.textMuted, fontSize: '0.6rem', cursor: 'pointer',
                  }}
                >
                  {showPlayerIds ? '▲' : '▼'}
                </button>
              </div>
            </div>

            {showPlayerIds && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <p style={{ margin: '0 0 0.3rem', fontSize: '0.65rem', color: colors.textMuted }}>
                  {t('giftCodes.playerIdsDesc', 'Save your Player IDs here for quick access when redeeming codes on the official site. Synced across all your devices.')}
                </p>

                {/* Linked account (always first, non-removable) */}
                {profile?.linked_player_id && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem',
                    backgroundColor: '#22d3ee08', border: '1px solid #22d3ee20', borderRadius: '8px',
                  }}>
                    <span style={{ fontSize: '0.55rem', color: '#22d3ee', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0 }}>
                      {t('giftCodes.linkedAccount', 'Linked')}
                    </span>
                    <span style={{
                      flex: 1, fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700,
                      color: copiedPid === profile.linked_player_id ? '#22c55e' : '#e5e7eb',
                      letterSpacing: '0.03em',
                    }}>
                      {profile.linked_player_id}
                    </span>
                    <button
                      onClick={() => copyPlayerId(profile.linked_player_id!)}
                      style={{
                        padding: '0.25rem 0.5rem', borderRadius: '6px', border: 'none',
                        backgroundColor: copiedPid === profile.linked_player_id ? '#22c55e' : '#22d3ee',
                        color: '#000', fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer',
                        transition: 'all 0.2s', minWidth: '50px',
                      }}
                    >
                      {copiedPid === profile.linked_player_id ? '✓' : t('giftCodes.copy', 'Copy')}
                    </button>
                  </div>
                )}

                {/* Saved alt IDs */}
                {savedIds.map((s) => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem',
                    backgroundColor: '#111', border: `1px solid ${colors.border}`, borderRadius: '8px',
                  }}>
                    <span style={{ fontSize: '0.55rem', color: '#a855f7', fontWeight: 600, flexShrink: 0 }}>
                      {s.label || t('giftCodes.alt', 'Alt')}
                    </span>
                    <span style={{
                      flex: 1, fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700,
                      color: copiedPid === s.player_id ? '#22c55e' : '#e5e7eb',
                      letterSpacing: '0.03em',
                    }}>
                      {s.player_id}
                    </span>
                    <button
                      onClick={() => copyPlayerId(s.player_id)}
                      style={{
                        padding: '0.25rem 0.5rem', borderRadius: '6px', border: 'none',
                        backgroundColor: copiedPid === s.player_id ? '#22c55e' : colors.amber,
                        color: '#000', fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer',
                        transition: 'all 0.2s', minWidth: '50px',
                      }}
                    >
                      {copiedPid === s.player_id ? '✓' : t('giftCodes.copy', 'Copy')}
                    </button>
                    <button
                      onClick={() => handleRemovePlayerId(s.id)}
                      style={{
                        padding: '0.2rem 0.35rem', borderRadius: '4px', border: 'none',
                        backgroundColor: '#ef444415', color: '#ef4444', fontSize: '0.6rem',
                        cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* Add new alt ID */}
                {savedIds.length < MAX_ALT_IDS && (
                  <div style={{
                    display: 'flex', gap: '0.35rem', alignItems: 'center',
                    padding: '0.35rem 0.5rem', backgroundColor: '#0a0a0a',
                    border: `1px dashed ${colors.border}`, borderRadius: '8px',
                  }}>
                    <input
                      value={newPlayerId}
                      onChange={e => setNewPlayerId(e.target.value)}
                      placeholder={t('giftCodes.enterPlayerId', 'Player ID')}
                      style={{
                        flex: 1, backgroundColor: 'transparent', border: 'none', outline: 'none',
                        color: '#e5e7eb', fontFamily: 'monospace', fontSize: '0.8rem', padding: '0.3rem 0',
                        minWidth: 0,
                      }}
                      onKeyDown={e => e.key === 'Enter' && handleAddPlayerId()}
                    />
                    <input
                      value={newLabel}
                      onChange={e => setNewLabel(e.target.value)}
                      placeholder={t('giftCodes.labelOptional', 'Label')}
                      maxLength={20}
                      style={{
                        width: isMobile ? '55px' : '80px', backgroundColor: 'transparent',
                        border: `1px solid ${colors.border}`, borderRadius: '4px', outline: 'none',
                        color: '#9ca3af', fontSize: '0.65rem', padding: '0.25rem 0.35rem',
                      }}
                      onKeyDown={e => e.key === 'Enter' && handleAddPlayerId()}
                    />
                    <button
                      onClick={handleAddPlayerId}
                      disabled={addingId || !newPlayerId.trim()}
                      style={{
                        padding: '0.3rem 0.6rem', borderRadius: '6px', border: 'none',
                        backgroundColor: !newPlayerId.trim() ? '#333' : '#22d3ee',
                        color: !newPlayerId.trim() ? '#555' : '#000',
                        fontSize: '0.65rem', fontWeight: 700,
                        cursor: !newPlayerId.trim() || addingId ? 'not-allowed' : 'pointer',
                        opacity: addingId ? 0.5 : 1, whiteSpace: 'nowrap',
                      }}
                    >
                      {addingId ? '...' : `+ ${t('giftCodes.addId', 'Add')}`}
                    </button>
                  </div>
                )}

                {!profile?.linked_player_id && savedIds.length === 0 && (
                  <p style={{ fontSize: '0.65rem', color: '#6b7280', textAlign: 'center', margin: '0.25rem 0', fontStyle: 'italic' }}>
                    {t('giftCodes.noIdsYet', 'No Player IDs saved yet. Add your first one above, or link your account in Settings.')}
                  </p>
                )}

                <p style={{ fontSize: '0.55rem', color: '#4b5563', margin: '0.15rem 0 0', textAlign: 'center' }}>
                  {t('giftCodes.idsLimit', { max: MAX_ALT_IDS, current: savedIds.length, defaultValue: `${savedIds.length}/${MAX_ALT_IDS} alt IDs saved` })}
                </p>
              </div>
            )}
          </div>
        )}

        {/* How to Redeem Section */}
        <div style={{
          marginTop: '1.25rem', padding: '1rem',
          backgroundColor: colors.surface, borderRadius: '12px', border: `1px solid ${colors.amber}20`,
        }}>
          <h3 style={{ color: colors.amber, fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('giftCodes.howToRedeem', 'How to Redeem')}
          </h3>

          {/* Android / In-Game */}
          <p style={{ color: colors.textMuted, fontSize: '0.7rem', fontWeight: 600, margin: '0.5rem 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            📱 {t('giftCodes.androidInGame', 'Android (In-Game)')}
          </p>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', color: colors.textSecondary, fontSize: '0.8rem', lineHeight: 1.8 }}>
            <li>{t('giftCodes.step1', 'Copy the code above')}</li>
            <li>{t('giftCodes.step2', 'Open Kingshot and go to Settings (gear icon)')}</li>
            <li>{t('giftCodes.step3', 'Tap "Gift Code" and paste the code')}</li>
            <li>{t('giftCodes.step4', 'Tap Redeem — rewards appear in your mailbox')}</li>
          </ol>

          {/* iOS / Web */}
          <p style={{ color: colors.textMuted, fontSize: '0.7rem', fontWeight: 600, margin: '0.75rem 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            🍎 {t('giftCodes.iosWeb', 'iOS (Web Redeem)')}
          </p>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', color: colors.textSecondary, fontSize: '0.8rem', lineHeight: 1.8 }}>
            <li>{t('giftCodes.iosStep1', 'Copy the code above')}</li>
            <li>
              {t('giftCodes.iosStep2', 'Visit the')}{' '}
              <a
                href="https://ks-giftcode.centurygame.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: colors.amber, textDecoration: 'underline' }}
              >
                {t('giftCodes.iosRedeemSite', 'official Kingshot Gift Code page')}
              </a>
            </li>
            <li>{t('giftCodes.iosStep3', 'Log in with your account and paste the code')}</li>
            <li>{t('giftCodes.iosStep4', 'Rewards appear in your in-game mailbox')}</li>
          </ol>
          <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
            {t('giftCodes.iosNote', 'iOS users cannot redeem gift codes in-game — use the web link above instead.')}
          </p>
        </div>

        {/* Info Section */}
        <div style={{
          marginTop: '0.75rem', padding: '0.75rem 1rem',
          backgroundColor: colors.surface, borderRadius: '10px', border: '1px solid #1a1a1a',
          fontSize: '0.7rem', color: '#4b5563', lineHeight: 1.6,
        }}>
          <p style={{ margin: 0 }}>
            <strong style={{ color: colors.textMuted }}>{t('giftCodes.aboutCodes', 'About codes:')}</strong>{' '}
            {t('giftCodes.aboutCodesDesc', 'Gift codes are released by Century Games through social media, events, and partnerships. Atlas aggregates them so you never miss one.')}
            {codesSource && codesSource !== 'unavailable' && ` ${t('giftCodes.codesSourced', { source: codesSource, defaultValue: `Codes sourced from ${codesSource}.` })}`}
          </p>
        </div>

        {/* Back links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1.5rem', paddingBottom: '1rem' }}>
          <Link to="/tools" style={{ color: colors.textSecondary, textDecoration: 'none', fontSize: '0.8rem' }}>
            ← {t('giftCodes.backToTools', 'Back to Tools')}
          </Link>
          <Link to="/" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('common.backToHome')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default GiftCodes;
