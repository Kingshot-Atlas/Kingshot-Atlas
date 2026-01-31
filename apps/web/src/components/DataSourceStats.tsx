/**
 * DataSourceStats Component
 * Displays KvK data source statistics for admin dashboard
 */

import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { kvkHistoryService } from '../services/kvkHistoryService';

interface DataStats {
  supabase: {
    totalRecords: number;
    uniqueKingdoms: number;
    minKingdom: number;
    maxKingdom: number;
    kvkRange: string;
    lastUpdated: string | null;
  } | null;
  csv: {
    totalRecords: number;
    uniqueKingdoms: number;
  };
  service: {
    source: 'supabase' | 'csv' | 'unknown';
    recordCount: number;
  };
  parity: {
    percentage: number;
    status: 'complete' | 'partial' | 'missing';
  };
}

export const DataSourceStats: React.FC = () => {
  const [stats, setStats] = useState<DataStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get Supabase stats
      let supabaseStats = null;
      if (isSupabaseConfigured && supabase) {
        const { data, error: supabaseError } = await supabase
          .from('kvk_history')
          .select('kingdom_number, kvk_number, created_at')
          .order('created_at', { ascending: false })
          .limit(1);

        if (!supabaseError) {
          // Get aggregate stats
          const { data: countData } = await supabase
            .rpc('get_kvk_stats');

          if (countData && countData.length > 0) {
            supabaseStats = {
              totalRecords: countData[0].total_records || 0,
              uniqueKingdoms: countData[0].unique_kingdoms || 0,
              minKingdom: countData[0].min_kingdom || 0,
              maxKingdom: countData[0].max_kingdom || 0,
              kvkRange: `${countData[0].min_kvk || 1}-${countData[0].max_kvk || 9}`,
              lastUpdated: data?.[0]?.created_at || null,
            };
          } else {
            // Fallback: direct count query
            const { count } = await supabase
              .from('kvk_history')
              .select('*', { count: 'exact', head: true });

            supabaseStats = {
              totalRecords: count || 0,
              uniqueKingdoms: 0,
              minKingdom: 0,
              maxKingdom: 0,
              kvkRange: '1-9',
              lastUpdated: data?.[0]?.created_at || null,
            };
          }
        }
      }

      // Get service stats
      const serviceStats = kvkHistoryService.getDataSource();

      // CSV stats (hardcoded based on known CSV)
      const csvStats = {
        totalRecords: 5042,
        uniqueKingdoms: 1189,
      };

      // Calculate parity
      const supabaseCount = supabaseStats?.totalRecords || 0;
      const parityPercentage = csvStats.totalRecords > 0 
        ? Math.round((supabaseCount / csvStats.totalRecords) * 100 * 10) / 10
        : 0;

      setStats({
        supabase: supabaseStats,
        csv: csvStats,
        service: serviceStats,
        parity: {
          percentage: Math.min(parityPercentage, 100),
          status: parityPercentage >= 100 ? 'complete' : parityPercentage >= 90 ? 'partial' : 'missing',
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        Loading data source stats...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '1.5rem', backgroundColor: '#111116', borderRadius: '12px', border: '1px solid #ef4444' }}>
        <p style={{ color: '#ef4444' }}>Error: {error}</p>
        <button 
          onClick={fetchStats}
          style={{ marginTop: '1rem', padding: '0.5rem 1rem', backgroundColor: '#22d3ee20', border: '1px solid #22d3ee50', borderRadius: '6px', color: '#22d3ee', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return '#22c55e';
      case 'partial': return '#f59e0b';
      case 'missing': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Parity Status Card */}
      <div style={{ 
        backgroundColor: '#111116', 
        borderRadius: '12px', 
        padding: '1.5rem', 
        border: `1px solid ${getStatusColor(stats.parity.status)}40`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ color: '#fff', fontSize: '1rem', margin: 0 }}>📊 Data Parity Status</h3>
          <span style={{ 
            padding: '0.25rem 0.75rem', 
            backgroundColor: `${getStatusColor(stats.parity.status)}20`,
            color: getStatusColor(stats.parity.status),
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: '600',
            textTransform: 'uppercase'
          }}>
            {stats.parity.status}
          </span>
        </div>
        
        {/* Progress Bar */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ 
            height: '8px', 
            backgroundColor: '#1a1a1f', 
            borderRadius: '4px', 
            overflow: 'hidden' 
          }}>
            <div style={{ 
              height: '100%', 
              width: `${stats.parity.percentage}%`,
              backgroundColor: getStatusColor(stats.parity.status),
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
            <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>CSV: {stats.csv.totalRecords.toLocaleString()}</span>
            <span style={{ color: getStatusColor(stats.parity.status), fontSize: '0.875rem', fontWeight: '600' }}>
              {stats.parity.percentage}%
            </span>
            <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Supabase: {stats.supabase?.totalRecords.toLocaleString() || 0}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {/* Supabase Stats */}
        <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.25rem', border: '1px solid #2a2a2a' }}>
          <h4 style={{ color: '#22d3ee', fontSize: '0.875rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🗄️</span> Supabase
          </h4>
          {stats.supabase ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Records</span>
                <span style={{ color: '#fff', fontWeight: '600' }}>{stats.supabase.totalRecords.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Kingdoms</span>
                <span style={{ color: '#fff', fontWeight: '600' }}>{stats.supabase.uniqueKingdoms.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Range</span>
                <span style={{ color: '#fff', fontWeight: '600' }}>K{stats.supabase.minKingdom}-K{stats.supabase.maxKingdom}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>KvK #</span>
                <span style={{ color: '#fff', fontWeight: '600' }}>{stats.supabase.kvkRange}</span>
              </div>
            </div>
          ) : (
            <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: 0 }}>Not connected</p>
          )}
        </div>

        {/* CSV Stats */}
        <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.25rem', border: '1px solid #2a2a2a' }}>
          <h4 style={{ color: '#a855f7', fontSize: '0.875rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📄</span> CSV Source
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Records</span>
              <span style={{ color: '#fff', fontWeight: '600' }}>{stats.csv.totalRecords.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Kingdoms</span>
              <span style={{ color: '#fff', fontWeight: '600' }}>{stats.csv.uniqueKingdoms.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Active Service */}
        <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.25rem', border: '1px solid #2a2a2a' }}>
          <h4 style={{ color: '#22c55e', fontSize: '0.875rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚡</span> Active Source
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Source</span>
              <span style={{ 
                color: stats.service.source === 'supabase' ? '#22c55e' : stats.service.source === 'csv' ? '#f59e0b' : '#ef4444',
                fontWeight: '600',
                textTransform: 'uppercase'
              }}>
                {stats.service.source}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Cached</span>
              <span style={{ color: '#fff', fontWeight: '600' }}>{stats.service.recordCount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={fetchStats}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#22d3ee20',
            border: '1px solid #22d3ee50',
            borderRadius: '6px',
            color: '#22d3ee',
            cursor: 'pointer',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          🔄 Refresh Stats
        </button>
      </div>
    </div>
  );
};

export default DataSourceStats;
