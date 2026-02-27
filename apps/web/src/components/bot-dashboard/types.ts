export interface BotStatus {
  status: 'online' | 'offline' | 'error' | 'unconfigured';
  bot_name?: string;
  bot_id?: string;
  bot_avatar?: string;
  server_count: number;
  uptime_hours?: number;
  message?: string;
}

export interface Server {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  member_count: number;
  presence_count: number;
}

export interface Channel {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
}

export interface BotStats {
  status: string;
  server_count: number;
  commands_24h: number;
  commands_7d: number;
  top_commands: Array<{ name: string; count: number }>;
}

export interface PeriodStats {
  total: number;
  unique_users: number;
  commands: Array<{ name: string; count: number; unique_users: number }>;
  latency: { avg: number; p50: number; p95: number; max: number } | null;
}

export interface AnalyticsData {
  period_24h: PeriodStats;
  period_7d: PeriodStats;
  period_30d: PeriodStats;
  servers: Array<{ guild_id: string; commands: number }>;
  latency_by_command: Array<{ command: string; avg: number; p50: number; p95: number; count: number }>;
  time_series: Array<{ date: string; commands: number; unique_users: number }>;
}

export interface MultirallyStats {
  total_uses: number;
  unique_users: number;
  supporter_uses: number;
  free_uses: number;
  upsell_impressions: number;
  today: { uses: number; users: number };
  week: { uses: number; users: number };
  month: { uses: number; users: number };
  error?: string;
}

export interface MultirallyAnalytics {
  total_uses: number;
  avg_players: number;
  target_distribution: Array<{ target: string; count: number; pct: number }>;
  supporter_ratio: number;
  error?: string;
}

export interface MessageHistoryItem {
  id: string;
  channel: string;
  server: string;
  content: string;
  timestamp: string;
  hasEmbed: boolean;
}

export interface MessageTemplate {
  name: string;
  content: string;
  embedTitle: string;
  embedDescription: string;
  useEmbed: boolean;
}

export interface ScheduledMessage {
  id: string;
  channel: Channel;
  server: Server;
  content: string;
  embedTitle: string;
  embedDescription: string;
  useEmbed: boolean;
  scheduledFor: Date;
  timer: ReturnType<typeof setTimeout>;
}

export const COLORS = {
  primary: '#22d3ee',
  success: '#22c55e',
  warning: '#fbbf24',
  danger: '#ef4444',
  muted: '#6b7280',
  background: '#111116',
  border: '#2a2a2a'
};

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export async function botHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  try {
    const { getAuthHeaders } = await import('../../services/authHeaders');
    const auth = await getAuthHeaders({ requireAuth: false });
    return { ...auth, ...extra };
  } catch {
    return { ...extra };
  }
}

export { API_URL };
