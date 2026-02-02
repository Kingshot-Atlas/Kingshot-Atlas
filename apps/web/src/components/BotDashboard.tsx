/**
 * Discord Bot Dashboard Component
 * Admin interface for managing Atlas Discord bot
 */
import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

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
  const [activeTab, setActiveTab] = useState<'status' | 'servers' | 'message'>('status');

  useEffect(() => {
    loadBotData();
  }, []);

  const loadBotData = async () => {
    setLoading(true);
    try {
      const [statusRes, serversRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/bot/status`),
        fetch(`${API_URL}/api/v1/bot/servers`),
        fetch(`${API_URL}/api/v1/bot/stats`)
      ]);

      if (statusRes.ok) setBotStatus(await statusRes.json());
      if (serversRes.ok) {
        const data = await serversRes.json();
        setServers(data.servers || []);
      }
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (error) {
      console.error('Failed to load bot data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = async (serverId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/bot/servers/${serverId}/channels`);
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
      }
    } catch (error) {
      console.error('Failed to load channels:', error);
    }
  };

  const handleServerSelect = (server: Server) => {
    setSelectedServer(server);
    setSelectedChannel(null);
    loadChannels(server.id);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setMessageContent('');
        setEmbedTitle('');
        setEmbedDescription('');
        alert('Message sent successfully!');
      } else {
        const error = await res.json();
        alert(`Failed to send message: ${error.detail}`);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleLeaveServer = async (serverId: string) => {
    if (!confirm('Are you sure you want to remove the bot from this server?')) return;

    try {
      const res = await fetch(`${API_URL}/api/v1/bot/leave-server/${serverId}`, {
        method: 'POST'
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
      console.error('Failed to leave server:', error);
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
          {(['status', 'servers', 'message'] as const).map(tab => (
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
                {stats.top_commands.map((cmd, i) => (
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
              https://discord.com/api/oauth2/authorize?client_id=1465531618965061672&permissions=2147485696&scope=bot%20applications.commands
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText('https://discord.com/api/oauth2/authorize?client_id=1465531618965061672&permissions=2147485696&scope=bot%20applications.commands');
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
          <h3 style={{ color: '#fff', margin: 0, fontSize: '1rem' }}>
            Connected Servers ({servers.length})
          </h3>
          {servers.length === 0 ? (
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
              {servers.map(server => (
                <div
                  key={server.id}
                  style={{
                    backgroundColor: COLORS.background,
                    borderRadius: '12px',
                    padding: '1rem',
                    border: `1px solid ${COLORS.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}
                >
                  {server.icon ? (
                    <img
                      src={server.icon}
                      alt={server.name}
                      style={{ width: '48px', height: '48px', borderRadius: '50%' }}
                    />
                  ) : (
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: COLORS.primary + '20',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: COLORS.primary,
                      fontWeight: '600',
                      fontSize: '1.25rem'
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
                    <div style={{ color: COLORS.muted, fontSize: '0.75rem' }}>
                      ID: {server.id}
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
                      fontSize: '0.7rem'
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

              {/* Send Button */}
              <button
                onClick={handleSendMessage}
                disabled={sending || (!messageContent && !embedTitle && !embedDescription)}
                style={{
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
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default BotDashboard;
