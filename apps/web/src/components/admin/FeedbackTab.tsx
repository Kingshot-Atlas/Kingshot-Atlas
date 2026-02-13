import React from 'react';
import { downloadCSV } from '../../utils/csvExport';
import { colors } from '../../utils/styles';

interface FeedbackItem {
  id: string;
  type: string;
  message: string;
  email: string | null;
  status: string;
  page_url: string | null;
  created_at: string;
  admin_notes: string | null;
}

interface FeedbackCounts {
  new: number;
  reviewed: number;
  in_progress: number;
  resolved: number;
  closed: number;
}

interface FeedbackTabProps {
  items: FeedbackItem[];
  counts: FeedbackCounts;
  onUpdateStatus: (id: string, status: string) => void;
  onEmailReply?: (email: string, subject: string, body: string) => void;
}

export const FeedbackTab: React.FC<FeedbackTabProps> = ({ items, counts, onUpdateStatus, onEmailReply }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Feedback Stats + Export */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {(['new', 'reviewed', 'in_progress', 'resolved', 'closed'] as const).map(status => {
            const count = counts[status];
            const statusColors: Record<string, string> = { new: colors.gold, reviewed: colors.primary, in_progress: colors.purple, resolved: colors.success, closed: colors.textMuted };
            return (
              <div key={status} style={{ backgroundColor: colors.cardAlt, padding: '0.75rem 1rem', borderRadius: '8px', border: `1px solid ${colors.border}`, minWidth: '80px', textAlign: 'center' }}>
                <div style={{ color: statusColors[status], fontWeight: 700, fontSize: '1.25rem' }}>{count}</div>
                <div style={{ color: colors.textMuted, fontSize: '0.7rem', textTransform: 'capitalize' }}>{status.replace('_', ' ')}</div>
              </div>
            );
          })}
        </div>
        {items.length > 0 && (
          <button
            onClick={() => downloadCSV(
              items.map(f => ({ type: f.type, message: f.message, email: f.email || '', status: f.status, page: f.page_url || '', date: f.created_at, notes: f.admin_notes || '' })),
              'feedback'
            )}
            style={{
              background: 'none', border: `1px solid ${colors.border}`, borderRadius: '4px',
              color: colors.textMuted, padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.7rem', flexShrink: 0,
            }}
          >
            📥 Export CSV
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>
          No feedback found
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} style={{ backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1rem', border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '1.25rem' }}>
                  {item.type === 'bug' ? '🐛' : item.type === 'feature' ? '✨' : '💭'}
                </span>
                <span style={{ color: colors.text, fontWeight: 600, textTransform: 'capitalize' }}>{item.type}</span>
                <span style={{ 
                  padding: '0.2rem 0.5rem', 
                  borderRadius: '4px', 
                  fontSize: '0.7rem', 
                  fontWeight: 600,
                  backgroundColor: item.status === 'new' ? `${colors.gold}20` : item.status === 'resolved' ? `${colors.success}20` : `${colors.primary}20`,
                  color: item.status === 'new' ? colors.gold : item.status === 'resolved' ? colors.success : colors.primary
                }}>
                  {item.status.replace('_', ' ')}
                </span>
              </div>
              <span style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
                {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            
            <p style={{ color: colors.textSecondary, fontSize: '0.9rem', marginBottom: '0.75rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {item.message}
            </p>
            
            {item.email && (
              <div style={{ fontSize: '0.75rem', color: colors.textSecondary, marginBottom: '0.5rem' }}>
                📧 <a href={`mailto:${item.email}`} style={{ color: colors.primary }}>{item.email}</a>
              </div>
            )}
            
            {item.page_url && (
              <div style={{ fontSize: '0.75rem', color: colors.textMuted, marginBottom: '0.5rem' }}>
                📍 {item.page_url.replace(window.location.origin, '')}
              </div>
            )}

            {item.admin_notes && (
              <div style={{ backgroundColor: colors.bg, padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                <span style={{ color: colors.textMuted }}>Admin notes:</span> <span style={{ color: colors.textSecondary }}>{item.admin_notes}</span>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {item.status === 'new' && (
                <button onClick={() => onUpdateStatus(item.id, 'reviewed')} style={{ padding: '0.4rem 0.75rem', backgroundColor: `${colors.primary}20`, border: `1px solid ${colors.primary}50`, borderRadius: '6px', color: colors.primary, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}>
                  ✓ Mark Reviewed
                </button>
              )}
              {(item.status === 'new' || item.status === 'reviewed') && (
                <button onClick={() => onUpdateStatus(item.id, 'in_progress')} style={{ padding: '0.4rem 0.75rem', backgroundColor: `${colors.purple}20`, border: `1px solid ${colors.purple}50`, borderRadius: '6px', color: colors.purple, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}>
                  🔧 In Progress
                </button>
              )}
              {item.status !== 'resolved' && item.status !== 'closed' && (
                <button onClick={() => onUpdateStatus(item.id, 'resolved')} style={{ padding: '0.4rem 0.75rem', backgroundColor: `${colors.success}20`, border: `1px solid ${colors.success}50`, borderRadius: '6px', color: colors.success, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}>
                  ✅ Resolved
                </button>
              )}
              {item.status !== 'closed' && (
                <button onClick={() => onUpdateStatus(item.id, 'closed')} style={{ padding: '0.4rem 0.75rem', backgroundColor: `${colors.textMuted}20`, border: `1px solid ${colors.textMuted}50`, borderRadius: '6px', color: colors.textMuted, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}>
                  ✕ Close
                </button>
              )}
              {item.email && onEmailReply && (
                <button
                  onClick={() => onEmailReply(
                    item.email!,
                    `Re: ${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Feedback — Kingshot Atlas`,
                    `Hi,\n\nThank you for your ${item.type} feedback:\n> ${item.message.substring(0, 200)}${item.message.length > 200 ? '...' : ''}\n\n`
                  )}
                  style={{ padding: '0.4rem 0.75rem', backgroundColor: `${colors.primary}10`, border: `1px solid ${colors.primary}40`, borderRadius: '6px', color: colors.primary, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}
                >
                  📧 Reply via Email
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
