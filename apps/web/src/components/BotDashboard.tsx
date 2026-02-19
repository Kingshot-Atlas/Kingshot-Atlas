/**
 * Discord Bot Dashboard Component
 * Admin interface for managing Atlas Discord bot
 */
import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

async function botHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  try {
    const { getAuthHeaders } = await import('../services/authHeaders');
    const auth = await getAuthHeaders({ requireAuth: false });
    return { ...auth, ...extra };
  } catch {
    return { ...extra };
  }
}

interface BotStatus {
  status: 'online' | 'offline' | 'error' | 'unconfigured';
  bot_name?: string;
  bot_id?: string;
  bot_avatar?: string;
  server_count: number;
  uptime_hours?: number;
  message?: string;
}

interface Server {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  member_count: number;
  presence_count: number;
}

interface Channel {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
}

interface BotStats {
  status: string;
  server_count: number;
  commands_24h: number;
  commands_7d: number;
  top_commands: Array<{ name: string; count: number }>;
}

interface PeriodStats {
  total: number;
  unique_users: number;
  commands: Array<{ name: string; count: number; unique_users: number }>;
  latency: { avg: number; p50: number; p95: number; max: number } | null;
}

interface AnalyticsData {
  period_24h: PeriodStats;
  period_7d: PeriodStats;
  period_30d: PeriodStats;
  servers: Array<{ guild_id: string; commands: number }>;
  latency_by_command: Array<{ command: string; avg: number; p50: number; p95: number; count: number }>;
  time_series: Array<{ date: string; commands: number; unique_users: number }>;
}

interface MultirallyStats {
  total_uses: number;
  unique_users: number;
  supporter_uses: number;
  free_uses: number;
  upsell_impressions: number;
  today: { uses: number; users: number };
  week: { uses: number; users: number };
  month: { uses: number; users: number };
  error?: string;
}

interface MultirallyAnalytics {
  total_uses: number;
  avg_players: number;
  target_distribution: Array<{ target: string; count: number; pct: number }>;
  supporter_ratio: number;
  error?: string;
}

interface RedeemStats {
  total: number;
  success_rate: number;
  unique_players: number;
  today: { total: number; success: number; failed: number; players: number };
  week: { total: number; success: number; failed: number; players: number };
  month: { total: number; success: number; failed: number; players: number };
  top_codes: Array<{ code: string; attempts: number; successes: number; success_rate: number }>;
  error_breakdown: Array<{ error: string; count: number }>;
  error?: string;
}

const COLORS = {
  primary: '#22d3ee',
  success: '#22c55e',
  warning: '#fbbf24',
  danger: '#ef4444',
  muted: '#6b7280',
  background: '#111116',
  border: '#2a2a2a'
};

export const BotDashboard: React.FC = () => {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [stats, setStats] = useState<BotStats | null>(null);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messageContent, setMessageContent] = useState('');
  const [embedTitle, setEmbedTitle] = useState('');
  const [embedDescription, setEmbedDescription] = useState('');
  const [useEmbed, setUseEmbed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'24h' | '7d' | '30d'>('7d');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [multirallyStats, setMultirallyStats] = useState<MultirallyStats | null>(null);
  const [multirallyAnalytics, setMultirallyAnalytics] = useState<MultirallyAnalytics | null>(null);
  const [redeemStats, setRedeemStats] = useState<RedeemStats | null>(null);
  const [messageHistory, setMessageHistory] = useState<Array<{ id: string; channel: string; server: string; content: string; timestamp: string; hasEmbed: boolean }>>([]);
  const [messageTemplates] = useState([
    { name: 'KvK Reminder', content: '', embedTitle: 'KvK Reminder', embedDescription: 'KvK starts soon! Make sure your rallies are coordinated.\n\nUse `/multirally` to plan your hits.', useEmbed: true },
    { name: 'Patch Notes', content: '', embedTitle: 'Atlas Update', embedDescription: 'New features have been deployed!\n\nCheck out the changelog at ks-atlas.com/changelog', useEmbed: true },
    { name: 'Welcome Message', content: 'Welcome to the Atlas Discord! Use `/help` to see all available commands.', embedTitle: '', embedDescription: '', useEmbed: false },
    { name: 'Transfer Event', content: '', embedTitle: 'Transfer Event Notice', embedDescription: 'Transfer Event is approaching!\n\nVisit ks-atlas.com/transfer-hub to find your next kingdom.', useEmbed: true },
  ]);
  const [permCheck, setPermCheck] = useState<{ healthy: boolean; permissions: Record<string, boolean>; missing?: string[]; error?: string } | null>(null);
  const [permChecking, setPermChecking] = useState(false);
  const [scheduledMessages, setScheduledMessages] = useState<Array<{ id: string; channel: Channel; server: Server; content: string; embedTitle: string; embedDescription: string; useEmbed: boolean; scheduledFor: Date; timer: ReturnType<typeof setTimeout> }>>([]);
  const [scheduleTime, setScheduleTime] = useState('');
  const [activeTab, setActiveTab] = useState<'status' | 'servers' | 'message' | 'analytics'>('status');

  useEffect(() => {
    loadBotData();
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics' && !analytics) loadAnalytics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const headers = await botHeaders();
      const [analyticsRes, mrStatsRes, mrAnalyticsRes, redeemRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/bot/analytics`, { headers }),
        fetch(`${API_URL}/api/v1/bot/multirally-stats`, { headers }),
        fetch(`${API_URL}/api/v1/bot/multirally-analytics`, { headers }),
        fetch(`${API_URL}/api/v1/bot/redeem-stats`, { headers }),
      ]);
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (mrStatsRes.ok) setMultirallyStats(await mrStatsRes.json());
      if (mrAnalyticsRes.ok) setMultirallyAnalytics(await mrAnalyticsRes.json());
      if (redeemRes.ok) setRedeemStats(await redeemRes.json());
    } catch (e) {
      logger.error('Failed to load analytics:', e);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadBotData = async () => {
    setLoading(true);
    setServerError(null);
    try {
      // Fetch status and stats first (lightweight)
      const headers = await botHeaders();
      const [statusRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/bot/status`, { headers }),
        fetch(`${API_URL}/api/v1/bot/stats`, { headers })
      ]);

      if (statusRes.ok) setBotStatus(await statusRes.json());
      if (statsRes.ok) setStats(await statsRes.json());

      // Fetch servers separately to avoid Discord API rate-limit race
      const serversRes = await fetch(`${API_URL}/api/v1/bot/servers`, { headers });
      if (serversRes.ok) {
        const data = await serversRes.json();
        setServers(data.servers || []);
        if (data.error) setServerError(data.error);
        // Update server_count on botStatus from servers response
        if (data.total && data.total > 0) {
          setBotStatus(prev => prev ? { ...prev, server_count: data.total } : prev);
        }
      } else {
        try {
          const errData = await serversRes.json();
          setServerError(errData?.detail || errData?.error || `API returned ${serversRes.status}`);
        } catch {
          setServerError(`API returned ${serversRes.status}`);
        }
      }
    } catch (error) {
      logger.error('Failed to load bot data:', error);
      setServerError(String(error));
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = async (serverId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/bot/servers/${serverId}/channels`, { headers: await botHeaders() });
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
      }
    } catch (error) {
      logger.error('Failed to load channels:', error);
    }
  };

  const handleServerSelect = (server: Server) => {
    setSelectedServer(server);
    setSelectedChannel(null);
    setPermCheck(null);
    loadChannels(server.id);
    checkPermissions(server.id);
  };

  const checkPermissions = async (guildId: string) => {
    setPermChecking(true);
    setPermCheck(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/bot/check-permissions/${guildId}`, { headers: await botHeaders() });
      if (res.ok) {
        setPermCheck(await res.json());
      }
    } catch {
      setPermCheck({ healthy: false, error: 'Failed to check permissions', permissions: {} });
    } finally {
      setPermChecking(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedChannel) return;
    if (!messageContent && !embedTitle && !embedDescription) return;

    setSending(true);
    try {
      const payload: {
        channel_id: string;
        content?: string;
        embed?: { title?: string; description?: string };
      } = {
        channel_id: selectedChannel.id
      };

      if (messageContent) {
        payload.content = messageContent;
      }

      if (useEmbed && (embedTitle || embedDescription)) {
        payload.embed = {};
        if (embedTitle) payload.embed.title = embedTitle;
        if (embedDescription) payload.embed.description = embedDescription;
      }

      const res = await fetch(`${API_URL}/api/v1/bot/send-message`, {
        method: 'POST',
        headers: await botHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Track in message history (local, last 20)
        setMessageHistory(prev => [{
          id: Date.now().toString(),
          channel: `#${selectedChannel.name}`,
          server: selectedServer?.name || 'Unknown',
          content: messageContent || embedTitle || embedDescription || '(embed)',
          timestamp: new Date().toISOString(),
          hasEmbed: useEmbed && !!(embedTitle || embedDescription),
        }, ...prev].slice(0, 20));
        setMessageContent('');
        setEmbedTitle('');
        setEmbedDescription('');
        alert('Message sent successfully!');
      } else {
        const error = await res.json();
        const detail = error.detail || 'Unknown error';
        if (detail.includes('50001') || detail.includes('Missing Access')) {
          alert('Bot lacks permission to send in this channel.\n\nFix: Re-authorize the bot with updated permissions using the link in the Status tab, or grant the bot View Channel + Send Messages in Discord server settings.');
        } else {
          alert(`Failed to send message: ${detail}`);
        }
      }
    } catch (error) {
      logger.error('Failed to send message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleScheduleMessage = () => {
    if (!selectedChannel || !selectedServer) return;
    if (!messageContent && !embedTitle && !embedDescription) return;
    if (!scheduleTime) { alert('Please select a schedule time'); return; }

    const scheduledFor = new Date(scheduleTime);
    const now = new Date();
    const delay = scheduledFor.getTime() - now.getTime();
    if (delay <= 0) { alert('Scheduled time must be in the future'); return; }

    const id = Date.now().toString();
    const capturedContent = messageContent;
    const capturedEmbedTitle = embedTitle;
    const capturedEmbedDescription = embedDescription;
    const capturedUseEmbed = useEmbed;
    const capturedChannel = selectedChannel;
    const capturedServer = selectedServer;

    const timer = setTimeout(async () => {
      // Auto-send when the time arrives
      try {
        const payload: { channel_id: string; content?: string; embed?: { title?: string; description?: string } } = {
          channel_id: capturedChannel.id,
        };
        if (capturedContent) payload.content = capturedContent;
        if (capturedUseEmbed && (capturedEmbedTitle || capturedEmbedDescription)) {
          payload.embed = {};
          if (capturedEmbedTitle) payload.embed.title = capturedEmbedTitle;
          if (capturedEmbedDescription) payload.embed.description = capturedEmbedDescription;
        }
        const res = await fetch(`${API_URL}/api/v1/bot/send-message`, {
          method: 'POST',
          headers: await botHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setMessageHistory(prev => [{
            id,
            channel: `#${capturedChannel.name}`,
            server: capturedServer.name,
            content: capturedContent || capturedEmbedTitle || capturedEmbedDescription || '(embed)',
            timestamp: new Date().toISOString(),
            hasEmbed: capturedUseEmbed && !!(capturedEmbedTitle || capturedEmbedDescription),
          }, ...prev].slice(0, 20));
        }
      } catch (e) {
        logger.error('Scheduled message failed:', e);
      }
      // Remove from queue
      setScheduledMessages(prev => prev.filter(m => m.id !== id));
    }, delay);

    setScheduledMessages(prev => [...prev, {
      id,
      channel: selectedChannel,
      server: selectedServer,
      content: messageContent,
      embedTitle,
      embedDescription,
      useEmbed,
      scheduledFor,
      timer,
    }]);

    setMessageContent('');
    setEmbedTitle('');
    setEmbedDescription('');
    setScheduleTime('');
    alert(`Message scheduled for ${scheduledFor.toLocaleTimeString()}`);
  };

  const cancelScheduledMessage = (id: string) => {
    setScheduledMessages(prev => {
      const msg = prev.find(m => m.id === id);
      if (msg) clearTimeout(msg.timer);
      return prev.filter(m => m.id !== id);
    });
  };

  const handleLeaveServer = async (serverId: string) => {
    if (!confirm('Are you sure you want to remove the bot from this server?')) return;

    try {
      const res = await fetch(`${API_URL}/api/v1/bot/leave-server/${serverId}`, {
        method: 'POST',
        headers: await botHeaders()
      });

      if (res.ok) {
        setServers(servers.filter(s => s.id !== serverId));
        if (selectedServer?.id === serverId) {
          setSelectedServer(null);
          setChannels([]);
        }
      } else {
        alert('Failed to leave server');
      }
    } catch (error) {
      logger.error('Failed to leave server:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return COLORS.success;
      case 'offline': return COLORS.danger;
      case 'error': return COLORS.warning;
      default: return COLORS.muted;
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: COLORS.muted }}>
        Loading bot data...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '1.25rem' }}>🤖 Discord Bot</h2>
          <p style={{ color: COLORS.muted, margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
            Manage Atlas bot settings and send messages
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['status', 'analytics', 'servers', 'message'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.4rem 0.75rem',
                backgroundColor: activeTab === tab ? COLORS.primary + '20' : 'transparent',
                border: `1px solid ${activeTab === tab ? COLORS.primary : COLORS.border}`,
                borderRadius: '6px',
                color: activeTab === tab ? COLORS.primary : COLORS.muted,
                cursor: 'pointer',
                fontSize: '0.8rem',
                textTransform: 'capitalize'
              }}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={loadBotData}
            style={{
              padding: '0.4rem 0.75rem',
              backgroundColor: 'transparent',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '6px',
              color: COLORS.muted,
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Status Tab */}
      {activeTab === 'status' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Bot Status Card */}
          <div style={{
            backgroundColor: COLORS.background,
            borderRadius: '12px',
            padding: '1.25rem',
            border: `1px solid ${botStatus ? getStatusColor(botStatus.status) + '40' : COLORS.border}`,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '1rem'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: COLORS.muted, textTransform: 'uppercase' }}>Status</div>
              <div style={{ 
                fontSize: '1.25rem', 
                fontWeight: '700', 
                color: botStatus ? getStatusColor(botStatus.status) : COLORS.muted,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: botStatus ? getStatusColor(botStatus.status) : COLORS.muted
                }} />
                {botStatus?.status || 'Unknown'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: COLORS.muted, textTransform: 'uppercase' }}>Servers</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: COLORS.primary }}>
                {botStatus?.server_count || 0}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: COLORS.muted, textTransform: 'uppercase' }}>Commands (24h)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: COLORS.success }}>
                {stats?.commands_24h || 0}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: COLORS.muted, textTransform: 'uppercase' }}>Commands (7d)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff' }}>
                {stats?.commands_7d || 0}
              </div>
            </div>
          </div>

          {/* Top Commands */}
          {stats?.top_commands && stats.top_commands.length > 0 && (
            <div style={{
              backgroundColor: COLORS.background,
              borderRadius: '12px',
              padding: '1.25rem',
              border: `1px solid ${COLORS.border}`
            }}>
              <h3 style={{ color: '#fff', margin: '0 0 1rem', fontSize: '1rem' }}>Top Commands</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {stats.top_commands.map((cmd, _i) => (
                  <div key={cmd.name} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#0a0a0f',
                    borderRadius: '6px'
                  }}>
                    <span style={{ color: COLORS.primary, fontFamily: 'monospace' }}>/{cmd.name}</span>
                    <span style={{ color: COLORS.muted, fontSize: '0.85rem' }}>{cmd.count} uses</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite Link */}
          <div style={{
            backgroundColor: COLORS.background,
            borderRadius: '12px',
            padding: '1.25rem',
            border: `1px solid ${COLORS.primary}30`,
            textAlign: 'center'
          }}>
            <h3 style={{ color: '#fff', margin: '0 0 0.75rem', fontSize: '1rem' }}>Public Invite Link</h3>
            <code style={{
              display: 'block',
              backgroundColor: '#0a0a0f',
              padding: '0.75rem',
              borderRadius: '6px',
              color: COLORS.primary,
              fontSize: '0.75rem',
              wordBreak: 'break-all',
              marginBottom: '0.75rem'
            }}>
              https://discord.com/api/oauth2/authorize?client_id=1465531618965061672&permissions=2415938560&scope=bot%20applications.commands
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText('https://discord.com/api/oauth2/authorize?client_id=1465531618965061672&permissions=2415938560&scope=bot%20applications.commands');
                alert('Copied to clipboard!');
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: COLORS.primary,
                border: 'none',
                borderRadius: '6px',
                color: '#0a0a0a',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem'
              }}
            >
              Copy Link
            </button>
          </div>
        </div>
      )}

      {/* Servers Tab */}
      {activeTab === 'servers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: '#fff', margin: 0, fontSize: '1rem' }}>
              Connected Servers ({servers.length})
            </h3>
            {servers.length > 0 && (
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                <span style={{ color: COLORS.muted }}>
                  Total Members: <span style={{ color: COLORS.primary, fontWeight: '600' }}>{servers.reduce((s, sv) => s + (sv.member_count || 0), 0).toLocaleString()}</span>
                </span>
                <span style={{ color: COLORS.muted }}>
                  Online: <span style={{ color: COLORS.success, fontWeight: '600' }}>{servers.reduce((s, sv) => s + (sv.presence_count || 0), 0).toLocaleString()}</span>
                </span>
              </div>
            )}
          </div>

          {serverError && (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: COLORS.danger + '15',
              borderRadius: '8px',
              border: `1px solid ${COLORS.danger}40`,
              color: COLORS.danger,
              fontSize: '0.8rem'
            }}>
              ⚠️ {serverError}
            </div>
          )}

          {servers.length === 0 && !serverError ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              color: COLORS.muted,
              backgroundColor: COLORS.background,
              borderRadius: '12px',
              border: `1px solid ${COLORS.border}`
            }}>
              Bot is not in any servers yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {servers.sort((a, b) => (b.member_count || 0) - (a.member_count || 0)).map(server => (
                <div
                  key={server.id}
                  style={{
                    backgroundColor: COLORS.background,
                    borderRadius: '10px',
                    padding: '0.85rem 1rem',
                    border: `1px solid ${COLORS.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}
                >
                  {server.icon ? (
                    <img
                      src={server.icon}
                      alt={server.name}
                      style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: COLORS.primary + '20',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: COLORS.primary,
                      fontWeight: '600',
                      fontSize: '1rem',
                      flexShrink: 0
                    }}>
                      {server.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: '#fff',
                      fontWeight: '600',
                      fontSize: '0.9rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {server.name}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.2rem', fontSize: '0.75rem' }}>
                      <span style={{ color: COLORS.muted }}>
                        👥 <span style={{ color: COLORS.primary }}>{(server.member_count || 0).toLocaleString()}</span> members
                      </span>
                      {server.presence_count > 0 && (
                        <span style={{ color: COLORS.muted }}>
                          🟢 <span style={{ color: COLORS.success }}>{server.presence_count.toLocaleString()}</span> online
                        </span>
                      )}
                      {server.owner && (
                        <span style={{ color: COLORS.warning }}>👑 Owner</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleLeaveServer(server.id)}
                    style={{
                      padding: '0.35rem 0.5rem',
                      backgroundColor: COLORS.danger + '20',
                      border: `1px solid ${COLORS.danger}50`,
                      borderRadius: '4px',
                      color: COLORS.danger,
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      flexShrink: 0
                    }}
                    title="Remove bot from server"
                  >
                    Leave
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Message Tab */}
      {activeTab === 'message' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ color: '#fff', margin: 0, fontSize: '1rem' }}>Send Message</h3>

          {/* Message Templates */}
          <div>
            <div style={{ fontSize: '0.8rem', color: COLORS.muted, marginBottom: '0.5rem' }}>Quick Templates</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {messageTemplates.map(t => (
                <button
                  key={t.name}
                  onClick={() => {
                    setMessageContent(t.content);
                    setEmbedTitle(t.embedTitle);
                    setEmbedDescription(t.embedDescription);
                    setUseEmbed(t.useEmbed);
                  }}
                  style={{
                    padding: '0.4rem 0.75rem',
                    backgroundColor: COLORS.background,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: '6px',
                    color: COLORS.primary,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontWeight: '500',
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          
          {/* Server Selection */}
          <div>
            <label style={{ display: 'block', color: COLORS.muted, fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              Select Server
            </label>
            <select
              value={selectedServer?.id || ''}
              onChange={(e) => {
                const server = servers.find(s => s.id === e.target.value);
                if (server) handleServerSelect(server);
              }}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: COLORS.background,
                border: `1px solid ${COLORS.border}`,
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.9rem'
              }}
            >
              <option value="">Choose a server...</option>
              {servers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Permission Health Check */}
          {selectedServer && (
            <div style={{
              padding: '0.6rem 0.75rem',
              backgroundColor: permChecking ? '#111116' : permCheck?.healthy ? COLORS.success + '10' : permCheck ? COLORS.danger + '10' : '#111116',
              border: `1px solid ${permChecking ? COLORS.border : permCheck?.healthy ? COLORS.success + '40' : permCheck ? COLORS.danger + '40' : COLORS.border}`,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8rem',
            }}>
              {permChecking ? (
                <span style={{ color: COLORS.muted }}>Checking permissions...</span>
              ) : permCheck?.healthy ? (
                <span style={{ color: COLORS.success }}>✅ All permissions OK</span>
              ) : permCheck?.error ? (
                <span style={{ color: COLORS.danger }}>⚠️ {permCheck.error}</span>
              ) : permCheck ? (
                <div>
                  <span style={{ color: COLORS.danger, fontWeight: '600' }}>⚠️ Missing permissions:</span>
                  <span style={{ color: COLORS.muted, marginLeft: '0.5rem' }}>
                    {permCheck.missing?.join(', ') || 'Unknown'}
                  </span>
                </div>
              ) : null}
              {permCheck && !permChecking && !permCheck.healthy && (
                <button
                  onClick={() => checkPermissions(selectedServer.id)}
                  style={{ marginLeft: 'auto', padding: '0.25rem 0.5rem', backgroundColor: 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: '4px', color: COLORS.muted, cursor: 'pointer', fontSize: '0.7rem' }}
                >
                  Re-check
                </button>
              )}
            </div>
          )}

          {/* Channel Selection */}
          {selectedServer && (
            <div>
              <label style={{ display: 'block', color: COLORS.muted, fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                Select Channel
              </label>
              <select
                value={selectedChannel?.id || ''}
                onChange={(e) => {
                  const channel = channels.find(c => c.id === e.target.value);
                  setSelectedChannel(channel || null);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: COLORS.background,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              >
                <option value="">Choose a channel...</option>
                {channels.map(c => (
                  <option key={c.id} value={c.id}>#{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Message Content */}
          {selectedChannel && (
            <>
              <div>
                <label style={{ display: 'block', color: COLORS.muted, fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  Message Content
                </label>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Type your message..."
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '0.75rem',
                    backgroundColor: COLORS.background,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Embed Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="useEmbed"
                  checked={useEmbed}
                  onChange={(e) => setUseEmbed(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="useEmbed" style={{ color: COLORS.muted, fontSize: '0.85rem', cursor: 'pointer' }}>
                  Include Rich Embed
                </label>
              </div>

              {/* Embed Fields */}
              {useEmbed && (
                <div style={{
                  padding: '1rem',
                  backgroundColor: COLORS.background,
                  borderRadius: '8px',
                  border: `1px solid ${COLORS.primary}30`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div>
                    <label style={{ display: 'block', color: COLORS.muted, fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                      Embed Title
                    </label>
                    <input
                      type="text"
                      value={embedTitle}
                      onChange={(e) => setEmbedTitle(e.target.value)}
                      placeholder="Announcement title..."
                      style={{
                        width: '100%',
                        padding: '0.6rem',
                        backgroundColor: '#0a0a0f',
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: COLORS.muted, fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                      Embed Description
                    </label>
                    <textarea
                      value={embedDescription}
                      onChange={(e) => setEmbedDescription(e.target.value)}
                      placeholder="Detailed message content..."
                      style={{
                        width: '100%',
                        minHeight: '80px',
                        padding: '0.6rem',
                        backgroundColor: '#0a0a0f',
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '0.85rem',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Schedule Time */}
              <div>
                <label style={{ display: 'block', color: COLORS.muted, fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                  Schedule (optional)
                </label>
                <input
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    backgroundColor: COLORS.background,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    colorScheme: 'dark',
                  }}
                />
              </div>

              {/* Send / Schedule Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleSendMessage}
                  disabled={sending || (!messageContent && !embedTitle && !embedDescription)}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1.5rem',
                    backgroundColor: sending ? COLORS.muted : COLORS.primary,
                    border: 'none',
                    borderRadius: '8px',
                    color: '#0a0a0a',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    cursor: sending ? 'not-allowed' : 'pointer',
                    opacity: (!messageContent && !embedTitle && !embedDescription) ? 0.5 : 1
                  }}
                >
                  {sending ? 'Sending...' : 'Send Now'}
                </button>
                {scheduleTime && (
                  <button
                    onClick={handleScheduleMessage}
                    disabled={!messageContent && !embedTitle && !embedDescription}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: COLORS.warning,
                      border: 'none',
                      borderRadius: '8px',
                      color: '#0a0a0a',
                      fontWeight: '600',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      opacity: (!messageContent && !embedTitle && !embedDescription) ? 0.5 : 1
                    }}
                  >
                    Schedule
                  </button>
                )}
              </div>
            </>
          )}

          {/* Scheduled Messages Queue */}
          {scheduledMessages.length > 0 && (
            <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1rem', border: `1px solid ${COLORS.warning}30` }}>
              <h4 style={{ color: COLORS.warning, margin: '0 0 0.75rem', fontSize: '0.9rem' }}>Scheduled ({scheduledMessages.length})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {scheduledMessages.map(msg => (
                  <div key={msg.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem',
                    backgroundColor: '#0a0a0f', borderRadius: '6px', border: `1px solid ${COLORS.border}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                        <span style={{ color: COLORS.warning, fontSize: '0.75rem', fontWeight: '600' }}>{msg.server.name}</span>
                        <span style={{ color: COLORS.muted, fontSize: '0.7rem' }}>#{msg.channel.name}</span>
                      </div>
                      <div style={{ color: '#ccc', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {msg.content || msg.embedTitle || msg.embedDescription || '(embed)'}
                      </div>
                    </div>
                    <div style={{ color: COLORS.warning, fontSize: '0.65rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {msg.scheduledFor.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <button
                      onClick={() => cancelScheduledMessage(msg.id)}
                      style={{ padding: '0.2rem 0.4rem', backgroundColor: COLORS.danger + '20', border: `1px solid ${COLORS.danger}40`, borderRadius: '4px', color: COLORS.danger, cursor: 'pointer', fontSize: '0.65rem', flexShrink: 0 }}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message History Log */}
          {messageHistory.length > 0 && (
            <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1rem', border: `1px solid ${COLORS.border}`, marginTop: '0.5rem' }}>
              <h4 style={{ color: '#fff', margin: '0 0 0.75rem', fontSize: '0.9rem' }}>Recent Messages ({messageHistory.length})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '300px', overflowY: 'auto' }}>
                {messageHistory.map(msg => (
                  <div key={msg.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem',
                    backgroundColor: '#0a0a0f', borderRadius: '6px', border: `1px solid ${COLORS.border}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                        <span style={{ color: COLORS.primary, fontSize: '0.75rem', fontWeight: '600' }}>{msg.server}</span>
                        <span style={{ color: COLORS.muted, fontSize: '0.7rem' }}>{msg.channel}</span>
                        {msg.hasEmbed && <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', backgroundColor: COLORS.warning + '20', color: COLORS.warning, borderRadius: '3px' }}>EMBED</span>}
                      </div>
                      <div style={{ color: '#ccc', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {msg.content}
                      </div>
                    </div>
                    <div style={{ color: COLORS.muted, fontSize: '0.65rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {analyticsLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: COLORS.muted }}>Loading analytics...</div>
          ) : !analytics ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: COLORS.muted }}>
              No analytics data available.
              <button onClick={loadAnalytics} style={{ display: 'block', margin: '1rem auto', padding: '0.5rem 1rem', backgroundColor: COLORS.primary, border: 'none', borderRadius: '6px', color: '#0a0a0a', cursor: 'pointer', fontWeight: '600' }}>Retry</button>
            </div>
          ) : (() => {
            const periodData = analyticsPeriod === '24h' ? analytics.period_24h : analyticsPeriod === '7d' ? analytics.period_7d : analytics.period_30d;
            const maxCmd = periodData.commands.length > 0 ? (periodData.commands[0]?.count || 1) : 1;
            return (
              <>
                {/* Period Selector */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ color: COLORS.muted, fontSize: '0.8rem' }}>Period:</span>
                  {(['24h', '7d', '30d'] as const).map(p => (
                    <button key={p} onClick={() => setAnalyticsPeriod(p)} style={{
                      padding: '0.35rem 0.75rem', borderRadius: '6px', border: `1px solid ${analyticsPeriod === p ? COLORS.primary : COLORS.border}`,
                      backgroundColor: analyticsPeriod === p ? COLORS.primary + '20' : 'transparent', color: analyticsPeriod === p ? COLORS.primary : COLORS.muted,
                      cursor: 'pointer', fontSize: '0.8rem', fontWeight: analyticsPeriod === p ? '600' : '400'
                    }}>{p}</button>
                  ))}
                  <button onClick={loadAnalytics} style={{ marginLeft: 'auto', padding: '0.35rem 0.75rem', borderRadius: '6px', border: `1px solid ${COLORS.border}`, backgroundColor: 'transparent', color: COLORS.muted, cursor: 'pointer', fontSize: '0.8rem' }}>
                    🔄
                  </button>
                </div>

                {/* Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                  {[
                    { label: 'Total Commands', value: periodData.total.toLocaleString(), color: COLORS.primary },
                    { label: 'Unique Users', value: periodData.unique_users.toLocaleString(), color: COLORS.success },
                    { label: 'Avg Latency', value: periodData.latency ? `${periodData.latency.avg}ms` : '—', color: COLORS.warning },
                    { label: 'P95 Latency', value: periodData.latency ? `${periodData.latency.p95}ms` : '—', color: periodData.latency && periodData.latency.p95 > 2000 ? COLORS.danger : COLORS.muted },
                  ].map(card => (
                    <div key={card.label} style={{ backgroundColor: COLORS.background, borderRadius: '10px', padding: '1rem', border: `1px solid ${COLORS.border}` }}>
                      <div style={{ fontSize: '0.7rem', color: COLORS.muted, textTransform: 'uppercase', marginBottom: '0.25rem' }}>{card.label}</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '700', color: card.color }}>{card.value}</div>
                    </div>
                  ))}
                </div>

                {/* Command Usage Breakdown */}
                <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
                  <h3 style={{ color: '#fff', margin: '0 0 1rem', fontSize: '1rem' }}>Command Usage</h3>
                  {periodData.commands.length === 0 ? (
                    <div style={{ color: COLORS.muted, fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>No commands in this period</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {periodData.commands.map(cmd => (
                        <div key={cmd.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '100px', flexShrink: 0, color: COLORS.primary, fontFamily: 'monospace', fontSize: '0.8rem' }}>/{cmd.name}</div>
                          <div style={{ flex: 1, position: 'relative', height: '24px', backgroundColor: '#0a0a0f', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(cmd.count / maxCmd) * 100}%`, backgroundColor: COLORS.primary + '40', borderRadius: '4px', transition: 'width 0.3s' }} />
                            <div style={{ position: 'relative', padding: '0 0.5rem', lineHeight: '24px', fontSize: '0.75rem', color: '#fff' }}>
                              {cmd.count} <span style={{ color: COLORS.muted }}>({cmd.unique_users} users)</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Server Breakdown */}
                {analytics.servers.length > 0 && (
                  <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
                    <h3 style={{ color: '#fff', margin: '0 0 1rem', fontSize: '1rem' }}>Server Activity (30d)</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {analytics.servers.slice(0, 10).map((srv, i) => {
                        const serverName = servers.find(s => s.id === srv.guild_id)?.name;
                        const maxSrv = analytics.servers[0]?.commands || 1;
                        return (
                          <div key={srv.guild_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '20px', flexShrink: 0, color: COLORS.muted, fontSize: '0.75rem', textAlign: 'right' }}>{i + 1}.</div>
                            <div style={{ width: '140px', flexShrink: 0, color: '#fff', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {serverName ? serverName : srv.guild_id === 'DM' ? 'Direct Messages' : srv.guild_id.slice(0, 8) + '...'}
                            </div>
                            <div style={{ flex: 1, position: 'relative', height: '20px', backgroundColor: '#0a0a0f', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(srv.commands / maxSrv) * 100}%`, backgroundColor: COLORS.success + '40', borderRadius: '4px' }} />
                              <div style={{ position: 'relative', padding: '0 0.5rem', lineHeight: '20px', fontSize: '0.7rem', color: COLORS.muted }}>{srv.commands}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Latency by Command */}
                {analytics.latency_by_command.length > 0 && (
                  <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
                    <h3 style={{ color: '#fff', margin: '0 0 1rem', fontSize: '1rem' }}>Latency by Command (30d)</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                            <th style={{ textAlign: 'left', padding: '0.5rem', color: COLORS.muted, fontWeight: '500' }}>Command</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem', color: COLORS.muted, fontWeight: '500' }}>Avg</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem', color: COLORS.muted, fontWeight: '500' }}>P50</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem', color: COLORS.muted, fontWeight: '500' }}>P95</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem', color: COLORS.muted, fontWeight: '500' }}>Calls</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.latency_by_command.map(row => {
                            const latColor = row.avg > 2000 ? COLORS.danger : row.avg > 1000 ? COLORS.warning : COLORS.success;
                            return (
                              <tr key={row.command} style={{ borderBottom: `1px solid ${COLORS.border}20` }}>
                                <td style={{ padding: '0.5rem', color: COLORS.primary, fontFamily: 'monospace' }}>/{row.command}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', color: latColor, fontWeight: '600' }}>{row.avg}ms</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', color: COLORS.muted }}>{row.p50}ms</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', color: row.p95 > 2000 ? COLORS.danger : COLORS.muted }}>{row.p95}ms</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', color: COLORS.muted }}>{row.count}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Daily Time Series (visual bar chart) */}
                {analytics.time_series.length > 0 && (
                  <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
                    <h3 style={{ color: '#fff', margin: '0 0 1rem', fontSize: '1rem' }}>Daily Activity (30d)</h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '120px', padding: '0 0 1.5rem' }}>
                      {analytics.time_series.map(day => {
                        const maxDay = Math.max(...analytics.time_series.map(d => d.commands), 1);
                        const pct = (day.commands / maxDay) * 100;
                        return (
                          <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', height: '100%', justifyContent: 'flex-end' }} title={`${day.date}: ${day.commands} cmds, ${day.unique_users} users`}>
                            <div style={{ width: '100%', maxWidth: '16px', height: `${Math.max(pct, 2)}%`, backgroundColor: COLORS.primary, borderRadius: '2px 2px 0 0', opacity: 0.7, transition: 'height 0.3s' }} />
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: COLORS.muted }}>
                      <span>{analytics.time_series[0]?.date.slice(5)}</span>
                      <span>{analytics.time_series[analytics.time_series.length - 1]?.date.slice(5)}</span>
                    </div>
                  </div>
                )}

                {/* Premium Commands — /multirally Stats */}
                {multirallyStats && !multirallyStats.error && (
                  <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.danger}40` }}>
                    <h3 style={{ color: '#fff', margin: '0 0 1rem', fontSize: '1rem' }}>
                      <span style={{ color: COLORS.danger }}>⚔️</span> Premium Commands — /multirally
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                      {[
                        { label: 'Total Uses', value: multirallyStats.total_uses.toLocaleString(), color: COLORS.primary },
                        { label: 'Unique Users', value: multirallyStats.unique_users.toLocaleString(), color: COLORS.success },
                        { label: 'Supporter Uses', value: multirallyStats.supporter_uses.toLocaleString(), color: COLORS.warning },
                        { label: 'Free Uses', value: multirallyStats.free_uses.toLocaleString(), color: COLORS.muted },
                        { label: 'Upsell Views', value: multirallyStats.upsell_impressions.toLocaleString(), color: COLORS.danger },
                      ].map(card => (
                        <div key={card.label} style={{ backgroundColor: '#0a0a0f', borderRadius: '8px', padding: '0.75rem', border: `1px solid ${COLORS.border}` }}>
                          <div style={{ fontSize: '0.65rem', color: COLORS.muted, textTransform: 'uppercase', marginBottom: '0.2rem' }}>{card.label}</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: card.color }}>{card.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                      {[
                        { label: 'Today', uses: multirallyStats.today.uses, users: multirallyStats.today.users },
                        { label: '7 Days', uses: multirallyStats.week.uses, users: multirallyStats.week.users },
                        { label: '30 Days', uses: multirallyStats.month.uses, users: multirallyStats.month.users },
                      ].map(period => (
                        <div key={period.label} style={{ backgroundColor: '#0a0a0f', borderRadius: '6px', padding: '0.6rem', textAlign: 'center', border: `1px solid ${COLORS.border}` }}>
                          <div style={{ fontSize: '0.65rem', color: COLORS.muted, marginBottom: '0.2rem' }}>{period.label}</div>
                          <div style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>{period.uses}</div>
                          <div style={{ fontSize: '0.65rem', color: COLORS.muted }}>{period.users} user{period.users !== 1 ? 's' : ''}</div>
                        </div>
                      ))}
                    </div>
                    {multirallyStats.upsell_impressions > 0 && multirallyStats.total_uses > 0 && (
                      <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: COLORS.danger + '10', borderRadius: '6px', fontSize: '0.75rem', color: COLORS.muted }}>
                        <span style={{ color: COLORS.danger, fontWeight: '600' }}>Conversion signal:</span>{' '}
                        {multirallyStats.upsell_impressions} user{multirallyStats.upsell_impressions !== 1 ? 's' : ''} hit the paywall
                        {multirallyStats.supporter_uses > 0 && ` · ${multirallyStats.supporter_uses} Supporter uses tracked`}
                      </div>
                    )}
                  </div>
                )}

                {/* Multirally Detailed Analytics — Target Distribution & Avg Players */}
                {multirallyAnalytics && !multirallyAnalytics.error && multirallyAnalytics.total_uses > 0 && (
                  <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
                    <h3 style={{ color: '#fff', margin: '0 0 1rem', fontSize: '1rem' }}>Rally Analytics</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div style={{ backgroundColor: '#0a0a0f', borderRadius: '8px', padding: '0.75rem', border: `1px solid ${COLORS.border}` }}>
                        <div style={{ fontSize: '0.65rem', color: COLORS.muted, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Avg Players/Call</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: COLORS.primary }}>{multirallyAnalytics.avg_players}</div>
                      </div>
                      <div style={{ backgroundColor: '#0a0a0f', borderRadius: '8px', padding: '0.75rem', border: `1px solid ${COLORS.border}` }}>
                        <div style={{ fontSize: '0.65rem', color: COLORS.muted, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Supporter %</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: COLORS.warning }}>{multirallyAnalytics.supporter_ratio}%</div>
                      </div>
                    </div>
                    {multirallyAnalytics.target_distribution.length > 0 && (
                      <>
                        <div style={{ fontSize: '0.8rem', color: COLORS.muted, marginBottom: '0.5rem' }}>Target Building Distribution</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {multirallyAnalytics.target_distribution.slice(0, 8).map(t => {
                            const maxT = multirallyAnalytics.target_distribution[0]?.count || 1;
                            return (
                              <div key={t.target} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '100px', flexShrink: 0, color: '#fff', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.target}</div>
                                <div style={{ flex: 1, position: 'relative', height: '20px', backgroundColor: '#0a0a0f', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(t.count / maxT) * 100}%`, backgroundColor: COLORS.danger + '50', borderRadius: '4px' }} />
                                  <div style={{ position: 'relative', padding: '0 0.5rem', lineHeight: '20px', fontSize: '0.7rem', color: COLORS.muted }}>{t.count} ({t.pct}%)</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Gift Code Redemption Stats — /redeem */}
                {redeemStats && !redeemStats.error && (
                  <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.success}40` }}>
                    <h3 style={{ color: '#fff', margin: '0 0 1rem', fontSize: '1rem' }}>
                      <span style={{ color: COLORS.success }}>🎁</span> Gift Code Redemption — /redeem
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                      {[
                        { label: 'Total (30d)', value: redeemStats.total.toLocaleString(), color: COLORS.primary },
                        { label: 'Success Rate', value: `${redeemStats.success_rate}%`, color: redeemStats.success_rate >= 50 ? COLORS.success : COLORS.danger },
                        { label: 'Unique Players', value: redeemStats.unique_players.toLocaleString(), color: '#a855f7' },
                      ].map(card => (
                        <div key={card.label} style={{ backgroundColor: '#0a0a0f', borderRadius: '8px', padding: '0.75rem', border: `1px solid ${COLORS.border}` }}>
                          <div style={{ fontSize: '0.65rem', color: COLORS.muted, textTransform: 'uppercase', marginBottom: '0.2rem' }}>{card.label}</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: card.color }}>{card.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Period breakdown */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                      {[
                        { label: 'Today', ...redeemStats.today },
                        { label: '7 Days', ...redeemStats.week },
                        { label: '30 Days', ...redeemStats.month },
                      ].map(period => (
                        <div key={period.label} style={{ backgroundColor: '#0a0a0f', borderRadius: '6px', padding: '0.6rem', textAlign: 'center', border: `1px solid ${COLORS.border}` }}>
                          <div style={{ fontSize: '0.65rem', color: COLORS.muted, marginBottom: '0.2rem' }}>{period.label}</div>
                          <div style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>{period.total}</div>
                          <div style={{ fontSize: '0.6rem', color: COLORS.muted }}>
                            <span style={{ color: COLORS.success }}>{period.success}✓</span>
                            {' / '}
                            <span style={{ color: COLORS.danger }}>{period.failed}✗</span>
                            {' · '}
                            {period.players} player{period.players !== 1 ? 's' : ''}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Top codes table */}
                    {redeemStats.top_codes.length > 0 && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.8rem', color: COLORS.muted, marginBottom: '0.5rem' }}>Top Codes</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.3rem 0.75rem', fontSize: '0.75rem' }}>
                          <div style={{ color: '#4b5563', fontWeight: 600 }}>Code</div>
                          <div style={{ color: '#4b5563', fontWeight: 600, textAlign: 'right' }}>Attempts</div>
                          <div style={{ color: '#4b5563', fontWeight: 600, textAlign: 'right' }}>Success</div>
                          <div style={{ color: '#4b5563', fontWeight: 600, textAlign: 'right' }}>Rate</div>
                          {redeemStats.top_codes.map(tc => (
                            <React.Fragment key={tc.code}>
                              <div style={{ color: '#e5e7eb', fontFamily: 'monospace', fontSize: '0.7rem' }}>{tc.code}</div>
                              <div style={{ color: COLORS.muted, textAlign: 'right' }}>{tc.attempts}</div>
                              <div style={{ color: COLORS.success, textAlign: 'right' }}>{tc.successes}</div>
                              <div style={{ textAlign: 'right', color: tc.success_rate >= 70 ? COLORS.success : tc.success_rate >= 40 ? COLORS.warning : COLORS.danger }}>
                                {tc.success_rate.toFixed(0)}%
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Error breakdown */}
                    {redeemStats.error_breakdown.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.8rem', color: COLORS.muted, marginBottom: '0.5rem' }}>Failure Breakdown</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {redeemStats.error_breakdown.map(eb => {
                            const maxErr = redeemStats.error_breakdown[0]?.count || 1;
                            return (
                              <div key={eb.error} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '120px', flexShrink: 0, color: COLORS.danger, fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eb.error}</div>
                                <div style={{ flex: 1, position: 'relative', height: '16px', backgroundColor: '#0a0a0f', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(eb.count / maxErr) * 100}%`, backgroundColor: COLORS.danger + '40', borderRadius: '4px' }} />
                                  <div style={{ position: 'relative', padding: '0 0.5rem', lineHeight: '16px', fontSize: '0.65rem', color: COLORS.muted }}>{eb.count}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Empty state */}
                    {redeemStats.total === 0 && (
                      <div style={{ textAlign: 'center', padding: '1.5rem', color: '#4b5563', fontSize: '0.8rem' }}>
                        No redemption data yet. Data appears when users redeem codes via Atlas or the /redeem bot command.
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default BotDashboard;
