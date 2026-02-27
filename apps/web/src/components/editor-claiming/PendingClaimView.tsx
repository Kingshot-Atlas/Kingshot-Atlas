import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { supabase } from '../../lib/supabase';
import { FONT_DISPLAY } from '../../utils/styles';
import EndorsementProgress from './EndorsementProgress';
import type { EditorClaim, Endorsement } from './types';

const PendingClaimView: React.FC<{
  claim: EditorClaim;
  onRefresh: () => void;
}> = ({ claim, onRefresh: _onRefresh }) => {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [discordCopied, setDiscordCopied] = useState(false);

  const loadEndorsements = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from('editor_endorsements')
        .select('id, editor_claim_id, endorser_user_id, created_at')
        .eq('editor_claim_id', claim.id)
        .order('created_at', { ascending: false });

      if (data) {
        // Fetch endorser usernames
        const userIds = data.map((e: Endorsement) => e.endorser_user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, linked_username')
          .in('id', userIds);

        const userMap = new Map(
          profiles?.map((p: { id: string; username: string; linked_username: string }) => [p.id, p]) || []
        );
        setEndorsements(data.map((e: Endorsement) => ({
          ...e,
          endorser_username: userMap.get(e.endorser_user_id)?.username,
          endorser_linked_username: userMap.get(e.endorser_user_id)?.linked_username,
        })));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [claim.id]);

  useEffect(() => {
    loadEndorsements();
  }, [loadEndorsements]);

  const shareLink = `${window.location.origin}/transfer-hub?endorse=${claim.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareDiscord = () => {
    const remaining = claim.required_endorsements - claim.endorsement_count;
    const msg = `🗳️ **Endorse me as Kingdom ${claim.kingdom_number} Editor on Kingshot Atlas!**\n\nI need ${remaining} more endorsement${remaining !== 1 ? 's' : ''} from K${claim.kingdom_number} members (TC20+).\n\n👉 ${shareLink}\n\nHelp me unlock the Transfer Hub for our kingdom!`;
    navigator.clipboard.writeText(msg);
    setDiscordCopied(true);
    setTimeout(() => setDiscordCopied(false), 2500);
  };

  return (
    <div style={{
      backgroundColor: '#111111',
      border: '1px solid #eab30825',
      borderRadius: '12px',
      padding: isMobile ? '0.75rem' : '1.25rem',
      maxWidth: '500px',
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isMobile ? 'center' : 'space-between',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '0.35rem' : '0',
        marginBottom: '0.5rem',
        textAlign: isMobile ? 'center' : undefined,
      }}>
        <h3 style={{
          fontFamily: FONT_DISPLAY,
          fontSize: isMobile ? '0.9rem' : '1rem',
          color: '#eab308',
          margin: 0,
        }}>
          {t('editor.pendingClaim', 'Pending Editor Claim')} — K{claim.kingdom_number}
        </h3>
        <span style={{
          padding: '0.15rem 0.5rem',
          backgroundColor: '#eab30815',
          border: '1px solid #eab30830',
          borderRadius: '4px',
          fontSize: '0.65rem',
          color: '#eab308',
          fontWeight: 'bold',
        }}>
          {t('editor.gatheringEndorsements', 'GATHERING ENDORSEMENTS')}
        </span>
      </div>

      <EndorsementProgress current={claim.endorsement_count} required={claim.required_endorsements} />

      <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.75rem' : '0.8rem', margin: '0.5rem 0', lineHeight: 1.4, textAlign: isMobile ? 'center' : undefined }}>
        {isMobile
          ? `Share with TC20+ K${claim.kingdom_number} members. ${claim.required_endorsements} endorsements to activate.`
          : `Share this link with TC20+ members of Kingdom ${claim.kingdom_number} to gather endorsements. Once you reach ${claim.required_endorsements} endorsements, your claim is automatically activated.`
        }
      </p>

      {/* Share Actions */}
      {isMobile ? (
        <div style={{
          display: 'flex', gap: '0.5rem',
          marginBottom: '0.5rem',
        }}>
          <button
            onClick={handleCopyLink}
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              backgroundColor: copied ? '#22c55e15' : '#22d3ee15',
              border: `1px solid ${copied ? '#22c55e30' : '#22d3ee30'}`,
              borderRadius: '8px',
              color: copied ? '#22c55e' : '#22d3ee',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              minHeight: '40px',
            }}
          >
            {copied ? t('editor.linkCopied', '✓ Link Copied!') : t('editor.copyLink', '🔗 Copy Link')}
          </button>
          <button
            onClick={handleShareDiscord}
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              backgroundColor: discordCopied ? '#22c55e15' : '#5865F215',
              border: `1px solid ${discordCopied ? '#22c55e30' : '#5865F230'}`,
              borderRadius: '8px',
              color: discordCopied ? '#22c55e' : '#5865F2',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              minHeight: '40px',
            }}
          >
            {discordCopied ? t('editor.copied', '✓ Copied!') : '💬 Discord'}
          </button>
        </div>
      ) : (
        <div style={{
          display: 'flex', gap: '0.5rem',
          marginBottom: '0.75rem',
        }}>
          <div style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            backgroundColor: '#0a0a0a',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            color: '#6b7280',
            fontSize: '0.7rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            minWidth: 0,
          }}>
            {shareLink}
          </div>
          <button
            onClick={handleCopyLink}
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: copied ? '#22c55e15' : '#22d3ee15',
              border: `1px solid ${copied ? '#22c55e30' : '#22d3ee30'}`,
              borderRadius: '8px',
              color: copied ? '#22c55e' : '#22d3ee',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              minHeight: '36px',
              flexShrink: 0,
            }}
          >
            {copied ? t('editor.copied', 'Copied!') : t('editor.copyLinkShort', 'Copy Link')}
          </button>
          <button
            onClick={handleShareDiscord}
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: discordCopied ? '#22c55e15' : '#5865F215',
              border: `1px solid ${discordCopied ? '#22c55e30' : '#5865F230'}`,
              borderRadius: '8px',
              color: discordCopied ? '#22c55e' : '#5865F2',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              minHeight: '36px',
              flexShrink: 0,
            }}
          >
            {discordCopied ? t('editor.copied', 'Copied!') : '💬 Discord'}
          </button>
        </div>
      )}

      {/* Endorsers List */}
      {loading ? (
        <div style={{ color: '#6b7280', fontSize: '0.75rem', padding: '0.5rem 0' }}>{t('editor.loadingEndorsements', 'Loading endorsements...')}</div>
      ) : endorsements.length > 0 ? (
        <div>
          <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>{t('editor.endorsedBy', 'Endorsed by:')}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
            {endorsements.map((e) => (
              <span key={e.id} style={{
                padding: '0.15rem 0.5rem',
                backgroundColor: '#22c55e10',
                border: '1px solid #22c55e20',
                borderRadius: '4px',
                fontSize: '0.65rem',
                color: '#22c55e',
              }}>
                {e.endorser_linked_username || e.endorser_username || 'User'}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p style={{ color: '#4b5563', fontSize: '0.75rem', margin: 0 }}>
          {t('editor.noEndorsements', 'No endorsements yet. Share your link to get started.')}
        </p>
      )}
    </div>
  );
};

export default PendingClaimView;
