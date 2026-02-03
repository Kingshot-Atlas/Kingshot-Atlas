/**
 * UserCorrectionStats Component
 * Displays user's KvK data correction contributions on their profile
 */

import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface CorrectionStats {
  totalSubmitted: number;
  totalApproved: number;
  pendingReview: number;
  recentCorrections: Array<{
    kingdom_number: number;
    kvk_number: number;
    status: 'approved' | 'pending' | 'rejected';
    submitted_at: string;
  }>;
}

interface Props {
  userId: string;
  username?: string;
  themeColor?: string;
  isOwnProfile?: boolean;
}

export function UserCorrectionStats({ userId, username: _username, themeColor = '#22d3ee', isOwnProfile = false }: Props) {
  const [stats, setStats] = useState<CorrectionStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCorrectionStats = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setStats({ totalSubmitted: 0, totalApproved: 0, pendingReview: 0, recentCorrections: [] });
      setLoading(false);
      return;
    }

    try {
      // Fetch approved corrections from Supabase
      const { data: approvedData, error: approvedError } = await supabase
        .from('kvk_corrections')
        .select('kingdom_number, kvk_number, corrected_at')
        .eq('submitted_by', userId);

      if (approvedError) {
        console.warn('Failed to fetch correction stats:', approvedError);
        setStats({ totalSubmitted: 0, totalApproved: 0, pendingReview: 0, recentCorrections: [] });
        setLoading(false);
        return;
      }

      // Fetch pending KvK errors from Supabase
      const { data: pendingData } = await supabase
        .from('kvk_errors')
        .select('kingdom_number, kvk_number, submitted_at, status')
        .eq('submitted_by', userId)
        .eq('status', 'pending');

      const pendingCorrections = (pendingData || []).map(e => ({
        kingdom_number: e.kingdom_number,
        kvk_number: e.kvk_number || 0,
        status: 'pending' as const,
        submitted_at: e.submitted_at,
      }));

      setStats({
        totalSubmitted: (approvedData?.length || 0) + pendingCorrections.length,
        totalApproved: approvedData?.length || 0,
        pendingReview: pendingCorrections.length,
        recentCorrections: [
          ...(approvedData || []).map(c => ({
            kingdom_number: c.kingdom_number,
            kvk_number: c.kvk_number,
            status: 'approved' as const,
            submitted_at: c.corrected_at,
          })),
          ...pendingCorrections,
        ].slice(0, 5),
      });
    } catch (err) {
      console.warn('Error fetching correction stats:', err);
      setStats({
        totalSubmitted: 0,
        totalApproved: 0,
        pendingReview: 0,
        recentCorrections: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCorrectionStats();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{
        backgroundColor: '#111111',
        borderRadius: '12px',
        padding: '1.5rem',
        border: '1px solid #2a2a2a',
      }}>
        <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading correction stats...</div>
      </div>
    );
  }

  if (!stats || (stats.totalSubmitted === 0 && !isOwnProfile)) {
    return null; // Don't show section if no corrections and viewing someone else
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#22c55e';
      case 'pending': return '#f59e0b';
      case 'rejected': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '12px',
      padding: '1.5rem',
      border: '1px solid #2a2a2a',
    }}>
      <h3 style={{
        fontSize: '1.125rem',
        fontWeight: '600',
        color: '#fff',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <span style={{ fontSize: '1.25rem' }}>📊</span>
        Data Contributions
      </h3>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
        marginBottom: stats.recentCorrections.length > 0 ? '1.5rem' : 0,
      }}>
        <div style={{
          backgroundColor: '#0a0a0a',
          borderRadius: '8px',
          padding: '1rem',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: themeColor,
          }}>
            {stats.totalSubmitted}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
            Submitted
          </div>
        </div>

        <div style={{
          backgroundColor: '#0a0a0a',
          borderRadius: '8px',
          padding: '1rem',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#22c55e',
          }}>
            {stats.totalApproved}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
            Approved
          </div>
        </div>

        <div style={{
          backgroundColor: '#0a0a0a',
          borderRadius: '8px',
          padding: '1rem',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#f59e0b',
          }}>
            {stats.pendingReview}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
            Pending
          </div>
        </div>
      </div>

      {/* Recent Corrections */}
      {stats.recentCorrections.length > 0 && (
        <div>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#9ca3af',
            marginBottom: '0.75rem',
          }}>
            Recent Corrections
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {stats.recentCorrections.map((correction, idx) => (
              <div
                key={`${correction.kingdom_number}-${correction.kvk_number}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#0a0a0a',
                  borderRadius: '6px',
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                }}
              >
                <span style={{ color: '#fff' }}>
                  K{correction.kingdom_number} KvK #{correction.kvk_number}
                </span>
                <span style={{
                  color: getStatusColor(correction.status),
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  textTransform: 'capitalize',
                }}>
                  {correction.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State for Own Profile */}
      {stats.totalSubmitted === 0 && isOwnProfile && (
        <div style={{
          textAlign: 'center',
          padding: '1rem',
          color: '#6b7280',
          fontSize: '0.875rem',
        }}>
          <p>You haven&apos;t submitted any KvK corrections yet.</p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem' }}>
            Found incorrect KvK data? Report it on a kingdom&apos;s profile page!
          </p>
        </div>
      )}
    </div>
  );
}

export default UserCorrectionStats;
