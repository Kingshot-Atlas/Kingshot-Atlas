import React, { useState } from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { colors } from '../../utils/styles';
import type { IncomingApplication } from './types';
import { formatTCLevel, STATUS_ACTIONS, STATUS_LABELS } from './types';

const ApplicationCard: React.FC<{
  application: IncomingApplication;
  onStatusChange: (id: string, newStatus: string) => void;
  updating: string | null;
}> = ({ application, onStatusChange, updating }) => {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const profile = application.profile;
  const isAnon = profile?.is_anonymous && application.status !== 'accepted';
  const statusInfo = STATUS_LABELS[application.status] || { label: application.status, color: colors.textMuted };
  const actions = STATUS_ACTIONS[application.status];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getDaysRemaining = () => {
    const diff = new Date(application.expires_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const daysLeft = getDaysRemaining();

  return (
    <div style={{
      backgroundColor: colors.bg,
      border: `1px solid ${statusInfo.color}25`,
      borderRadius: '10px',
      overflow: 'hidden',
    }}>
      {/* Header Row */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: isMobile ? '0.75rem' : '0.75rem 1rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
          <span style={{ color: colors.text, fontWeight: '600', fontSize: '0.85rem' }}>
            {isAnon ? '🔒 Anonymous Applicant' : (profile?.username || 'Unknown Player')}
          </span>
          {profile && (
            <span style={{ color: colors.textSecondary, fontSize: '0.7rem' }}>
              Kingdom {profile.current_kingdom} • {formatTCLevel(profile.tc_level)} • {profile.power_million ? `${profile.power_million}M` : profile.power_range}
            </span>
          )}
          <span style={{
            padding: '0.1rem 0.4rem',
            backgroundColor: `${statusInfo.color}15`,
            border: `1px solid ${statusInfo.color}30`,
            borderRadius: '4px',
            fontSize: '0.6rem',
            color: statusInfo.color,
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}>
            {statusInfo.label}
          </span>
          {application.status === 'accepted' && profile?.linked_player_id && (
            <span style={{ color: colors.textMuted, fontSize: '0.6rem' }}>
              ID: <span style={{ color: '#22d3ee', fontWeight: '600' }}>{profile.linked_player_id}</span>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>
            {formatDate(application.applied_at)}
          </span>
          {daysLeft <= 3 && daysLeft > 0 && application.status !== 'accepted' && application.status !== 'declined' && (
            <span style={{ color: '#f59e0b', fontSize: '0.6rem', fontWeight: '600' }}>
              {daysLeft}d left
            </span>
          )}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {/* Expanded Profile Details */}
      {expanded && profile && (
        <div style={{
          padding: isMobile ? '0 0.75rem 0.75rem' : '0 1rem 1rem',
          borderTop: '1px solid #1a1a1a',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '0.5rem',
            marginTop: '0.75rem',
          }}>
            <div>
              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>Language</span>
              <div style={{ color: '#d1d5db', fontSize: '0.8rem' }}>{profile.main_language}</div>
            </div>
            <div>
              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>KvK Availability</span>
              <div style={{ color: '#d1d5db', fontSize: '0.8rem', textTransform: 'capitalize' }}>{profile.kvk_availability || '—'}</div>
            </div>
            <div>
              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>Saving for KvK</span>
              <div style={{ color: '#d1d5db', fontSize: '0.8rem', textTransform: 'capitalize' }}>{(profile.saving_for_kvk || '—').replace(/_/g, ' ')}</div>
            </div>
            <div>
              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>Group Size</span>
              <div style={{ color: '#d1d5db', fontSize: '0.8rem' }}>{profile.group_size}</div>
            </div>
            <div>
              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>Contact</span>
              {isAnon ? (
                <div style={{ color: colors.textMuted, fontSize: '0.8rem', fontStyle: 'italic' }}>
                  🔒 Revealed after acceptance
                </div>
              ) : (
                <div style={{ color: '#22d3ee', fontSize: '0.8rem' }}>
                  {(profile.contact_method === 'discord' || profile.contact_method === 'both') && profile.contact_discord && (
                    <span>💬 {profile.contact_discord}</span>
                  )}
                  {profile.contact_method === 'both' && ' · '}
                  {(profile.contact_method === 'in_game' || profile.contact_method === 'both') && profile.contact_coordinates && (
                    <span>🎮 {(() => {
                      const m = profile.contact_coordinates.match(/^K:(\d+) X:(\d+) Y:(\d+)$/);
                      return m ? `K${m[1]} · X:${m[2]} Y:${m[3]}` : profile.contact_coordinates;
                    })()}</span>
                  )}
                  {!profile.contact_discord && !profile.contact_coordinates && profile.contact_info && (
                    <span>{profile.contact_method === 'discord' ? '💬 ' : '🎮 '}{profile.contact_info}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {profile.looking_for.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>Looking For</span>
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                {profile.looking_for.slice(0, 3).map((tag) => (
                  <span key={tag} style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: '#22d3ee10',
                    border: '1px solid #22d3ee20',
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    color: '#22d3ee',
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.player_bio && (
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>Bio</span>
              <p style={{ color: '#d1d5db', fontSize: '0.8rem', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
                {profile.player_bio}
              </p>
            </div>
          )}

          {application.applicant_note && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#22d3ee08',
              border: '1px solid #22d3ee15',
              borderRadius: '8px',
            }}>
              <span style={{ color: '#22d3ee', fontSize: '0.65rem', fontWeight: '600' }}>📝 Applicant Note</span>
              <p style={{ color: '#d1d5db', fontSize: '0.78rem', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
                {application.applicant_note}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          {actions && (
            <div style={{
              display: 'flex', gap: '0.5rem', marginTop: '0.75rem',
              flexWrap: 'wrap',
            }}>
              {actions.next.map((nextStatus) => {
                const actionColor = actions.colors[nextStatus];
                if (!actionColor) return null;
                return (
                  <button
                    key={nextStatus}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(application.id, nextStatus);
                    }}
                    disabled={updating === application.id}
                    style={{
                      padding: '0.4rem 0.75rem',
                      backgroundColor: actionColor.bg,
                      border: `1px solid ${actionColor.border}`,
                      borderRadius: '6px',
                      color: actionColor.text,
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: updating === application.id ? 'not-allowed' : 'pointer',
                      opacity: updating === application.id ? 0.5 : 1,
                      textTransform: 'capitalize',
                      minHeight: '44px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {updating === application.id ? '...' : nextStatus === 'viewed' ? 'Mark Viewed' : (nextStatus === 'declined' && application.status === 'accepted') ? 'Cancel Approval' : nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ApplicationCard;
