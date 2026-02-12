import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useTranslation } from 'react-i18next';
import { getAuthHeaders } from '../services/authHeaders';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const CODES_CACHE_KEY = 'atlas_gift_codes_cache';
const CODES_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

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

type RedeemOutcome = 'success' | 'expired' | 'already_redeemed' | 'invalid' | 'rate_limited' | 'retryable';

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

  const playerId = profile?.linked_player_id;
  const playerName = profile?.linked_username || profile?.username;

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
      // 1.5s delay between redemptions to avoid rate limits
      await new Promise(r => setTimeout(r, 1500));
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

  // Not logged in
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎁</div>
          <h2 style={{ color: '#fff', fontSize: '1.5rem', fontFamily: FONT_DISPLAY, marginBottom: '0.75rem' }}>{t('giftCodes.signInTitle', 'Gift Code Redeemer')}</h2>
          <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{t('giftCodes.signInDesc', 'Sign in and link your Kingshot account to redeem gift codes with one click.')}</p>
          <Link to="/profile" style={{ display: 'inline-block', padding: '0.6rem 1.5rem', backgroundColor: '#f59e0b20', border: '1px solid #f59e0b50', borderRadius: '8px', color: '#f59e0b', textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem' }}>
            {t('giftCodes.signIn', 'Sign In')}
          </Link>
        </div>
      </div>
    );
  }

  // No linked player ID
  if (!playerId) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '420px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
          <h2 style={{ color: '#fff', fontSize: '1.5rem', fontFamily: FONT_DISPLAY, marginBottom: '0.75rem' }}>{t('giftCodes.linkTitle', 'Link Your Account First')}</h2>
          <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{t('giftCodes.linkDesc', 'To redeem codes, we need your Player ID. Link your Kingshot account in your profile settings.')}</p>
          <Link to="/profile" style={{ display: 'inline-block', padding: '0.6rem 1.5rem', backgroundColor: '#f59e0b20', border: '1px solid #f59e0b50', borderRadius: '8px', color: '#f59e0b', textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem' }}>
            {t('giftCodes.goToProfile', 'Go to Profile')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
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
            <span style={{ color: '#fff' }}>GIFT CODE</span>
            <span style={{ ...neonGlow('#f59e0b'), marginLeft: '0.5rem' }}>REDEEMER</span>
          </h1>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.75rem' }}>
            {t('giftCodes.heroSubtitle', 'One click. Instant rewards. No copy-pasting.')}
          </p>

          {/* Player info pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.4rem 0.75rem', borderRadius: '20px',
            backgroundColor: '#f59e0b12', border: '1px solid #f59e0b30',
            fontSize: '0.75rem', color: '#f59e0b',
          }}>
            <span>🎮</span>
            <span style={{ fontWeight: '600' }}>{playerName}</span>
            <span style={{ color: '#f59e0b80' }}>•</span>
            <span style={{ color: '#f59e0b80' }}>ID: {playerId}</span>
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

      <div style={{ maxWidth: '750px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem' }}>

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

        {/* Codes Grid — 3-column pill layout */}
        {loadingCodes ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: '0.75rem',
          }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: '120px', borderRadius: '14px', backgroundColor: '#111111',
                border: '1px solid #1a1a1a', animation: 'pulse 1.5s infinite',
              }} />
            ))}
          </div>
        ) : codes.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '2rem',
            backgroundColor: '#111111', borderRadius: '12px', border: '1px solid #2a2a2a',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📭</div>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
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
                border: '1px solid #f59e0b40', backgroundColor: '#f59e0b12',
                color: '#f59e0b', fontSize: '0.8rem', fontWeight: '600',
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
                  : '#2a2a2a';
                const bgColor = outcome === 'success' ? '#22c55e06'
                  : outcome === 'already_redeemed' ? '#eab30806'
                  : '#111111';
                const codeColor = outcome === 'success' ? '#22c55e'
                  : outcome === 'already_redeemed' ? '#eab308'
                  : outcome === 'expired' ? '#6b7280'
                  : '#e5e7eb';

                const btnLabel = isLoading ? '...'
                  : outcome === 'success' ? `✓ ${t('giftCodes.redeemed', 'Redeemed')}`
                  : outcome === 'already_redeemed' ? `✓ ${t('giftCodes.alreadyRedeemed', 'Already Redeemed')}`
                  : outcome === 'expired' ? `⛔ ${t('giftCodes.expired', 'Expired')}`
                  : outcome === 'invalid' || outcome === 'retryable' ? t('giftCodes.retry', 'Retry')
                  : t('giftCodes.redeem', 'Redeem');
                const btnBg = outcome === 'success' ? '#22c55e'
                  : outcome === 'already_redeemed' ? '#eab308'
                  : outcome === 'expired' ? '#ef4444'
                  : isLoading ? '#f59e0b60'
                  : '#f59e0b';
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
                        color: countdown === 'Expired' ? '#ef4444' : !countdown.includes('d') ? '#f59e0b' : '#6b7280',
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
                  border: allRedeemed ? '1px solid #22c55e40' : '1px solid #f59e0b50',
                  backgroundColor: allRedeemed ? '#22c55e12' : '#f59e0b15',
                  color: allRedeemed ? '#22c55e' : '#f59e0b',
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
          backgroundColor: '#111111', borderRadius: '10px', border: '1px solid #2a2a2a',
        }}>
          <span style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                backgroundColor: '#0a0a0a',
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
                border: '1px solid #f59e0b40',
                backgroundColor: '#f59e0b15',
                color: '#f59e0b',
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
          backgroundColor: '#111111', borderRadius: '10px', border: '1px solid #1a1a1a',
          fontSize: '0.7rem', color: '#4b5563', lineHeight: 1.6,
        }}>
          <p style={{ marginBottom: '0.3rem' }}>
            <strong style={{ color: '#6b7280' }}>{t('giftCodes.howItWorks', 'How it works:')}</strong> {t('giftCodes.howItWorksDesc', "Atlas sends the code to Century Games' official gift code service on your behalf, using your linked Player ID. Rewards go straight to your in-game mailbox.")}
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: '#6b7280' }}>{t('giftCodes.rateLimit', 'Rate limit:')}</strong> {t('giftCodes.rateLimitDesc', '10 codes per minute.')} {codesSource && codesSource !== 'unavailable' && t('giftCodes.codesSourced', { source: codesSource, defaultValue: `Codes sourced from ${codesSource}.` })}
          </p>
        </div>

        {/* Back links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1.5rem', paddingBottom: '1rem' }}>
          <Link to="/tools" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.8rem' }}>
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
