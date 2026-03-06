import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTransferStatusHistory, useTransferEvents } from '../../hooks/useTransferHubQueries';
import SmartTooltip from '../shared/SmartTooltip';

interface TransferStatusHistoryProps {
  kingdomNumber: number;
  isMobile: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  Leading: '#22d3ee',
  Ordinary: '#6b7280',
  Unannounced: '#4b5563',
};

const TransferStatusHistory: React.FC<TransferStatusHistoryProps> = ({ kingdomNumber, isMobile }) => {
  const { t } = useTranslation();
  const { data: history = [], isLoading: historyLoading } = useTransferStatusHistory(kingdomNumber);
  const { data: events = [], isLoading: eventsLoading } = useTransferEvents();

  const isLoading = historyLoading || eventsLoading;

  if (isLoading) {
    return (
      <div style={{
        backgroundColor: '#131318',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.25rem',
        border: '1px solid #2a2a2a',
        marginBottom: isMobile ? '1.25rem' : '1.5rem',
      }}>
        <h3 style={{ color: '#fff', fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: '600', margin: '0 0 0.75rem 0', textAlign: 'center' }}>
          {t('kingdomProfile.transferHistory', 'Transfer History')}
        </h3>
        <div style={{ color: '#6b7280', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>
          {t('common.loading', 'Loading...')}
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return null;
  }

  const eventMap = new Map(events.map(e => [e.event_number, e]));

  return (
    <div style={{
      backgroundColor: '#131318',
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
      border: '1px solid #2a2a2a',
      marginBottom: isMobile ? '1.25rem' : '1.5rem',
    }}>
      <h3 style={{ color: '#fff', fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: '600', margin: '0 0 0.75rem 0', textAlign: 'center' }}>
        {t('kingdomProfile.transferHistory', 'Transfer History')}
      </h3>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.5rem',
      }}>
        {history.map((entry) => {
          const event = eventMap.get(entry.event_number);
          const eventDate = event?.event_date
            ? new Date(event.event_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
            : '';
          const statusColor = STATUS_COLORS[entry.status] || '#6b7280';
          const isCurrent = event?.is_current ?? false;

          return (
            <SmartTooltip
              key={entry.event_number}
              accentColor={statusColor}
              content={
                <div style={{ fontSize: '0.75rem', lineHeight: '1.4' }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                    {t('kingdomProfile.transferEvent', 'Transfer #{{num}}', { num: entry.event_number })}
                    {eventDate ? ` — ${eventDate}` : ''}
                  </div>
                  <div>
                    {t('kingdomProfile.transferGroup', 'Group')}: {entry.group_number}
                    {entry.is_unofficial ? ` (${t('kingdomProfile.unofficial', 'Unofficial')})` : ''}
                  </div>
                  <div style={{ marginTop: '0.25rem' }}>
                    {entry.status === 'Leading'
                      ? t('transferStatuses.leadingDesc', 'This kingdom is leading its transfer group.')
                      : t('transferStatuses.ordinaryDesc', 'This kingdom is an ordinary member of its transfer group.')}
                  </div>
                </div>
              }
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  backgroundColor: isCurrent ? `${statusColor}08` : '#0a0a0a',
                  border: `1px solid ${isCurrent ? `${statusColor}30` : '#1a1a1a'}`,
                  cursor: 'default',
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: statusColor,
                  flexShrink: 0,
                  boxShadow: isCurrent ? `0 0 6px ${statusColor}60` : 'none',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ color: '#e5e7eb', fontSize: '0.8rem', fontWeight: '500' }}>
                      #{entry.event_number}
                    </span>
                    {isCurrent && (
                      <span style={{
                        fontSize: '0.55rem',
                        padding: '0.05rem 0.3rem',
                        borderRadius: '3px',
                        backgroundColor: `${statusColor}15`,
                        border: `1px solid ${statusColor}30`,
                        color: statusColor,
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}>
                        {t('kingdomProfile.current', 'Current')}
                      </span>
                    )}
                    {entry.is_unofficial && (
                      <span style={{
                        fontSize: '0.55rem',
                        padding: '0.05rem 0.3rem',
                        borderRadius: '3px',
                        backgroundColor: '#eab30815',
                        border: '1px solid #eab30830',
                        color: '#eab308',
                        fontWeight: '600',
                      }}>
                        {t('kingdomProfile.unofficial', 'Unofficial')}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                    <span style={{ color: statusColor, fontSize: '0.7rem', fontWeight: '500' }}>
                      {t(`transferStatuses.${entry.status}`, entry.status)}
                    </span>
                    <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>
                      · {t('kingdomProfile.transferGroup', 'Group')} {entry.group_number}
                    </span>
                  </div>
                </div>
                {eventDate && (
                  <span style={{ color: '#4b5563', fontSize: '0.65rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {eventDate}
                  </span>
                )}
              </div>
            </SmartTooltip>
          );
        })}
      </div>
    </div>
  );
};

export default TransferStatusHistory;
