import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getAuthHeaders } from '../../services/authHeaders';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';
import { downloadCSV } from '../../utils/csvExport';
import {
  type Expense, type RevenueData, type ChurnAlert, type FinanceSection,
  SECTIONS, EXPENSE_CATEGORIES, getCategoryConfig, getNextRecurringDate,
  inputStyle, actionBtnStyle,
} from './FinanceTabHelpers';
import { RevenueSection } from './RevenueSection';
import { SubscribersSection } from './SubscribersSection';
import { PromoSection } from './PromoSection';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// ─── Component ───────────────────────────────────────────────────────────────

interface FinanceTabProps {
  syncingSubscriptions: boolean;
  onSyncSubscriptions: () => void;
  onGrantSubscription?: (email: string, tier: string, source: string, reason: string) => Promise<{ success: boolean; message: string }>;
}

export const FinanceTab: React.FC<FinanceTabProps> = ({
  syncingSubscriptions,
  onSyncSubscriptions,
  onGrantSubscription,
}) => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<FinanceSection['id']>('revenue');

  // Revenue state
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [churnAlerts, setChurnAlerts] = useState<ChurnAlert[]>([]);
  const [loadingRevenue, setLoadingRevenue] = useState(true);
  const [revenueError, setRevenueError] = useState<string | null>(null);

  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    category: 'hosting',
    vendor: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0] ?? '',
    is_recurring: false,
    recurring_interval: 'monthly' as string,
    receipt_url: '',
    notes: '',
  });
  const [savingExpense, setSavingExpense] = useState(false);

  // Subscribers state
  const [grantEmail, setGrantEmail] = useState('');
  const [grantSource, setGrantSource] = useState<'kofi' | 'manual' | 'stripe'>('kofi');
  const [grantReason, setGrantReason] = useState('');
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantResult, setGrantResult] = useState<{ success: boolean; message: string } | null>(null);

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchRevenue = useCallback(async () => {
    setLoadingRevenue(true);
    setRevenueError(null);
    try {
      const authHeaders = await getAuthHeaders({ requireAuth: false });

      // Fetch admin overview (includes revenue + subscribers)
      const res = await fetch(`${API_URL}/api/v1/admin/stats/overview`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setRevenue({
          mrr: data.revenue?.mrr || 0,
          total: data.revenue?.total || 0,
          activeSubscriptions: data.revenue?.active_subscriptions || 0,
          subscriptions: data.subscriptions || [],
          recentPayments: data.recent_payments || [],
          recentSubscribers: data.recent_subscribers || [],
          stripeBalance: { available: 0, pending: 0 },
        });
      } else {
        setRevenueError(`API returned ${res.status}: ${res.statusText}`);
      }

      // Fetch churn alerts
      const churnRes = await fetch(`${API_URL}/api/v1/admin/churn-alerts`, { headers: authHeaders });
      if (churnRes.ok) {
        const churnData = await churnRes.json();
        setChurnAlerts(churnData.cancellations || []);
      }
    } catch (err) {
      logger.error('Failed to fetch revenue data:', err);
      setRevenueError(err instanceof Error ? err.message : 'Network error — is the backend running?');
    } finally {
      setLoadingRevenue(false);
    }
  }, []);

  const fetchExpenses = useCallback(async () => {
    if (!supabase) return;
    setLoadingExpenses(true);
    try {
      const { data, error } = await supabase
        .from('atlas_expenses')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (err) {
      logger.error('Failed to fetch expenses:', err);
    } finally {
      setLoadingExpenses(false);
    }
  }, []);

  // Compute per-transaction Stripe fees from revenue payment data (virtual entries, not stored in DB)
  const stripeFeeEntries: Expense[] = useMemo(() => {
    if (!revenue?.recentPayments?.length) return [];
    return revenue.recentPayments.map((p, i) => {
      const fee = Math.round((p.amount * 0.029 + 0.30) * 100) / 100;
      return {
        id: `stripe-fee-${i}`,
        category: 'api',
        vendor: 'Stripe',
        description: `Processing fee on $${p.amount.toFixed(2)} payment${p.customer_email ? ` (${p.customer_email})` : ''}`,
        amount: fee,
        currency: 'USD',
        date: typeof p.date === 'string' ? p.date.split('T')[0] || '' : new Date(p.date).toISOString().split('T')[0] || '',
        is_recurring: false,
        recurring_interval: null,
        recurring_next_date: null,
        receipt_url: null,
        notes: '2.9% + $0.30 per transaction (auto-computed from Stripe payments)',
        created_at: '',
      };
    });
  }, [revenue]);

  // All expenses = DB expenses + auto-computed Stripe fees
  const allExpenses = useMemo(() => {
    return [...expenses, ...stripeFeeEntries].sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, stripeFeeEntries]);

  useEffect(() => {
    fetchRevenue();
    fetchExpenses();
  }, [fetchRevenue, fetchExpenses]);

  // ─── Expense CRUD ───────────────────────────────────────────────────────

  const resetExpenseForm = () => {
    setExpenseForm({
      category: 'hosting',
      vendor: '',
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0] ?? '',
      is_recurring: false,
      recurring_interval: 'monthly',
      receipt_url: '',
      notes: '',
    });
    setShowAddExpense(false);
    setEditingExpense(null);
  };

  const handleSaveExpense = async () => {
    if (!supabase || !user) return;
    if (!expenseForm.vendor.trim() || !expenseForm.amount) return;

    setSavingExpense(true);
    try {
      const payload = {
        category: expenseForm.category,
        vendor: expenseForm.vendor.trim(),
        description: expenseForm.description.trim(),
        amount: parseFloat(expenseForm.amount),
        date: expenseForm.date,
        is_recurring: expenseForm.is_recurring,
        recurring_interval: expenseForm.is_recurring ? expenseForm.recurring_interval : null,
        recurring_next_date: expenseForm.is_recurring ? getNextRecurringDate(expenseForm.date, expenseForm.recurring_interval) : null,
        receipt_url: expenseForm.receipt_url.trim() || null,
        notes: expenseForm.notes.trim() || null,
        created_by: user.id,
      };

      if (editingExpense) {
        const { error } = await supabase
          .from('atlas_expenses')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingExpense);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('atlas_expenses')
          .insert(payload);
        if (error) throw error;
      }

      resetExpenseForm();
      await fetchExpenses();
    } catch (err) {
      logger.error('Failed to save expense:', err);
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!supabase || !confirm('Delete this expense?')) return;
    try {
      const { error } = await supabase.from('atlas_expenses').delete().eq('id', id);
      if (error) throw error;
      await fetchExpenses();
    } catch (err) {
      logger.error('Failed to delete expense:', err);
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setExpenseForm({
      category: expense.category,
      vendor: expense.vendor,
      description: expense.description,
      amount: expense.amount.toString(),
      date: expense.date,
      is_recurring: expense.is_recurring,
      recurring_interval: expense.recurring_interval || 'monthly',
      receipt_url: expense.receipt_url || '',
      notes: expense.notes || '',
    });
    setEditingExpense(expense.id);
    setShowAddExpense(true);
  };

  // ─── Computed Values ────────────────────────────────────────────────────

  const monthlyExpenses = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // One-time expenses this month (includes auto-computed Stripe fees)
    const oneTimeThisMonth = allExpenses
      .filter(e => !e.is_recurring && e.date.startsWith(thisMonth))
      .reduce((sum, e) => sum + e.amount, 0);

    // Recurring expenses (monthly equivalent)
    const recurringMonthly = allExpenses
      .filter(e => e.is_recurring)
      .reduce((sum, e) => {
        if (e.recurring_interval === 'monthly') return sum + e.amount;
        if (e.recurring_interval === 'quarterly') return sum + e.amount / 3;
        if (e.recurring_interval === 'yearly') return sum + e.amount / 12;
        return sum + e.amount;
      }, 0);

    return oneTimeThisMonth + recurringMonthly;
  }, [allExpenses]);

  const totalExpensesAllTime = useMemo(() => {
    return allExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [allExpenses]);

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    allExpenses.forEach(e => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total, config: getCategoryConfig(category) }))
      .sort((a, b) => b.total - a.total);
  }, [allExpenses]);

  const netProfit = (revenue?.mrr || 0) - monthlyExpenses;

  // ─── Render Helpers ─────────────────────────────────────────────────────

  const renderSectionNav = () => (
    <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', backgroundColor: '#111116', padding: '0.25rem', borderRadius: '8px', width: 'fit-content' }}>
      {SECTIONS.map(section => (
        <button
          key={section.id}
          onClick={() => setActiveSection(section.id)}
          style={{
            padding: '0.5rem 0.85rem',
            backgroundColor: activeSection === section.id ? `${colors.primary}15` : 'transparent',
            border: 'none',
            borderRadius: '6px',
            color: activeSection === section.id ? colors.primary : colors.textMuted,
            fontSize: '0.8rem',
            fontWeight: activeSection === section.id ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            transition: 'all 0.15s',
          }}
        >
          <span>{section.icon}</span>
          {section.label}
        </button>
      ))}
    </div>
  );

  // ─── Expenses Section ───────────────────────────────────────────────────

  const renderExpenses = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Expense Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Monthly Expenses (est.)', value: `$${monthlyExpenses.toFixed(2)}`, color: colors.error, icon: '📤' },
          { label: 'Total Logged', value: `$${totalExpensesAllTime.toFixed(2)}`, color: colors.orange, icon: '📋' },
          { label: 'Recurring', value: expenses.filter(e => e.is_recurring).length.toString(), color: colors.purple, icon: '🔄' },
          { label: 'Categories Used', value: new Set(expenses.map(e => e.category)).size.toString(), color: colors.primary, icon: '📂' },
        ].map((metric, i) => (
          <div key={i} style={{ backgroundColor: colors.cardAlt, borderRadius: '10px', padding: '1rem', border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
              <span>{metric.icon}</span>
              <span style={{ color: colors.textMuted, fontSize: '0.75rem' }}>{metric.label}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: metric.color }}>{metric.value}</div>
          </div>
        ))}
      </div>

      {/* Category Breakdown */}
      {expensesByCategory.length > 0 && (
        <div style={{ backgroundColor: colors.cardAlt, borderRadius: '10px', padding: '1rem', border: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Expense Breakdown by Category
          </div>
          {expensesByCategory.map((item, i) => {
            const pct = totalExpensesAllTime > 0 ? (item.total / totalExpensesAllTime) * 100 : 0;
            return (
              <div key={i} style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <span style={{ color: colors.text, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span>{item.config.icon}</span> {item.config.label}
                  </span>
                  <span style={{ color: item.config.color, fontWeight: 600, fontSize: '0.8rem' }}>${item.total.toFixed(2)}</span>
                </div>
                <div style={{ height: '6px', backgroundColor: colors.surfaceHover, borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', backgroundColor: item.config.color, borderRadius: '3px', transition: 'width 0.3s' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Expense Button */}
      {!showAddExpense && (
        <button
          onClick={() => setShowAddExpense(true)}
          style={{
            padding: '0.6rem 1rem', backgroundColor: `${colors.success}15`, border: `1px solid ${colors.success}40`,
            borderRadius: '8px', color: colors.success, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
            width: 'fit-content', display: 'flex', alignItems: 'center', gap: '0.35rem',
          }}
        >
          + Add Expense
        </button>
      )}

      {/* Add/Edit Expense Form */}
      {showAddExpense && (
        <div style={{ backgroundColor: colors.cardAlt, borderRadius: '10px', padding: '1rem', border: `1px solid ${colors.success}30` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.9rem' }}>
              {editingExpense ? '✏️ Edit Expense' : '➕ New Expense'}
            </span>
            <button onClick={resetExpenseForm} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {/* Category */}
            <div>
              <label style={{ fontSize: '0.65rem', color: colors.textMuted, display: 'block', marginBottom: '0.2rem' }}>Category</label>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {EXPENSE_CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setExpenseForm(prev => ({ ...prev, category: cat.value }))}
                    style={{
                      padding: '0.3rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer',
                      backgroundColor: expenseForm.category === cat.value ? `${cat.color}20` : 'transparent',
                      border: `1px solid ${expenseForm.category === cat.value ? `${cat.color}50` : colors.border}`,
                      color: expenseForm.category === cat.value ? cat.color : colors.textMuted,
                      display: 'flex', alignItems: 'center', gap: '0.2rem',
                    }}
                  >
                    <span style={{ fontSize: '0.7rem' }}>{cat.icon}</span> {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vendor + Amount */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: '0.65rem', color: colors.textMuted, display: 'block', marginBottom: '0.2rem' }}>Vendor *</label>
                <input
                  value={expenseForm.vendor}
                  onChange={e => setExpenseForm(prev => ({ ...prev, vendor: e.target.value }))}
                  placeholder="e.g. Render, Cloudflare, Supabase"
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.65rem', color: colors.textMuted, display: 'block', marginBottom: '0.2rem' }}>Amount (USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={{ fontSize: '0.65rem', color: colors.textMuted, display: 'block', marginBottom: '0.2rem' }}>Description</label>
              <input
                value={expenseForm.description}
                onChange={e => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="What is this expense for?"
                style={inputStyle}
              />
            </div>

            {/* Date + Recurring */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.65rem', color: colors.textMuted, display: 'block', marginBottom: '0.2rem' }}>Date</label>
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={e => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.75rem', color: colors.textSecondary, padding: '0.5rem 0' }}>
                  <input
                    type="checkbox"
                    checked={expenseForm.is_recurring}
                    onChange={e => setExpenseForm(prev => ({ ...prev, is_recurring: e.target.checked }))}
                    style={{ accentColor: colors.purple }}
                  />
                  Recurring
                </label>
              </div>
              {expenseForm.is_recurring && (
                <div style={{ flex: 1 }}>
                  <select
                    value={expenseForm.recurring_interval}
                    onChange={e => setExpenseForm(prev => ({ ...prev, recurring_interval: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              )}
            </div>

            {/* Notes + Receipt URL */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.65rem', color: colors.textMuted, display: 'block', marginBottom: '0.2rem' }}>Notes</label>
                <input
                  value={expenseForm.notes}
                  onChange={e => setExpenseForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes"
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.65rem', color: colors.textMuted, display: 'block', marginBottom: '0.2rem' }}>Receipt URL</label>
                <input
                  value={expenseForm.receipt_url}
                  onChange={e => setExpenseForm(prev => ({ ...prev, receipt_url: e.target.value }))}
                  placeholder="https://..."
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Save */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleSaveExpense}
                disabled={savingExpense || !expenseForm.vendor.trim() || !expenseForm.amount}
                style={{
                  padding: '0.5rem 1rem', backgroundColor: `${colors.success}20`, color: colors.success,
                  border: `1px solid ${colors.success}50`, borderRadius: '6px', fontWeight: 600,
                  fontSize: '0.8rem', cursor: savingExpense ? 'not-allowed' : 'pointer',
                }}
              >
                {savingExpense ? '⏳ Saving...' : editingExpense ? '💾 Update' : '✅ Save Expense'}
              </button>
              <button onClick={resetExpenseForm} style={{ padding: '0.5rem 0.75rem', backgroundColor: 'transparent', color: colors.textMuted, border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense List */}
      <div style={{ backgroundColor: colors.cardAlt, borderRadius: '10px', padding: '1rem', border: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            All Expenses ({allExpenses.length})
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button onClick={fetchExpenses} style={{ background: 'none', border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.textMuted, padding: '0.15rem 0.4rem', cursor: 'pointer', fontSize: '0.65rem' }}>
              ↻ Refresh
            </button>
            {expenses.length > 0 && (
              <button
                onClick={() => downloadCSV(expenses.map(e => ({ date: e.date, vendor: e.vendor, category: e.category, amount: `$${e.amount.toFixed(2)}`, description: e.description, recurring: e.is_recurring ? `${e.recurring_interval}` : 'one-time' })), 'expenses')}
                style={{ background: 'none', border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.textMuted, padding: '0.15rem 0.4rem', cursor: 'pointer', fontSize: '0.65rem' }}
              >
                📥 CSV
              </button>
            )}
          </div>
        </div>

        {loadingExpenses ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.8rem' }}>Loading...</div>
        ) : allExpenses.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.8rem', border: `1px dashed ${colors.border}`, borderRadius: '8px' }}>
            No expenses logged yet. Click "+ Add Expense" to start tracking.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {allExpenses.map(expense => {
              const cat = getCategoryConfig(expense.category);
              const isVirtual = expense.id.startsWith('stripe-fee-');
              return (
                <div key={expense.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.5rem 0.6rem', backgroundColor: isVirtual ? `${colors.primary}05` : colors.bg,
                  border: `1px solid ${isVirtual ? `${colors.primary}15` : colors.surfaceHover}`, borderRadius: '8px',
                }}>
                  <span style={{ fontSize: '0.85rem', width: '24px', textAlign: 'center' }}>{cat.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.8rem' }}>{expense.vendor}</span>
                      {expense.is_recurring && (
                        <span style={{ padding: '0.05rem 0.3rem', borderRadius: '4px', fontSize: '0.55rem', fontWeight: 600, backgroundColor: `${colors.purple}15`, color: colors.purple, border: `1px solid ${colors.purple}30` }}>
                          {expense.recurring_interval}
                        </span>
                      )}
                      {isVirtual && (
                        <span style={{ padding: '0.05rem 0.3rem', borderRadius: '4px', fontSize: '0.55rem', fontWeight: 600, backgroundColor: `${colors.primary}15`, color: colors.primary, border: `1px solid ${colors.primary}30` }}>
                          auto
                        </span>
                      )}
                    </div>
                    {expense.description && (
                      <div style={{ color: colors.textMuted, fontSize: '0.65rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {expense.description}
                      </div>
                    )}
                  </div>
                  <span style={{ color: colors.error, fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    -${expense.amount.toFixed(2)}
                  </span>
                  <span style={{ color: colors.textMuted, fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                    {new Date(expense.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  {!isVirtual && (
                    <div style={{ display: 'flex', gap: '0.2rem' }}>
                      <button onClick={() => handleEditExpense(expense)} style={actionBtnStyle} title="Edit">✏️</button>
                      <button onClick={() => handleDeleteExpense(expense.id)} style={{ ...actionBtnStyle, color: colors.error }} title="Delete">🗑️</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ─── P&L Section ────────────────────────────────────────────────────────

  const renderPnL = () => {
    const mrr = revenue?.mrr || 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* P&L Summary */}
        <div style={{ backgroundColor: colors.cardAlt, borderRadius: '10px', padding: '1.25rem', border: `1px solid ${netProfit >= 0 ? colors.success : colors.error}30` }}>
          <div style={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: 600, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Monthly Profit & Loss Statement
          </div>

          {/* Income */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ color: colors.success, fontWeight: 600, fontSize: '0.85rem' }}>📈 Income</span>
              <span style={{ color: colors.success, fontWeight: 700, fontSize: '1.1rem' }}>${mrr.toFixed(2)}</span>
            </div>
            <div style={{ paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span style={{ color: colors.textSecondary }}>Stripe Subscriptions (MRR)</span>
                <span style={{ color: colors.text }}>${mrr.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: `1px solid ${colors.border}`, margin: '0.75rem 0' }} />

          {/* Expenses */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ color: colors.error, fontWeight: 600, fontSize: '0.85rem' }}>📉 Expenses</span>
              <span style={{ color: colors.error, fontWeight: 700, fontSize: '1.1rem' }}>-${monthlyExpenses.toFixed(2)}</span>
            </div>
            <div style={{ paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {expensesByCategory.length > 0 ? expensesByCategory.map((item, i) => {
                const now = new Date();
                const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const monthlyEq = allExpenses
                  .filter(e => e.category === item.category)
                  .reduce((sum, e) => {
                    if (!e.is_recurring) {
                      // Include one-time expenses from this month (e.g. Stripe fees)
                      return sum + (e.date.startsWith(thisMonth) ? e.amount : 0);
                    }
                    if (e.recurring_interval === 'monthly') return sum + e.amount;
                    if (e.recurring_interval === 'quarterly') return sum + e.amount / 3;
                    if (e.recurring_interval === 'yearly') return sum + e.amount / 12;
                    return sum + e.amount;
                  }, 0);
                if (monthlyEq === 0) return null;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      {item.config.icon} {item.config.label}
                    </span>
                    <span style={{ color: colors.text }}>-${monthlyEq.toFixed(2)}</span>
                  </div>
                );
              }) : (
                <div style={{ color: colors.textMuted, fontSize: '0.8rem', fontStyle: 'italic' }}>No recurring expenses logged</div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: `2px solid ${colors.border}`, margin: '0.75rem 0' }} />

          {/* Net Profit */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: colors.text, fontWeight: 700, fontSize: '1rem' }}>
              {netProfit >= 0 ? '✅' : '⚠️'} Net Monthly {netProfit >= 0 ? 'Profit' : 'Loss'}
            </span>
            <span style={{ color: netProfit >= 0 ? colors.success : colors.error, fontWeight: 700, fontSize: '1.3rem' }}>
              {netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)}
            </span>
          </div>

          {/* Margin */}
          {mrr > 0 && (
            <div style={{ textAlign: 'right', marginTop: '0.25rem' }}>
              <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>
                Margin: {((netProfit / mrr) * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Quick Insights */}
        <div style={{ backgroundColor: colors.cardAlt, borderRadius: '10px', padding: '1rem', border: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quick Insights
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
            <div style={{ color: colors.textSecondary }}>
              💡 Revenue per subscriber: <span style={{ color: colors.primary, fontWeight: 600 }}>${revenue?.activeSubscriptions ? (mrr / revenue.activeSubscriptions).toFixed(2) : '0.00'}</span>/mo
            </div>
            <div style={{ color: colors.textSecondary }}>
              💡 Break-even needs: <span style={{ color: colors.primary, fontWeight: 600 }}>{monthlyExpenses > 0 ? Math.ceil(monthlyExpenses / 4.99) : 0}</span> subscribers at $4.99/mo
            </div>
            {revenue?.activeSubscriptions && monthlyExpenses > 0 && (
              <div style={{ color: colors.textSecondary }}>
                💡 Runway: <span style={{ color: netProfit >= 0 ? colors.success : colors.error, fontWeight: 600 }}>
                  {netProfit >= 0 ? 'Profitable ✅' : `${Math.abs(netProfit).toFixed(2)}/mo shortfall`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };


  // ─── Main Render ────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {renderSectionNav()}
      {activeSection === 'revenue' && (
        <RevenueSection
          loading={loadingRevenue}
          error={revenueError}
          revenue={revenue}
          churnAlerts={churnAlerts}
          syncingSubscriptions={syncingSubscriptions}
          onSyncSubscriptions={onSyncSubscriptions}
          onRetry={fetchRevenue}
        />
      )}
      {activeSection === 'expenses' && renderExpenses()}
      {activeSection === 'pnl' && renderPnL()}
      {activeSection === 'subscribers' && (
        <SubscribersSection
          revenue={revenue}
          onGrantSubscription={onGrantSubscription}
          grantEmail={grantEmail}
          setGrantEmail={setGrantEmail}
          grantSource={grantSource}
          setGrantSource={setGrantSource}
          grantReason={grantReason}
          setGrantReason={setGrantReason}
          grantLoading={grantLoading}
          setGrantLoading={setGrantLoading}
          grantResult={grantResult}
          setGrantResult={setGrantResult}
        />
      )}
      {activeSection === 'promo' && <PromoSection />}
    </div>
  );
};

export default FinanceTab;
