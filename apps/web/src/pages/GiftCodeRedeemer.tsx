import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { neonGlow, FONT_DISPLAY, colors } from '../utils/styles';
import { useTranslation } from 'react-i18next';
import { getAuthHeaders } from '../services/authHeaders';
import { usePremium } from '../contexts/PremiumContext';
import { supabase } from '../lib/supabase';
import { analyticsService } from '../services/analyticsService';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const CODES_CACHE_KEY = 'atlas_gift_codes_cache';
const CODES_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const ALT_ACCOUNTS_KEY = 'atlas_alt_accounts';
const BULK_RESULTS_KEY = 'atlas_bulk_results';
const MAX_ALT_ACCOUNTS = 10;

interface AltAccount {
  player_id: string;
  label: string;
  hasError?: boolean;
  lastRedeemed?: string; // ISO timestamp of last successful redemption
}

interface BulkCodeResult {
  code: string;
  success: boolean;
  message: string;
  err_code?: number;
}

interface BulkAccountResult {
  playerId: string;
  label: string;
  success: number;
  failed: number;
  errors: string[];
  codeResults: BulkCodeResult[];
}

interface GiftCode {
  code: string;
  expire_date?: string;
  is_expired?: boolean;
}

interface RedeemResult {
  code: string;
  success: boolean;
  message: string;
  loading?: boolean;
  err_code?: number;
}

type RedeemOutcome = 'success' | 'expired' | 'already_redeemed' | 'invalid' | 'rate_limited' | 'not_login' | 'retryable';
type BulkCodeOutcome = 'success' | 'expired' | 'already_redeemed' | 'invalid' | 'rate_limited' | 'not_login' | 'error';

function getBulkCodeOutcome(cr: BulkCodeResult): BulkCodeOutcome {
  if (cr.success) return 'success';
  if (cr.err_code === 40007) return 'expired';
  if (cr.err_code === 40005 || cr.err_code === 40008 || cr.err_code === 40011) return 'already_redeemed';
  if (cr.err_code === 40014) return 'invalid';
  if (cr.err_code === 40101) return 'rate_limited';
  if (cr.message?.toLowerCase().includes('rate limit')) return 'rate_limited';
  if (cr.message?.toLowerCase().includes('not login')) return 'not_login';
  return 'error';
}

function isBulkRetryable(cr: BulkCodeResult): boolean {
  const outcome = getBulkCodeOutcome(cr);
  return outcome === 'rate_limited' || outcome === 'not_login' || outcome === 'error';
}

function getOutcome(result: RedeemResult | undefined): RedeemOutcome | null {
  if (!result || result.loading) return null;
  if (result.success) return 'success';
  const code = result.err_code;
  if (code === 40007) return 'expired';
  if (code === 40005 || code === 40008 || code === 40011) return 'already_redeemed';
  if (code === 40014) return 'invalid';
  if (code === 40101) return 'rate_limited';
  // Fallback: check message text for backwards compat
  if (result.message?.toLowerCase().includes('expired')) return 'expired';
  if (result.message?.toLowerCase().includes('already')) return 'already_redeemed';
  if (result.message?.toLowerCase().includes('not login') || result.message?.toLowerCase().includes('hasn\'t logged in')) return 'not_login';
  return 'retryable';
}

function isNonRetryable(outcome: RedeemOutcome | null): boolean {
  return outcome === 'success' || outcome === 'expired' || outcome === 'already_redeemed';
}

const GiftCodeRedeemer: React.FC = () => {
  const { t } = useTranslation();
  useMetaTags(PAGE_META_TAGS.giftCodes);
  const isMobile = useIsMobile();
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [codes, setCodes] = useState<GiftCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [codesSource, setCodesSource] = useState<string>('');
  const [results, setResults] = useState<Map<string, RedeemResult>>(new Map());
  const [redeemingAll, setRedeemingAll] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);
  const [globalCooldown, setGlobalCooldown] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { isSupporter } = usePremium();

  // Alt accounts (cloud-synced to Supabase, localStorage as cache)
  const [altAccounts, setAltAccounts] = useState<AltAccount[]>(() => {
    try {
      const stored = localStorage.getItem(ALT_ACCOUNTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [showAltPanel, setShowAltPanel] = useState(false);
  const [newAltId, setNewAltId] = useState('');
  const [newAltLabel, setNewAltLabel] = useState('');
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null); // null = main account
  const [customPlayerId, setCustomPlayerId] = useState('');
  const [showSupporterPrompt, setShowSupporterPrompt] = useState(false);
  const [redeemingAllAccounts, setRedeemingAllAccounts] = useState(false);
  const [bulkRedeemProgress, setBulkRedeemProgress] = useState<{ current: number; total: number; currentAccount: string } | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkAccountResult[]>(() => {
    try {
      const stored = sessionStorage.getItem(BULK_RESULTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [showBulkResults, setShowBulkResults] = useState(() => {
    try { return !!sessionStorage.getItem(BULK_RESULTS_KEY); } catch { return false; }
  });
  const [expandedBulkAccounts, setExpandedBulkAccounts] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem(BULK_RESULTS_KEY);
      if (!stored) return new Set<string>();
      const results: BulkAccountResult[] = JSON.parse(stored);
      return new Set(results.filter(r => r.failed > 0).map(r => r.playerId));
    } catch { return new Set<string>(); }
  });
  const [retryingAccounts, setRetryingAccounts] = useState<Set<string>>(new Set());
  const [redeemingCodeForAlts, setRedeemingCodeForAlts] = useState<Set<string>>(new Set());
  const [altsSyncedFromCloud, setAltsSyncedFromCloud] = useState(false);

  const freeAltLimit = 1;
  const altLimit = isSupporter ? MAX_ALT_ACCOUNTS : freeAltLimit;

  // Load alt accounts from Supabase on mount (cloud is source of truth)
  useEffect(() => {
    if (!user || !supabase) return;
    const loadFromCloud = async () => {
      try {
        const { data, error } = await supabase!
          .from('profiles')
          .select('alt_accounts')
          .eq('id', user.id)
          .single();
        if (error || !data) return;
        const cloudAlts: AltAccount[] = data.alt_accounts || [];
        if (cloudAlts.length > 0) {
          // Cloud wins — merge lastRedeemed from localStorage if cloud entry is missing it
          const localAlts: AltAccount[] = (() => { try { return JSON.parse(localStorage.getItem(ALT_ACCOUNTS_KEY) || '[]'); } catch { return []; } })();
          const merged = cloudAlts.map(ca => {
            const local = localAlts.find(la => la.player_id === ca.player_id);
            return { ...ca, lastRedeemed: ca.lastRedeemed || local?.lastRedeemed };
          });
          setAltAccounts(merged);
        } else {
          // Cloud is empty — push localStorage alts to cloud (one-time migration)
          const localAlts: AltAccount[] = (() => { try { return JSON.parse(localStorage.getItem(ALT_ACCOUNTS_KEY) || '[]'); } catch { return []; } })();
          if (localAlts.length > 0) {
            await supabase!.from('profiles').update({ alt_accounts: localAlts }).eq('id', user.id);
          }
        }
        setAltsSyncedFromCloud(true);
      } catch { /* silent */ }
    };
    loadFromCloud();
  }, [user]);

  // Persist alt accounts to localStorage + Supabase
  useEffect(() => {
    try { localStorage.setItem(ALT_ACCOUNTS_KEY, JSON.stringify(altAccounts)); } catch { /* quota */ }
    // Sync to Supabase (debounced by React batching)
    if (user && supabase && altsSyncedFromCloud) {
      const clean = altAccounts.map(({ player_id, label, lastRedeemed }) => ({ player_id, label, lastRedeemed }));
      supabase!.from('profiles').update({ alt_accounts: clean }).eq('id', user.id).then(() => {});
    }
  }, [altAccounts, user, altsSyncedFromCloud]);

  const mainPlayerId = profile?.linked_player_id;
  const mainPlayerName = profile?.linked_username || profile?.username;

  // Active player ID: custom entry, alt account, or main
  const playerId = customPlayerId.trim() || activePlayerId || mainPlayerId;
  const playerName = activePlayerId
    ? altAccounts.find(a => a.player_id === activePlayerId)?.label || `Alt ${activePlayerId}`
    : customPlayerId.trim()
      ? `Custom (${customPlayerId.trim()})`
      : mainPlayerName;
  const isUsingMainAccount = !customPlayerId.trim() && !activePlayerId;

  // Fetch active codes (forceRefresh bypasses cache)
  const fetchCodes = useCallback(async (forceRefresh = false) => {
    // Check cache first (skip if forcing refresh)
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(CODES_CACHE_KEY);
        if (cached) {
          const { codes: cachedCodes, timestamp, source } = JSON.parse(cached);
          if (Date.now() - timestamp < CODES_CACHE_TTL && cachedCodes?.length > 0) {
            setCodes(cachedCodes);
            setCodesSource(source);
            setLoadingCodes(false);
            return;
          }
        }
      } catch { /* ignore cache errors */ }
    }

    setLoadingCodes(true);
    try {
      // Try backend proxy first, fall back to direct kingshot.net fetch
      let rawCodes: any[] = [];
      let source = 'unknown';

      try {
        const response = await fetch(`${API_BASE}/api/v1/player-link/gift-codes`);
        if (response.ok) {
          const data = await response.json();
          rawCodes = data.codes || [];
          source = data.source || 'backend';
        }
      } catch { /* backend unavailable */ }

      // Fallback: fetch directly from kingshot.net if backend failed
      if (rawCodes.length === 0) {
        try {
          const directRes = await fetch('https://kingshot.net/api/gift-codes');
          if (directRes.ok) {
            const directData = await directRes.json();
            const giftCodes = directData?.data?.giftCodes || directData?.codes || [];
            rawCodes = giftCodes;
            source = 'kingshot.net (direct)';
          }
        } catch { /* direct fetch also failed */ }
      }

      if (rawCodes.length === 0) {
        showToast(t('giftCodes.noCodesUnavailable', 'Could not fetch gift codes right now. Try again later.'), 'error');
      }

      const fetchedCodes: GiftCode[] = rawCodes
        .filter((c: any) => !c.is_expired)
        .map((c: any) => ({
          code: c.code || c.title || '',
          expire_date: c.expire_date || c.expiresAt,
        }))
        .filter((c: GiftCode) => c.code);
      setCodes(fetchedCodes);
      setCodesSource(source);
      if (fetchedCodes.length > 0) {
        localStorage.setItem(CODES_CACHE_KEY, JSON.stringify({
          codes: fetchedCodes,
          timestamp: Date.now(),
          source,
        }));
      }
      if (forceRefresh && fetchedCodes.length > 0) {
        showToast(t('giftCodes.refreshed', `Found ${fetchedCodes.length} active codes`), 'success');
      }
    } catch {
      showToast(t('giftCodes.noCodesUnavailable', 'Could not fetch gift codes right now. Try again later.'), 'error');
    } finally {
      setLoadingCodes(false);
    }
  }, [showToast, t]);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  // Cleanup cooldown timer on unmount
  useEffect(() => {
    return () => { if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current); };
  }, []);

  // Start a cooldown countdown
  const startCooldown = useCallback((seconds: number) => {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    setGlobalCooldown(true);
    setCooldownSeconds(seconds);
    cooldownTimerRef.current = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          setGlobalCooldown(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Format expiration countdown
  const getExpirationCountdown = (expireDate?: string): string | null => {
    if (!expireDate) return null;
    const expiry = new Date(expireDate).getTime();
    const now = Date.now();
    const diff = expiry - now;
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 7) return null; // Only show countdown for codes expiring within 7 days
    if (days > 0) return `${days}d ${hours}h left`;
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m left`;
  };

  // Redeem a single code
  const redeemCode = useCallback(async (code: string) => {
    if (!playerId || globalCooldown) return;

    setResults(prev => {
      const next = new Map(prev);
      next.set(code, { code, success: false, message: 'Redeeming...', loading: true });
      return next;
    });

    try {
      const headers = await getAuthHeaders({ requireAuth: false });
      const response = await fetch(`${API_BASE}/api/v1/player-link/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ player_id: playerId, code }),
      });

      if (response.status === 429) {
        startCooldown(30);
        setResults(prev => {
          const next = new Map(prev);
          next.set(code, { code, success: false, message: 'Rate limited. Cooldown active.' });
          return next;
        });
        return;
      }

      const data = await response.json();
      const result: RedeemResult = {
        code,
        success: data.success,
        message: data.message || (data.detail?.error) || 'Unknown error',
        err_code: data.err_code,
      };
      setResults(prev => {
        const next = new Map(prev);
        next.set(code, result);
        return next;
      });

      const outcome = getOutcome(result);
      if (outcome === 'success') {
        showToast(`${code} redeemed!`, 'success');
      } else if (outcome === 'already_redeemed') {
        showToast(`${code} — already redeemed`, 'info');
      }
    } catch {
      setResults(prev => {
        const next = new Map(prev);
        next.set(code, { code, success: false, message: 'Network error. Try again.' });
        return next;
      });
    }
  }, [playerId, globalCooldown, showToast, startCooldown]);

  // Redeem all codes sequentially with delay
  const redeemAll = useCallback(async () => {
    if (!playerId || redeemingAll) return;
    setRedeemingAll(true);

    const unredeemed = codes.filter(c => {
      const result = results.get(c.code);
      if (!result) return true; // never attempted
      if (result.loading) return false; // in progress
      const outcome = getOutcome(result);
      return !isNonRetryable(outcome); // skip success, expired, already redeemed
    });

    for (const code of unredeemed) {
      if (globalCooldown) break;
      await redeemCode(code.code);
      // 2s delay between redemptions to avoid rate limits
      await new Promise(r => setTimeout(r, 2000));
    }

    setRedeemingAll(false);
  }, [playerId, codes, results, redeemingAll, globalCooldown, redeemCode]);

  // Redeem manual code
  const redeemManual = useCallback(async () => {
    const trimmed = manualCode.trim();
    if (!trimmed || !playerId) return;
    await redeemCode(trimmed);
    setManualCode('');
  }, [manualCode, playerId, redeemCode]);

  const allRedeemed = codes.length > 0 && codes.every(c => results.get(c.code)?.success);
  const redeemedCount = codes.filter(c => results.get(c.code)?.success).length;

  // Alt account management
  const addAltAccount = useCallback(() => {
    const id = newAltId.trim();
    if (!id || !/^\d{6,20}$/.test(id)) {
      showToast('Player ID must be 6-20 digits', 'error');
      return;
    }
    if (id === mainPlayerId) {
      showToast('That\'s your main account', 'error');
      return;
    }
    if (altAccounts.some(a => a.player_id === id)) {
      showToast('Account already added', 'error');
      return;
    }
    if (altAccounts.length >= altLimit) {
      if (!isSupporter) {
        showToast(`Free users get ${freeAltLimit} alt slot. Become a Supporter for up to ${MAX_ALT_ACCOUNTS}!`, 'info');
      } else {
        showToast(`Maximum ${MAX_ALT_ACCOUNTS} alt accounts`, 'error');
      }
      return;
    }
    setAltAccounts(prev => [...prev, { player_id: id, label: newAltLabel.trim() || `Alt ${prev.length + 1}` }]);
    setNewAltId('');
    setNewAltLabel('');
    showToast('Alt account added', 'success');
  }, [newAltId, newAltLabel, mainPlayerId, altAccounts, altLimit, isSupporter, showToast]);

  const removeAltAccount = useCallback((id: string) => {
    setAltAccounts(prev => prev.filter(a => a.player_id !== id));
    if (activePlayerId === id) setActivePlayerId(null);
  }, [activePlayerId]);

  const moveAltAccount = useCallback((index: number, direction: 'up' | 'down') => {
    setAltAccounts(prev => {
      const next = [...prev];
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= next.length) return prev;
      [next[index], next[targetIdx]] = [next[targetIdx]!, next[index]!];
      return next;
    });
  }, []);

  // Redeem a code for a specific player ID
  const redeemCodeForPlayer = useCallback(async (code: string, targetPlayerId: string): Promise<RedeemResult> => {
    try {
      const headers = await getAuthHeaders({ requireAuth: false });
      const response = await fetch(`${API_BASE}/api/v1/player-link/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ player_id: targetPlayerId, code }),
      });

      if (response.status === 429) {
        startCooldown(30);
        return { code, success: false, message: 'Rate limited. Cooldown active.' };
      }

      const data = await response.json();
      return {
        code,
        success: data.success,
        message: data.message || (data.detail?.error) || 'Unknown error',
        err_code: data.err_code,
      };
    } catch {
      return { code, success: false, message: 'Network error. Try again.' };
    }
  }, [startCooldown]);

  // Redeem a single code for all accounts (main + alts) — Supporter only
  const redeemCodeForAllAlts = useCallback(async (code: string) => {
    if (!isSupporter) {
      setShowSupporterPrompt(true);
      return;
    }
    if (!mainPlayerId || redeemingCodeForAlts.has(code)) return;

    setRedeemingCodeForAlts(prev => new Set(prev).add(code));

    const allPlayerIds = [mainPlayerId, ...altAccounts.map(a => a.player_id)];
    let successCount = 0;
    let failCount = 0;
    let rateLimited = false;

    for (let i = 0; i < allPlayerIds.length; i++) {
      if (rateLimited) break;
      const pid = allPlayerIds[i]!;
      const result = await redeemCodeForPlayer(code, pid);

      if (result.success) {
        successCount++;
      } else {
        failCount++;
        if (result.message?.toLowerCase().includes('rate limit')) {
          rateLimited = true;
        }
      }

      // Update main results map for the currently active player
      if (pid === playerId) {
        setResults(prev => {
          const next = new Map(prev);
          next.set(code, result);
          return next;
        });
      }

      // Update alt account status
      if (!result.success && result.err_code && ![40005, 40007, 40008, 40011].includes(result.err_code)) {
        setAltAccounts(prev => prev.map(a => a.player_id === pid ? { ...a, hasError: true } : a));
      } else if (result.success) {
        setAltAccounts(prev => prev.map(a => a.player_id === pid ? { ...a, hasError: false, lastRedeemed: new Date().toISOString() } : a));
      }

      if (!rateLimited && i < allPlayerIds.length - 1) await new Promise(r => setTimeout(r, 1500));
    }

    setRedeemingCodeForAlts(prev => {
      const next = new Set(prev);
      next.delete(code);
      return next;
    });

    if (rateLimited) {
      startCooldown(30);
      showToast(`Rate limited after ${successCount}/${successCount + failCount} accounts. Retry in 30s.`, 'error');
    } else {
      startCooldown(5);
      showToast(`${code}: Redeemed for ${successCount}/${allPlayerIds.length} accounts`, successCount > 0 ? 'success' : 'error');
    }
  }, [isSupporter, mainPlayerId, altAccounts, redeemCodeForPlayer, playerId, redeemingCodeForAlts, showToast, startCooldown]);

  // Bulk redeem all codes for all accounts (main + alts) — Supporter only
  const redeemAllForAllAccounts = useCallback(async () => {
    if (!isSupporter) {
      setShowSupporterPrompt(true);
      return;
    }
    if (!mainPlayerId || redeemingAllAccounts) return;
    setRedeemingAllAccounts(true);
    setExpandedBulkAccounts(new Set());

    const allPlayerIds = [mainPlayerId, ...altAccounts.map(a => a.player_id)];
    let totalSuccess = 0;
    let totalAttempts = 0;
    const accountResults: BulkAccountResult[] = [];

    const unredeemed = codes.filter(c => {
      const result = results.get(c.code);
      if (!result) return true;
      if (result.loading) return false;
      const outcome = getOutcome(result);
      return !isNonRetryable(outcome);
    });

    if (unredeemed.length === 0) {
      setRedeemingAllAccounts(false);
      showToast('No unredeemed codes to process', 'info');
      return;
    }

    const totalOps = allPlayerIds.length * unredeemed.length;
    let rateLimited = false; // local flag — React state is stale inside async loops

    for (let pidIdx = 0; pidIdx < allPlayerIds.length; pidIdx++) {
      if (rateLimited) break;
      const pid = allPlayerIds[pidIdx]!;
      const accountLabel = pid === mainPlayerId ? 'Main' : (altAccounts.find(a => a.player_id === pid)?.label || `Alt ${pid}`);
      const acctResult: BulkAccountResult = { playerId: pid, label: accountLabel, success: 0, failed: 0, errors: [], codeResults: [] };

      for (const code of unredeemed) {
        if (rateLimited) break;
        totalAttempts++;
        setBulkRedeemProgress({ current: totalAttempts, total: totalOps, currentAccount: accountLabel });
        const result = await redeemCodeForPlayer(code.code, pid);
        acctResult.codeResults.push({ code: code.code, success: result.success, message: result.message, err_code: result.err_code });
        if (result.success) {
          totalSuccess++;
          acctResult.success++;
        } else {
          acctResult.failed++;
          const errMsg = result.message || 'Unknown';
          if (!acctResult.errors.includes(errMsg)) acctResult.errors.push(errMsg);
          // Detect rate limiting via message (since err_code may not be set for 429s)
          if (result.message?.toLowerCase().includes('rate limit')) {
            rateLimited = true;
          }
        }
        // Update main results map for the currently active player
        if (pid === playerId) {
          setResults(prev => {
            const next = new Map(prev);
            next.set(code.code, result);
            return next;
          });
        }
        // Mark alt account errors (skip known non-error codes)
        if (!result.success && result.err_code && ![40005, 40007, 40008, 40011].includes(result.err_code)) {
          setAltAccounts(prev => prev.map(a => a.player_id === pid ? { ...a, hasError: true } : a));
        } else if (result.success) {
          setAltAccounts(prev => prev.map(a => a.player_id === pid ? { ...a, hasError: false, lastRedeemed: new Date().toISOString() } : a));
        }
        if (!rateLimited) await new Promise(r => setTimeout(r, 1500));
      }
      accountResults.push(acctResult);
      // Extra delay between accounts to avoid rate limiting
      if (pidIdx < allPlayerIds.length - 1 && !rateLimited) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    setRedeemingAllAccounts(false);
    setBulkRedeemProgress(null);
    setBulkResults(accountResults);
    setShowBulkResults(true);
    // Auto-expand accounts that had failures
    setExpandedBulkAccounts(new Set(accountResults.filter(r => r.failed > 0).map(r => r.playerId)));
    if (rateLimited) {
      startCooldown(30);
      showToast(`Rate limited after ${totalSuccess}/${totalAttempts} codes. Retry in 30s.`, 'error');
    } else {
      startCooldown(10);
      showToast(`Redeemed ${totalSuccess}/${totalAttempts} codes across ${allPlayerIds.length} accounts`, totalSuccess > 0 ? 'success' : 'error');
    }
  }, [isSupporter, mainPlayerId, altAccounts, codes, results, redeemCodeForPlayer, playerId, redeemingAllAccounts, showToast, startCooldown]);

  // Persist bulkResults to sessionStorage
  useEffect(() => {
    if (bulkResults.length > 0) {
      try { sessionStorage.setItem(BULK_RESULTS_KEY, JSON.stringify(bulkResults)); } catch {}
    } else {
      try { sessionStorage.removeItem(BULK_RESULTS_KEY); } catch {}
    }
  }, [bulkResults]);

  // Clear sessionStorage when user dismisses results
  const dismissBulkResults = useCallback(() => {
    setShowBulkResults(false);
    setBulkResults([]);
    try { sessionStorage.removeItem(BULK_RESULTS_KEY); } catch {}
  }, []);

  // Retry failed codes for a single account
  const retryFailedForAccount = useCallback(async (targetPlayerId: string) => {
    if (globalCooldown || retryingAccounts.has(targetPlayerId)) return;
    const acctIdx = bulkResults.findIndex(r => r.playerId === targetPlayerId);
    if (acctIdx === -1) return;
    const acct = bulkResults[acctIdx]!;
    const retryable = acct.codeResults.filter(isBulkRetryable);
    if (retryable.length === 0) return;

    setRetryingAccounts(prev => new Set(prev).add(targetPlayerId));
    let rateLimited = false;

    for (const cr of retryable) {
      if (rateLimited) break;
      const result = await redeemCodeForPlayer(cr.code, targetPlayerId);
      // Update codeResults in place
      setBulkResults(prev => prev.map(r => {
        if (r.playerId !== targetPlayerId) return r;
        const newCodes = r.codeResults.map(c =>
          c.code === cr.code ? { code: cr.code, success: result.success, message: result.message, err_code: result.err_code } : c
        );
        const success = newCodes.filter(c => c.success).length;
        const failed = newCodes.filter(c => !c.success).length;
        const errors = [...new Set(newCodes.filter(c => !c.success).map(c => c.message))];
        return { ...r, codeResults: newCodes, success, failed, errors };
      }));
      if (result.message?.toLowerCase().includes('rate limit')) {
        rateLimited = true;
      }
      if (!rateLimited) await new Promise(resolve => setTimeout(resolve, 1500));
    }

    setRetryingAccounts(prev => { const n = new Set(prev); n.delete(targetPlayerId); return n; });
    if (rateLimited) {
      startCooldown(30);
      showToast('Rate limited during retry. Try again in 30s.', 'error');
    }
  }, [bulkResults, globalCooldown, retryingAccounts, redeemCodeForPlayer, startCooldown, showToast]);

  // Retry all failed codes across all accounts
  const retryAllFailed = useCallback(async () => {
    if (globalCooldown || retryingAccounts.size > 0) return;
    const accountsWithRetryable = bulkResults.filter(r => r.codeResults.some(isBulkRetryable));
    if (accountsWithRetryable.length === 0) return;

    for (let i = 0; i < accountsWithRetryable.length; i++) {
      if (globalCooldown) break;
      await retryFailedForAccount(accountsWithRetryable[i]!.playerId);
      if (i < accountsWithRetryable.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }, [bulkResults, globalCooldown, retryingAccounts, retryFailedForAccount]);

  // Not logged in
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎁</div>
          <h2 style={{ color: colors.text, fontSize: '1.5rem', fontFamily: FONT_DISPLAY, marginBottom: '0.75rem' }}>{t('giftCodes.signInTitle', 'Gift Code Redeemer')}</h2>
          <p style={{ color: colors.textSecondary, fontSize: '0.9rem', marginBottom: '1.5rem' }}>{t('giftCodes.signInDesc', 'Sign in and link your Kingshot account to redeem gift codes with one click.')}</p>
          <Link to="/profile" style={{ display: 'inline-block', padding: '0.6rem 1.5rem', backgroundColor: `${colors.amber}20`, border: `1px solid ${colors.amber}50`, borderRadius: '8px', color: colors.amber, textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem' }}>
            {t('giftCodes.signIn', 'Sign In')}
          </Link>
        </div>
      </div>
    );
  }

  // No linked player ID — but allow custom entry
  if (!mainPlayerId && !customPlayerId.trim()) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '420px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
          <h2 style={{ color: colors.text, fontSize: '1.5rem', fontFamily: FONT_DISPLAY, marginBottom: '0.75rem' }}>{t('giftCodes.linkTitle', 'Link Your Account First')}</h2>
          <p style={{ color: colors.textSecondary, fontSize: '0.9rem', marginBottom: '1rem' }}>{t('giftCodes.linkDesc', 'To redeem codes, we need your Player ID. Link your Kingshot account in your profile settings.')}</p>
          <Link to="/profile" style={{ display: 'inline-block', padding: '0.6rem 1.5rem', backgroundColor: `${colors.amber}20`, border: `1px solid ${colors.amber}50`, borderRadius: '8px', color: colors.amber, textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            {t('giftCodes.goToProfile', 'Go to Profile')}
          </Link>
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid #2a2a2a', paddingTop: '1.25rem' }}>
            <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '0.75rem' }}>Or enter a Player ID directly:</p>
            <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '320px', margin: '0 auto' }}>
              <input
                type="text"
                value={customPlayerId}
                onChange={e => setCustomPlayerId(e.target.value.replace(/\D/g, ''))}
                placeholder="Player ID (digits)"
                style={{
                  flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px',
                  border: '1px solid #333', backgroundColor: colors.bg,
                  color: '#e5e7eb', fontSize: '0.9rem', fontFamily: 'monospace', outline: 'none',
                }}
              />
              <button
                onClick={() => { if (/^\d{6,20}$/.test(customPlayerId.trim())) { /* will re-render with playerId set */ } else showToast('Enter a valid Player ID (6-20 digits)', 'error'); }}
                disabled={!customPlayerId.trim()}
                style={{
                  padding: '0.5rem 1rem', borderRadius: '8px', border: `1px solid ${colors.amber}40`,
                  backgroundColor: `${colors.amber}15`, color: colors.amber, fontWeight: '600', fontSize: '0.8rem',
                  cursor: customPlayerId.trim() ? 'pointer' : 'default', opacity: customPlayerId.trim() ? 1 : 0.5,
                }}
              >
                Use ID
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg }}>
      {/* Hero */}
      <div style={{
        padding: isMobile ? '1.5rem 1rem 1rem' : '2rem 2rem 1.25rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #1a1400 0%, #0a0a0a 100%)',
        position: 'relative',
      }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h1 style={{
            fontSize: isMobile ? '1.5rem' : '2rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            fontFamily: FONT_DISPLAY,
            letterSpacing: '0.05em',
          }}>
            <span style={{ color: colors.text }}>GIFT CODE</span>
            <span style={{ ...neonGlow(colors.amber), marginLeft: '0.5rem' }}>REDEEMER</span>
          </h1>
          <p style={{ color: colors.textSecondary, fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.75rem' }}>
            {t('giftCodes.heroSubtitle', 'One click. Instant rewards. No copy-pasting.')}
          </p>

          {/* Active player info pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.4rem 0.75rem', borderRadius: '20px',
            backgroundColor: isUsingMainAccount ? `${colors.amber}12` : `${colors.purple}12`,
            border: `1px solid ${isUsingMainAccount ? `${colors.amber}30` : `${colors.purple}30`}`,
            fontSize: '0.75rem', color: isUsingMainAccount ? colors.amber : colors.purple,
          }}>
            <span>{isUsingMainAccount ? '🎮' : '👤'}</span>
            <span style={{ fontWeight: '600' }}>{playerName}</span>
            <span style={{ color: isUsingMainAccount ? `${colors.amber}80` : `${colors.purple}80` }}>•</span>
            <span style={{ color: isUsingMainAccount ? `${colors.amber}80` : `${colors.purple}80` }}>ID: {playerId}</span>
            {!isUsingMainAccount && (
              <button onClick={() => { setActivePlayerId(null); setCustomPlayerId(''); setResults(new Map()); }} style={{
                background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer',
                fontSize: '0.7rem', padding: '0 0.2rem',
              }}>✕</button>
            )}
          </div>
        </div>
      </div>

      {/* Keyframes for fancy animations */}
      <style>{`
        @keyframes giftPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); } 50% { box-shadow: 0 0 16px 2px rgba(245,158,11,0.15); } }
        @keyframes giftShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes giftPop { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .gift-pill:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.3); }
        .gift-btn:hover:not(:disabled) { transform: scale(1.03); filter: brightness(1.2); }
        .gift-action-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.15); }
      `}</style>

      {/* Supporter Prompt Modal */}
      {showSupporterPrompt && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.7)', padding: '1rem',
        }} onClick={() => setShowSupporterPrompt(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            backgroundColor: colors.surface, borderRadius: '16px', border: `1px solid ${colors.amber}30`,
            padding: '1.5rem', maxWidth: '400px', width: '100%', textAlign: 'center',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⭐</div>
            <h3 style={{ color: colors.text, fontSize: '1.1rem', fontFamily: FONT_DISPLAY, marginBottom: '0.5rem' }}>
              Atlas Supporter Perk
            </h3>
            <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '1rem', lineHeight: 1.5 }}>
              Bulk redeeming codes for all your accounts at once is an Atlas Supporter perk.
              Manage alt accounts and redeem everything with one tap.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button onClick={() => setShowSupporterPrompt(false)} style={{
                padding: '0.5rem 1rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`,
                borderRadius: '8px', color: colors.textMuted, fontSize: '0.8rem', cursor: 'pointer',
              }}>
                Maybe Later
              </button>
              <Link to="/support" style={{
                padding: '0.5rem 1.25rem', backgroundColor: colors.amber, border: 'none',
                borderRadius: '8px', color: '#000', fontWeight: '700', fontSize: '0.8rem',
                textDecoration: 'none', display: 'inline-block',
              }}>
                Become a Supporter
              </Link>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '750px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem' }}>

        {/* Account Switcher + Alt Accounts */}
        <div style={{
          marginBottom: '0.75rem', padding: '0.75rem',
          backgroundColor: colors.surface, borderRadius: '12px', border: `1px solid ${colors.border}`,
        }}>
          {/* Custom Player ID Input */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: altAccounts.length > 0 || showAltPanel ? '0.6rem' : 0 }}>
            <input
              type="text"
              value={customPlayerId}
              onChange={e => { setCustomPlayerId(e.target.value.replace(/\D/g, '')); if (e.target.value) setActivePlayerId(null); }}
              placeholder="Paste any Player ID to redeem for..."
              style={{
                flex: 1, padding: '0.45rem 0.65rem', borderRadius: '8px',
                border: `1px solid ${colors.border}`, backgroundColor: colors.bg,
                color: '#e5e7eb', fontSize: '0.8rem', fontFamily: 'monospace', outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { e.target.style.borderColor = `${colors.amber}40`; }}
              onBlur={e => { e.target.style.borderColor = '#2a2a2a'; }}
            />
            {mainPlayerId && !isUsingMainAccount && (
              <button onClick={() => { setCustomPlayerId(''); setActivePlayerId(null); setResults(new Map()); }} style={{
                padding: '0.4rem 0.65rem', borderRadius: '8px', border: `1px solid ${colors.amber}30`,
                backgroundColor: `${colors.amber}12`, color: colors.amber, fontSize: '0.7rem', fontWeight: '600',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                ← Main
              </button>
            )}
            <button
              onClick={() => setShowAltPanel(!showAltPanel)}
              style={{
                padding: '0.4rem 0.65rem', borderRadius: '8px',
                border: `1px solid ${isSupporter ? '#a855f730' : '#2a2a2a'}`,
                backgroundColor: isSupporter ? '#a855f712' : 'transparent',
                color: isSupporter ? '#a855f7' : '#9ca3af',
                fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap',
                position: 'relative',
              }}
            >
              👥 Alts
              {altAccounts.length > 0 && (
                <span style={{
                  position: 'absolute', top: '-4px', right: '-4px',
                  width: '16px', height: '16px', borderRadius: '50%',
                  backgroundColor: '#a855f7', color: '#000', fontSize: '0.5rem', fontWeight: '700',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {altAccounts.length}
                </span>
              )}
            </button>
          </div>

          {/* Alt Account Quick-Switch Pills */}
          {altAccounts.length > 0 && !showAltPanel && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {altAccounts.map(alt => (
                <button
                  key={alt.player_id}
                  onClick={() => { setActivePlayerId(alt.player_id); setCustomPlayerId(''); setResults(new Map()); }}
                  style={{
                    padding: '0.25rem 0.55rem', borderRadius: '16px',
                    border: `1px solid ${activePlayerId === alt.player_id ? '#a855f760' : alt.hasError ? '#ef444440' : '#2a2a2a'}`,
                    backgroundColor: activePlayerId === alt.player_id ? '#a855f718' : alt.hasError ? '#ef444408' : 'transparent',
                    color: activePlayerId === alt.player_id ? '#a855f7' : alt.hasError ? '#ef4444' : '#9ca3af',
                    fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {alt.hasError && '⚠ '}{alt.label}
                </button>
              ))}
            </div>
          )}

          {/* Alt Accounts Management Panel */}
          {showAltPanel && (
            <div style={{
              padding: '0.6rem', backgroundColor: colors.bg, borderRadius: '10px',
              border: '1px solid #a855f720',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ color: '#a855f7', fontSize: '0.7rem', fontWeight: '700', letterSpacing: '0.05em' }}>
                  ALT ACCOUNTS ({altAccounts.length}/{altLimit})
                </span>
                <button onClick={() => setShowAltPanel(false)} style={{
                  background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '0.75rem',
                }}>✕</button>
              </div>

              {/* Add new alt */}
              <div style={{ display: 'flex', gap: '0.3rem', marginBottom: altAccounts.length > 0 ? '0.5rem' : 0 }}>
                <input
                  type="text"
                  value={newAltId}
                  onChange={e => setNewAltId(e.target.value.replace(/\D/g, ''))}
                  placeholder="Player ID"
                  style={{
                    flex: 1, padding: '0.35rem 0.5rem', borderRadius: '6px',
                    border: `1px solid ${colors.border}`, backgroundColor: colors.surface,
                    color: '#e5e7eb', fontSize: '0.75rem', fontFamily: 'monospace', outline: 'none',
                    minWidth: 0,
                  }}
                />
                <input
                  type="text"
                  value={newAltLabel}
                  onChange={e => setNewAltLabel(e.target.value)}
                  placeholder="Label (optional)"
                  style={{
                    width: isMobile ? '90px' : '120px', padding: '0.35rem 0.5rem', borderRadius: '6px',
                    border: `1px solid ${colors.border}`, backgroundColor: colors.surface,
                    color: '#e5e7eb', fontSize: '0.75rem', outline: 'none',
                  }}
                />
                <button onClick={addAltAccount} disabled={!newAltId.trim()} style={{
                  padding: '0.35rem 0.6rem', borderRadius: '6px', border: 'none',
                  backgroundColor: newAltId.trim() ? '#a855f7' : '#333',
                  color: '#000', fontSize: '0.7rem', fontWeight: '700', cursor: newAltId.trim() ? 'pointer' : 'default',
                }}>
                  +
                </button>
              </div>

              {/* Saved alts list */}
              {altAccounts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {altAccounts.map((alt, idx) => (
                    <div key={alt.player_id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                      padding: '0.3rem 0.5rem', borderRadius: '8px',
                      backgroundColor: activePlayerId === alt.player_id ? '#a855f712' : 'transparent',
                      border: `1px solid ${alt.hasError ? '#ef444430' : activePlayerId === alt.player_id ? '#a855f730' : '#1a1a1a'}`,
                    }}>
                      {/* Reorder buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <button onClick={() => moveAltAccount(idx, 'up')} disabled={idx === 0} style={{
                          background: 'none', border: 'none', color: idx === 0 ? '#1a1a1a' : '#4b5563',
                          cursor: idx === 0 ? 'default' : 'pointer', fontSize: '0.5rem', padding: 0, lineHeight: 1,
                        }}>▲</button>
                        <button onClick={() => moveAltAccount(idx, 'down')} disabled={idx === altAccounts.length - 1} style={{
                          background: 'none', border: 'none', color: idx === altAccounts.length - 1 ? '#1a1a1a' : '#4b5563',
                          cursor: idx === altAccounts.length - 1 ? 'default' : 'pointer', fontSize: '0.5rem', padding: 0, lineHeight: 1,
                        }}>▼</button>
                      </div>
                      <button onClick={() => { setActivePlayerId(alt.player_id); setCustomPlayerId(''); setResults(new Map()); setShowAltPanel(false); }} style={{
                        flex: 1, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0,
                        display: 'flex', flexDirection: 'column', gap: '0.1rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ color: alt.hasError ? '#ef4444' : '#d1d5db', fontSize: '0.7rem', fontWeight: '600' }}>
                            {alt.hasError ? '⚠ ' : ''}{alt.label}
                          </span>
                          <span style={{ color: '#4b5563', fontSize: '0.6rem', fontFamily: 'monospace' }}>
                            {alt.player_id}
                          </span>
                        </div>
                        {alt.lastRedeemed && (
                          <span style={{ color: '#374151', fontSize: '0.5rem' }}>
                            Last redeemed {new Date(alt.lastRedeemed).toLocaleDateString()}
                          </span>
                        )}
                      </button>
                      <button onClick={() => removeAltAccount(alt.player_id)} style={{
                        background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer',
                        fontSize: '0.65rem', padding: '0.1rem 0.3rem',
                      }}>🗑</button>
                    </div>
                  ))}
                </div>
              )}

              {altAccounts.length === 0 && (
                <p style={{ color: '#4b5563', fontSize: '0.65rem', textAlign: 'center', padding: '0.5rem 0' }}>
                  Add your alt Player IDs here for quick switching and bulk redemption.
                </p>
              )}

              {/* Supporter teaser for free users */}
              {!isSupporter && altAccounts.length >= freeAltLimit && (
                <div style={{
                  marginTop: '0.4rem', padding: '0.4rem 0.6rem', borderRadius: '8px',
                  backgroundColor: `${colors.amber}08`, border: `1px solid ${colors.amber}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ color: `${colors.amber}90`, fontSize: '0.6rem' }}>
                    ⭐ Supporters get up to {MAX_ALT_ACCOUNTS} alt accounts + bulk redeem
                  </span>
                  <Link to="/support" onClick={() => analyticsService.trackFeatureUse('Alt Panel Upgrade CTA')} style={{ color: colors.amber, fontSize: '0.6rem', fontWeight: '700', textDecoration: 'none' }}>
                    Upgrade
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rate Limit Countdown Banner */}
        {globalCooldown && cooldownSeconds > 0 && (
          <div style={{
            marginBottom: '0.75rem', padding: '0.6rem 1rem',
            backgroundColor: '#ef444412', borderRadius: '10px', border: '1px solid #ef444430',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem' }}>⏱️</span>
              <div>
                <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 600 }}>Rate Limited</div>
                <div style={{ color: '#ef444490', fontSize: '0.65rem' }}>Too many requests. Please wait.</div>
              </div>
            </div>
            <div style={{
              minWidth: '48px', textAlign: 'center',
              padding: '0.3rem 0.6rem', borderRadius: '8px',
              backgroundColor: '#ef444418', color: '#ef4444',
              fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace',
            }}>
              {cooldownSeconds}s
            </div>
          </div>
        )}

        {/* Bulk Redeem Results Summary */}
        {showBulkResults && bulkResults.length > 0 && (() => {
          const totalSuccess = bulkResults.reduce((s, r) => s + r.success, 0);
          const totalFailed = bulkResults.reduce((s, r) => s + r.failed, 0);
          const totalCodes = totalSuccess + totalFailed;
          const allExpanded = bulkResults.every(r => expandedBulkAccounts.has(r.playerId));
          const hasAnyRetryable = bulkResults.some(r => r.codeResults.some(isBulkRetryable));
          const isRetryingAny = retryingAccounts.size > 0;
          return (
          <div style={{
            marginBottom: '0.75rem', padding: '0.6rem 0.75rem',
            backgroundColor: colors.surface, borderRadius: '10px', border: '1px solid #a855f720',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.15rem' }}>
              <span style={{ color: '#a855f7', fontSize: '0.7rem', fontWeight: '700', letterSpacing: '0.05em' }}>
                BULK REDEEM RESULTS
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {hasAnyRetryable && (
                  <button
                    onClick={retryAllFailed}
                    disabled={globalCooldown || isRetryingAny}
                    style={{
                      background: 'none', border: `1px solid ${colors.amber}40`, color: isRetryingAny ? `${colors.amber}60` : colors.amber,
                      cursor: (globalCooldown || isRetryingAny) ? 'default' : 'pointer', fontSize: '0.55rem',
                      padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: '600',
                      opacity: (globalCooldown || isRetryingAny) ? 0.5 : 1,
                    }}
                  >
                    {isRetryingAny ? '⟳ Retrying...' : '⟳ Retry All Failed'}
                  </button>
                )}
                <button onClick={() => {
                  if (allExpanded) setExpandedBulkAccounts(new Set());
                  else setExpandedBulkAccounts(new Set(bulkResults.map(r => r.playerId)));
                }} style={{
                  background: 'none', border: 'none', color: '#6b728090', cursor: 'pointer', fontSize: '0.55rem',
                  padding: '0.1rem 0.3rem', borderRadius: '4px',
                }}>
                  {allExpanded ? 'Collapse All' : 'Expand All'}
                </button>
                <button onClick={dismissBulkResults} style={{
                  background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '0.7rem',
                }}>✕</button>
              </div>
            </div>
            {/* Summary line */}
            <div style={{ fontSize: '0.6rem', color: colors.textMuted, marginBottom: '0.4rem' }}>
              {totalSuccess > 0 && <span style={{ color: '#22c55e' }}>{totalSuccess} redeemed</span>}
              {totalSuccess > 0 && totalFailed > 0 && <span> · </span>}
              {totalFailed > 0 && <span style={{ color: '#ef4444' }}>{totalFailed} failed</span>}
              <span> across {bulkResults.length} account{bulkResults.length > 1 ? 's' : ''}</span>
              {totalCodes > 0 && <span> ({totalSuccess}/{totalCodes})</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {bulkResults.map(r => {
                const isExpanded = expandedBulkAccounts.has(r.playerId);
                const borderC = r.success > 0 && r.failed === 0 ? '#22c55e15' : r.failed > 0 ? '#ef444415' : '#1a1a1a';
                const bgC = r.success > 0 && r.failed === 0 ? '#22c55e06' : r.failed > 0 ? '#ef444406' : 'transparent';
                const acctRetryable = r.codeResults.some(isBulkRetryable);
                const isRetrying = retryingAccounts.has(r.playerId);
                return (
                  <div key={r.playerId}>
                    <button
                      onClick={() => setExpandedBulkAccounts(prev => {
                        const next = new Set(prev);
                        if (next.has(r.playerId)) next.delete(r.playerId);
                        else next.add(r.playerId);
                        return next;
                      })}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.35rem 0.4rem', borderRadius: isExpanded ? '6px 6px 0 0' : '6px',
                        backgroundColor: bgC,
                        border: `1px solid ${borderC}`,
                        borderBottom: isExpanded ? 'none' : undefined,
                        cursor: 'pointer',
                        transition: 'background-color 0.15s',
                      }}
                    >
                      <span style={{ fontSize: '0.7rem', color: r.success > 0 && r.failed === 0 ? '#22c55e' : r.failed > 0 && r.success === 0 ? '#ef4444' : '#d1d5db' }}>
                        {isRetrying ? '⟳' : r.success > 0 && r.failed === 0 ? '✓' : r.failed > 0 && r.success === 0 ? '✗' : '◐'}
                      </span>
                      <span style={{ color: isRetrying ? colors.amber : '#d1d5db', fontSize: '0.7rem', fontWeight: '600', flex: 1, textAlign: 'left' }}>
                        {r.label}{isRetrying ? ' (retrying...)' : ''}
                      </span>
                      {r.success > 0 && (
                        <span style={{ color: '#22c55e', fontSize: '0.65rem', fontWeight: '600' }}>
                          {r.success} redeemed
                        </span>
                      )}
                      {r.failed > 0 && (
                        <span style={{ color: '#ef4444', fontSize: '0.65rem' }}>
                          {r.failed} failed
                        </span>
                      )}
                      <span style={{
                        fontSize: '0.55rem', color: colors.textMuted,
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        display: 'inline-block', width: '12px', flexShrink: 0,
                      }}>▶</span>
                    </button>
                    {isExpanded && r.codeResults.length > 0 && (
                      <div style={{
                        borderLeft: `1px solid ${borderC}`,
                        borderRight: `1px solid ${borderC}`,
                        borderBottom: `1px solid ${borderC}`,
                        borderRadius: '0 0 6px 6px',
                        padding: '0.25rem 0.4rem 0.35rem',
                        backgroundColor: colors.bg,
                      }}>
                        {r.codeResults.map(cr => {
                          const crOutcome = getBulkCodeOutcome(cr);
                          const statusIcon = crOutcome === 'success' ? '✓'
                            : crOutcome === 'already_redeemed' ? '⟳'
                            : crOutcome === 'expired' ? '⛔'
                            : crOutcome === 'invalid' ? '✗'
                            : crOutcome === 'rate_limited' ? '⏱'
                            : crOutcome === 'not_login' ? '🔒'
                            : '✗';
                          const statusColor = crOutcome === 'success' ? '#22c55e'
                            : crOutcome === 'already_redeemed' ? '#eab308'
                            : crOutcome === 'expired' ? '#6b7280'
                            : crOutcome === 'rate_limited' ? '#f97316'
                            : crOutcome === 'not_login' ? '#f97316'
                            : '#ef4444';
                          return (
                            <div key={cr.code} style={{
                              display: 'flex', alignItems: 'center', gap: '0.4rem',
                              padding: '0.2rem 0.3rem',
                              borderBottom: '1px solid #1a1a1a',
                            }}>
                              <span style={{ color: statusColor, fontSize: '0.6rem', width: '14px', textAlign: 'center', flexShrink: 0 }}>{statusIcon}</span>
                              <span style={{
                                color: colors.textSecondary, fontSize: '0.6rem', fontFamily: 'monospace', fontWeight: '600',
                                minWidth: '80px',
                              }}>{cr.code}</span>
                              <span style={{
                                color: statusColor, fontSize: '0.55rem', flex: 1,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>{cr.message}</span>
                            </div>
                          );
                        })}
                        {/* Per-account Retry Failed button */}
                        {acctRetryable && !isRetrying && (
                          <button
                            onClick={(e) => { e.stopPropagation(); retryFailedForAccount(r.playerId); }}
                            disabled={globalCooldown || isRetryingAny}
                            style={{
                              width: '100%', marginTop: '0.25rem', padding: '0.25rem 0',
                              background: 'none', border: `1px solid ${colors.amber}30`,
                              borderRadius: '4px', color: colors.amber, fontSize: '0.55rem',
                              fontWeight: '600', cursor: (globalCooldown || isRetryingAny) ? 'default' : 'pointer',
                              opacity: (globalCooldown || isRetryingAny) ? 0.4 : 1,
                              transition: 'opacity 0.15s',
                            }}
                          >
                            ⟳ Retry {r.codeResults.filter(isBulkRetryable).length} Failed Code{r.codeResults.filter(isBulkRetryable).length > 1 ? 's' : ''}
                          </button>
                        )}
                        {isRetrying && (
                          <div style={{ textAlign: 'center', padding: '0.25rem 0', color: `${colors.amber}80`, fontSize: '0.55rem' }}>
                            Retrying...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          );
        })()}

        {/* Codes Grid — 3-column pill layout */}
        {loadingCodes ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: '0.75rem',
          }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: '120px', borderRadius: '14px', backgroundColor: colors.surface,
                border: '1px solid #1a1a1a', animation: 'pulse 1.5s infinite',
              }} />
            ))}
          </div>
        ) : codes.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '2rem',
            backgroundColor: colors.surface, borderRadius: '12px', border: `1px solid ${colors.border}`,
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📭</div>
            <p style={{ color: colors.textMuted, fontSize: '0.85rem', marginBottom: '1rem' }}>
              {codesSource === 'unavailable'
                ? t('giftCodes.noCodesUnavailable', 'Could not fetch gift codes right now. Try again later or enter a code manually below.')
                : t('giftCodes.noCodesEmpty', 'No active gift codes found right now. Check back later!')}
            </p>
            <button
              onClick={() => fetchCodes(true)}
              disabled={loadingCodes}
              className="gift-action-btn"
              style={{
                padding: '0.4rem 1rem', borderRadius: '8px',
                border: `1px solid ${colors.amber}40`, backgroundColor: `${colors.amber}12`,
                color: colors.amber, fontSize: '0.8rem', fontWeight: '600',
                cursor: loadingCodes ? 'default' : 'pointer', opacity: loadingCodes ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              🔄 {t('giftCodes.refresh', 'Refresh Codes')}
            </button>
          </div>
        ) : (
          <>
            {/* 3-column pill grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : codes.length < 3 ? `repeat(${codes.length}, 1fr)` : 'repeat(3, 1fr)',
              gap: '0.75rem',
            }}>
              {codes.map((gc, idx) => {
                const result = results.get(gc.code);
                const isLoading = result?.loading;
                const outcome = getOutcome(result);
                const locked = isNonRetryable(outcome);

                const borderColor = outcome === 'success' ? '#22c55e40'
                  : outcome === 'already_redeemed' ? '#eab30830'
                  : outcome === 'expired' ? '#ef444430'
                  : outcome === 'not_login' ? '#f9731630'
                  : '#2a2a2a';
                const bgColor = outcome === 'success' ? '#22c55e06'
                  : outcome === 'already_redeemed' ? '#eab30806'
                  : outcome === 'not_login' ? '#f9731606'
                  : '#111111';
                const codeColor = outcome === 'success' ? '#22c55e'
                  : outcome === 'already_redeemed' ? '#eab308'
                  : outcome === 'expired' ? '#6b7280'
                  : outcome === 'not_login' ? '#f97316'
                  : '#e5e7eb';

                const btnLabel = isLoading ? '...'
                  : outcome === 'success' ? `✓ ${t('giftCodes.redeemed', 'Redeemed')}`
                  : outcome === 'already_redeemed' ? `✓ ${t('giftCodes.alreadyRedeemed', 'Already Redeemed')}`
                  : outcome === 'expired' ? `⛔ ${t('giftCodes.expired', 'Expired')}`
                  : outcome === 'not_login' ? '� Retry'
                  : outcome === 'invalid' || outcome === 'retryable' ? t('giftCodes.retry', 'Retry')
                  : t('giftCodes.redeem', 'Redeem');
                const btnBg = outcome === 'success' ? '#22c55e'
                  : outcome === 'already_redeemed' ? '#eab308'
                  : outcome === 'expired' ? '#ef4444'
                  : outcome === 'not_login' ? '#f97316'
                  : isLoading ? `${colors.amber}60`
                  : colors.amber;
                const btnTextColor = (outcome === 'success' || outcome === 'already_redeemed' || outcome === 'expired' || !isLoading) ? '#000' : '#000';

                const countdown = getExpirationCountdown(gc.expire_date);

                return (
                  <div
                    key={gc.code}
                    className="gift-pill"
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center',
                      padding: '1.25rem 0.75rem 1rem',
                      borderRadius: '14px',
                      backgroundColor: bgColor,
                      border: `1px solid ${borderColor}`,
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      animation: `giftPop 0.3s ease ${idx * 0.08}s both`,
                      cursor: 'default',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Shimmer overlay for active codes */}
                    {!outcome && (
                      <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.03), transparent)',
                        backgroundSize: '200% 100%',
                        animation: 'giftShimmer 3s ease infinite',
                      }} />
                    )}

                    {/* Code text — centered */}
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: isMobile ? '1rem' : '1.1rem',
                      fontWeight: '700',
                      color: codeColor,
                      letterSpacing: '0.04em',
                      textDecoration: outcome === 'expired' ? 'line-through' : 'none',
                      textAlign: 'center',
                      marginBottom: '0.15rem',
                    }}>
                      {gc.code}
                    </div>

                    {/* Expiration countdown */}
                    {countdown && (
                      <div style={{
                        fontSize: '0.55rem', fontWeight: 600, marginBottom: '0.3rem',
                        color: countdown === 'Expired' ? colors.error : !countdown.includes('d') ? colors.amber : colors.textMuted,
                      }}>
                        {countdown === 'Expired' ? '⛔ Expired' : `⏳ ${countdown}`}
                      </div>
                    )}

                    {/* Status message */}
                    {result && !isLoading && (
                      <div style={{
                        fontSize: '0.6rem', marginBottom: '0.3rem',
                        color: outcome === 'success' ? '#22c55e' : outcome === 'already_redeemed' ? '#eab308' : '#ef4444',
                        textAlign: 'center', maxWidth: '100%',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {result.message}
                      </div>
                    )}

                    {/* Redeem button — below code */}
                    <button
                      onClick={() => redeemCode(gc.code)}
                      disabled={isLoading || locked || globalCooldown || redeemingAll}
                      className="gift-btn"
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.4rem 1.25rem',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        letterSpacing: '0.03em',
                        cursor: (isLoading || locked || globalCooldown || redeemingAll) ? 'default' : 'pointer',
                        backgroundColor: btnBg,
                        color: btnTextColor,
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        opacity: (isLoading || globalCooldown) && !locked ? 0.6 : locked ? 0.7 : 1,
                        minWidth: '90px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {btnLabel}
                    </button>

                    {/* Redeem for all alts — purple button (Supporter perk) */}
                    {altAccounts.length > 0 && !locked && (
                      <button
                        onClick={() => redeemCodeForAllAlts(gc.code)}
                        disabled={isLoading || globalCooldown || redeemingAll || redeemingCodeForAlts.has(gc.code) || redeemingAllAccounts}
                        className="gift-btn"
                        style={{
                          marginTop: '0.3rem',
                          padding: '0.3rem 0.9rem',
                          borderRadius: '6px',
                          border: isSupporter ? '1px solid #a855f740' : '1px solid #2a2a2a',
                          backgroundColor: isSupporter ? '#a855f718' : 'transparent',
                          fontSize: '0.55rem',
                          fontWeight: '600',
                          letterSpacing: '0.02em',
                          cursor: (isLoading || globalCooldown || redeemingAll || redeemingCodeForAlts.has(gc.code)) ? 'default' : 'pointer',
                          color: isSupporter ? '#a855f7' : '#4b5563',
                          transition: 'all 0.2s ease',
                          opacity: (isLoading || globalCooldown || redeemingCodeForAlts.has(gc.code)) ? 0.5 : 1,
                          minWidth: '90px',
                        }}
                      >
                        {redeemingCodeForAlts.has(gc.code)
                          ? t('giftCodes.redeemingAlts', 'Redeeming...')
                          : isSupporter
                            ? `👥 ${t('giftCodes.redeemAllAlts', { count: 1 + altAccounts.length, defaultValue: `All ${1 + altAccounts.length} Accounts` })}`
                            : `🔒 ${t('giftCodes.redeemAllAltsLocked', 'All Accounts')}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons — below codes, single column, centered */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '0.5rem', marginTop: '1.25rem', maxWidth: '320px', marginLeft: 'auto', marginRight: 'auto',
            }}>
              {/* Redeem All */}
              <button
                onClick={redeemAll}
                disabled={redeemingAll || allRedeemed || globalCooldown || !playerId}
                className="gift-action-btn"
                style={{
                  width: '100%',
                  padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  border: allRedeemed ? `1px solid ${colors.success}40` : `1px solid ${colors.amber}50`,
                  backgroundColor: allRedeemed ? `${colors.success}12` : `${colors.amber}15`,
                  color: allRedeemed ? colors.success : colors.amber,
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  fontFamily: FONT_DISPLAY,
                  cursor: (redeemingAll || allRedeemed || globalCooldown) ? 'default' : 'pointer',
                  opacity: (redeemingAll || globalCooldown) ? 0.6 : 1,
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  letterSpacing: '0.03em',
                }}
              >
                {allRedeemed
                  ? `✓ ${t('giftCodes.allRedeemed', { count: codes.length, defaultValue: `All ${codes.length} Codes Redeemed` })}`
                  : redeemingAll
                    ? t('giftCodes.redeemingProgress', { done: redeemedCount, total: codes.length, defaultValue: `Redeeming... (${redeemedCount}/${codes.length})` })
                    : globalCooldown
                      ? t('giftCodes.cooldown', { seconds: cooldownSeconds, defaultValue: `Cooldown — ${cooldownSeconds}s` })
                      : `⚡ ${t('giftCodes.redeemAll', { count: codes.length, defaultValue: `Redeem All ${codes.length} Codes` })}`}
              </button>

              {/* Redeem All for All Accounts — Supporter Perk */}
              {altAccounts.length > 0 && (
                <button
                  onClick={redeemAllForAllAccounts}
                  disabled={redeemingAllAccounts || allRedeemed || globalCooldown || !mainPlayerId}
                  className="gift-action-btn"
                  style={{
                    width: '100%',
                    padding: '0.6rem 1rem',
                    borderRadius: '10px',
                    border: isSupporter ? '1px solid #a855f750' : '1px solid #2a2a2a',
                    backgroundColor: isSupporter ? '#a855f715' : '#111111',
                    color: isSupporter ? '#a855f7' : '#4b5563',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    fontFamily: FONT_DISPLAY,
                    cursor: (redeemingAllAccounts || allRedeemed || globalCooldown) ? 'default' : 'pointer',
                    opacity: (redeemingAllAccounts || globalCooldown) ? 0.6 : 1,
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    letterSpacing: '0.03em',
                  }}
                >
                  {redeemingAllAccounts && bulkRedeemProgress
                    ? `${bulkRedeemProgress.currentAccount} (${bulkRedeemProgress.current}/${bulkRedeemProgress.total})...`
                    : redeemingAllAccounts
                      ? `Redeeming across ${1 + altAccounts.length} accounts...`
                      : isSupporter
                        ? `👥 Redeem All for ${1 + altAccounts.length} Accounts`
                        : `🔒 Redeem All Accounts (Supporter)`}
                </button>
              )}

              {/* Copy All Codes */}
              <button
                onClick={() => {
                  const allCodes = codes.map(c => c.code).join('\n');
                  navigator.clipboard.writeText(allCodes).then(() => {
                    setCopiedAll(true);
                    showToast(t('giftCodes.copiedAll', { count: codes.length, defaultValue: `Copied ${codes.length} codes to clipboard` }), 'success');
                    setTimeout(() => setCopiedAll(false), 2000);
                  }).catch(() => {
                    showToast('Failed to copy', 'error');
                  });
                }}
                className="gift-action-btn"
                style={{
                  width: '100%',
                  padding: '0.45rem 1rem',
                  borderRadius: '8px',
                  border: `1px solid ${copiedAll ? '#22c55e30' : '#2a2a2a'}`,
                  backgroundColor: copiedAll ? '#22c55e10' : 'transparent',
                  color: copiedAll ? '#22c55e' : '#6b7280',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {copiedAll ? '✓ Copied!' : `📋 ${t('giftCodes.copyAll', 'Copy All Codes')}`}
              </button>

              {/* Refresh Codes */}
              <button
                onClick={() => fetchCodes(true)}
                disabled={loadingCodes || redeemingAll}
                className="gift-action-btn"
                style={{
                  width: '100%',
                  padding: '0.4rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #1a1a1a',
                  backgroundColor: 'transparent',
                  color: '#4b5563',
                  fontSize: '0.7rem',
                  fontWeight: '500',
                  cursor: (loadingCodes || redeemingAll) ? 'default' : 'pointer',
                  opacity: (loadingCodes || redeemingAll) ? 0.4 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                🔄 {t('giftCodes.refresh', 'Refresh Codes')}
              </button>
            </div>
          </>
        )}

        {/* Manual Code Entry — below everything */}
        <div style={{
          marginTop: '1.25rem', padding: '1rem',
          backgroundColor: colors.surface, borderRadius: '10px', border: `1px solid ${colors.border}`,
        }}>
          <span style={{ color: colors.textSecondary, fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('giftCodes.manualEntry', 'Enter a Code Manually')}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') redeemManual(); }}
              placeholder="e.g. KINGSHOT2026"
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #333',
                backgroundColor: colors.bg,
                color: '#e5e7eb',
                fontSize: '1rem',
                fontFamily: 'monospace',
                outline: 'none',
                transition: 'border-color 0.2s ease',
              }}
            />
            <button
              onClick={redeemManual}
              disabled={!manualCode.trim() || globalCooldown}
              className="gift-action-btn"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: `1px solid ${colors.amber}40`,
                backgroundColor: `${colors.amber}15`,
                color: colors.amber,
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: (!manualCode.trim() || globalCooldown) ? 'default' : 'pointer',
                opacity: (!manualCode.trim() || globalCooldown) ? 0.5 : 1,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              {t('giftCodes.redeem', 'Redeem')}
            </button>
          </div>
          {/* Show result for manual code */}
          {manualCode === '' && results.size > 0 && (() => {
            const manualResults = [...results.values()].filter(r => !codes.find(c => c.code === r.code));
            if (manualResults.length === 0) return null;
            const last = manualResults[manualResults.length - 1] as RedeemResult | undefined;
            if (!last) return null;
            return (
              <div style={{ fontSize: '0.7rem', marginTop: '0.4rem', color: last.success ? '#22c55e' : '#ef4444' }}>
                {last.code}: {last.message}
              </div>
            );
          })()}
        </div>

        {/* Info Section */}
        <div style={{
          marginTop: '1.25rem', padding: '0.75rem 1rem',
          backgroundColor: colors.surface, borderRadius: '10px', border: '1px solid #1a1a1a',
          fontSize: '0.7rem', color: '#4b5563', lineHeight: 1.6,
        }}>
          <p style={{ marginBottom: '0.3rem' }}>
            <strong style={{ color: colors.textMuted }}>{t('giftCodes.howItWorks', 'How it works:')}</strong> {t('giftCodes.howItWorksDesc', "Atlas sends the code to Century Games' official gift code service on your behalf, using your linked Player ID. Rewards go straight to your in-game mailbox.")}
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: colors.textMuted }}>{t('giftCodes.rateLimit', 'Rate limit:')}</strong> {t('giftCodes.rateLimitDesc', '10 codes per minute.')} {codesSource && codesSource !== 'unavailable' && t('giftCodes.codesSourced', { source: codesSource, defaultValue: `Codes sourced from ${codesSource}.` })}
          </p>
        </div>

        {/* Back links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1.5rem', paddingBottom: '1rem' }}>
          <Link to="/tools" style={{ color: colors.textSecondary, textDecoration: 'none', fontSize: '0.8rem' }}>
            ← {t('giftCodes.backToTools', 'Back to Tools')}
          </Link>
          <Link to="/" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('common.backToHome')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default GiftCodeRedeemer;
