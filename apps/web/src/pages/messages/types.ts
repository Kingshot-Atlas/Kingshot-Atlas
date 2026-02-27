// ─── Types ────────────────────────────────────────────────────
export interface Conversation {
  application_id: string;
  kingdom_number: number;
  status: string;
  other_party_name: string;
  other_party_id: string;
  role: 'recruiter' | 'transferee';
  last_message: string;
  last_message_at: string;
  last_sender_id: string;
  unread_count: number;
  applied_at: string;
}

export interface ChatMessage {
  id: string;
  sender_user_id: string;
  message: string;
  created_at: string;
}
