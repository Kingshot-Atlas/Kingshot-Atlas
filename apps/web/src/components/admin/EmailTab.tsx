import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getAuthHeaders } from '../../services/authHeaders';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

interface SupportEmail {
  id: string;
  direction: 'inbound' | 'outbound';
  from_email: string;
  to_email: string;
  subject: string;
  body_text: string;
  body_html?: string;
  status: string;
  thread_id?: string;
  in_reply_to?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface EmailStats {
  total: number;
  inbound: number;
  outbound: number;
  unread: number;
  sent: number;
  failed: number;
  avg_response_minutes?: number | null;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  unread: { bg: `${colors.gold}20`, border: `${colors.gold}50`, text: colors.gold },
  read: { bg: `${colors.textMuted}20`, border: `${colors.textMuted}50`, text: colors.textMuted },
  replied: { bg: `${colors.success}20`, border: `${colors.success}50`, text: colors.success },
  sent: { bg: `${colors.primary}20`, border: `${colors.primary}50`, text: colors.primary },
  draft: { bg: `${colors.purple}20`, border: `${colors.purple}50`, text: colors.purple },
  failed: { bg: `${colors.error}20`, border: `${colors.error}50`, text: colors.error },
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  bug_report: { bg: `${colors.error}20`, text: colors.error, label: 'Bug' },
  feature_request: { bg: `${colors.purple}20`, text: colors.purple, label: 'Feature' },
  feedback: { bg: `${colors.success}20`, text: colors.success, label: 'Feedback' },
  transfer: { bg: `${colors.orange}20`, text: colors.orange, label: 'Transfer' },
  score_inquiry: { bg: `${colors.warning}20`, text: colors.warning, label: 'Score' },
  billing: { bg: `${colors.pink}20`, text: colors.pink, label: 'Billing' },
  general: { bg: `${colors.textMuted}20`, text: colors.textMuted, label: 'General' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface CannedResponse {
  id: string;
  label: string;
  subject: string;
  body: string;
  tags: string[];
  usage_count: number;
}

export const EmailTab: React.FC = () => {
  const { t } = useTranslation();
  const [emails, setEmails] = useState<SupportEmail[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<SupportEmail | null>(null);
  const [view, setView] = useState<'inbox' | 'compose'>('inbox');
  const [filter, setFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupByThread, setGroupByThread] = useState(false);

  // Compose state
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<SupportEmail | null>(null);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const authHeaders = await getAuthHeaders({ requireAuth: false });
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('direction', filter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      
      const res = await fetch(`${API_URL}/api/v1/admin/email/inbox?${params}`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails || []);
      }
    } catch (err) {
      logger.error('Failed to fetch emails:', err);
    }
    setLoading(false);
  }, [filter, statusFilter, searchQuery]);

  // S1.3: Group emails by thread
  const groupedEmails = React.useMemo(() => {
    if (!groupByThread) return emails;
    const threads = new Map<string, SupportEmail[]>();
    const standalone: SupportEmail[] = [];
    for (const email of emails) {
      const tid = email.thread_id || email.id;
      if (email.thread_id) {
        if (!threads.has(tid)) threads.set(tid, []);
        threads.get(tid)!.push(email);
      } else {
        standalone.push(email);
      }
    }
    // Return thread heads (latest email per thread) + standalone
    const heads: SupportEmail[] = [];
    for (const [, thread] of threads) {
      thread.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const head = thread[0]!;
      heads.push({ ...head, metadata: { ...(head.metadata || {}), threadCount: thread.length } } as SupportEmail);
    }
    return [...heads, ...standalone].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [emails, groupByThread]);

  // S1.5: Fetch canned responses from Supabase
  const fetchTemplates = useCallback(async () => {
    try {
      const authHeaders = await getAuthHeaders({ requireAuth: false });
      const res = await fetch(`${API_URL}/api/v1/admin/email/templates`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setCannedResponses(data.templates || []);
      }
    } catch { /* silent */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const authHeaders = await getAuthHeaders({ requireAuth: false });
      const res = await fetch(`${API_URL}/api/v1/admin/email/stats`, { headers: authHeaders });
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (err) {
      logger.error('Failed to fetch email stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchEmails();
    fetchStats();
    fetchTemplates();
    // S2.2: Check for pre-filled compose data from feedback reply
    const prefill = sessionStorage.getItem('email_prefill');
    if (prefill) {
      try {
        const data = JSON.parse(prefill);
        setComposeTo(data.to || '');
        setComposeSubject(data.subject || '');
        setComposeBody(data.body || '');
        setView('compose');
        sessionStorage.removeItem('email_prefill');
      } catch { /* ignore */ }
    }
  }, [fetchEmails, fetchStats, fetchTemplates]);

  const markAsRead = async (emailId: string) => {
    try {
      const authHeaders = await getAuthHeaders({ requireAuth: false });
      await fetch(`${API_URL}/api/v1/admin/email/${emailId}/read`, {
        method: 'PATCH',
        headers: authHeaders,
      });
      fetchEmails();
      fetchStats();
    } catch (err) {
      logger.error('Failed to mark email as read:', err);
    }
  };

  const handleSend = async () => {
    if (!composeTo || !composeSubject || !composeBody) return;
    setSending(true);
    try {
      const authHeaders = await getAuthHeaders({ requireAuth: false });
      const res = await fetch(`${API_URL}/api/v1/admin/email/send`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          body_text: composeBody,
          in_reply_to: replyingTo?.id || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          resetCompose();
          setView('inbox');
          fetchEmails();
          fetchStats();
        } else {
          alert(`Send failed: ${data.error || 'Unknown error'}`);
        }
      }
    } catch (err) {
      logger.error('Failed to send email:', err);
    }
    setSending(false);
  };

  const resetCompose = () => {
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    setReplyingTo(null);
  };

  const startReply = (email: SupportEmail) => {
    setReplyingTo(email);
    setComposeTo(email.from_email);
    setComposeSubject(email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`);
    setComposeBody(`\n\n---\nOn ${new Date(email.created_at).toLocaleString()}, ${email.from_email} wrote:\n> ${email.body_text.split('\n').join('\n> ')}`);
    setView('compose');
  };

  const deleteEmail = async (emailId: string) => {
    if (!confirm('Delete this email permanently?')) return;
    try {
      const authHeaders = await getAuthHeaders({ requireAuth: false });
      const res = await fetch(`${API_URL}/api/v1/admin/email/${emailId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        if (selectedEmail?.id === emailId) setSelectedEmail(null);
        fetchEmails();
        fetchStats();
      }
    } catch (err) {
      logger.error('Failed to delete email:', err);
    }
  };

  const selectEmail = (email: SupportEmail) => {
    setSelectedEmail(email);
    if (email.status === 'unread') {
      markAsRead(email.id);
    }
  };

  // Stats bar
  const StatBadge: React.FC<{ label: string; count: number; color: string }> = ({ label, count, color }) => (
    <div style={{ 
      backgroundColor: colors.cardAlt, padding: '0.5rem 0.75rem', borderRadius: '8px', 
      border: `1px solid ${colors.border}`, textAlign: 'center', minWidth: '60px' 
    }}>
      <div style={{ color, fontWeight: 700, fontSize: '1.1rem' }}>{count}</div>
      <div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{label}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <h3 style={{ color: colors.text, margin: 0, fontSize: '1.1rem' }}>📧 Support Email</h3>
          <span style={{ color: colors.textMuted, fontSize: '0.8rem' }}>support@ks-atlas.com</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => { setView('inbox'); setSelectedEmail(null); }} 
            style={{ 
              padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
              backgroundColor: view === 'inbox' ? `${colors.primary}20` : 'transparent',
              color: view === 'inbox' ? colors.primary : colors.textMuted,
              border: view === 'inbox' ? `1px solid ${colors.primary}40` : `1px solid ${colors.border}`,
            }}
          >
            Inbox
          </button>
          <button 
            onClick={() => { setView('compose'); setSelectedEmail(null); resetCompose(); }} 
            style={{ 
              padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
              backgroundColor: view === 'compose' ? `${colors.success}20` : 'transparent',
              color: view === 'compose' ? colors.success : colors.textMuted,
              border: view === 'compose' ? `1px solid ${colors.success}40` : `1px solid ${colors.border}`,
            }}
          >
            ✏️ Compose
          </button>
          <button 
            onClick={() => { fetchEmails(); fetchStats(); }} 
            style={{ 
              padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem',
              backgroundColor: 'transparent', color: colors.textMuted, border: `1px solid ${colors.border}`,
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <StatBadge label="Total" count={stats.total} color={colors.text} />
          <StatBadge label="Unread" count={stats.unread} color={colors.gold} />
          <StatBadge label="Inbound" count={stats.inbound} color={colors.purple} />
          <StatBadge label="Sent" count={stats.sent} color={colors.primary} />
          <StatBadge label="Failed" count={stats.failed} color={colors.error} />
          {stats.avg_response_minutes != null && (
            <div style={{ 
              backgroundColor: colors.cardAlt, padding: '0.5rem 0.75rem', borderRadius: '8px', 
              border: `1px solid ${colors.border}`, textAlign: 'center', minWidth: '60px' 
            }}>
              <div style={{ color: colors.success, fontWeight: 700, fontSize: '1.1rem' }}>
                {stats.avg_response_minutes < 60
                  ? `${stats.avg_response_minutes}m`
                  : `${(Math.round(stats.avg_response_minutes / 60 * 10) / 10)}h`}
              </div>
              <div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{t('admin.avgReply', 'Avg Reply')}</div>
            </div>
          )}
        </div>
      )}

      {view === 'inbox' ? (
        <>
          {/* S1.4: Search bar */}
          <div style={{ marginBottom: '0.25rem' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchEmails(); }}
              placeholder="Search emails by subject, body, or sender..."
              style={{
                width: '100%', padding: '0.5rem 0.75rem', backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.85rem',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {(['all', 'inbound', 'outbound'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem',
                backgroundColor: filter === f ? `${colors.primary}20` : 'transparent',
                color: filter === f ? colors.primary : colors.textMuted,
                border: filter === f ? `1px solid ${colors.primary}40` : '1px solid transparent',
                textTransform: 'capitalize',
              }}>
                {f}
              </button>
            ))}
            <span style={{ borderLeft: `1px solid ${colors.border}`, margin: '0 0.25rem' }} />
            {(['all', 'unread', 'read', 'replied', 'sent', 'failed'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{
                padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem',
                backgroundColor: statusFilter === s ? `${colors.primary}20` : 'transparent',
                color: statusFilter === s ? colors.primary : colors.textMuted,
                border: statusFilter === s ? `1px solid ${colors.primary}40` : '1px solid transparent',
                textTransform: 'capitalize',
              }}>
                {s}
              </button>
            ))}
            <span style={{ borderLeft: `1px solid ${colors.border}`, margin: '0 0.25rem' }} />
            <button onClick={() => setGroupByThread(!groupByThread)} style={{
              padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem',
              backgroundColor: groupByThread ? `${colors.purple}20` : 'transparent',
              color: groupByThread ? colors.purple : colors.textMuted,
              border: groupByThread ? `1px solid ${colors.purple}40` : '1px solid transparent',
            }}>
              {groupByThread ? '🔗 Threaded' : '🔗 Thread'}
            </button>
          </div>

          {/* Email List + Detail Split View */}
          <div style={{ display: 'grid', gridTemplateColumns: selectedEmail ? '1fr 1.5fr' : '1fr', gap: '1rem', minHeight: '400px' }}>
            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '600px', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: colors.textMuted }}>Loading...</div>
              ) : emails.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: colors.textMuted }}>
                  No emails yet. Emails to support@ks-atlas.com will appear here once Email Routing is configured.
                </div>
              ) : (
                groupedEmails.map(email => {
                  const isSelected = selectedEmail?.id === email.id;
                  const isUnread = email.status === 'unread';
                  const sc = STATUS_COLORS[email.status] ?? { bg: `${colors.textMuted}20`, border: `${colors.textMuted}50`, text: colors.textMuted };
                  return (
                    <div 
                      key={email.id} 
                      onClick={() => selectEmail(email)}
                      style={{ 
                        padding: '0.75rem', borderRadius: '8px', cursor: 'pointer',
                        backgroundColor: isSelected ? '#1a1a2a' : colors.cardAlt,
                        border: isSelected ? `1px solid ${colors.primary}40` : `1px solid ${colors.borderSubtle}`,
                        borderLeft: isUnread ? `3px solid ${colors.gold}` : '3px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ 
                          color: isUnread ? colors.text : colors.textSecondary, fontWeight: isUnread ? 600 : 400, fontSize: '0.85rem',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%'
                        }}>
                          {email.direction === 'inbound' ? email.from_email : `→ ${email.to_email}`}
                        </span>
                        <span style={{ color: '#4b5563', fontSize: '0.7rem', flexShrink: 0 }}>
                          {timeAgo(email.created_at)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          padding: '0.1rem 0.35rem', borderRadius: '3px', fontSize: '0.6rem', fontWeight: 600,
                          backgroundColor: email.direction === 'inbound' ? `${colors.purple}15` : `${colors.primary}15`,
                          color: email.direction === 'inbound' ? colors.purple : colors.primary,
                        }}>
                          {email.direction === 'inbound' ? '↓ IN' : '↑ OUT'}
                        </span>
                        <span style={{
                          padding: '0.1rem 0.35rem', borderRadius: '3px', fontSize: '0.6rem', fontWeight: 600,
                          backgroundColor: sc.bg, color: sc.text,
                        }}>
                          {email.status}
                        </span>
                        {(() => {
                          const cat = (email.metadata as Record<string, unknown>)?.category as string | undefined;
                          const cc = cat ? CATEGORY_COLORS[cat] : null;
                          return cc ? (
                            <span style={{
                              padding: '0.1rem 0.35rem', borderRadius: '3px', fontSize: '0.6rem', fontWeight: 600,
                              backgroundColor: cc.bg, color: cc.text,
                            }}>
                              {cc.label}
                            </span>
                          ) : null;
                        })()}
                        <span style={{ 
                          color: isUnread ? '#e5e7eb' : colors.textMuted, fontSize: '0.8rem',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          fontWeight: isUnread ? 500 : 400,
                        }}>
                          {email.subject || '(no subject)'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Detail */}
            {selectedEmail && (
              <div style={{ 
                backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.5rem', 
                border: `1px solid ${colors.border}`, overflowY: 'auto', maxHeight: '600px' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <h4 style={{ color: colors.text, margin: 0, fontSize: '1rem', lineHeight: 1.4 }}>
                    {selectedEmail.subject || '(no subject)'}
                  </h4>
                  <button onClick={() => setSelectedEmail(null)} style={{
                    background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '1.2rem', padding: 0,
                  }}>×</button>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: colors.textMuted }}>From: </span>
                    <span style={{ color: colors.primary }}>{selectedEmail.from_email}</span>
                  </div>
                  <div>
                    <span style={{ color: colors.textMuted }}>To: </span>
                    <span style={{ color: colors.textSecondary }}>{selectedEmail.to_email}</span>
                  </div>
                  <div>
                    <span style={{ color: colors.textMuted }}>
                      {new Date(selectedEmail.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {(() => {
                  // Determine the best content to render
                  const htmlContent = selectedEmail.body_html || '';
                  const textContent = selectedEmail.body_text || '';
                  const textLooksLikeHtml = /^\s*(<(!DOCTYPE|html|head|body|div|p|table|tr|td)\b)/i.test(textContent);
                  const renderAsHtml = htmlContent || textLooksLikeHtml;
                  const iframeSrc = htmlContent || (textLooksLikeHtml ? textContent : '');

                  if (renderAsHtml && iframeSrc) {
                    return (
                      <div style={{
                        backgroundColor: '#fff', borderRadius: '8px', padding: '0.5rem',
                        border: `1px solid ${colors.borderSubtle}`, marginBottom: '1rem',
                        maxHeight: '400px', overflowY: 'auto', color: '#000',
                      }}>
                        <iframe
                          srcDoc={iframeSrc}
                          title="Email content"
                          sandbox="allow-same-origin"
                          style={{
                            width: '100%', minHeight: '200px', border: 'none',
                            backgroundColor: '#fff', colorScheme: 'light',
                          }}
                          onLoad={(e) => {
                            const iframe = e.target as HTMLIFrameElement;
                            if (iframe.contentDocument?.body) {
                              iframe.style.height = Math.min(iframe.contentDocument.body.scrollHeight + 20, 600) + 'px';
                            }
                          }}
                        />
                      </div>
                    );
                  }
                  return (
                    <div style={{
                      backgroundColor: colors.bg, borderRadius: '8px', padding: '1rem',
                      border: `1px solid ${colors.borderSubtle}`, marginBottom: '1rem',
                      whiteSpace: 'pre-wrap', color: '#e5e7eb', fontSize: '0.875rem', lineHeight: 1.6,
                      maxHeight: '350px', overflowY: 'auto',
                    }}>
                      {textContent || '(empty)'}
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {selectedEmail.direction === 'inbound' && (
                    <button onClick={() => startReply(selectedEmail)} style={{
                      padding: '0.5rem 1rem', backgroundColor: colors.success, color: colors.text,
                      border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
                    }}>
                      ↩ Reply
                    </button>
                  )}
                  <button onClick={() => deleteEmail(selectedEmail.id)} style={{
                    padding: '0.5rem 1rem', backgroundColor: `${colors.error}20`,
                    color: colors.error, border: `1px solid ${colors.error}40`,
                    borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
                  }}>
                    🗑 Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Compose View */
        <div style={{ backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.5rem', border: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ color: colors.text, margin: 0 }}>
              {replyingTo ? `↩ Replying to ${replyingTo.from_email}` : '✏️ New Email'}
            </h4>
            {/* S1.5: Canned responses selector from Supabase */}
            <select
              onChange={async (e) => {
                const id = e.target.value;
                const t = cannedResponses.find(r => r.id === id);
                if (t) {
                  if (!replyingTo) setComposeSubject(t.subject);
                  setComposeBody(t.body + (composeBody.includes('---') ? composeBody.substring(composeBody.indexOf('---') - 1) : ''));
                  // Track usage
                  try {
                    const authHeaders = await getAuthHeaders({ requireAuth: false });
                    fetch(`${API_URL}/api/v1/admin/email/templates/${t.id}/use`, { method: 'PATCH', headers: authHeaders });
                  } catch { /* silent */ }
                }
                e.target.value = '';
              }}
              style={{
                padding: '0.35rem 0.6rem', backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.textMuted,
                fontSize: '0.8rem', cursor: 'pointer',
              }}
            >
              <option value="">📋 Insert Template...</option>
              {cannedResponses.map(t => (
                <option key={t.id} value={t.id}>{t.label} ({t.usage_count}x)</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ color: colors.textMuted, fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>To</label>
              <input
                type="email"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="recipient@example.com"
                style={{
                  width: '100%', padding: '0.6rem', backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.9rem',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ color: colors.textMuted, fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>{t('admin.subject', 'Subject')}</label>
              <input
                type="text"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Email subject"
                style={{
                  width: '100%', padding: '0.6rem', backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.9rem',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ color: colors.textMuted, fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>{t('admin.message', 'Message')}</label>
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Write your message..."
                rows={12}
                style={{
                  width: '100%', padding: '0.75rem', backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.9rem',
                  outline: 'none', resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { resetCompose(); setView('inbox'); }} style={{
                padding: '0.5rem 1rem', backgroundColor: 'transparent', color: colors.textMuted,
                border: `1px solid ${colors.border}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem',
              }}>
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !composeTo || !composeSubject || !composeBody}
                style={{
                  padding: '0.5rem 1.25rem', backgroundColor: colors.success, color: colors.text,
                  border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
                  opacity: (sending || !composeTo || !composeSubject || !composeBody) ? 0.5 : 1,
                }}
              >
                {sending ? 'Sending...' : '📤 Send Email'}
              </button>
            </div>
          </div>

          {/* Setup Notice */}
          <div style={{
            marginTop: '1.5rem', padding: '1rem', backgroundColor: '#fbbf2410',
            border: '1px solid #fbbf2430', borderRadius: '8px', fontSize: '0.8rem', color: colors.gold,
          }}>
            <strong>Setup Required:</strong> To send emails, configure <code>RESEND_API_KEY</code> in your backend environment. 
            Sign up free at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" style={{ color: colors.primary }}>resend.com</a> (3,000 emails/month free). 
            To receive emails, enable Cloudflare Email Routing and deploy the Email Worker.
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailTab;
