import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

/**
 * Lightweight hook to get total unread message count for the current user.
 * Used in the header to show badge on profile/hamburger button.
 * Subscribes to real-time inserts on application_messages for live updates.
 */
export function useUnreadMessages(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user || !supabase) return;
    const userId = user.id;

    // Get all active applications where this user is involved (as applicant or as recruiter/editor)
    // 1. As applicant
    const { data: asApplicant } = await supabase
      .from('transfer_applications')
      .select('id')
      .eq('applicant_user_id', userId)
      .in('status', ['pending', 'viewed', 'interested', 'accepted']);

    // 2. As recruiter — find kingdoms they edit, then find apps for those kingdoms
    const { data: editorRows } = await supabase
      .from('kingdom_editors')
      .select('kingdom_number')
      .eq('user_id', userId);

    let recruiterAppIds: string[] = [];
    if (editorRows && editorRows.length > 0) {
      const kNums = editorRows.map((e: { kingdom_number: number }) => e.kingdom_number);
      const { data: recruiterApps } = await supabase
        .from('transfer_applications')
        .select('id')
        .in('kingdom_number', kNums)
        .in('status', ['pending', 'viewed', 'interested', 'accepted']);
      recruiterAppIds = (recruiterApps || []).map((a: { id: string }) => a.id);
    }

    const applicantAppIds = (asApplicant || []).map((a: { id: string }) => a.id);
    const allAppIds = [...new Set([...applicantAppIds, ...recruiterAppIds])];

    if (allAppIds.length === 0) {
      setCount(0);
      return;
    }

    // Fetch read status for all apps
    const { data: readRows } = await supabase
      .from('message_read_status')
      .select('application_id, last_read_at')
      .eq('user_id', userId)
      .in('application_id', allAppIds);
    const readMap = new Map(
      (readRows || []).map((r: { application_id: string; last_read_at: string }) => [r.application_id, r.last_read_at])
    );

    // Count unread messages from others
    let total = 0;
    for (const appId of allAppIds) {
      const lastRead = readMap.get(appId);
      let query = supabase
        .from('application_messages')
        .select('id', { count: 'exact', head: true })
        .eq('application_id', appId)
        .neq('sender_user_id', userId);
      if (lastRead) query = query.gt('created_at', lastRead);
      const { count: c } = await query;
      total += c || 0;
    }

    setCount(total);
  }, [user, supabase]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Subscribe to real-time new messages to update count
  useEffect(() => {
    if (!user || !supabase) return;
    const sb = supabase!;
    const channel = sb
      .channel('header-unread-msgs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'application_messages',
      }, (payload) => {
        const row = payload.new as { sender_user_id: string };
        // Only increment if message is from someone else
        if (row.sender_user_id !== user.id) {
          setCount(prev => prev + 1);
        }
      })
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [user]);

  // Also listen for read status changes (user reading messages should decrease count)
  useEffect(() => {
    if (!user || !supabase) return;
    const sb = supabase;
    const channel = sb
      .channel('header-read-status')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_read_status',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        // Re-fetch the full count when user reads messages
        fetchCount();
      })
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [user, fetchCount]);

  // Listen for custom 'messages-read' event dispatched by Messages page / ApplicationCard
  useEffect(() => {
    const handler = () => { fetchCount(); };
    window.addEventListener('messages-read', handler);
    return () => window.removeEventListener('messages-read', handler);
  }, [fetchCount]);

  return count;
}
