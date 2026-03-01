import React, { useState, useEffect } from 'react';
import { reviewService, ReviewReport } from '../../services/reviewService';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';

interface ReviewReportsTabProps {
  filter: string;
}

export const ReviewReportsTab: React.FC<ReviewReportsTabProps> = ({ filter }) => {
  const { user } = useAuth();
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'reviewed' | 'dismissed' | 'all'>('pending');
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadReports = async () => {
    setLoading(true);
    const data = await reviewService.getReviewReports(statusFilter === 'all' ? undefined : statusFilter);
    setReports(data);
    setLoading(false);
  };

  useEffect(() => {
    loadReports();
  }, [statusFilter]);

  const handleDismiss = async (reportId: string) => {
    if (!user?.id) return;
    setActioningId(reportId);
    const result = await reviewService.updateReportStatus(reportId, 'dismissed', user.id);
    if (result.success) {
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'dismissed' as const } : r));
    }
    setActioningId(null);
  };

  const handleMarkReviewed = async (reportId: string) => {
    if (!user?.id) return;
    setActioningId(reportId);
    const result = await reviewService.updateReportStatus(reportId, 'reviewed', user.id);
    if (result.success) {
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'reviewed' as const } : r));
    }
    setActioningId(null);
  };

  const handleDeleteReview = async (reportId: string, reviewId: string) => {
    if (!user?.id) return;
    if (!confirm('Delete this review permanently? This cannot be undone.')) return;
    setActioningId(reportId);
    const deleteResult = await reviewService.adminDeleteReview(reviewId);
    if (deleteResult.success) {
      await reviewService.updateReportStatus(reportId, 'reviewed', user.id);
      setReports(prev => prev.filter(r => r.review_id !== reviewId));
    }
    setActioningId(null);
  };

  const filteredReports = filter
    ? reports.filter(r =>
        r.reason.toLowerCase().includes(filter.toLowerCase()) ||
        r.review_id.toLowerCase().includes(filter.toLowerCase()) ||
        (r.details && r.details.toLowerCase().includes(filter.toLowerCase()))
      )
    : reports;

  const reasonLabel: Record<string, string> = {
    spam: '🚫 Spam',
    inappropriate: '⚠️ Inappropriate',
    misleading: '🔄 Misleading',
    harassment: '🛑 Harassment',
    other: '📝 Other',
  };

  const statusBadge = (status: string) => {
    const fallback = { bg: '#f59e0b15', border: '#f59e0b40', text: '#f59e0b' };
    const colors: Record<string, { bg: string; border: string; text: string }> = {
      pending: fallback,
      reviewed: { bg: '#22c55e15', border: '#22c55e40', text: '#22c55e' },
      dismissed: { bg: '#6b728015', border: '#6b728040', text: '#6b7280' },
    };
    const c = colors[status] || fallback;
    return (
      <span style={{
        fontSize: '0.6rem', fontWeight: 700, color: c.text,
        backgroundColor: c.bg, border: `1px solid ${c.border}`,
        padding: '0.1rem 0.4rem', borderRadius: '4px',
        textTransform: 'uppercase', letterSpacing: '0.03em',
      }}>
        {status}
      </span>
    );
  };

  const btnStyle: React.CSSProperties = {
    padding: '0.3rem 0.6rem', borderRadius: '5px', cursor: 'pointer',
    fontSize: '0.7rem', fontWeight: 600, border: 'none',
  };

  return (
    <div>
      {/* Status filter */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {(['pending', 'reviewed', 'dismissed', 'all'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '0.35rem 0.75rem',
              backgroundColor: statusFilter === s ? '#f9731620' : 'transparent',
              color: statusFilter === s ? '#f97316' : '#6b7280',
              border: statusFilter === s ? '1px solid #f9731640' : '1px solid transparent',
              borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '0.8rem',
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s === 'pending' && reports.length > 0 && statusFilter === 'pending' && (
              <span style={{
                marginLeft: '0.3rem', backgroundColor: '#f97316', color: '#0a0a0a',
                fontSize: '0.6rem', fontWeight: 700, padding: '0.05rem 0.3rem', borderRadius: '9999px',
              }}>
                {filteredReports.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>Loading reports...</div>
      ) : filteredReports.length === 0 ? (
        <div style={{ color: '#4b5563', textAlign: 'center', padding: '2rem', fontSize: '0.85rem' }}>
          {statusFilter === 'pending' ? 'No pending review reports. 🎉' : 'No reports found.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredReports.map(report => (
            <div
              key={report.id}
              style={{
                backgroundColor: '#111116', borderRadius: '10px',
                border: report.status === 'pending' ? '1px solid #f9731630' : '1px solid #1a1a1a',
                padding: '1rem',
              }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                {statusBadge(report.status)}
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#d1d5db' }}>
                  {reasonLabel[report.reason] || report.reason}
                </span>
                <span style={{ fontSize: '0.65rem', color: '#4b5563', marginLeft: 'auto' }}>
                  {new Date(report.created_at).toLocaleString()}
                </span>
              </div>

              {/* Details */}
              {report.details && (
                <div style={{
                  padding: '0.5rem 0.75rem', backgroundColor: '#0a0a0a', borderRadius: '6px',
                  border: '1px solid #1e1e1e', marginBottom: '0.5rem',
                  fontSize: '0.8rem', color: '#9ca3af', lineHeight: 1.5, fontStyle: 'italic',
                }}>
                  &quot;{report.details}&quot;
                </div>
              )}

              {/* Meta */}
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.65rem', color: '#4b5563', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                {report.kingdom_number && (
                  <span>Kingdom: <Link to={`/kingdom/${report.kingdom_number}`} style={{ color: '#22d3ee', textDecoration: 'none' }}>K{report.kingdom_number}</Link></span>
                )}
                <span>Reported: {report.reported_username ? (
                  <span style={{ color: '#f97316', fontWeight: 600 }}>{report.reported_username}</span>
                ) : (
                  <code style={{ color: '#6b7280' }}>{report.review_id.slice(0, 8)}…</code>
                )}</span>
                <span>Reporter: {report.reporter_username ? (
                  <span style={{ color: '#22d3ee', fontWeight: 600 }}>{report.reporter_username}</span>
                ) : (
                  <code style={{ color: '#6b7280' }}>{report.reporter_id.slice(0, 8)}…</code>
                )}</span>
              </div>

              {/* Actions */}
              {report.status === 'pending' && (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <Link
                    to={report.kingdom_number ? `/kingdom/${report.kingdom_number}#reviews` : '#'}
                    target="_blank"
                    style={{ ...btnStyle, backgroundColor: '#22d3ee15', color: '#22d3ee', border: '1px solid #22d3ee40', textDecoration: 'none' }}
                  >
                    View Review
                  </Link>
                  <button
                    onClick={() => handleMarkReviewed(report.id)}
                    disabled={actioningId === report.id}
                    style={{ ...btnStyle, backgroundColor: '#22c55e15', color: '#22c55e' }}
                  >
                    ✓ Mark Reviewed
                  </button>
                  <button
                    onClick={() => handleDismiss(report.id)}
                    disabled={actioningId === report.id}
                    style={{ ...btnStyle, backgroundColor: '#6b728015', color: '#6b7280' }}
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleDeleteReview(report.id, report.review_id)}
                    disabled={actioningId === report.id}
                    style={{ ...btnStyle, backgroundColor: '#ef444415', color: '#ef4444' }}
                  >
                    🗑️ Delete Review
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
