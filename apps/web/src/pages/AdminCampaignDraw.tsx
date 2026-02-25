import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_USERNAMES } from '../utils/constants';
import {
  useActiveCampaign,
  useSettlerLeaderboard,
  useCampaignWinners,
  useSaveWinner,
  useDeleteWinner,
  useClearAllWinners,
} from '../hooks/useCampaignQueries';
import type { Campaign, CampaignWinner } from '../hooks/useCampaignQueries';
import {
  weightedRandomSelect,
  getPrizeTierColor,
  formatPrize,
  generateReelSequence,
  generateDiscordAnnouncement,
} from '../utils/campaignUtils';

// ─── Slot Reel Component ──────────────────────────────────────

interface SlotReelProps {
  sequence: number[];
  isSpinning: boolean;
  duration: number; // seconds
  onComplete: () => void;
}

const SlotReel: React.FC<SlotReelProps> = ({ sequence, isSpinning, duration, onComplete }) => {
  const reelRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isSpinning || sequence.length === 0) return;

    const totalMs = duration * 1000;
    const totalItems = sequence.length;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / totalMs, 1);

      // Easing: fast start, slow end (cubic ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);
      const idx = Math.min(Math.floor(eased * totalItems), totalItems - 1);

      setCurrentIndex(idx);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setCurrentIndex(totalItems - 1);
        onComplete();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isSpinning, sequence, duration, onComplete]);

  // Reset index only when a new sequence starts (not when spinning stops)
  useEffect(() => {
    if (isSpinning && sequence.length > 0) setCurrentIndex(0);
  }, [isSpinning, sequence.length]);

  const displayNumber = sequence.length > 0 ? sequence[currentIndex] ?? sequence[0] : 0;

  // Show 3 numbers: prev, current, next for slot effect
  const prevNumber = currentIndex > 0 ? sequence[currentIndex - 1] : null;
  const nextNumber = currentIndex < sequence.length - 1 ? sequence[currentIndex + 1] : null;

  return (
    <div
      ref={reelRef}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 520,
        height: 220,
        overflow: 'hidden',
        borderRadius: 16,
        background: '#131318',
        border: '2px solid rgba(34,211,238,0.3)',
        boxShadow: isSpinning
          ? '0 0 60px rgba(34,211,238,0.4), 0 0 120px rgba(34,211,238,0.15), inset 0 0 60px rgba(0,0,0,0.6)'
          : '0 0 30px rgba(34,211,238,0.2), inset 0 0 40px rgba(0,0,0,0.5)',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'box-shadow 0.3s',
      }}
    >
      {/* Fade overlays */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(to bottom, #131318 20%, transparent)', zIndex: 2 }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(to top, #131318 20%, transparent)', zIndex: 2 }} />

      {/* Numbers - vertically centered */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, height: '100%' }}>
        <div style={{
          fontFamily: "'Orbitron', sans-serif", fontSize: '1rem', color: 'rgba(255,255,255,0.15)',
          transition: isSpinning ? 'none' : 'all 0.3s',
          filter: isSpinning ? 'blur(2px)' : 'none',
          height: 28, display: 'flex', alignItems: 'center',
        }}>
          {prevNumber ? `Kingdom ${prevNumber}` : ''}
        </div>
        <div style={{
          fontFamily: "'Cinzel', 'Trajan Pro', serif",
          fontSize: 'clamp(1.8rem, 5vw, 2.8rem)',
          fontWeight: 700,
          color: '#fff',
          textShadow: '0 0 30px rgba(34,211,238,0.6), 0 0 60px rgba(34,211,238,0.2)',
          letterSpacing: 3,
          whiteSpace: 'nowrap',
          transition: isSpinning ? 'none' : 'all 0.3s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 56,
        }}>
          Kingdom {displayNumber}
        </div>
        <div style={{
          fontFamily: "'Orbitron', sans-serif", fontSize: '1rem', color: 'rgba(255,255,255,0.15)',
          transition: isSpinning ? 'none' : 'all 0.3s',
          filter: isSpinning ? 'blur(2px)' : 'none',
          height: 28, display: 'flex', alignItems: 'center',
        }}>
          {nextNumber ? `Kingdom ${nextNumber}` : ''}
        </div>
      </div>

      {/* Center line indicator */}
      <div style={{
        position: 'absolute', left: 12, right: 12, top: '50%', transform: 'translateY(-50%)',
        height: 64, border: '2px solid rgba(34,211,238,0.5)', borderRadius: 12,
        boxShadow: '0 0 15px rgba(34,211,238,0.15), inset 0 0 15px rgba(34,211,238,0.05)',
        pointerEvents: 'none', zIndex: 3,
      }} />
    </div>
  );
};

// ─── Prize Queue Sidebar ──────────────────────────────────────

interface PrizeQueueProps {
  rewards: Campaign['rewards'];
  winners: CampaignWinner[];
  currentDrawOrder: number;
  reRollingDraw: number | null;
}

const PrizeQueue: React.FC<PrizeQueueProps> = ({ rewards, winners, currentDrawOrder, reRollingDraw }) => {
  const winnerMap = useMemo(() => {
    const map = new Map<number, CampaignWinner>();
    for (const w of winners) map.set(w.draw_order, w);
    return map;
  }, [winners]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      maxHeight: 'calc(100vh - 200px)', overflowY: 'auto',
      padding: '0.5rem',
    }}>
      <div style={{ color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontWeight: 600 }}>
        Prize Queue
      </div>
      {rewards.map((r) => {
        const winner = winnerMap.get(r.draw_order);
        const isCurrent = r.draw_order === currentDrawOrder;
        const isReRolling = r.draw_order === reRollingDraw;
        const isDone = !!winner;
        const tierColor = getPrizeTierColor(r.amount);

        return (
          <div
            key={r.draw_order}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', borderRadius: 8,
              background: isCurrent ? `${tierColor}15` : isReRolling ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.02)',
              border: isCurrent ? `1px solid ${tierColor}44` : '1px solid transparent',
              transition: 'all 0.3s',
              animation: isReRolling ? 'rerollPulse 1s infinite' : undefined,
            }}
          >
            {isCurrent && <span style={{ color: tierColor, fontSize: '0.75rem' }}>▶</span>}
            <span style={{
              fontFamily: "'Orbitron', sans-serif", fontSize: '0.8rem', fontWeight: 700,
              color: tierColor, minWidth: 40,
            }}>
              {formatPrize(r.amount)}
            </span>
            <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>→</span>
            {isDone ? (
              <span style={{ color: '#22c55e', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                Kingdom {winner.kingdom_number} ✓{winner.is_upgrade ? ' ⬆' : ''}
              </span>
            ) : isReRolling ? (
              <span style={{ color: '#fbbf24', fontSize: '0.75rem', fontWeight: 600 }}>RE-ROLL</span>
            ) : (
              <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>—</span>
            )}
          </div>
        );
      })}
      <style>{`@keyframes rerollPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
};

// ─── Draw Stats ───────────────────────────────────────────────

interface DrawStatsProps {
  totalTickets: number;
  qualifyingKingdoms: number;
  drawsCompleted: number;
  totalDraws: number;
  reRolls: number;
}

const DrawStats: React.FC<DrawStatsProps> = ({ totalTickets, qualifyingKingdoms, drawsCompleted, totalDraws, reRolls }) => {
  const stats = [
    { label: 'Pool', value: `${totalTickets} tickets` },
    { label: 'Kingdoms', value: qualifyingKingdoms },
    { label: 'Drawn', value: `${drawsCompleted}/${totalDraws}` },
    { label: 'Re-rolls', value: reRolls },
  ];

  return (
    <div style={{
      display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap',
      background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '0.75rem 1rem',
    }}>
      {stats.map(s => (
        <div key={s.label} style={{ textAlign: 'center', minWidth: 80 }}>
          <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
            {s.value}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Qualified Kingdoms Panel ─────────────────────────────────

const QualifiedKingdomsPanel: React.FC<{
  qualifying: { kingdom_number: number; tickets: number; atlas_users: number; percentage: number }[];
  totalTickets: number;
}> = ({ qualifying, totalTickets }) => {
  const [expanded, setExpanded] = useState(false);

  if (qualifying.length === 0) return null;

  return (
    <div style={{
      maxWidth: 900, margin: '1rem auto 0', padding: '0 1rem',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: expanded ? '10px 10px 0 0' : '10px',
          color: '#9ca3af',
          cursor: 'pointer',
          fontSize: '0.8rem',
          transition: 'all 0.2s',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🎫</span>
          <span style={{ fontWeight: 600 }}>Qualified Kingdoms</span>
          <span style={{
            fontSize: '0.65rem', backgroundColor: 'rgba(34,211,238,0.15)',
            color: '#22d3ee', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 600,
          }}>
            {qualifying.length}
          </span>
        </span>
        <span style={{
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          fontSize: '0.75rem',
        }}>
          ▼
        </span>
      </button>

      {expanded && (
        <div style={{
          border: '1px solid rgba(255,255,255,0.08)',
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          background: 'rgba(0,0,0,0.3)',
          maxHeight: 400,
          overflowY: 'auto',
        }}>
          {/* Header row */}
          <div style={{
            display: 'flex', padding: '0.5rem 1rem',
            fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ width: 40, textAlign: 'center' }}>#</span>
            <span style={{ flex: 1 }}>Kingdom</span>
            <span style={{ width: 60, textAlign: 'right' }}>Tickets</span>
            <span style={{ width: 60, textAlign: 'right' }}>Chance</span>
          </div>

          {qualifying.map((k, i) => (
            <div
              key={k.kingdom_number}
              style={{
                display: 'flex', alignItems: 'center', padding: '0.4rem 1rem',
                fontSize: '0.8rem',
                borderBottom: i < qualifying.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(34,211,238,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ width: 40, textAlign: 'center', color: '#6b7280', fontSize: '0.7rem' }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, color: '#fff', fontWeight: 600 }}>
                Kingdom {k.kingdom_number}
              </span>
              <span style={{ width: 60, textAlign: 'right', color: '#22d3ee', fontWeight: 600, fontFamily: "'Orbitron', sans-serif", fontSize: '0.75rem' }}>
                {k.tickets}
              </span>
              <span style={{ width: 60, textAlign: 'right', color: '#9ca3af', fontSize: '0.7rem' }}>
                {totalTickets > 0 ? `${k.percentage.toFixed(1)}%` : '—'}
              </span>
            </div>
          ))}

          {/* Total row */}
          <div style={{
            display: 'flex', alignItems: 'center', padding: '0.5rem 1rem',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
            fontSize: '0.75rem', fontWeight: 700,
          }}>
            <span style={{ width: 40 }} />
            <span style={{ flex: 1, color: '#9ca3af' }}>Total</span>
            <span style={{ width: 60, textAlign: 'right', color: '#22d3ee', fontFamily: "'Orbitron', sans-serif" }}>
              {totalTickets}
            </span>
            <span style={{ width: 60, textAlign: 'right', color: '#9ca3af' }}>100%</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Confetti Effect ──────────────────────────────────────────

const Confetti: React.FC<{ color: string; active: boolean }> = ({ color, active }) => {
  if (!active) return null;
  const colors = [color, '#fbbf24', '#22d3ee', '#fff', '#a855f7', '#22c55e'];
  const particles = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 2 + Math.random() * 2,
    size: 4 + Math.random() * 8,
    rotation: Math.random() * 360,
    color: colors[i % colors.length],
    drift: (Math.random() - 0.5) * 120,
  }));

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 100, overflow: 'hidden' }}>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: -20,
            width: p.size,
            height: p.id % 4 === 0 ? p.size : p.size * 0.6,
            borderRadius: p.id % 3 === 0 ? '50%' : 2,
            background: p.color,
            animation: `confettiFall${p.id % 3} ${p.duration}s ${p.delay}s ease-in forwards`,
            transform: `rotate(${p.rotation}deg)`,
            opacity: 0.9,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall0 {
          0% { transform: translateY(0) rotate(0deg) translateX(0); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg) translateX(60px); opacity: 0; }
        }
        @keyframes confettiFall1 {
          0% { transform: translateY(0) rotate(0deg) translateX(0); opacity: 1; }
          100% { transform: translateY(100vh) rotate(-540deg) translateX(-80px); opacity: 0; }
        }
        @keyframes confettiFall2 {
          0% { transform: translateY(0) rotate(0deg) translateX(0); opacity: 1; }
          50% { opacity: 1; }
          100% { transform: translateY(100vh) rotate(900deg) translateX(40px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes confettiFall0, @keyframes confettiFall1, @keyframes confettiFall2 {
            0% { opacity: 1; }
            100% { opacity: 0; }
          }
        }
      `}</style>
    </div>
  );
};

// ─── Main Admin Draw Page ─────────────────────────────────────

const AdminCampaignDraw: React.FC = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.username && ADMIN_USERNAMES.includes(profile.username.toLowerCase());

  const { data: campaign, isLoading: campaignLoading } = useActiveCampaign();
  const { data: leaderboardData } = useSettlerLeaderboard(campaign);
  const { data: winners = [] } = useCampaignWinners(campaign?.id ?? 0);
  const saveWinner = useSaveWinner();
  const deleteWinner = useDeleteWinner();
  const clearAllWinners = useClearAllWinners();

  // Draw state
  const [isSpinning, setIsSpinning] = useState(false);
  const [rollDuration, setRollDuration] = useState(8);
  const [testMode, setTestMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastWinner, setLastWinner] = useState<{ kingdom: number; prize: number; isUpgrade: boolean } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [reelSequence, setReelSequence] = useState<number[]>([]);
  const [reRollingDraw, setReRollingDraw] = useState<number | null>(null);
  const [reRollCount, setReRollCount] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [exportText, setExportText] = useState<string | null>(null);

  // Audio context for sound effects
  const audioCtxRef = useRef<AudioContext | null>(null);
  const spinSoundRef = useRef<{ osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode } | null>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }, []);

  const playSound = useCallback((frequency: number, duration: number, type: OscillatorType = 'square', volume = 0.15) => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio not available
    }
  }, [soundEnabled, getAudioCtx]);

  // Continuous slot machine spinning sound
  const startSpinSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      // Main tone: low buzz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);

      // LFO for slot machine clicking/ticking effect
      lfo.type = 'square';
      lfo.frequency.setValueAtTime(12, ctx.currentTime); // 12 clicks/sec, speeds up feeling
      lfoGain.gain.setValueAtTime(0.04, ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      lfo.start();

      spinSoundRef.current = { osc, gain, lfo };
    } catch {
      // Audio not available
    }
  }, [soundEnabled, getAudioCtx]);

  const stopSpinSound = useCallback(() => {
    if (spinSoundRef.current) {
      try {
        const ctx = getAudioCtx();
        const { osc, gain, lfo } = spinSoundRef.current;
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.stop(ctx.currentTime + 0.4);
        lfo.stop(ctx.currentTime + 0.4);
      } catch { /* ignore */ }
      spinSoundRef.current = null;
    }
  }, [getAudioCtx]);

  const playJackpotSound = useCallback((prizeAmount: number) => {
    if (!soundEnabled) return;
    // Jackpot cascade: rapid ascending notes then sustained chord
    if (prizeAmount >= 100) {
      // Grand jackpot: epic ascending fanfare + sustained shimmer
      setTimeout(() => playSound(523, 0.3, 'triangle', 0.2), 0);
      setTimeout(() => playSound(659, 0.3, 'triangle', 0.2), 80);
      setTimeout(() => playSound(784, 0.3, 'triangle', 0.22), 160);
      setTimeout(() => playSound(1047, 1.0, 'triangle', 0.25), 260);
      setTimeout(() => playSound(1319, 0.8, 'sine', 0.1), 350);
      setTimeout(() => playSound(1568, 0.7, 'sine', 0.08), 440);
      // Sustained power chord
      setTimeout(() => playSound(523, 1.5, 'sine', 0.12), 550);
      setTimeout(() => playSound(784, 1.5, 'sine', 0.1), 550);
      setTimeout(() => playSound(1047, 1.5, 'sine', 0.08), 550);
    } else if (prizeAmount >= 50) {
      // High prize: bright cascade
      setTimeout(() => playSound(440, 0.3, 'triangle', 0.18), 0);
      setTimeout(() => playSound(554, 0.3, 'triangle', 0.18), 100);
      setTimeout(() => playSound(659, 0.4, 'triangle', 0.2), 200);
      setTimeout(() => playSound(880, 0.8, 'triangle', 0.18), 340);
      setTimeout(() => playSound(1100, 0.6, 'sine', 0.06), 440);
    } else if (prizeAmount >= 25) {
      // Medium prize: warm triad
      setTimeout(() => playSound(392, 0.3, 'triangle', 0.16), 0);
      setTimeout(() => playSound(494, 0.3, 'triangle', 0.16), 120);
      setTimeout(() => playSound(587, 0.5, 'triangle', 0.18), 240);
      setTimeout(() => playSound(784, 0.4, 'sine', 0.06), 380);
    } else {
      // Standard prize: simple ascending
      setTimeout(() => playSound(262, 0.3, 'triangle', 0.14), 0);
      setTimeout(() => playSound(330, 0.4, 'triangle', 0.16), 140);
    }
  }, [soundEnabled, playSound]);

  // Derived state
  const qualifying = leaderboardData?.qualifying ?? [];
  const totalTickets = leaderboardData?.totalTickets ?? 0;

  const winnerKingdoms = useMemo(() => {
    const map = new Map<number, CampaignWinner>();
    for (const w of winners) {
      const existing = map.get(w.kingdom_number);
      if (!existing || w.prize_amount > existing.prize_amount) {
        map.set(w.kingdom_number, w);
      }
    }
    return map;
  }, [winners]);

  // Determine current draw order (next undrawn prize)
  const currentDrawOrder = useMemo(() => {
    const drawnOrders = new Set(winners.map(w => w.draw_order));
    const rewards = campaign?.rewards ?? [];
    for (const r of rewards) {
      if (!drawnOrders.has(r.draw_order)) return r.draw_order;
    }
    return rewards.length + 1; // All done
  }, [winners, campaign]);

  const currentPrize = campaign?.rewards.find(r => r.draw_order === currentDrawOrder);
  const allDrawn = !currentPrize;

  // ─── Spin Handler ─────────────────────────────────────────

  const handleSpin = useCallback(() => {
    if (isSpinning || !campaign || !currentPrize || qualifying.length === 0) return;

    // For the draw, we DON'T exclude already-won kingdoms (they can win again → upgrade)
    const weightedKingdoms = qualifying.map(k => ({
      kingdom_number: k.kingdom_number,
      tickets: k.tickets,
    }));

    const result = weightedRandomSelect(weightedKingdoms);
    if (!result) return;

    startSpinSound(); // Continuous spin sound

    const sequence = generateReelSequence(weightedKingdoms, result.kingdom_number, 40);
    setReelSequence(sequence);
    setIsSpinning(true);
    setLastWinner(null);
    setUpgradeMessage(null);
    setShowConfetti(false);
  }, [isSpinning, campaign, currentPrize, qualifying, startSpinSound]);

  // ─── Spin Complete Handler ────────────────────────────────

  const handleSpinComplete = useCallback(async () => {
    setIsSpinning(false);
    stopSpinSound(); // Stop the continuous spin sound
    if (!campaign || !currentPrize || reelSequence.length === 0) return;

    const winningKingdom = reelSequence[reelSequence.length - 1]!;
    const existingWin = winnerKingdoms.get(winningKingdom);

    // Check if this kingdom already won
    if (existingWin) {
      if (currentPrize.amount > existingWin.prize_amount) {
        // UPGRADE: kingdom won a higher prize
        setUpgradeMessage(`UPGRADE! Kingdom ${winningKingdom}: ${formatPrize(existingWin.prize_amount)} → ${formatPrize(currentPrize.amount)}`);
        setLastWinner({ kingdom: winningKingdom, prize: currentPrize.amount, isUpgrade: true });

        if (!testMode) {
          // Delete old winner entry
          await deleteWinner.mutateAsync({ campaignId: campaign.id, drawOrder: existingWin.draw_order });

          // Save new winner at current draw order
          await saveWinner.mutateAsync({
            campaign_id: campaign.id,
            draw_order: currentPrize.draw_order,
            prize_amount: currentPrize.amount,
            kingdom_number: winningKingdom,
            tickets_at_draw: qualifying.find(k => k.kingdom_number === winningKingdom)?.tickets ?? 0,
            total_tickets_at_draw: totalTickets,
            is_upgrade: true,
            upgraded_from_draw: existingWin.draw_order,
            random_seed: reelSequence.join(',').slice(0, 100),
          });

          // Mark the old draw_order as needing re-roll
          setReRollingDraw(existingWin.draw_order);
          setReRollCount(prev => prev + 1);
        }

        playJackpotSound(currentPrize.amount);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      } else {
        // Already won equal or higher — auto-skip, will re-spin
        setUpgradeMessage(`Kingdom ${winningKingdom} already won ${formatPrize(existingWin.prize_amount)} — re-drawing...`);
        playSound(150, 0.3); // Error tone
        setTimeout(() => {
          setUpgradeMessage(null);
          handleSpin(); // Auto re-spin
        }, 2000);
        return;
      }
    } else {
      // Normal win
      setLastWinner({ kingdom: winningKingdom, prize: currentPrize.amount, isUpgrade: false });

      if (!testMode) {
        await saveWinner.mutateAsync({
          campaign_id: campaign.id,
          draw_order: currentPrize.draw_order,
          prize_amount: currentPrize.amount,
          kingdom_number: winningKingdom,
          tickets_at_draw: qualifying.find(k => k.kingdom_number === winningKingdom)?.tickets ?? 0,
          total_tickets_at_draw: totalTickets,
          is_upgrade: false,
          upgraded_from_draw: null,
          random_seed: reelSequence.join(',').slice(0, 100),
        });
      }

      playJackpotSound(currentPrize.amount);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [campaign, currentPrize, reelSequence, winnerKingdoms, testMode, qualifying, totalTickets, deleteWinner, saveWinner, playJackpotSound, playSound, handleSpin, stopSpinSound]);

  // Keyboard shortcut: Spacebar = spin
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpinning && !allDrawn) {
        e.preventDefault();
        handleSpin();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSpin, isSpinning, allDrawn]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Reset draw
  const handleReset = useCallback(async () => {
    if (!campaign) return;
    if (!testMode) {
      await clearAllWinners.mutateAsync(campaign.id);
    }
    setLastWinner(null);
    setUpgradeMessage(null);
    setReRollingDraw(null);
    setReRollCount(0);
    setShowResetConfirm(false);
    setReelSequence([]);
  }, [campaign, testMode, clearAllWinners]);

  // Export results
  const handleExport = useCallback(() => {
    if (!campaign || winners.length === 0) return;
    const text = generateDiscordAnnouncement(
      campaign.name,
      campaign.campaign_number,
      winners,
      totalTickets,
      qualifying.length
    );
    setExportText(text);
    navigator.clipboard.writeText(text).catch(() => {});
  }, [campaign, winners, totalTickets, qualifying]);

  // ─── Auth Guard ─────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ color: '#fff', fontSize: '1.25rem' }}>Admin Only</h2>
          <p style={{ color: '#6b7280' }}>This page is restricted to administrators.</p>
        </div>
      </div>
    );
  }

  if (campaignLoading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
        Loading campaign...
      </div>
    );
  }

  if (!campaign) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
          <h2 style={{ color: '#fff', fontSize: '1.25rem' }}>No Active Campaign</h2>
          <p style={{ color: '#6b7280' }}>Create a campaign in Supabase first.</p>
        </div>
      </div>
    );
  }

  const prizeColor = currentPrize ? getPrizeTierColor(currentPrize.amount) : '#22d3ee';

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a',
      backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(34,211,238,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.04) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(251,191,36,0.03) 0%, transparent 50%)',
      padding: isFullscreen ? '1rem' : '0',
    }}>
      <Confetti color={prizeColor} active={showConfetti} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div>
          <h1 style={{
            fontFamily: "'Cinzel', serif", fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: 0,
          }}>
            KINGDOM <span style={{ color: '#22d3ee' }}>SETTLERS</span>
            <span style={{ color: '#6b7280', fontSize: '0.8rem', fontWeight: 400, marginLeft: 12 }}>LIVE DRAW</span>
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {testMode && (
            <span style={{ background: '#fbbf24', color: '#000', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>
              TEST MODE
            </span>
          )}
          <span style={{
            background: 'rgba(34,211,238,0.1)', color: '#22d3ee',
            padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600,
          }}>
            Campaign #{campaign.campaign_number}
          </span>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        gap: '1rem',
        padding: '1rem 1.5rem',
        maxHeight: 'calc(100vh - 120px)',
      }}>
        {/* Left: Prize Queue */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>
          <PrizeQueue
            rewards={campaign.rewards}
            winners={winners}
            currentDrawOrder={currentDrawOrder}
            reRollingDraw={reRollingDraw}
          />
        </div>

        {/* Right: Slot Machine + Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', justifyContent: 'center' }}>

          {/* Upgrade Message */}
          {upgradeMessage && (
            <div style={{
              background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
              borderRadius: 10, padding: '0.75rem 1.5rem', textAlign: 'center',
              color: '#fbbf24', fontWeight: 700, fontSize: '1.1rem',
              animation: 'upgradeFlash 0.5s ease-out',
            }}>
              {upgradeMessage}
            </div>
          )}

          {/* Current Prize Indicator */}
          {currentPrize && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
                Now Drawing
              </div>
              <div style={{
                fontFamily: "'Orbitron', sans-serif", fontSize: '2rem', fontWeight: 700,
                color: prizeColor,
                textShadow: `0 0 20px ${prizeColor}66`,
              }}>
                {formatPrize(currentPrize.amount)}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                Prize #{currentPrize.draw_order} of {campaign.rewards.length}
              </div>
            </div>
          )}

          {allDrawn && (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</div>
              <div style={{
                fontFamily: "'Cinzel', serif", fontSize: '1.5rem', fontWeight: 700,
                color: '#fbbf24', marginBottom: '0.5rem',
              }}>
                ALL PRIZES DRAWN
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Campaign #{campaign.campaign_number} complete!</div>
            </div>
          )}

          {/* Slot Machine Reel */}
          <SlotReel
            sequence={reelSequence.length > 0 ? reelSequence : (qualifying.length > 0 ? [qualifying[0]!.kingdom_number] : [0])}
            isSpinning={isSpinning}
            duration={rollDuration}
            onComplete={handleSpinComplete}
          />

          {/* Last Winner Display */}
          {lastWinner && !isSpinning && (
            <div style={{
              textAlign: 'center', padding: '0.5rem 1.5rem', borderRadius: 10,
              background: `${getPrizeTierColor(lastWinner.prize)}15`,
              border: `1px solid ${getPrizeTierColor(lastWinner.prize)}33`,
              animation: 'fadeIn 0.5s ease-out',
            }}>
              <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Winner: </span>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>Kingdom {lastWinner.kingdom}</span>
              <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}> → </span>
              <span style={{ color: getPrizeTierColor(lastWinner.prize), fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>
                {formatPrize(lastWinner.prize)}
              </span>
              {lastWinner.isUpgrade && <span style={{ color: '#fbbf24', marginLeft: 8 }}>⬆ UPGRADE</span>}
            </div>
          )}

          {/* Spin Button + Duration Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={handleSpin}
              disabled={isSpinning || allDrawn}
              style={{
                padding: '1rem 3rem', borderRadius: 14, border: 'none',
                background: isSpinning ? '#374151' : allDrawn ? '#1f2937' : `linear-gradient(135deg, ${prizeColor}, ${prizeColor}cc)`,
                color: isSpinning || allDrawn ? '#6b7280' : '#000',
                fontWeight: 700, fontSize: '1.2rem', cursor: isSpinning || allDrawn ? 'not-allowed' : 'pointer',
                fontFamily: "'Orbitron', sans-serif",
                letterSpacing: 2,
                boxShadow: isSpinning || allDrawn ? 'none' : `0 0 30px ${prizeColor}55, 0 0 60px ${prizeColor}22`,
                transition: 'all 0.3s',
                animation: !isSpinning && !allDrawn ? 'spinPulse 2s infinite' : 'none',
              }}
            >
              {isSpinning ? 'SPINNING...' : allDrawn ? 'COMPLETE' : 'SPIN'}
            </button>

            {/* Duration slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>⏱️</span>
              <input
                type="range"
                min={1}
                max={20}
                value={rollDuration}
                onChange={(e) => setRollDuration(Number(e.target.value))}
                disabled={isSpinning}
                style={{ width: 100, accentColor: '#22d3ee' }}
              />
              <span style={{ color: '#9ca3af', fontSize: '0.8rem', fontFamily: "'Orbitron', sans-serif", minWidth: 28 }}>
                {rollDuration}s
              </span>
            </div>
          </div>

          {/* Stats */}
          <DrawStats
            totalTickets={totalTickets}
            qualifyingKingdoms={qualifying.length}
            drawsCompleted={winners.length}
            totalDraws={campaign.rewards.length}
            reRolls={reRollCount}
          />

          {/* Control Bar */}
          <div style={{
            display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center',
            paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <ControlButton icon="🔊" label={soundEnabled ? 'Sound: ON' : 'Sound: OFF'} onClick={() => setSoundEnabled(!soundEnabled)} active={soundEnabled} />
            <ControlButton icon="🖥️" label="Fullscreen" onClick={toggleFullscreen} active={isFullscreen} />
            <ControlButton icon="🧪" label={testMode ? 'Test: ON' : 'Test: OFF'} onClick={() => setTestMode(!testMode)} active={testMode} warning />
            <ControlButton icon="📋" label="Export" onClick={handleExport} disabled={winners.length === 0} />
            <ControlButton icon="🔄" label="Reset" onClick={() => setShowResetConfirm(true)} danger disabled={winners.length === 0 && !testMode} />
          </div>
        </div>
      </div>

      {/* Expandable Qualified Kingdoms */}
      <QualifiedKingdomsPanel qualifying={qualifying} totalTickets={totalTickets} />

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            style={{
              background: '#1a1a2e', borderRadius: 16, padding: '2rem',
              maxWidth: 400, width: '90%', border: '1px solid rgba(239,68,68,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: '#ef4444', fontSize: '1.1rem', marginBottom: '0.75rem' }}>
              ⚠️ Reset All Draw Results?
            </h3>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              This will delete all {winners.length} winner records from the database. This cannot be undone.
              {testMode && <span style={{ color: '#fbbf24' }}> (Test mode — no DB changes)</span>}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #374151', background: 'transparent', color: '#9ca3af', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                style={{ padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {exportText && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}
          onClick={() => setExportText(null)}
        >
          <div
            style={{
              background: '#1a1a2e', borderRadius: 16, padding: '2rem',
              maxWidth: 600, width: '90%', border: '1px solid rgba(34,211,238,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: '#22d3ee', fontSize: '1.1rem', marginBottom: '0.75rem' }}>
              📋 Discord Announcement — Copied!
            </h3>
            <pre style={{
              background: '#0a0a0a', borderRadius: 8, padding: '1rem',
              color: '#d1d5db', fontSize: '0.8rem', whiteSpace: 'pre-wrap',
              maxHeight: 300, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              {exportText}
            </pre>
            <button
              onClick={() => setExportText(null)}
              style={{ marginTop: '1rem', padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: '#22d3ee', color: '#000', fontWeight: 600, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes spinPulse {
          0%, 100% { box-shadow: 0 0 20px ${prizeColor}44; }
          50% { box-shadow: 0 0 30px ${prizeColor}66, 0 0 60px ${prizeColor}22; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes upgradeFlash {
          0% { transform: scale(0.95); opacity: 0; }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// ─── Control Button ───────────────────────────────────────────

const ControlButton: React.FC<{
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  warning?: boolean;
  disabled?: boolean;
}> = ({ icon, label, onClick, active, danger, warning, disabled }) => {
  let borderColor = 'rgba(255,255,255,0.08)';
  if (active && danger) borderColor = 'rgba(239,68,68,0.4)';
  else if (active && warning) borderColor = 'rgba(251,191,36,0.4)';
  else if (active) borderColor = 'rgba(34,211,238,0.4)';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0.4rem 0.75rem', borderRadius: 8,
        border: `1px solid ${borderColor}`,
        background: active ? `${borderColor.replace('0.4', '0.1')}` : 'rgba(255,255,255,0.02)',
        color: disabled ? '#374151' : danger ? '#ef4444' : warning ? '#fbbf24' : '#9ca3af',
        fontSize: '0.75rem', cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s', opacity: disabled ? 0.5 : 1,
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
};

export default AdminCampaignDraw;
