import { supabase } from '../lib/supabase';
import { logger } from './logger';

/**
 * Logs an admin action to the admin_audit_log table.
 * Fire-and-forget — never blocks the caller or surfaces errors to the user.
 */
export async function logAdminAction(params: {
  action: string;
  targetTable: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Fetch username from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', session.user.id)
      .single();

    await supabase.from('admin_audit_log').insert({
      admin_user_id: session.user.id,
      admin_username: profile?.username ?? session.user.email ?? 'unknown',
      action: params.action,
      target_table: params.targetTable,
      target_id: params.targetId ?? null,
      details: params.details ?? {},
    });
  } catch (err) {
    // Never throw — audit logging must not break admin flows
    logger.warn('Failed to write admin audit log:', err);
  }
}
