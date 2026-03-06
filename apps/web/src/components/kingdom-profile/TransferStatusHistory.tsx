import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTransferStatusHistory, useTransferEvents } from '../../hooks/useTransferHubQueries';
import SmartTooltip from '../shared/SmartTooltip';
import { colors } from '../../utils/styles';

interface TransferStatusHistoryProps {
  kingdomNumber: number;
  isMobile: boolean;
}

/** Parse YYYY-MM-DD as UTC to avoid timezone date shift */
function parseEventDate(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  const year = parts[0] ?? 2025;
  const month = parts[1] ?? 1;
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const TransferStatusHistory: React.FC<TransferStatusHistoryProps> = ({ kingdomNumber, isMobile }) => {
  const { t } = useTranslation();
  const { data: history = [], isLoading: historyLoading } = useTransferStatusHistory(kingdomNumber);
  const { data: events = [], isLoading: eventsLoading } = useTransferEvents();

  const isLoading = historyLoading || eventsLoading;

  if (isLoading) {
    return (
      <div style={{
        backgroundColor: colors.card,
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.25rem',
        border: `1px solid ${colors.border}`,
        marginBottom: isMobile ? '1.25rem' : '1.5rem',
      }}>
        <h3 style={{ color: colors.text, fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: '600', margin: '0 0 0.75rem 0', textAlign: 'center' }}>
          {t('kingdomProfile.transferHistory', 'Transfer Status History')}
        </h3>
        <div style={{ color: colors.textMuted, fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>
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
      backgroundColor: colors.card,
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
      border: `1px solid ${colors.border}`,
      marginBottom: isMobile ? '1.25rem' : '1.5rem',
    }}>
      <h3 style={{ color: colors.text, fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: '600', margin: '0 0 0.75rem 0', textAlign: 'center' }}>
        {t('kingdomProfile.transferHistory', 'Transfer Status History')}
      </h3>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: isMobile ? '0.6rem' : '0.5rem',
      }}>
        {history.map((entry) => {
          const event = eventMap.get(entry.event_number);
          const eventDate = event?.event_date ? parseEventDate(event.event_date) : '';
          const isActive = event?.is_current ?? false;
          const isLeading = entry.status === 'Leading';
          const statusColor = isLeading ? colors.primary : colors.text;

          return (
            <SmartTooltip
              key={entry.event_number}
              accentColor={isLeading ? colors.primary : colors.textMuted}
              content={
                <div style={{ fontSize: '0.75rem', lineHeight: '1.5' }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                    {t('kingdomProfile.transferEvent', 'Transfer #{{num}}', { num: entry.event_number })}
                    {eventDate ? ` (${eventDate})` : ''}
                  </div>
                  <div>
                    {t('kingdomProfile.transferGroup', 'Group')} {entry.group_number} — {t(`transferStatuses.${entry.status}`, entry.status)}
                    {entry.is_unofficial ? ` (${t('kingdomProfile.unofficial', 'Unofficial')})` : ''}
                  </div>
                  <div style={{ marginTop: '0.25rem' }}>
                    {isLeading
                      ? t('transferStatuses.leadingDesc', 'This kingdom is leading its transfer group.')
                      : t('transferStatuses.ordinaryDesc', 'This kingdom is an ordinary member of its transfer group.')}
                  </div>
                </div>
              }
            >
              <div
                style={{
                  padding: isMobile ? '0.65rem 0.75rem' : '0.6rem 0.85rem',
                  borderRadius: '10px',
                  backgroundColor: isActive ? `${colors.success}08` : colors.bg,
                  border: `1px solid ${isActive ? `${colors.success}40` : colors.borderSubtle}`,
                  boxShadow: isActive ? `0 0 8px ${colors.success}18, inset 0 0 0 0.5px ${colors.success}20` : 'none',
                  cursor: 'default',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '0.35rem',
                  marginBottom: '0.3rem',
                }}>
                  <span style={{ color: colors.text, fontSize: isMobile ? '0.8rem' : '0.82rem', fontWeight: '600' }}>
                    {t('kingdomProfile.transferEvent', 'Transfer #{{num}}', { num: entry.event_number })}
                  </span>
                  {eventDate && (
                    <span style={{ color: colors.textMuted, fontSize: isMobile ? '0.68rem' : '0.7rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {eventDate}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                  <span style={{ color: colors.textMuted, fontSize: isMobile ? '0.75rem' : '0.75rem' }}>
                    {t('kingdomProfile.transferGroup', 'Group')} {entry.group_number} —
                  </span>
                  <span style={{ color: statusColor, fontSize: isMobile ? '0.75rem' : '0.75rem', fontWeight: '500' }}>
                    {t(`transferStatuses.${entry.status}`, entry.status)}
                  </span>
                </div>
              </div>
            </SmartTooltip>
          );
        })}
      </div>
    </div>
  );
};

export default TransferStatusHistory;
