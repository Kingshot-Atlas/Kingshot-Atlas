import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { CURRENT_KVK } from '../constants';

const BANNER_DISMISS_KEY = 'kvk_banner_dismissed';

interface KvKSchedule {
  kvk_number: number;
  matchups_open_at: string;
  prep_open_at: string;
  battle_open_at: string;
  is_complete: boolean;
}

type Phase = 'matchup' | 'prep' | 'battle' | null;

const getActivePhase = (schedule: KvKSchedule | null): Phase => {
  if (!schedule || schedule.is_complete) return null;
  const now = new Date();
  if (now >= new Date(schedule.battle_open_at)) return 'battle';
  if (now >= new Date(schedule.prep_open_at)) return 'prep';
  if (now >= new Date(schedule.matchups_open_at)) return 'matchup';
  return null;
};

const PHASE_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string; messageKey: string; messageFallback: string; ctaKey: string; ctaFallback: string }> = {
  matchup: {
    icon: '🔗',
    color: '#22d3ee',
    bg: '#22d3ee08',
    border: '#22d3ee30',
    messageKey: 'kvkBanner.matchupMessage',
    messageFallback: 'KvK matchups are live! Add your kingdom\'s matchup now.',
    ctaKey: 'kvkBanner.matchupCta',
    ctaFallback: 'Add Matchup',
  },
  prep: {
    icon: '🛡️',
    color: '#eab308',
    bg: '#eab30808',
    border: '#eab30830',
    messageKey: 'kvkBanner.prepMessage',
    messageFallback: 'KvK Prep Phase has ended! Submit your prep result.',
    ctaKey: 'kvkBanner.prepCta',
    ctaFallback: 'Add Prep Result',
  },
  battle: {
    icon: '⚔️',
    color: '#f97316',
    bg: '#f9731608',
    border: '#f9731630',
    messageKey: 'kvkBanner.battleMessage',
    messageFallback: 'KvK Castle Battle is over! Submit your battle result.',
    ctaKey: 'kvkBanner.battleCta',
    ctaFallback: 'Add Battle Result',
  },
};

const KvKPhaseBanner: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<KvKSchedule | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoaded(true); return; }

    // Fetch latest non-complete KvK schedule whose matchup phase has started
    supabase
      .from('kvk_schedule')
      .select('*')
      .eq('is_complete', false)
      .lte('matchups_open_at', new Date().toISOString())
      .order('kvk_number', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setSchedule(data);
        setLoaded(true);
      });
  }, []);

  // Check if user dismissed this banner
  useEffect(() => {
    if (!user || !schedule) return;
    try {
      const raw = localStorage.getItem(BANNER_DISMISS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const currentPhase = getActivePhase(schedule);
        if (parsed.kvk === schedule.kvk_number && parsed.phase === currentPhase) {
          setDismissed(true);
        }
      }
    } catch { /* ignore */ }
  }, [user, schedule]);

  if (!loaded || dismissed) return null;

  const phase = getActivePhase(schedule);
  if (!phase) return null;

  const config = PHASE_CONFIG[phase];
  if (!config) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (schedule) {
      try {
        localStorage.setItem(BANNER_DISMISS_KEY, JSON.stringify({
          kvk: schedule.kvk_number,
          phase,
        }));
      } catch { /* ignore */ }
    }
  };

  const kvkNum = schedule?.kvk_number || CURRENT_KVK;

  return (
    <div style={{
      width: '100%',
      backgroundColor: config.bg,
      borderBottom: `1px solid ${config.border}`,
      padding: '0.6rem 1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      flexWrap: 'wrap',
      position: 'relative',
    }}>
      <span style={{ fontSize: '1rem' }}>{config.icon}</span>
      <span style={{ color: config.color, fontSize: '0.85rem', fontWeight: 600 }}>
        KvK #{kvkNum}:
      </span>
      <span style={{ color: '#d1d5db', fontSize: '0.85rem' }}>
        {t(config.messageKey, config.messageFallback)}
      </span>
      <Link
        to={`/seasons/${kvkNum}`}
        style={{
          padding: '0.3rem 0.75rem',
          backgroundColor: config.color,
          color: '#000',
          borderRadius: '6px',
          fontSize: '0.8rem',
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        {t(config.ctaKey, config.ctaFallback)} →
      </Link>
      <button
        onClick={handleDismiss}
        style={{
          position: 'absolute',
          right: '0.75rem',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          color: '#6b7280',
          cursor: 'pointer',
          fontSize: '1.1rem',
          lineHeight: 1,
          padding: '0.25rem',
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
};

export default KvKPhaseBanner;
