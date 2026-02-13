import React from 'react';

export interface EditorInfo {
  id: string;
  kingdom_number: number;
  user_id: string;
  role: 'editor' | 'co-editor';
  status: 'pending' | 'active' | 'inactive' | 'suspended';
  endorsement_count: number;
  required_endorsements: number;
  activated_at: string | null;
  last_active_at: string | null;
}

export interface TransfereeProfile {
  id: string;
  username: string;
  current_kingdom: number;
  tc_level: number;
  power_million: number | null;
  power_range: string;
  main_language: string;
  kvk_availability: string;
  saving_for_kvk: string;
  group_size: string;
  player_bio: string;
  looking_for: string[];
  is_anonymous: boolean;
  is_active: boolean;
  visible_to_recruiters: boolean;
  last_active_at: string | null;
}

export interface FundInfo {
  kingdom_number: number;
  balance: number;
  tier: string;
  is_recruiting: boolean;
  recruitment_pitch: string | null;
  what_we_offer: string | null;
  what_we_want: string | null;
  min_tc_level: number | null;
  min_power_range: string | null;
  min_power_million: number | null;
  main_language: string | null;
  secondary_languages: string[];
  event_times: Array<{ start: string; end: string }>;
  contact_link: string | null;
  recruitment_tags: string[];
  highlighted_stats: string[];
  kingdom_vibe: string[];
  nap_policy: boolean | null;
  sanctuary_distribution: boolean | null;
  castle_rotation: boolean | null;
  alliance_events: {
    alliances: string[];
    schedule: Record<string, string[][]>;
  } | null;
}

export interface TeamMember {
  id: string;
  user_id: string;
  role: 'editor' | 'co-editor';
  status: string;
  username?: string;
  linked_username?: string;
  last_active_at?: string | null;
  assigned_by?: string | null;
}

export interface IncomingApplication {
  id: string;
  transfer_profile_id: string;
  applicant_user_id: string;
  kingdom_number: number;
  status: 'pending' | 'viewed' | 'interested' | 'accepted' | 'declined' | 'withdrawn' | 'expired';
  applied_at: string;
  viewed_at: string | null;
  responded_at: string | null;
  expires_at: string;
  applicant_note: string | null;
  // Joined from transfer_profiles + profiles
  profile?: {
    user_id: string;
    username: string;
    current_kingdom: number;
    tc_level: number;
    power_million: number | null;
    power_range: string;
    main_language: string;
    kvk_availability: string;
    saving_for_kvk: string;
    group_size: string;
    player_bio: string;
    contact_method: string;
    contact_discord: string;
    contact_coordinates: string;
    contact_info: string;
    looking_for: string[];
    is_anonymous: boolean;
    linked_player_id?: string;
  };
}

// Helper function to format TC level for display
export const formatTCLevel = (tcLevel: number): string => {
  if (tcLevel <= 0) return '—';
  if (tcLevel <= 30) return `TC${tcLevel}`;
  if (tcLevel <= 34) return 'TC30';
  const tgLevel = Math.floor((tcLevel - 35) / 5) + 1;
  return `TG${tgLevel}`;
};

export const LANGUAGE_OPTIONS = [
  'English', 'Mandarin Chinese', 'Hindi', 'Spanish', 'French', 'Arabic', 'Bengali',
  'Portuguese', 'Russian', 'Japanese', 'German', 'Korean', 'Turkish', 'Vietnamese',
  'Italian', 'Thai', 'Polish', 'Indonesian', 'Dutch', 'Tagalog', 'Other',
];

export const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  backgroundColor: '#0a0a0a',
  border: '1px solid #2a2a2a',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '0.8rem',
  width: '100%',
  boxSizing: 'border-box',
};

// Status workflow constants for application cards
export const STATUS_ACTIONS: Record<string, { next: string[]; colors: Record<string, { bg: string; border: string; text: string }> }> = {
  pending: {
    next: ['viewed', 'interested', 'declined'],
    colors: {
      viewed: { bg: '#3b82f615', border: '#3b82f640', text: '#3b82f6' },
      interested: { bg: '#a855f715', border: '#a855f740', text: '#a855f7' },
      declined: { bg: '#ef444415', border: '#ef444440', text: '#ef4444' },
    },
  },
  viewed: {
    next: ['interested', 'accepted', 'declined'],
    colors: {
      interested: { bg: '#a855f715', border: '#a855f740', text: '#a855f7' },
      accepted: { bg: '#22c55e15', border: '#22c55e40', text: '#22c55e' },
      declined: { bg: '#ef444415', border: '#ef444440', text: '#ef4444' },
    },
  },
  interested: {
    next: ['accepted', 'declined'],
    colors: {
      accepted: { bg: '#22c55e15', border: '#22c55e40', text: '#22c55e' },
      declined: { bg: '#ef444415', border: '#ef444440', text: '#ef4444' },
    },
  },
  accepted: {
    next: ['declined'],
    colors: {
      declined: { bg: '#ef444415', border: '#ef444440', text: '#ef4444' },
    },
  },
};

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#eab308' },
  viewed: { label: 'Viewed', color: '#3b82f6' },
  interested: { label: 'Interested', color: '#a855f7' },
  accepted: { label: 'Accepted', color: '#22c55e' },
  declined: { label: 'Declined', color: '#ef4444' },
  withdrawn: { label: 'Withdrawn', color: '#9ca3af' },
  expired: { label: 'Expired', color: '#6b7280' },
};

