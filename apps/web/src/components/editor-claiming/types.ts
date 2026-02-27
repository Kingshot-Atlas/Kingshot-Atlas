export interface EditorClaim {
  id: string;
  kingdom_number: number;
  user_id: string;
  role: 'editor' | 'co-editor';
  status: 'pending' | 'active' | 'inactive' | 'suspended' | 'cancelled';
  endorsement_count: number;
  required_endorsements: number;
  nominated_at: string | null;
  activated_at: string | null;
  assigned_by: string | null;
}

export interface Endorsement {
  id: string;
  editor_claim_id: string;
  endorser_user_id: string;
  created_at: string;
  endorser_username?: string;
  endorser_linked_username?: string;
}
