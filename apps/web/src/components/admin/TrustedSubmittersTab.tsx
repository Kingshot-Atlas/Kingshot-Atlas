import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';

interface TrustedEntry {
  id: string;
  user_id: string;
  reason: string | null;
  created_at: string;
  linked_username: string;
  linked_kingdom: number | null;
  linked_tc_level: number | null;
  linked_avatar_url: string | null;
  username: string;
}

interface SearchResult {
  id: string;
  username: string;
  linked_username: string;
  linked_kingdom: number | null;
  linked_tc_level: number | null;
  linked_avatar_url: string | null;
}

const ACCENT = '#10b981';

export const TrustedSubmittersTab: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [entries, setEntries] = useState<TrustedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('trusted_submitters')
        .select('id, user_id, reason, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = data.map(d => d.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, linked_username, linked_kingdom, linked_tc_level, linked_avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const list: TrustedEntry[] = data.map(d => {
          const p = profileMap.get(d.user_id);
          return {
            id: d.id,
            user_id: d.user_id,
            reason: d.reason,
            created_at: d.created_at,
            linked_username: p?.linked_username || '—',
            linked_kingdom: p?.linked_kingdom || null,
            linked_tc_level: p?.linked_tc_level || null,
            linked_avatar_url: p?.linked_avatar_url || null,
            username: p?.username || 'Unknown',
          };
        });
        setEntries(list);
      } else {
        setEntries([]);
      }
    } catch (err) {
      logger.error('Failed to fetch trusted submitters:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!supabase || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, linked_username, linked_kingdom, linked_tc_level, linked_avatar_url')
        .not('linked_player_id', 'is', null)
        .ilike('linked_username', `%${query.trim()}%`)
        .limit(10);

      if (error) throw error;

      const existingIds = new Set(entries.map(e => e.user_id));
      setSearchResults((data || []).filter(d => !existingIds.has(d.id)));
    } catch (err) {
      logger.error('Trusted submitters search failed:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [entries]);

  const grantTrust = useCallback(async (userId: string) => {
    if (!supabase || !user) return;
    setAdding(userId);
    try {
      const { error } = await supabase
        .from('trusted_submitters')
        .insert({ user_id: userId, granted_by: user.id, reason: 'Manually added by admin' });

      if (error) throw error;

      setSearchQuery('');
      setSearchResults([]);
      await fetchEntries();
    } catch (err) {
      logger.error('Failed to grant trusted submitter status:', err);
    } finally {
      setAdding(null);
    }
  }, [user, fetchEntries]);

  const revokeTrust = useCallback(async (entryId: string) => {
    if (!supabase) return;
    setRemoving(entryId);
    try {
      const { error } = await supabase
        .from('trusted_submitters')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
      await fetchEntries();
    } catch (err) {
      logger.error('Failed to revoke trusted submitter status:', err);
    } finally {
      setRemoving(null);
    }
  }, [fetchEntries]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{
        backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.25rem',
        border: `1px solid ${colors.border}`,
      }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <h3 style={{ color: colors.text, margin: 0, fontSize: '1rem' }}>
            ✅ {t('admin.trustedSubmitters.title', 'Trusted Submitters')}
          </h3>
          <p style={{ color: colors.textMuted, fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
            {t('admin.trustedSubmitters.description', 'These users can submit KvK results and data corrections without screenshots. Their submissions are auto-approved like admin submissions.')}
          </p>
        </div>

        {/* Perks Info */}
        <div style={{
          padding: '0.6rem 0.75rem', backgroundColor: `${ACCENT}08`,
          border: `1px solid ${ACCENT}20`, borderRadius: '8px', marginBottom: '1rem',
        }}>
          <span style={{ color: ACCENT, fontSize: '0.75rem', fontWeight: 600 }}>
            {t('admin.trustedSubmitters.perksTitle', 'Trusted Submitter Perks')}
          </span>
          <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.2rem', color: colors.textSecondary, fontSize: '0.72rem', lineHeight: 1.6 }}>
            <li>{t('admin.trustedSubmitters.perk1', 'No screenshot required for KvK result submissions')}</li>
            <li>{t('admin.trustedSubmitters.perk2', 'Submissions are auto-approved (no admin review queue)')}</li>
            <li>{t('admin.trustedSubmitters.perk3', 'Data corrections are fast-tracked')}</li>
            <li>{t('admin.trustedSubmitters.perk4', '"✅ Trusted" badge on their profile')}</li>
          </ul>
        </div>

        {/* Count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ color: ACCENT, fontSize: '0.85rem', fontWeight: 700 }}>
            ✅ {t('admin.trustedSubmitters.active', 'Active Trusted Submitters')}
          </span>
          <div style={{
            padding: '0.2rem 0.6rem', backgroundColor: `${ACCENT}20`,
            border: `1px solid ${ACCENT}40`, borderRadius: '20px',
            color: ACCENT, fontSize: '0.7rem', fontWeight: 600,
          }}>
            {entries.length} {t('admin.trustedSubmitters.users', 'user')}{entries.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder={t('admin.trustedSubmitters.searchPlaceholder', 'Search by Kingshot username to add...')}
            style={{
              width: '100%', padding: '0.6rem 0.75rem', backgroundColor: colors.bg,
              border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.text,
              fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
            }}
          />
          {searching && (
            <span style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              color: colors.textMuted, fontSize: '0.7rem',
            }}>
              {t('admin.trustedSubmitters.searching', 'Searching...')}
            </span>
          )}

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              marginTop: '4px', backgroundColor: colors.cardAlt, border: `1px solid ${colors.border}`,
              borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              maxHeight: '280px', overflowY: 'auto',
            }}>
              {searchResults.map(result => (
                <button
                  key={result.id}
                  onClick={() => grantTrust(result.id)}
                  disabled={adding === result.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    width: '100%', padding: '0.6rem 0.75rem', backgroundColor: 'transparent',
                    border: 'none', borderBottom: `1px solid ${colors.surfaceHover}`, cursor: 'pointer',
                    textAlign: 'left', color: colors.text, transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1a1a2a')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {result.linked_avatar_url ? (
                    <img
                      src={result.linked_avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      backgroundColor: colors.border, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', flexShrink: 0, fontSize: '0.7rem',
                    }}>
                      👤
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {result.linked_username}
                    </div>
                    <div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
                      K{result.linked_kingdom || '?'} · TC{result.linked_tc_level || '?'} · @{result.username}
                    </div>
                  </div>
                  <span style={{
                    padding: '0.2rem 0.5rem', backgroundColor: `${ACCENT}20`,
                    border: `1px solid ${ACCENT}40`, borderRadius: '6px',
                    color: ACCENT, fontSize: '0.65rem', fontWeight: 600, flexShrink: 0,
                  }}>
                    {adding === result.id ? '...' : `+ ${t('admin.trustedSubmitters.grant', 'Trust')}`}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              marginTop: '4px', backgroundColor: colors.cardAlt, border: `1px solid ${colors.border}`,
              borderRadius: '8px', padding: '0.75rem', textAlign: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}>
              <span style={{ color: colors.textMuted, fontSize: '0.8rem' }}>
                {t('admin.trustedSubmitters.noResults', 'No linked Kingshot users found matching "{{query}}"', { query: searchQuery })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Trusted Submitters List */}
      <div style={{
        backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.25rem',
        border: `1px solid ${colors.border}`,
      }}>
        <h4 style={{ color: colors.text, margin: '0 0 0.75rem', fontSize: '0.9rem' }}>
          {t('admin.trustedSubmitters.listTitle', 'Current Trusted Submitters')}
        </h4>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.8rem' }}>
            {t('admin.trustedSubmitters.loading', 'Loading...')}
          </div>
        ) : entries.length === 0 ? (
          <div style={{
            padding: '2rem', textAlign: 'center', color: colors.textMuted,
            fontSize: '0.8rem', border: `1px dashed ${colors.border}`, borderRadius: '8px',
          }}>
            {t('admin.trustedSubmitters.noUsersYet', 'No trusted submitters yet. Search above to add users.')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {entries.map(entry => (
              <div
                key={entry.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.5rem 0.65rem', backgroundColor: colors.bg,
                  border: `1px solid ${colors.surfaceHover}`, borderRadius: '8px',
                }}
              >
                {entry.linked_avatar_url ? (
                  <img
                    src={entry.linked_avatar_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    backgroundColor: colors.border, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem',
                  }}>
                    👤
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.linked_username}
                    </span>
                    <span style={{
                      padding: '0.05rem 0.3rem', backgroundColor: `${ACCENT}15`,
                      border: `1px solid ${ACCENT}30`, borderRadius: '4px',
                      color: ACCENT, fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase',
                    }}>
                      ✅ Trusted
                    </span>
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
                    K{entry.linked_kingdom || '?'} · TC{entry.linked_tc_level || '?'} · @{entry.username} · {t('admin.trustedSubmitters.added', 'Added')} {formatDate(entry.created_at)}
                  </div>
                </div>

                <button
                  onClick={() => revokeTrust(entry.id)}
                  disabled={removing === entry.id}
                  style={{
                    padding: '0.25rem 0.6rem', backgroundColor: `${colors.error}15`,
                    border: `1px solid ${colors.error}30`, borderRadius: '6px',
                    color: colors.error, fontSize: '0.65rem', fontWeight: 600,
                    cursor: removing === entry.id ? 'not-allowed' : 'pointer',
                    flexShrink: 0, opacity: removing === entry.id ? 0.5 : 1,
                  }}
                >
                  {removing === entry.id ? '...' : t('admin.trustedSubmitters.revoke', 'Remove')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
