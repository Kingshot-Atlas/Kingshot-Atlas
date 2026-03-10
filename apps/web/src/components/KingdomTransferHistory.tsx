import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

interface KingdomTransfer {
  id: string;
  from_kingdom: number;
  to_kingdom: number;
  detected_at: string;
}

interface KingdomTransferHistoryProps {
  userId: string;
  themeColor: string;
  isMobile: boolean;
}

const KingdomTransferHistory: React.FC<KingdomTransferHistoryProps> = ({ userId, themeColor, isMobile }) => {
  const { t } = useTranslation();
  const [transfers, setTransfers] = useState<KingdomTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !userId) {
      setLoading(false);
      return;
    }

    const fetchTransfers = async () => {
      try {
        const { data, error } = await supabase!
          .from('kingdom_transfers')
          .select('id, from_kingdom, to_kingdom, detected_at')
          .eq('user_id', userId)
          .order('detected_at', { ascending: false })
          .limit(10);

        if (error) throw error;
        setTransfers(data || []);
      } catch (err) {
        logger.error('Failed to fetch kingdom transfers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransfers();
  }, [userId]);

  if (loading || transfers.length === 0) return null;

  return (
    <div style={{
      marginBottom: '1.5rem',
      padding: isMobile ? '1rem' : '1.25rem',
      backgroundColor: '#111111',
      borderRadius: '12px',
      border: '1px solid #2a2a2a',
    }}>
      <div style={{
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <span style={{ fontSize: '1rem' }}>🔄</span>
        <span style={{
          fontSize: '0.9rem',
          color: '#fff',
          fontWeight: '600',
        }}>{t('profile.kingdomTransferHistory', 'Kingdom Transfer History')}</span>
        <span style={{
          fontSize: '0.7rem',
          color: '#6b7280',
          backgroundColor: '#1a1a2e',
          padding: '0.15rem 0.5rem',
          borderRadius: '9999px',
        }}>{transfers.length}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {transfers.map((transfer) => {
          const date = new Date(transfer.detected_at);
          const formattedDate = date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
          return (
            <div
              key={transfer.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                backgroundColor: '#0a0a0a',
                borderRadius: '8px',
                border: '1px solid #1a1a1a',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: isMobile ? '0.85rem' : '0.9rem',
                fontFamily: 'monospace',
              }}>
                <span style={{ color: '#9ca3af' }}>K{transfer.from_kingdom}</span>
                <span style={{ color: themeColor }}>→</span>
                <span style={{ color: '#fff', fontWeight: '600' }}>K{transfer.to_kingdom}</span>
              </div>
              <span style={{
                fontSize: '0.75rem',
                color: '#6b7280',
              }}>{formattedDate}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KingdomTransferHistory;
