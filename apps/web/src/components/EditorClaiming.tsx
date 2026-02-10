import React, { useState, useEffect } from 'react';
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
  const pct = Math.min(100, (current / required) * 100);
  const isComplete = current >= required;

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '0.35rem',
      }}>
        <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>Endorsements</span>
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
          backgroundColor: isComplete ? '#22c55e' : '#eab308',
          borderRadius: '3px',
          transition: 'width 0.3s ease',
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
        Claim Your Kingdom
      </h3>

      <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
        Become the editor for your kingdom's Transfer Hub listing.
        As editor, you control recruitment settings, review applications, and manage your kingdom's public profile.
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
            Linked Kingshot account {linkedKingdom ? `(Kingdom ${linkedKingdom})` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: meetsTcReq ? '#22c55e' : '#ef4444', fontSize: '0.8rem' }}>
            {meetsTcReq ? '✓' : '✗'}
          </span>
          <span style={{ color: meetsTcReq ? '#d1d5db' : '#6b7280', fontSize: '0.8rem' }}>
            TC Level 20+ {linkedTcLevel ? `(currently TC${linkedTcLevel})` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>○</span>
          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
            10 endorsements from TC20+ kingdom members (after nomination)
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
            Link your Kingshot account first. Go to your Profile page and use the "Link Kingshot Account" section.
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
          Cancel
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
          {submitting ? 'Submitting...' : 'Nominate Myself'}
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
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadEndorsements();
  }, [claim.id]);

  const loadEndorsements = async () => {
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
  };

  const shareLink = `${window.location.origin}/transfer-hub?endorse=${claim.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      backgroundColor: '#111111',
      border: '1px solid #eab30825',
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '0.75rem',
      }}>
        <h3 style={{
          fontFamily: FONT_DISPLAY,
          fontSize: '1rem',
          color: '#eab308',
          margin: 0,
        }}>
          Pending Editor Claim — K{claim.kingdom_number}
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
          GATHERING ENDORSEMENTS
        </span>
      </div>

      <EndorsementProgress current={claim.endorsement_count} required={claim.required_endorsements} />

      <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.75rem 0', lineHeight: 1.5 }}>
        Share this link with TC20+ members of Kingdom {claim.kingdom_number} to gather endorsements.
        Once you reach {claim.required_endorsements} endorsements, your claim is automatically activated.
      </p>

      {/* Share Link */}
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
          }}
        >
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>

      {/* Endorsers List */}
      {loading ? (
        <div style={{ color: '#6b7280', fontSize: '0.75rem', padding: '0.5rem 0' }}>Loading endorsements...</div>
      ) : endorsements.length > 0 ? (
        <div>
          <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>Endorsed by:</span>
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
          No endorsements yet. Share your link to get started.
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyEndorsed, setAlreadyEndorsed] = useState(false);

  const isLinked = !!profile?.linked_player_id;
  const linkedKingdom = profile?.linked_kingdom;
  const meetsTcReq = (profile?.linked_tc_level || 0) >= 20;
  const isSameKingdom = linkedKingdom === kingdomNumber;
  const canEndorse = isLinked && meetsTcReq && isSameKingdom && !alreadyEndorsed;

  useEffect(() => {
    checkExisting();
  }, [user, claimId]);

  const checkExisting = async () => {
    if (!supabase || !user) return;
    const { data } = await supabase
      .from('editor_endorsements')
      .select('id')
      .eq('editor_claim_id', claimId)
      .eq('endorser_user_id', user.id)
      .single();
    setAlreadyEndorsed(!!data);
  };

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
      padding: '0.75rem 1rem',
      display: 'flex',
      alignItems: isSameKingdom ? 'center' : 'flex-start',
      justifyContent: 'space-between',
      flexDirection: isSameKingdom ? 'row' : 'column',
      gap: '0.5rem',
    }}>
      <div>
        <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600' }}>
          Endorse {nomineeName ? <span style={{ color: '#a855f7' }}>{nomineeName}</span> : 'Editor'} for K{kingdomNumber}
        </span>
        {!isLinked && (
          <p style={{ color: '#f59e0b', fontSize: '0.7rem', margin: '0.2rem 0 0 0' }}>
            Link your Kingshot account first to endorse.
          </p>
        )}
        {isLinked && !isSameKingdom && (
          <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.2rem 0 0 0' }}>
            Only members of Kingdom {kingdomNumber} with TC20+ can endorse.
          </p>
        )}
        {isLinked && isSameKingdom && !meetsTcReq && (
          <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.2rem 0 0 0' }}>
            TC Level 20+ required to endorse.
          </p>
        )}
      </div>

      {error && (
        <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>{error}</span>
      )}

      {alreadyEndorsed ? (
        <span style={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: '600' }}>
          ✓ Endorsed
        </span>
      ) : (
        <button
          onClick={handleEndorse}
          disabled={!canEndorse || submitting}
          style={{
            padding: '0.4rem 0.75rem',
            backgroundColor: canEndorse && !submitting ? '#22c55e' : '#22c55e20',
            border: 'none',
            borderRadius: '8px',
            color: canEndorse && !submitting ? '#000' : '#6b7280',
            fontSize: '0.8rem',
            fontWeight: '600',
            cursor: canEndorse && !submitting ? 'pointer' : 'not-allowed',
            minHeight: '36px',
            whiteSpace: 'nowrap',
          }}
        >
          {submitting ? 'Endorsing...' : 'Endorse'}
        </button>
      )}
    </div>
  );
};

// =============================================
// MAIN EDITOR CLAIMING COMPONENT
// =============================================

const EditorClaiming: React.FC<{
  onEditorActivated?: () => void;
}> = ({ onEditorActivated }) => {
  const { user, profile } = useAuth();
  const [myClaim, setMyClaim] = useState<EditorClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNominate, setShowNominate] = useState(false);

  useEffect(() => {
    loadMyClaim();
  }, [user]);

  const loadMyClaim = async () => {
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
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <div style={{ color: '#6b7280', fontSize: '0.8rem', padding: '0.5rem 0' }}>Checking editor status...</div>;

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
          You manage this kingdom's<br />Transfer Hub listing.
        </p>
      </div>
    );
  }

  // Has a pending claim
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
  return (
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
          Become a Kingdom Editor
        </span>
        <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.2rem 0 0 0' }}>
          {linkedKingdom
            ? `Claim Kingdom ${linkedKingdom} to manage its recruitment listing.`
            : 'Link your Kingshot account first, then claim your kingdom.'}
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
        Claim Kingdom
      </button>
    </div>
  );
};

export { EditorClaiming, EndorseButton };
export default EditorClaiming;
