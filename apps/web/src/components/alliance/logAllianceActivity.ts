import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { logger } from '../../utils/logger';

export type AllianceAction =
  | 'member_added' | 'member_removed' | 'member_updated'
  | 'application_approved' | 'application_rejected'
  | 'ownership_transferred' | 'manager_added' | 'manager_removed'
  | 'alliance_updated' | 'alliance_created';

/**
 * Fire-and-forget activity log writer.
 * Silently catches errors — logging should never block the main action.
 */
export async function logAllianceActivity(params: {
  allianceId: string;
  actorUserId: string;
  actorName: string;
  action: AllianceAction;
  targetName?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('alliance_activity_log').insert({
      alliance_id: params.allianceId,
      actor_user_id: params.actorUserId,
      actor_name: params.actorName,
      action: params.action,
      target_name: params.targetName ?? null,
      details: params.details ?? {},
    });
  } catch (e) {
    logger.error('Failed to write alliance activity log:', e);
  }
}
