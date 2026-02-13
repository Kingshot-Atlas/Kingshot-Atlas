import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../utils/styles';

interface AccessEntry {
  id: string;
  user_id: string;
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

export const BattlePlannerAccessTab: React.FC = () => {
  const { user } = useAuth();
  const [accessList, setAccessList] = useState<AccessEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchAccessList = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('battle_planner_access')
        .select('id, user_id, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profile info for each user
      if (data && data.length > 0) {
        const userIds = data.map(d => d.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, linked_username, linked_kingdom, linked_tc_level, linked_avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const entries: AccessEntry[] = data.map(d => {
          const p = profileMap.get(d.user_id);
          return {
            id: d.id,
            user_id: d.user_id,
            created_at: d.created_at,
            linked_username: p?.linked_username || '—',
            linked_kingdom: p?.linked_kingdom || null,
            linked_tc_level: p?.linked_tc_level || null,
            linked_avatar_url: p?.linked_avatar_url || null,
            username: p?.username || 'Unknown',
          };
        });
        setAccessList(entries);
      } else {
        setAccessList([]);
      }
    } catch (err) {
      console.error('Failed to fetch battle planner access list:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccessList();
  }, [fetchAccessList]);

  // Search linked Kingshot users by username
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

      // Filter out users already in access list
      const existingIds = new Set(accessList.map(a => a.user_id));
      setSearchResults((data || []).filter(d => !existingIds.has(d.id)));
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [accessList]);

  const grantAccess = useCallback(async (userId: string) => {
    if (!supabase || !user) return;
    setAdding(userId);
    try {
      const { error } = await supabase
        .from('battle_planner_access')
        .insert({ user_id: userId, granted_by: user.id });

      if (error) throw error;

      setSearchQuery('');
      setSearchResults([]);
      await fetchAccessList();
    } catch (err) {
      console.error('Failed to grant access:', err);
    } finally {
      setAdding(null);
    }
  }, [user, fetchAccessList]);

  const revokeAccess = useCallback(async (entryId: string) => {
    if (!supabase) return;
    setRemoving(entryId);
    try {
      const { error } = await supabase
        .from('battle_planner_access')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
      await fetchAccessList();
    } catch (err) {
      console.error('Failed to revoke access:', err);
    } finally {
      setRemoving(null);
    }
  }, [fetchAccessList]);

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ color: colors.text, margin: 0, fontSize: '1rem' }}>⚔️ KvK Battle Planner Access</h3>
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              Grant or revoke access to the Battle Planner for specific linked Kingshot users.
            </p>
          </div>
          <div style={{
            padding: '0.3rem 0.75rem', backgroundColor: `${colors.error}20`,
            border: `1px solid ${colors.error}40`, borderRadius: '20px',
            color: colors.error, fontSize: '0.75rem', fontWeight: 600,
          }}>
            {accessList.length} user{accessList.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by Kingshot username..."
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
              Searching...
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
                  onClick={() => grantAccess(result.id)}
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
                  {/* Avatar */}
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
                    padding: '0.2rem 0.5rem', backgroundColor: `${colors.success}20`,
                    border: `1px solid ${colors.success}40`, borderRadius: '6px',
                    color: colors.success, fontSize: '0.65rem', fontWeight: 600, flexShrink: 0,
                  }}>
                    {adding === result.id ? '...' : '+ Grant'}
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
                No linked Kingshot users found matching "{searchQuery}"
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Access List */}
      <div style={{
        backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.25rem',
        border: `1px solid ${colors.border}`,
      }}>
        <h4 style={{ color: colors.text, margin: '0 0 0.75rem', fontSize: '0.9rem' }}>
          Authorized Users
        </h4>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.8rem' }}>
            Loading...
          </div>
        ) : accessList.length === 0 ? (
          <div style={{
            padding: '2rem', textAlign: 'center', color: colors.textMuted,
            fontSize: '0.8rem', border: `1px dashed ${colors.border}`, borderRadius: '8px',
          }}>
            No users have Battle Planner access yet. Search above to grant access.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {accessList.map(entry => (
              <div
                key={entry.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.5rem 0.65rem', backgroundColor: colors.bg,
                  border: `1px solid ${colors.surfaceHover}`, borderRadius: '8px',
                }}
              >
                {/* Avatar */}
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
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.linked_username}
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
                    K{entry.linked_kingdom || '?'} · TC{entry.linked_tc_level || '?'} · @{entry.username} · Added {formatDate(entry.created_at)}
                  </div>
                </div>

                <button
                  onClick={() => revokeAccess(entry.id)}
                  disabled={removing === entry.id}
                  style={{
                    padding: '0.25rem 0.6rem', backgroundColor: `${colors.error}15`,
                    border: `1px solid ${colors.error}30`, borderRadius: '6px',
                    color: colors.error, fontSize: '0.65rem', fontWeight: 600,
                    cursor: removing === entry.id ? 'not-allowed' : 'pointer',
                    flexShrink: 0, opacity: removing === entry.id ? 0.5 : 1,
                  }}
                >
                  {removing === entry.id ? '...' : 'Revoke'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
