import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { neonGlow, FONT_DISPLAY, colors } from '../utils/styles';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/Toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const CODES_CACHE_KEY = 'atlas_gift_codes_cache';
const CODES_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

interface GiftCode {
  code: string;
  expire_date?: string;
  is_expired?: boolean;
}

interface RawGiftCode {
  code?: string;
  title?: string;
  expire_date?: string;
  expiresAt?: string;
  is_expired?: boolean;
}

const GiftCodes: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('giftCodes.pageTitle', 'Gift Codes'));
  useMetaTags(PAGE_META_TAGS.giftCodes);
  useStructuredData({ type: 'BreadcrumbList', data: PAGE_BREADCRUMBS.tools });
  const isMobile = useIsMobile();
  const { showToast } = useToast();

  const [codes, setCodes] = useState<GiftCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [codesSource, setCodesSource] = useState<string>('');
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Fetch active codes (forceRefresh bypasses cache)
  const fetchCodes = useCallback(async (forceRefresh = false, silent = false) => {
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
      let rawCodes: RawGiftCode[] = [];
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

      const fetchedCodes: GiftCode[] = rawCodes
        .filter((c: RawGiftCode) => !c.is_expired)
        .map((c: RawGiftCode) => ({
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
      if (forceRefresh && !silent && fetchedCodes.length > 0) {
        showToast(t('giftCodes.refreshed', `Found ${fetchedCodes.length} active codes`), 'success');
      }
      if (rawCodes.length === 0 && !silent) {
        showToast(t('giftCodes.noCodesUnavailable', 'Could not fetch gift codes right now. Try again later.'), 'error');
      }
    } catch {
      showToast(t('giftCodes.noCodesUnavailable', 'Could not fetch gift codes right now. Try again later.'), 'error');
    } finally {
      setLoadingCodes(false);
    }
  }, [showToast, t]);

  useEffect(() => { fetchCodes(true, true); }, [fetchCodes]);

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

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      showToast(t('giftCodes.codeCopied', { code, defaultValue: `Copied ${code}` }), 'success');
      setTimeout(() => setCopiedCode(null), 2000);
    }).catch(() => showToast('Failed to copy', 'error'));
  };

  const copyAllCodes = () => {
    const allCodes = codes.map(c => c.code).join('\n');
    navigator.clipboard.writeText(allCodes).then(() => {
      setCopiedAll(true);
      showToast(t('giftCodes.copiedAll', { count: codes.length, defaultValue: `Copied ${codes.length} codes to clipboard` }), 'success');
      setTimeout(() => setCopiedAll(false), 2000);
    }).catch(() => showToast('Failed to copy', 'error'));
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg }}>
      {/* Hero */}
      <div style={{
        padding: isMobile ? '1.5rem 1rem 1rem' : '2rem 2rem 1.25rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #1a1400 0%, #0a0a0a 100%)',
      }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h1 style={{
            fontSize: isMobile ? '1.5rem' : '2rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            fontFamily: FONT_DISPLAY,
            letterSpacing: '0.05em',
          }}>
            <span style={{ color: colors.text }}>GIFT</span>
            <span style={{ ...neonGlow(colors.amber), marginLeft: '0.5rem' }}>CODES</span>
          </h1>
          <p style={{ color: colors.textSecondary, fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.75rem' }}>
            {t('giftCodes.heroSubtitleDisplay', 'Active Kingshot gift codes in one place. Copy and redeem them in-game.')}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes giftPop { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes giftShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .gift-pill:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.3); }
        .gift-action-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.15); }
      `}</style>

      <div style={{ maxWidth: '750px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem' }}>
        {/* Codes Grid */}
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
              {t('giftCodes.noCodesEmpty', 'No active gift codes found right now. Check back later!')}
            </p>
            <button
              onClick={() => fetchCodes(true)}
              disabled={loadingCodes}
              className="gift-action-btn"
              style={{
                padding: '0.4rem 1rem', borderRadius: '8px',
                border: `1px solid ${colors.amber}40`, backgroundColor: `${colors.amber}12`,
                color: colors.amber, fontSize: '0.8rem', fontWeight: '600',
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}
            >
              🔄 {t('giftCodes.refresh', 'Refresh Codes')}
            </button>
          </div>
        ) : (
          <>
            {/* Code pills grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : codes.length < 3 ? `repeat(${codes.length}, 1fr)` : 'repeat(3, 1fr)',
              gap: '0.75rem',
            }}>
              {codes.map((gc, idx) => {
                const countdown = getExpirationCountdown(gc.expire_date);
                const isCopied = copiedCode === gc.code;

                return (
                  <div
                    key={gc.code}
                    className="gift-pill"
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center',
                      padding: '1.25rem 0.75rem 1rem',
                      borderRadius: '14px',
                      backgroundColor: isCopied ? '#22c55e06' : '#111111',
                      border: `1px solid ${isCopied ? '#22c55e40' : '#2a2a2a'}`,
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      animation: `giftPop 0.3s ease ${idx * 0.08}s both`,
                      cursor: 'default',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Shimmer overlay for active codes */}
                    {!isCopied && (
                      <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.03), transparent)',
                        backgroundSize: '200% 100%',
                        animation: 'giftShimmer 3s ease infinite',
                      }} />
                    )}

                    {/* Code text */}
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: isMobile ? '1rem' : '1.1rem',
                      fontWeight: '700',
                      color: isCopied ? '#22c55e' : '#e5e7eb',
                      letterSpacing: '0.04em',
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

                    {/* Copy button */}
                    <button
                      onClick={() => copyCode(gc.code)}
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.4rem 1.25rem',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        letterSpacing: '0.03em',
                        cursor: 'pointer',
                        backgroundColor: isCopied ? '#22c55e' : colors.amber,
                        color: '#000',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        minWidth: '90px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {isCopied ? `✓ ${t('giftCodes.copiedShort', 'Copied')}` : `📋 ${t('giftCodes.copy', 'Copy')}`}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '0.5rem', marginTop: '1.25rem', maxWidth: '320px', marginLeft: 'auto', marginRight: 'auto',
            }}>
              {/* Copy All Codes */}
              <button
                onClick={copyAllCodes}
                className="gift-action-btn"
                style={{
                  width: '100%',
                  padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  border: `1px solid ${copiedAll ? '#22c55e40' : colors.amber + '50'}`,
                  backgroundColor: copiedAll ? '#22c55e12' : `${colors.amber}15`,
                  color: copiedAll ? '#22c55e' : colors.amber,
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  fontFamily: FONT_DISPLAY,
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  letterSpacing: '0.03em',
                }}
              >
                {copiedAll
                  ? `✓ ${t('giftCodes.allCopied', { count: codes.length, defaultValue: `All ${codes.length} Codes Copied` })}`
                  : `📋 ${t('giftCodes.copyAll', 'Copy All Codes')}`}
              </button>

              {/* Refresh Codes */}
              <button
                onClick={() => fetchCodes(true)}
                disabled={loadingCodes}
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
                  cursor: loadingCodes ? 'default' : 'pointer',
                  opacity: loadingCodes ? 0.4 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                🔄 {t('giftCodes.refresh', 'Refresh Codes')}
              </button>
            </div>
          </>
        )}

        {/* How to Redeem Section */}
        <div style={{
          marginTop: '1.25rem', padding: '1rem',
          backgroundColor: colors.surface, borderRadius: '12px', border: `1px solid ${colors.amber}20`,
        }}>
          <h3 style={{ color: colors.amber, fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('giftCodes.howToRedeem', 'How to Redeem')}
          </h3>

          {/* Android / In-Game */}
          <p style={{ color: colors.textMuted, fontSize: '0.7rem', fontWeight: 600, margin: '0.5rem 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            📱 {t('giftCodes.androidInGame', 'Android (In-Game)')}
          </p>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', color: colors.textSecondary, fontSize: '0.8rem', lineHeight: 1.8 }}>
            <li>{t('giftCodes.step1', 'Copy the code above')}</li>
            <li>{t('giftCodes.step2', 'Open Kingshot and go to Settings (gear icon)')}</li>
            <li>{t('giftCodes.step3', 'Tap "Gift Code" and paste the code')}</li>
            <li>{t('giftCodes.step4', 'Tap Redeem — rewards appear in your mailbox')}</li>
          </ol>

          {/* iOS / Web */}
          <p style={{ color: colors.textMuted, fontSize: '0.7rem', fontWeight: 600, margin: '0.75rem 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            🍎 {t('giftCodes.iosWeb', 'iOS (Web Redeem)')}
          </p>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', color: colors.textSecondary, fontSize: '0.8rem', lineHeight: 1.8 }}>
            <li>{t('giftCodes.iosStep1', 'Copy the code above')}</li>
            <li>
              {t('giftCodes.iosStep2', 'Visit the')}{' '}
              <a
                href="https://ks-giftcode.centurygame.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: colors.amber, textDecoration: 'underline' }}
              >
                {t('giftCodes.iosRedeemSite', 'official Kingshot Gift Code page')}
              </a>
            </li>
            <li>{t('giftCodes.iosStep3', 'Log in with your account and paste the code')}</li>
            <li>{t('giftCodes.iosStep4', 'Rewards appear in your in-game mailbox')}</li>
          </ol>
          <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
            {t('giftCodes.iosNote', 'iOS users cannot redeem gift codes in-game — use the web link above instead.')}
          </p>
        </div>

        {/* Info Section */}
        <div style={{
          marginTop: '0.75rem', padding: '0.75rem 1rem',
          backgroundColor: colors.surface, borderRadius: '10px', border: '1px solid #1a1a1a',
          fontSize: '0.7rem', color: '#4b5563', lineHeight: 1.6,
        }}>
          <p style={{ margin: 0 }}>
            <strong style={{ color: colors.textMuted }}>{t('giftCodes.aboutCodes', 'About codes:')}</strong>{' '}
            {t('giftCodes.aboutCodesDesc', 'Gift codes are released by Century Games through social media, events, and partnerships. Atlas aggregates them so you never miss one.')}
            {codesSource && codesSource !== 'unavailable' && ` ${t('giftCodes.codesSourced', { source: codesSource, defaultValue: `Codes sourced from ${codesSource}.` })}`}
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

export default GiftCodes;
