/**
 * Discord Bot Dashboard Component
 * Admin interface for managing Atlas Discord bot
 */
import React, { useState, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import BotMessageTab from './bot-dashboard/BotMessageTab';
import BotAnalyticsTab from './bot-dashboard/BotAnalyticsTab';
import {
  BotStatus, Server, Channel, BotStats, AnalyticsData,
  MultirallyStats, MultirallyAnalytics, MessageHistoryItem,
  COLORS, API_URL, botHeaders,
} from './bot-dashboard/types';

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
  const [messageHistory, setMessageHistory] = useState<MessageHistoryItem[]>([]);
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

  const loadAnalyticsRef = useRef(() => {});

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const headers = await botHeaders();
      const [analyticsRes, mrStatsRes, mrAnalyticsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/bot/analytics`, { headers }),
        fetch(`${API_URL}/api/v1/bot/multirally-stats`, { headers }),
        fetch(`${API_URL}/api/v1/bot/multirally-analytics`, { headers }),
      ]);
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (mrStatsRes.ok) setMultirallyStats(await mrStatsRes.json());
      if (mrAnalyticsRes.ok) setMultirallyAnalytics(await mrAnalyticsRes.json());
    } catch (e) {
      logger.error('Failed to load analytics:', e);
    } finally {
      setAnalyticsLoading(false);
    }
  };
  loadAnalyticsRef.current = loadAnalytics;

  useEffect(() => {
    if (activeTab !== 'analytics' || analytics) return;
    loadAnalyticsRef.current();
  }, [activeTab, analytics]);

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
        <BotMessageTab
          servers={servers}
          selectedServer={selectedServer}
          selectedChannel={selectedChannel}
          channels={channels}
          messageContent={messageContent}
          embedTitle={embedTitle}
          embedDescription={embedDescription}
          useEmbed={useEmbed}
          sending={sending}
          scheduleTime={scheduleTime}
          messageTemplates={messageTemplates}
          scheduledMessages={scheduledMessages}
          messageHistory={messageHistory}
          permCheck={permCheck}
          permChecking={permChecking}
          onServerSelect={handleServerSelect}
          onSetSelectedChannel={setSelectedChannel}
          onSetMessageContent={setMessageContent}
          onSetEmbedTitle={setEmbedTitle}
          onSetEmbedDescription={setEmbedDescription}
          onSetUseEmbed={setUseEmbed}
          onSetScheduleTime={setScheduleTime}
          onSendMessage={handleSendMessage}
          onScheduleMessage={handleScheduleMessage}
          onCancelScheduledMessage={cancelScheduledMessage}
          onCheckPermissions={checkPermissions}
        />
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <BotAnalyticsTab
            analytics={analytics}
            analyticsLoading={analyticsLoading}
            analyticsPeriod={analyticsPeriod}
            multirallyStats={multirallyStats}
            multirallyAnalytics={multirallyAnalytics}
            servers={servers}
            onSetAnalyticsPeriod={setAnalyticsPeriod}
            onLoadAnalytics={loadAnalytics}
          />
        </div>
      )}
    </div>
  );
};

export default BotDashboard;
