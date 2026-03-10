import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

export interface SuccessionResult {
  success: boolean;
  promotedUserId?: string;
  promotedName?: string;
  error?: string;
  action: 'transferred' | 'auto_promoted' | 'kingdom_unmanaged' | 'stepped_down' | 'claims_cancelled' | 'no_action' | 'error';
}

/**
 * Check if a user has any editor claims/positions for a kingdom that differs from their new linked kingdom.
 * Handles ALL claim types:
 *   - Active editor → trigger succession via stepDownAsEditor
 *   - Pending editor claim (gathering endorsements) → cancel
 *   - Active co-editor → deactivate
 *   - Pending co-editor request → cancel
 * Called after linked_kingdom changes (account switch, new link, refresh).
 * Returns null if no action was needed.
 */
export async function checkAndAutoStepDown(
  userId: string,
  newLinkedKingdom: number | null | undefined,
): Promise<SuccessionResult | null> {
  if (!supabase || !userId) return null;

  try {
    // Find ALL active/pending claims for this user
    const { data: claims } = await supabase
      .from('kingdom_editors')
      .select('id, kingdom_number, role, status')
      .eq('user_id', userId)
      .in('status', ['active', 'pending']);

    if (!claims || claims.length === 0) return null;

    // Filter to claims that don't match the new kingdom
    const mismatched = claims.filter(c =>
      !newLinkedKingdom || c.kingdom_number !== newLinkedKingdom
    );

    if (mismatched.length === 0) return null;

    let result: SuccessionResult | null = null;
    const cancelledKingdoms: number[] = [];

    for (const claim of mismatched) {
      if (claim.status === 'active' && claim.role === 'editor') {
        // Active editor — trigger full succession
        logger.info(`[AutoStepDown] User ${userId} transferred to K${newLinkedKingdom}, auto-stepping down from K${claim.kingdom_number}`);
        result = await stepDownAsEditor(claim.id, userId, claim.kingdom_number);

        // Override audit log source
        if (result.success) {
          await supabase
            .from('editor_audit_log')
            .update({
              details: {
                source: 'kingdom_transfer_auto_step_down',
                new_kingdom: newLinkedKingdom,
                auto_promoted: result.action === 'auto_promoted',
                ...(result.promotedUserId ? { promoted_user_id: result.promotedUserId } : {}),
              },
            })
            .eq('kingdom_number', claim.kingdom_number)
            .eq('performed_by', userId)
            .eq('action', 'step_down')
            .order('created_at', { ascending: false })
            .limit(1);
        }
      } else if (claim.status === 'pending' && claim.role === 'editor') {
        // Pending editor claim (gathering endorsements) — cancel
        logger.info(`[AutoCancel] User ${userId} transferred to K${newLinkedKingdom}, cancelling pending editor claim for K${claim.kingdom_number}`);
        await supabase.from('kingdom_editors').update({ status: 'cancelled' }).eq('id', claim.id);
        cancelledKingdoms.push(claim.kingdom_number);

        await supabase.from('editor_audit_log').insert({
          editor_id: claim.id,
          kingdom_number: claim.kingdom_number,
          action: 'cancel',
          performed_by: userId,
          target_user_id: null,
          details: { source: 'kingdom_transfer_auto_cancel', new_kingdom: newLinkedKingdom },
        });
      } else if (claim.status === 'active' && claim.role === 'co-editor') {
        // Active co-editor — deactivate
        logger.info(`[AutoCancel] User ${userId} transferred to K${newLinkedKingdom}, deactivating co-editor for K${claim.kingdom_number}`);
        await supabase.from('kingdom_editors').update({ status: 'inactive' }).eq('id', claim.id);
        cancelledKingdoms.push(claim.kingdom_number);

        await supabase.from('editor_audit_log').insert({
          editor_id: claim.id,
          kingdom_number: claim.kingdom_number,
          action: 'step_down',
          performed_by: userId,
          target_user_id: null,
          details: { source: 'kingdom_transfer_auto_cancel', new_kingdom: newLinkedKingdom, role: 'co-editor' },
        });
      } else if (claim.status === 'pending' && claim.role === 'co-editor') {
        // Pending co-editor request — cancel
        logger.info(`[AutoCancel] User ${userId} transferred to K${newLinkedKingdom}, cancelling pending co-editor request for K${claim.kingdom_number}`);
        await supabase.from('kingdom_editors').update({ status: 'cancelled' }).eq('id', claim.id);
        cancelledKingdoms.push(claim.kingdom_number);
      }
    }

    // If we had an active editor step-down, that result takes priority
    if (result) return result;

    // Otherwise, report that claims were cancelled
    if (cancelledKingdoms.length > 0) {
      return { success: true, action: 'claims_cancelled' };
    }

    return null;
  } catch (err) {
    logger.error('[AutoStepDown] Failed:', err);
    return null; // Silently fail — don't block the kingdom transfer
  }
}

/**
 * Transfer the editor role to a specific co-editor.
 * - Deactivates the current editor
 * - Promotes the target co-editor to editor
 * - Logs the action in editor_audit_log
 * - Sends notification to the promoted user
 */
export async function transferEditorRole(
  editorClaimId: string,
  editorUserId: string,
  targetCoEditorClaimId: string,
  targetCoEditorUserId: string,
  kingdomNumber: number,
): Promise<SuccessionResult> {
  if (!supabase) return { success: false, error: 'No database connection', action: 'error' };

  try {
    // Validate the target is still an active co-editor
    const { data: target } = await supabase
      .from('kingdom_editors')
      .select('id, status, role, user_id')
      .eq('id', targetCoEditorClaimId)
      .eq('status', 'active')
      .eq('role', 'co-editor')
      .maybeSingle();

    if (!target) {
      return { success: false, error: 'Selected co-editor is no longer active.', action: 'error' };
    }

    // Deactivate the current editor
    const { error: deactivateError } = await supabase
      .from('kingdom_editors')
      .update({ status: 'inactive' })
      .eq('id', editorClaimId);

    if (deactivateError) {
      return { success: false, error: deactivateError.message, action: 'error' };
    }

    // Promote the co-editor to editor
    const { error: promoteError } = await supabase
      .from('kingdom_editors')
      .update({ role: 'editor', activated_at: new Date().toISOString() })
      .eq('id', targetCoEditorClaimId);

    if (promoteError) {
      // Rollback: reactivate the editor
      await supabase.from('kingdom_editors').update({ status: 'active' }).eq('id', editorClaimId);
      return { success: false, error: promoteError.message, action: 'error' };
    }

    // Get the promoted user's display name
    const { data: promotedProfile } = await supabase
      .from('profiles')
      .select('linked_username, username')
      .eq('id', targetCoEditorUserId)
      .maybeSingle();
    const promotedName = promotedProfile?.linked_username || promotedProfile?.username || 'User';

    // Audit log
    await supabase.from('editor_audit_log').insert({
      editor_id: editorClaimId,
      kingdom_number: kingdomNumber,
      action: 'transfer',
      performed_by: editorUserId,
      target_user_id: targetCoEditorUserId,
      details: { source: 'manual_concession', promoted_claim_id: targetCoEditorClaimId },
    });

    // Notify the promoted co-editor
    await supabase.from('notifications').insert({
      user_id: targetCoEditorUserId,
      type: 'editor_promotion',
      title: 'You are now the Editor',
      message: `The previous editor transferred the editor role for Kingdom ${kingdomNumber} to you. You now have full editor access.`,
      link: '/transfer-hub',
      metadata: { kingdom_number: kingdomNumber, action: 'promoted', previous_editor: editorUserId },
    });

    return { success: true, promotedUserId: targetCoEditorUserId, promotedName, action: 'transferred' };
  } catch (err) {
    logger.error('transferEditorRole failed:', err);
    return { success: false, error: 'Unexpected error during transfer.', action: 'error' };
  }
}

/**
 * Step down as editor, triggering auto-succession.
 * - If 1 active co-editor → auto-promote
 * - If multiple → promote the longest-serving (earliest activated_at)
 * - If 0 → kingdom becomes unmanaged
 */
export async function stepDownAsEditor(
  editorClaimId: string,
  editorUserId: string,
  kingdomNumber: number,
): Promise<SuccessionResult> {
  if (!supabase) return { success: false, error: 'No database connection', action: 'error' };

  try {
    // Find active co-editors for this kingdom, ordered by seniority
    const { data: coEditors } = await supabase
      .from('kingdom_editors')
      .select('id, user_id, activated_at, created_at')
      .eq('kingdom_number', kingdomNumber)
      .eq('role', 'co-editor')
      .eq('status', 'active')
      .order('activated_at', { ascending: true })
      .order('created_at', { ascending: true });

    // Deactivate the current editor
    const { error: deactivateError } = await supabase
      .from('kingdom_editors')
      .update({ status: 'inactive' })
      .eq('id', editorClaimId);

    if (deactivateError) {
      return { success: false, error: deactivateError.message, action: 'error' };
    }

    // Auto-succession
    if (coEditors && coEditors.length > 0) {
      const successor = coEditors[0]!; // Most senior co-editor

      // Promote
      const { error: promoteError } = await supabase
        .from('kingdom_editors')
        .update({ role: 'editor', activated_at: new Date().toISOString() })
        .eq('id', successor.id);

      if (promoteError) {
        logger.error('stepDown auto-promote failed:', promoteError);
        return { success: true, action: 'kingdom_unmanaged', error: 'Editor stepped down but auto-promotion failed.' };
      }

      const { data: promotedProfile } = await supabase
        .from('profiles')
        .select('linked_username, username')
        .eq('id', successor.user_id)
        .maybeSingle();
      const promotedName = promotedProfile?.linked_username || promotedProfile?.username || 'User';

      // Audit log
      await supabase.from('editor_audit_log').insert({
        editor_id: editorClaimId,
        kingdom_number: kingdomNumber,
        action: 'step_down',
        performed_by: editorUserId,
        target_user_id: successor.user_id,
        details: {
          source: 'voluntary_step_down',
          auto_promoted: true,
          promoted_claim_id: successor.id,
          co_editor_count: coEditors.length,
        },
      });

      // Notify promoted co-editor
      await supabase.from('notifications').insert({
        user_id: successor.user_id,
        type: 'editor_promotion',
        title: 'You are now the Editor',
        message: `The previous editor of Kingdom ${kingdomNumber} stepped down. As the most senior co-editor, you have been automatically promoted to editor.`,
        link: '/transfer-hub',
        metadata: { kingdom_number: kingdomNumber, action: 'auto_promoted', previous_editor: editorUserId },
      });

      // Notify other co-editors about the change
      if (coEditors.length > 1) {
        const otherCoEditors = coEditors.slice(1);
        const notifications = otherCoEditors.map(ce => ({
          user_id: ce.user_id,
          type: 'editor_change',
          title: 'Editor Changed',
          message: `The editor of Kingdom ${kingdomNumber} stepped down. ${promotedName} has been promoted to editor.`,
          link: '/transfer-hub',
          metadata: { kingdom_number: kingdomNumber, new_editor: successor.user_id },
        }));
        await supabase.from('notifications').insert(notifications);
      }

      return { success: true, promotedUserId: successor.user_id, promotedName, action: 'auto_promoted' };
    }

    // No co-editors — kingdom becomes unmanaged
    await supabase.from('editor_audit_log').insert({
      editor_id: editorClaimId,
      kingdom_number: kingdomNumber,
      action: 'step_down',
      performed_by: editorUserId,
      target_user_id: null,
      details: { source: 'voluntary_step_down', auto_promoted: false, kingdom_unmanaged: true },
    });

    return { success: true, action: 'kingdom_unmanaged' };
  } catch (err) {
    logger.error('stepDownAsEditor failed:', err);
    return { success: false, error: 'Unexpected error during step-down.', action: 'error' };
  }
}
