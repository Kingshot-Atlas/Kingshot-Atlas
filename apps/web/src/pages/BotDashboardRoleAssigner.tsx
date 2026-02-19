import React from 'react';
import { ReactionRoleConfig, DiscordChannel, DiscordRole, iS, lS, SearchableSelect } from './BotDashboardComponents';
import { colors } from '../utils/styles';
import EmojiPicker from './BotDashboardEmojiPicker';

// ─── Role Assigner Card ─────────────────────────────────────────────────────

const RoleAssignerCard: React.FC<{
  cfg: ReactionRoleConfig; mob: boolean;
  dChannels: DiscordChannel[]; dRoles: DiscordRole[]; loadingDiscord: boolean;
  onUpdate: (u: Partial<ReactionRoleConfig>) => void; onDelete: () => void;
  onDeploy: () => void; onEdit: () => void; onCopy: () => void;
  deploying: boolean; rrError: string;
}> = ({ cfg, mob, dChannels, dRoles, loadingDiscord, onUpdate, onDelete, onDeploy, onEdit, onCopy, deploying, rrError }) => {

  const updateMapping = (idx: number, patch: Partial<{ emoji: string; role_id: string; role_name?: string; label?: string }>) => {
    const updated = cfg.emoji_role_mappings.map((m, i) => i === idx ? { ...m, ...patch } : m);
    onUpdate({ emoji_role_mappings: updated });
  };

  return (
    <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${cfg.active ? '#a855f730' : colors.border}`, padding: mob ? '0.85rem' : '1rem 1.25rem', marginBottom: '0.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🏷️</span>
          <span style={{ color: colors.text, fontWeight: 700, fontSize: mob ? '0.85rem' : '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cfg.title || 'Untitled'}</span>
          {cfg.active && cfg.message_id && <span style={{ fontSize: '0.6rem', fontWeight: 600, color: '#22c55e', backgroundColor: '#22c55e15', padding: '0.1rem 0.4rem', borderRadius: 3, flexShrink: 0 }}>LIVE</span>}
          {!cfg.active && <span style={{ fontSize: '0.6rem', fontWeight: 600, color: colors.textMuted, backgroundColor: `${colors.textMuted}15`, padding: '0.1rem 0.4rem', borderRadius: 3, flexShrink: 0 }}>DRAFT</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
          <button onClick={onCopy} title="Duplicate config" style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '0.75rem', cursor: 'pointer', padding: '0.2rem 0.3rem' }}>📋</button>
          <button onClick={onDelete} title="Delete" style={{ background: 'none', border: 'none', color: colors.error, fontSize: '0.75rem', cursor: 'pointer', padding: '0.2rem 0.3rem' }}>🗑️</button>
        </div>
      </div>

      {/* Channel */}
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={lS}>CHANNEL</label>
        {dChannels.length > 0 || loadingDiscord ? (
          <SearchableSelect value={cfg.channel_id || null} onChange={v => onUpdate({ channel_id: v || '' })} options={dChannels.map(c => ({ id: c.id, name: c.name, category: '' }))} placeholder="Select a channel" loading={loadingDiscord} accentColor="#a855f7" />
        ) : (
          <input type="text" value={cfg.channel_id} onChange={e => onUpdate({ channel_id: e.target.value })} placeholder="Channel ID" style={iS} />
        )}
      </div>

      {/* Title + Description — side by side on desktop, stacked on mobile */}
      <div style={{ display: 'flex', flexDirection: mob ? 'column' : 'row', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div style={{ flex: mob ? undefined : '0 0 40%' }}>
          <label style={lS}>EMBED TITLE</label>
          <input type="text" value={cfg.title} onChange={e => onUpdate({ title: e.target.value })} placeholder="Role Selection" maxLength={100} style={{ ...iS, width: '100%', maxWidth: '100%' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={lS}>EMBED MESSAGE</label>
          <textarea value={cfg.description} onChange={e => onUpdate({ description: e.target.value })} placeholder="React to get your roles!" rows={2} maxLength={1000} style={{ ...iS, width: '100%', maxWidth: '100%', resize: 'vertical', minHeight: 44, fontFamily: 'inherit', fontSize: '0.8rem', lineHeight: 1.4 }} />
        </div>
      </div>

      {/* Emoji → Role Mappings */}
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={lS}>EMOJI → ROLE MAPPINGS ({cfg.emoji_role_mappings.length}/20)</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.5rem' }}>
          {cfg.emoji_role_mappings.map((mapping, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: mob ? 'stretch' : 'center', gap: mob ? '0.3rem' : '0.4rem', padding: '0.35rem 0.5rem', backgroundColor: '#a855f708', border: '1px solid #a855f720', borderRadius: 6, flexDirection: mob ? 'column' : 'row' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <EmojiPicker value={mapping.emoji} onChange={emoji => updateMapping(idx, { emoji })} />
                <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>→</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {dRoles.length > 0 || loadingDiscord ? (
                    <SearchableSelect value={mapping.role_id || null} onChange={v => { const roleName = dRoles.find(r => r.id === v)?.name; updateMapping(idx, { role_id: v || '', role_name: roleName }); }} options={dRoles.map(r => ({ id: r.id, name: r.name, color: r.color }))} placeholder="Select role" loading={loadingDiscord} accentColor="#a855f7" />
                  ) : (
                    <input type="text" value={mapping.role_id} onChange={e => updateMapping(idx, { role_id: e.target.value })} placeholder="Role ID" style={{ ...iS, width: '100%', maxWidth: 'none' }} />
                  )}
                </div>
                {!mob && (
                  <button onClick={() => { const updated = cfg.emoji_role_mappings.filter((_, i) => i !== idx); onUpdate({ emoji_role_mappings: updated }); }} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '0.7rem', padding: '0.2rem', flexShrink: 0 }}>✕</button>
                )}
              </div>
              {mob && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <input type="text" value={mapping.label || ''} onChange={e => updateMapping(idx, { label: e.target.value })} placeholder="Label (optional)" maxLength={50} style={{ ...iS, flex: 1, maxWidth: 'none', fontSize: '0.72rem' }} />
                  <button onClick={() => { const updated = cfg.emoji_role_mappings.filter((_, i) => i !== idx); onUpdate({ emoji_role_mappings: updated }); }} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '0.7rem', padding: '0.2rem 0.4rem', flexShrink: 0 }}>✕</button>
                </div>
              )}
              {!mob && (
                <input type="text" value={mapping.label || ''} onChange={e => updateMapping(idx, { label: e.target.value })} placeholder="Label (optional)" maxLength={50} style={{ ...iS, width: 120, maxWidth: 120, fontSize: '0.72rem' }} />
              )}
            </div>
          ))}
        </div>
        {cfg.emoji_role_mappings.length < 20 && (
          <button onClick={() => { const updated = [...cfg.emoji_role_mappings, { emoji: '', role_id: '' }]; onUpdate({ emoji_role_mappings: updated }); }} style={{ padding: '0.3rem 0.6rem', backgroundColor: 'transparent', border: '1px solid #a855f730', borderRadius: 6, color: '#a855f7', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
            + Add Mapping
          </button>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexDirection: mob ? 'column' : 'row' }}>
          <button onClick={onDeploy} disabled={deploying || !cfg.channel_id || cfg.emoji_role_mappings.length === 0}
            style={{ flex: 1, padding: '0.5rem 1rem', backgroundColor: deploying ? colors.border : '#a855f720', border: '1px solid #a855f740', borderRadius: 8, color: deploying ? colors.textMuted : '#a855f7', fontSize: '0.8rem', fontWeight: 600, cursor: deploying || !cfg.channel_id || cfg.emoji_role_mappings.length === 0 ? 'default' : 'pointer' }}>
            {deploying ? '⏳ Working...' : cfg.message_id ? '🔄 Re-deploy' : '🚀 Deploy to Discord'}
          </button>
          {cfg.message_id && (
            <button onClick={onEdit} disabled={deploying}
              style={{ flex: mob ? undefined : '0 0 auto', padding: '0.5rem 1rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: '0.8rem', fontWeight: 600, cursor: deploying ? 'default' : 'pointer' }}>
              ✏️ Edit Message
            </button>
          )}
        </div>
        {cfg.message_id && (
          <div style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.3rem', textAlign: 'center' }}>
            Message ID: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#a855f7' }}>{cfg.message_id}</span>
          </div>
        )}
        {rrError && (
          <div style={{ marginTop: '0.4rem', padding: '0.4rem 0.6rem', borderRadius: 6, backgroundColor: `${colors.error}10`, border: `1px solid ${colors.error}30`, color: colors.error, fontSize: '0.72rem' }}>
            ❌ {rrError}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleAssignerCard;
