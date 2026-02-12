import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { supabase } from '../lib/supabase';
import { FONT_DISPLAY } from '../utils/styles';

// =============================================
// TYPES
// =============================================

interface EditorClaim {
  id: string;
  kingdom_number: number;
  user_id: string;
  role: 'editor' | 'co-editor';
  status: 'pending' | 'active' | 'inactive' | 'suspended';
  endorsement_count: number;
  required_endorsements: number;
  nominated_at: string | null;
  activated_at: string | null;
  assigned_by: string | null;
}

interface Endorsement {
  id: string;
  editor_claim_id: string;
  endorser_user_id: string;
  created_at: string;
  endorser_username?: string;
  endorser_linked_username?: string;
}

// =============================================
// ENDORSEMENT PROGRESS BAR
// =============================================

const EndorsementProgress: React.FC<{
  current: number;
  required: number;
}> = ({ current, required }) => {
  const { t } = useTranslation();
  const pct = Math.min(100, (current / required) * 100);
  const isComplete = current >= required;

  const getMilestone = () => {
    if (pct >= 100) return { emoji: '🎉', label: t('editor.activated', 'Activated!'), color: '#22c55e' };
    if (pct >= 75) return { emoji: '🔥', label: t('editor.almostThere', 'Almost there!'), color: '#f97316' };
    if (pct >= 50) return { emoji: '⚡', label: t('editor.halfway', 'Halfway!'), color: '#eab308' };
    if (pct >= 25) return { emoji: '🚀', label: t('editor.gainingMomentum', 'Gaining momentum'), color: '#22d3ee' };
    return null;
  };
  const milestone = getMilestone();

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '0.35rem',
      }}>
        <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
          {t('editor.endorsements', 'Endorsements')}
          {milestone && (
            <span style={{ marginLeft: '0.4rem', color: milestone.color, fontWeight: 600 }}>
              {milestone.emoji} {milestone.label}
            </span>
          )}
        </span>
        <span style={{
          color: isComplete ? '#22c55e' : '#eab308',
          fontSize: '0.75rem',
          fontWeight: '600',
        }}>
          {current}/{required}
        </span>
      </div>
      <div style={{
        height: '6px',
        backgroundColor: '#1a1a1a',
        borderRadius: '3px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: isComplete ? '#22c55e' : milestone?.color || '#eab308',
          borderRadius: '3px',
          transition: 'width 0.5s ease',
          ...(pct >= 75 && !isComplete ? { boxShadow: `0 0 8px ${milestone?.color || '#f97316'}60` } : {}),
        }} />
      </div>
    </div>
  );
};

// =============================================
// NOMINATE FORM
// =============================================

const NominateForm: React.FC<{
  onNominated: () => void;
  onCancel: () => void;
}> = ({ onNominated, onCancel }) => {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkedKingdom = profile?.linked_kingdom;
  const linkedTcLevel = profile?.linked_tc_level;
  const isLinked = !!profile?.linked_player_id;
  const meetsTcReq = (linkedTcLevel || 0) >= 20;

  const canNominate = isLinked && meetsTcReq && linkedKingdom;

  const handleNominate = async () => {
    if (!supabase || !user || !linkedKingdom || !canNominate) return;

    setSubmitting(true);
    setError(null);

    try {
      // Check for existing claim
      const { data: existingClaim } = await supabase
        .from('kingdom_editors')
        .select('id, status')
        .eq('kingdom_number', linkedKingdom)
        .eq('user_id', user.id)
        .single();

      if (existingClaim) {
        setError('You already have an editor claim for this kingdom.');
        return;
      }

      // Check if kingdom already has an active editor
      const { data: activeEditor } = await supabase
        .from('kingdom_editors')
        .select('id')
        .eq('kingdom_number', linkedKingdom)
        .eq('status', 'active')
        .eq('role', 'editor')
        .single();

      if (activeEditor) {
        setError('This kingdom already has an active primary editor.');
        return;
      }

      // Create nomination
      const { error: insertError } = await supabase
        .from('kingdom_editors')
        .insert({
          kingdom_number: linkedKingdom,
          user_id: user.id,
          role: 'editor',
          status: 'pending',
          endorsement_count: 0,
          required_endorsements: 10,
        });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      onNominated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit nomination';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      backgroundColor: '#111111',
      border: '1px solid #2a2a2a',
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
    }}>
      <h3 style={{
        fontFamily: FONT_DISPLAY,
        fontSize: '1rem',
        color: '#fff',
        margin: '0 0 0.75rem 0',
      }}>
        {t('editor.claimYourKingdom', 'Claim Your Kingdom')}
      </h3>

      <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
        {t('editor.becomeEditorDesc', "Become the editor for your kingdom's Transfer Hub listing. As editor, you control recruitment settings, review applications, and manage your kingdom's public profile.")}
      </p>

      {/* Requirements Checklist */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '0.5rem',
        marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: isLinked ? '#22c55e' : '#ef4444', fontSize: '0.8rem' }}>
            {isLinked ? '✓' : '✗'}
          </span>
          <span style={{ color: isLinked ? '#d1d5db' : '#6b7280', fontSize: '0.8rem' }}>
            {t('editor.linkedAccount', 'Linked Kingshot account')} {linkedKingdom ? `(${t('editor.kingdom', 'Kingdom')} ${linkedKingdom})` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: meetsTcReq ? '#22c55e' : '#ef4444', fontSize: '0.8rem' }}>
            {meetsTcReq ? '✓' : '✗'}
          </span>
          <span style={{ color: meetsTcReq ? '#d1d5db' : '#6b7280', fontSize: '0.8rem' }}>
            {t('editor.tcLevel20', 'TC Level 20+')} {linkedTcLevel ? `(${t('editor.currently', 'currently')} TC${linkedTcLevel})` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>○</span>
          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
            {t('editor.endorsementsRequired', '10 endorsements from TC20+ kingdom members (after nomination)')}
          </span>
        </div>
      </div>

      {!isLinked && (
        <div style={{
          padding: '0.75rem',
          backgroundColor: '#f59e0b10',
          border: '1px solid #f59e0b25',
          borderRadius: '8px',
          marginBottom: '0.75rem',
        }}>
          <p style={{ color: '#f59e0b', fontSize: '0.8rem', margin: 0 }}>
            {t('editor.linkAccountFirst', 'Link your Kingshot account first. Go to your Profile page and use the "Link Kingshot Account" section.')}
          </p>
        </div>
      )}

      {error && (
        <div style={{
          padding: '0.6rem 0.75rem',
          backgroundColor: '#ef444415',
          border: '1px solid #ef444440',
          borderRadius: '8px',
          color: '#ef4444',
          fontSize: '0.8rem',
          marginBottom: '0.75rem',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'transparent',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            color: '#9ca3af',
            fontSize: '0.8rem',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          {t('editor.cancel', 'Cancel')}
        </button>
        <button
          onClick={handleNominate}
          disabled={!canNominate || submitting}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: canNominate && !submitting ? '#22d3ee' : '#22d3ee30',
            border: 'none',
            borderRadius: '8px',
            color: canNominate && !submitting ? '#000' : '#6b7280',
            fontSize: '0.8rem',
            fontWeight: '600',
            cursor: canNominate && !submitting ? 'pointer' : 'not-allowed',
            minHeight: '44px',
          }}
        >
          {submitting ? t('editor.submitting', 'Submitting...') : t('editor.nominateMyself', 'Nominate Myself')}
        </button>
      </div>
    </div>
  );
};

// =============================================
// PENDING CLAIM VIEW (endorsement gathering)
// =============================================

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
          fontSize: '0.6rem',
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

// =============================================
// ENDORSE BUTTON (for other users viewing a claim)
// =============================================

const EndorseButton: React.FC<{
  claimId: string;
  kingdomNumber: number;
  nomineeName?: string;
  onEndorsed: () => void;
}> = ({ claimId, kingdomNumber, nomineeName, onEndorsed }) => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyEndorsed, setAlreadyEndorsed] = useState(false);

  const isLinked = !!profile?.linked_player_id;
  const linkedKingdom = profile?.linked_kingdom;
  const meetsTcReq = (profile?.linked_tc_level || 0) >= 20;
  const isSameKingdom = linkedKingdom === kingdomNumber;
  const canEndorse = isLinked && meetsTcReq && isSameKingdom && !alreadyEndorsed;

  const checkExisting = useCallback(async () => {
    if (!supabase || !user) return;
    const { data } = await supabase
      .from('editor_endorsements')
      .select('id')
      .eq('editor_claim_id', claimId)
      .eq('endorser_user_id', user.id)
      .single();
    setAlreadyEndorsed(!!data);
  }, [user, claimId]);

  useEffect(() => {
    checkExisting();
  }, [checkExisting]);

  const handleEndorse = async () => {
    if (!supabase || !user || !canEndorse) return;
    setSubmitting(true);
    setError(null);

    try {
      // Atomic RPC: inserts endorsement + increments count in one transaction
      const { data, error: rpcError } = await supabase
        .rpc('submit_endorsement', {
          p_claim_id: claimId,
          p_endorser_user_id: user.id,
        });

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      const result = data as { success: boolean; error?: string; new_count?: number; activated?: boolean } | null;

      if (!result?.success) {
        setError(result?.error || 'Failed to endorse');
        return;
      }

      setAlreadyEndorsed(true);
      onEndorsed();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to endorse';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div style={{
      backgroundColor: '#111111',
      border: '1px solid #22c55e25',
      borderRadius: '10px',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.5rem',
      textAlign: 'center',
    }}>
      <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600' }}>
        {t('editor.endorse', 'Endorse')} {nomineeName ? <span style={{ color: '#a855f7' }}>{nomineeName}</span> : t('recruiter.editor', 'Editor')} {t('editor.forKingdom', 'for')} K{kingdomNumber}
      </span>
      {!isLinked && (
        <p style={{ color: '#f59e0b', fontSize: '0.7rem', margin: 0 }}>
          {t('editor.linkToEndorse', 'Link your Kingshot account first to endorse.')}
        </p>
      )}
      {isLinked && !isSameKingdom && (
        <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: 0 }}>
          {t('editor.onlyMembers', 'Only members of Kingdom {{kingdom}} with TC20+ can endorse.', { kingdom: kingdomNumber })}
        </p>
      )}
      {isLinked && isSameKingdom && !meetsTcReq && (
        <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: 0 }}>
          {t('editor.tcRequired', 'TC Level 20+ required to endorse.')}
        </p>
      )}

      {error && (
        <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>{error}</span>
      )}

      {alreadyEndorsed ? (
        <span style={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: '600' }}>
          {t('editor.endorsed', '✓ Endorsed')}
        </span>
      ) : (
        <button
          onClick={handleEndorse}
          disabled={!canEndorse || submitting}
          style={{
            padding: '0.5rem 1.5rem',
            backgroundColor: canEndorse && !submitting ? '#22c55e' : '#22c55e20',
            border: 'none',
            borderRadius: '8px',
            color: canEndorse && !submitting ? '#000' : '#6b7280',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: canEndorse && !submitting ? 'pointer' : 'not-allowed',
            minHeight: '44px',
            whiteSpace: 'nowrap',
          }}
        >
          {submitting ? t('editor.endorsing', 'Endorsing...') : t('editor.endorse', 'Endorse')}
        </button>
      )}
    </div>
  );
};

// =============================================
// MAIN EDITOR CLAIMING COMPONENT
// =============================================

const MAX_CO_EDITORS_PER_KINGDOM = 2;

const EditorClaiming: React.FC<{
  onEditorActivated?: () => void;
}> = ({ onEditorActivated }) => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [myClaim, setMyClaim] = useState<EditorClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNominate, setShowNominate] = useState(false);
  const [hasActiveEditor, setHasActiveEditor] = useState(false);
  const [coEditorCount, setCoEditorCount] = useState(0);
  const [submittingCoEditor, setSubmittingCoEditor] = useState(false);
  const [coEditorError, setCoEditorError] = useState<string | null>(null);
  const [coEditorRequestSent, setCoEditorRequestSent] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState(false);

  const loadMyClaim = useCallback(async () => {
    if (!supabase || !user) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('kingdom_editors')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setMyClaim(data || null);
    } catch {
      // No claim found
    }

    // Check if kingdom has an active editor & co-editor count
    const linkedKingdom = profile?.linked_kingdom;
    if (linkedKingdom) {
      try {
        const { data: activeEd } = await supabase
          .from('kingdom_editors')
          .select('id')
          .eq('kingdom_number', linkedKingdom)
          .eq('status', 'active')
          .eq('role', 'editor')
          .limit(1)
          .maybeSingle();
        setHasActiveEditor(!!activeEd);

        const { data: coEditors } = await supabase
          .from('kingdom_editors')
          .select('id')
          .eq('kingdom_number', linkedKingdom)
          .eq('role', 'co-editor')
          .in('status', ['active', 'pending']);
        setCoEditorCount(coEditors?.length || 0);
      } catch {
        // silent
      }
    }

    setLoading(false);
  }, [user, profile?.linked_kingdom]);

  useEffect(() => {
    loadMyClaim();
  }, [loadMyClaim]);

  if (!user) return null;
  if (loading) return <div style={{ color: '#6b7280', fontSize: '0.8rem', padding: '0.5rem 0' }}>{t('editor.checkingStatus', 'Checking editor status...')}</div>;

  // Already an active editor
  if (myClaim?.status === 'active') {
    return (
      <div style={{
        backgroundColor: '#22c55e08',
        border: '1px solid #22c55e25',
        borderRadius: '10px',
        padding: '0.6rem 0.75rem',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ color: '#22c55e', fontWeight: '600', fontSize: '0.85rem' }}>
            Kingdom {myClaim.kingdom_number}
          </span>
          <span style={{
            padding: '0.1rem 0.4rem',
            backgroundColor: '#22c55e15',
            border: '1px solid #22c55e30',
            borderRadius: '4px',
            fontSize: '0.55rem',
            color: '#22c55e',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}>
            {myClaim.role}
          </span>
        </div>
        <p style={{ color: '#6b7280', fontSize: '0.65rem', margin: '0.15rem 0 0 0', lineHeight: 1.3, textAlign: 'center' }}>
          {t('editor.youManage', "You manage this kingdom's")} <br />{t('editor.transferHubListing', 'Transfer Hub listing.')}
        </p>
      </div>
    );
  }

  // Has a pending co-editor invite (editor invited this user — assigned_by is set)
  if (myClaim?.status === 'pending' && myClaim?.role === 'co-editor' && myClaim?.assigned_by) {
    const handleAcceptInvite = async () => {
      if (!supabase || !myClaim) return;
      setAcceptingInvite(true);
      try {
        await supabase
          .from('kingdom_editors')
          .update({ status: 'active', activated_at: new Date().toISOString() })
          .eq('id', myClaim.id);
        loadMyClaim();
        onEditorActivated?.();
      } catch {
        // silent
      } finally {
        setAcceptingInvite(false);
      }
    };
    const handleDeclineInvite = async () => {
      if (!supabase || !myClaim) return;
      setAcceptingInvite(true);
      try {
        await supabase
          .from('kingdom_editors')
          .update({ status: 'inactive' })
          .eq('id', myClaim.id);
        loadMyClaim();
      } catch {
        // silent
      } finally {
        setAcceptingInvite(false);
      }
    };
    return (
      <div style={{
        backgroundColor: '#22c55e08',
        border: '1px solid #22c55e25',
        borderRadius: '10px',
        padding: '0.75rem 1rem',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '1rem' }}>🎉</span>
          <span style={{ color: '#22c55e', fontWeight: '600', fontSize: '0.85rem' }}>
            {t('editor.coEditorInvitation', 'Co-Editor Invitation')}
          </span>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.7rem', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
          {t('editor.coEditorInviteDesc', "You've been invited to co-edit Kingdom {{kingdom}}'s recruiter dashboard.", { kingdom: myClaim.kingdom_number })}
        </p>
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', marginTop: '0.5rem' }}>
          <button
            onClick={handleAcceptInvite}
            disabled={acceptingInvite}
            style={{
              padding: '0.4rem 1rem', backgroundColor: '#22c55e15', border: '1px solid #22c55e40',
              borderRadius: '6px', color: '#22c55e', fontSize: '0.75rem', fontWeight: '600',
              cursor: acceptingInvite ? 'default' : 'pointer', minHeight: '36px',
              opacity: acceptingInvite ? 0.5 : 1,
            }}
          >
            {acceptingInvite ? '...' : t('editor.acceptInvite', 'Accept')}
          </button>
          <button
            onClick={handleDeclineInvite}
            disabled={acceptingInvite}
            style={{
              padding: '0.4rem 1rem', backgroundColor: '#ef444415', border: '1px solid #ef444440',
              borderRadius: '6px', color: '#ef4444', fontSize: '0.75rem', fontWeight: '600',
              cursor: acceptingInvite ? 'default' : 'pointer', minHeight: '36px',
              opacity: acceptingInvite ? 0.5 : 1,
            }}
          >
            {t('editor.declineInvite', 'Decline')}
          </button>
        </div>
      </div>
    );
  }

  // Has a pending co-editor self-request (user applied — no assigned_by)
  if (myClaim?.status === 'pending' && myClaim?.role === 'co-editor') {
    return (
      <div style={{
        backgroundColor: '#eab30808',
        border: '1px solid #eab30825',
        borderRadius: '10px',
        padding: '0.75rem 1rem',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '1rem' }}>📨</span>
          <span style={{ color: '#eab308', fontWeight: '600', fontSize: '0.85rem' }}>
            {t('editor.coEditorRequestSent', 'Co-Editor Request Sent')}
          </span>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.7rem', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
          {t('editor.coEditorRequestPending', 'Your request to co-edit Kingdom {{kingdom}} is pending editor approval. You\'ll be notified when it\'s reviewed.', { kingdom: myClaim.kingdom_number })}
        </p>
        {coEditorRequestSent && (
          <div style={{
            marginTop: '0.5rem',
            padding: '0.3rem 0.6rem',
            backgroundColor: '#22c55e10',
            border: '1px solid #22c55e25',
            borderRadius: '6px',
            color: '#22c55e',
            fontSize: '0.65rem',
            fontWeight: '500',
          }}>
            ✓ {t('editor.requestJustSent', 'Request just sent! The editor has been notified.')}
          </div>
        )}
      </div>
    );
  }

  // Has a pending editor claim
  if (myClaim?.status === 'pending') {
    return (
      <PendingClaimView
        claim={myClaim}
        onRefresh={() => {
          loadMyClaim();
          onEditorActivated?.();
        }}
      />
    );
  }

  // Co-editor self-nomination handler
  const handleBecomeCoEditor = async () => {
    if (!supabase || !user || !profile?.linked_kingdom) return;
    setSubmittingCoEditor(true);
    setCoEditorError(null);

    const linkedKingdom = profile.linked_kingdom;
    const meetsTcReq = (profile.linked_tc_level || 0) >= 20;

    if (!meetsTcReq) {
      setCoEditorError('TC Level 20+ required to become a co-editor.');
      setSubmittingCoEditor(false);
      return;
    }

    if (coEditorCount >= MAX_CO_EDITORS_PER_KINGDOM) {
      setCoEditorError(`Maximum of ${MAX_CO_EDITORS_PER_KINGDOM} co-editors per kingdom.`);
      setSubmittingCoEditor(false);
      return;
    }

    try {
      // Check for existing claim
      const { data: existing } = await supabase
        .from('kingdom_editors')
        .select('id, status, assigned_by')
        .eq('kingdom_number', linkedKingdom)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'active') {
          setCoEditorError('You are already an active editor for this kingdom.');
          setSubmittingCoEditor(false);
          return;
        }
        if (existing.status === 'pending' && existing.assigned_by) {
          // Editor already invited this user — auto-accept the invite
          await supabase
            .from('kingdom_editors')
            .update({ status: 'active', activated_at: new Date().toISOString() })
            .eq('id', existing.id);
          loadMyClaim();
          onEditorActivated?.();
          setSubmittingCoEditor(false);
          return;
        }
        if (existing.status === 'pending' && !existing.assigned_by) {
          setCoEditorError('You already have a pending co-editor request for this kingdom.');
          setSubmittingCoEditor(false);
          return;
        }
        // Inactive — reuse the row
        await supabase
          .from('kingdom_editors')
          .update({ status: 'pending', role: 'co-editor', assigned_by: null })
          .eq('id', existing.id);
        setCoEditorRequestSent(true);
        loadMyClaim();

        // Notify active editor(s)
        const { data: activeEditors } = await supabase
          .from('kingdom_editors')
          .select('user_id')
          .eq('kingdom_number', linkedKingdom)
          .eq('status', 'active')
          .eq('role', 'editor');

        if (activeEditors?.length) {
          const displayName = profile.linked_username || profile.username || 'A user';
          const notifications = activeEditors.map(e => ({
            user_id: e.user_id,
            type: 'co_editor_request',
            title: 'Co-Editor Request',
            message: `${displayName} wants to become a co-editor for Kingdom ${linkedKingdom}.`,
            link: '/transfer-hub',
            metadata: { kingdom_number: linkedKingdom, requester_id: user.id },
          }));
          await supabase.from('notifications').insert(notifications);
        }
        setSubmittingCoEditor(false);
        return;
      }

      // Insert co-editor claim — skip endorsements, goes straight to pending for editor approval
      const { error: insertError } = await supabase
        .from('kingdom_editors')
        .insert({
          kingdom_number: linkedKingdom,
          user_id: user.id,
          role: 'co-editor',
          status: 'pending',
          endorsement_count: 0,
          required_endorsements: 0,
        });

      if (insertError) {
        setCoEditorError(insertError.message);
        return;
      }

      // Notify the active editor(s) about the request
      const { data: activeEditors } = await supabase
        .from('kingdom_editors')
        .select('user_id')
        .eq('kingdom_number', linkedKingdom)
        .eq('status', 'active')
        .eq('role', 'editor');

      if (activeEditors?.length) {
        const displayName = profile.linked_username || profile.username || 'A user';
        const notifications = activeEditors.map(e => ({
          user_id: e.user_id,
          type: 'co_editor_request',
          title: 'Co-Editor Request',
          message: `${displayName} wants to become a co-editor for Kingdom ${linkedKingdom}.`,
          link: '/transfer-hub',
          metadata: { kingdom_number: linkedKingdom, requester_id: user.id },
        }));
        await supabase.from('notifications').insert(notifications);
      }

      setCoEditorRequestSent(true);
      loadMyClaim();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit co-editor request';
      setCoEditorError(message);
    } finally {
      setSubmittingCoEditor(false);
    }
  };

  // No claim — show CTA or nominate form
  if (showNominate) {
    return (
      <NominateForm
        onNominated={() => {
          setShowNominate(false);
          loadMyClaim();
        }}
        onCancel={() => setShowNominate(false)}
      />
    );
  }

  // CTA to claim kingdom
  const linkedKingdom = profile?.linked_kingdom;
  const isLinked = !!profile?.linked_player_id;
  const meetsTcReq = (profile?.linked_tc_level || 0) >= 20;
  const canBeCoEditor = isLinked && meetsTcReq && linkedKingdom && hasActiveEditor && coEditorCount < MAX_CO_EDITORS_PER_KINGDOM;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Primary CTA: Become Editor */}
      {!hasActiveEditor && (
        <div style={{
          backgroundColor: '#a855f708',
          border: '1px solid #a855f725',
          borderRadius: '12px',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}>
          <div>
            <span style={{ color: '#a855f7', fontWeight: '600', fontSize: '0.85rem' }}>
              {t('editor.becomeEditor', 'Become a Kingdom Editor')}
            </span>
            <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.2rem 0 0 0' }}>
              {linkedKingdom
                ? t('editor.claimKingdomDesc', 'Claim Kingdom {{kingdom}} to manage its recruitment listing.', { kingdom: linkedKingdom })
                : t('editor.linkFirst', 'Link your Kingshot account first, then claim your kingdom.')}
            </p>
          </div>
          <button
            onClick={() => setShowNominate(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#a855f7',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              minHeight: '44px',
            }}
          >
            {t('editor.claimKingdom', 'Claim Kingdom')}
          </button>
        </div>
      )}

      {/* Co-Editor CTA: When kingdom already has an active editor */}
      {hasActiveEditor && linkedKingdom && (
        <div style={{
          backgroundColor: '#a855f708',
          border: '1px solid #a855f725',
          borderRadius: '12px',
          padding: '0.75rem 1rem',
        }}>
          <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: '0.75rem', flexDirection: isMobile ? 'column' : 'row' }}>
            <div>
              <span style={{ color: '#a855f7', fontWeight: '600', fontSize: '0.85rem' }}>
                {t('editor.becomeCoEditor', 'Become a Co-Editor')}
              </span>
              <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.2rem 0 0 0' }}>
                {t('editor.becomeCoEditorDesc', 'Kingdom {{kingdom}} already has an editor. Join as a co-editor to help manage the Transfer Hub listing.', { kingdom: linkedKingdom })}
                {coEditorCount > 0 && (
                  <span style={{ color: '#a855f7' }}> {t('editor.coEditorSlotsUsed', '({{count}}/{{max}} co-editor slots used)', { count: coEditorCount, max: MAX_CO_EDITORS_PER_KINGDOM })}</span>
                )}
              </p>
              <p style={{ color: '#4b5563', fontSize: '0.65rem', margin: '0.2rem 0 0 0' }}>
                {t('editor.noEndorsementsRequired', 'No endorsements required. The editor will be notified of your request.')}
              </p>
            </div>
            <button
              onClick={handleBecomeCoEditor}
              disabled={!canBeCoEditor || submittingCoEditor}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: canBeCoEditor && !submittingCoEditor ? '#a855f7' : '#a855f730',
                border: 'none',
                borderRadius: '8px',
                color: canBeCoEditor && !submittingCoEditor ? '#fff' : '#6b7280',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: canBeCoEditor && !submittingCoEditor ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
                minHeight: '44px',
                flexShrink: 0,
                width: isMobile ? '100%' : 'auto',
              }}
            >
              {submittingCoEditor ? t('editor.requesting', 'Requesting...') : t('editor.requestCoEditor', 'Request Co-Editor')}
            </button>
          </div>

          {coEditorError && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.4rem 0.6rem',
              backgroundColor: '#ef444415',
              border: '1px solid #ef444440',
              borderRadius: '6px',
              color: '#ef4444',
              fontSize: '0.75rem',
            }}>
              {coEditorError}
            </div>
          )}

          {!isLinked && (
            <p style={{ color: '#f59e0b', fontSize: '0.7rem', margin: '0.4rem 0 0 0' }}>
              {t('editor.linkAccountCoEditor', 'Link your Kingshot account first to become a co-editor.')}
            </p>
          )}
          {isLinked && !meetsTcReq && (
            <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.4rem 0 0 0' }}>
              {t('editor.tcRequiredCoEditor', 'TC Level 20+ required to become a co-editor.')}
            </p>
          )}
          {coEditorCount >= MAX_CO_EDITORS_PER_KINGDOM && (
            <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.4rem 0 0 0' }}>
              {t('editor.maxCoEditors', 'This kingdom has reached the maximum of {{max}} co-editors.', { max: MAX_CO_EDITORS_PER_KINGDOM })}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export { EditorClaiming, EndorseButton };
export default EditorClaiming;
