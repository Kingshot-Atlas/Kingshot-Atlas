import React from 'react';
import { COLORS, Server, Channel, MessageTemplate, MessageHistoryItem, ScheduledMessage } from './types';

interface BotMessageTabProps {
  servers: Server[];
  selectedServer: Server | null;
  selectedChannel: Channel | null;
  channels: Channel[];
  messageContent: string;
  embedTitle: string;
  embedDescription: string;
  useEmbed: boolean;
  sending: boolean;
  scheduleTime: string;
  messageTemplates: MessageTemplate[];
  scheduledMessages: ScheduledMessage[];
  messageHistory: MessageHistoryItem[];
  permCheck: { healthy: boolean; permissions: Record<string, boolean>; missing?: string[]; error?: string } | null;
  permChecking: boolean;
  onServerSelect: (server: Server) => void;
  onSetSelectedChannel: (channel: Channel | null) => void;
  onSetMessageContent: (content: string) => void;
  onSetEmbedTitle: (title: string) => void;
  onSetEmbedDescription: (desc: string) => void;
  onSetUseEmbed: (use: boolean) => void;
  onSetScheduleTime: (time: string) => void;
  onSendMessage: () => void;
  onScheduleMessage: () => void;
  onCancelScheduledMessage: (id: string) => void;
  onCheckPermissions: (guildId: string) => void;
}

const BotMessageTab: React.FC<BotMessageTabProps> = ({
  servers,
  selectedServer,
  selectedChannel,
  channels,
  messageContent,
  embedTitle,
  embedDescription,
  useEmbed,
  sending,
  scheduleTime,
  messageTemplates,
  scheduledMessages,
  messageHistory,
  permCheck,
  permChecking,
  onServerSelect,
  onSetSelectedChannel,
  onSetMessageContent,
  onSetEmbedTitle,
  onSetEmbedDescription,
  onSetUseEmbed,
  onSetScheduleTime,
  onSendMessage,
  onScheduleMessage,
  onCancelScheduledMessage,
  onCheckPermissions,
}) => {
  return (
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
                onSetMessageContent(t.content);
                onSetEmbedTitle(t.embedTitle);
                onSetEmbedDescription(t.embedDescription);
                onSetUseEmbed(t.useEmbed);
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
            if (server) onServerSelect(server);
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
              onClick={() => onCheckPermissions(selectedServer.id)}
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
              onSetSelectedChannel(channel || null);
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
              onChange={(e) => onSetMessageContent(e.target.value)}
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
              onChange={(e) => onSetUseEmbed(e.target.checked)}
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
                  onChange={(e) => onSetEmbedTitle(e.target.value)}
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
                  onChange={(e) => onSetEmbedDescription(e.target.value)}
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
              onChange={(e) => onSetScheduleTime(e.target.value)}
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
              onClick={onSendMessage}
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
                onClick={onScheduleMessage}
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
                  onClick={() => onCancelScheduledMessage(msg.id)}
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
  );
};

export default BotMessageTab;
