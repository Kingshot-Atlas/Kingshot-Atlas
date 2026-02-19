import React from 'react';
import { colors } from '../../utils/styles';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FinanceSection {
  id: 'revenue' | 'expenses' | 'pnl' | 'subscribers' | 'promo';
  label: string;
  icon: string;
}

export interface Expense {
  id: string;
  category: string;
  vendor: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  is_recurring: boolean;
  recurring_interval: string | null;
  recurring_next_date: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface RevenueData {
  mrr: number;
  total: number;
  activeSubscriptions: number;
  subscriptions: { tier: string; count: number }[];
  recentPayments: { amount: number; currency: string; date: string; customer_email?: string }[];
  recentSubscribers: { username: string; tier: string; created_at: string }[];
  stripeBalance: { available: number; pending: number };
}

export interface ChurnAlert {
  event_id: string;
  customer_id: string;
  canceled_at: string;
  reason: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const SECTIONS: FinanceSection[] = [
  { id: 'revenue', label: 'Revenue', icon: '💰' },
  { id: 'expenses', label: 'Expenses', icon: '📤' },
  { id: 'pnl', label: 'P&L', icon: '📊' },
  { id: 'subscribers', label: 'Subscribers', icon: '👥' },
  { id: 'promo', label: 'Promo', icon: '🎯' },
];

export const EXPENSE_CATEGORIES: { value: string; label: string; icon: string; color: string }[] = [
  { value: 'hosting', label: 'Hosting', icon: '🖥️', color: '#3b82f6' },
  { value: 'domain', label: 'Domain', icon: '🌐', color: '#8b5cf6' },
  { value: 'database', label: 'Database', icon: '🗄️', color: '#22c55e' },
  { value: 'marketing', label: 'Marketing', icon: '📢', color: '#f97316' },
  { value: 'tools', label: 'Tools & SaaS', icon: '🔧', color: '#eab308' },
  { value: 'api', label: 'API Services', icon: '🔌', color: '#06b6d4' },
  { value: 'design', label: 'Design', icon: '🎨', color: '#ec4899' },
  { value: 'other', label: 'Other', icon: '📦', color: '#6b7280' },
];

export const getCategoryConfig = (cat: string) =>
  EXPENSE_CATEGORIES.find(c => c.value === cat) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]!;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getNextRecurringDate(dateStr: string, interval: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (interval === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (interval === 'quarterly') d.setMonth(d.getMonth() + 3);
  else if (interval === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0] ?? dateStr;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.65rem',
  backgroundColor: colors.bg,
  border: `1px solid ${colors.border}`,
  borderRadius: '6px',
  color: colors.text,
  fontSize: '0.8rem',
  outline: 'none',
  boxSizing: 'border-box',
};

export const actionBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.7rem',
  padding: '0.2rem',
  opacity: 0.7,
};
