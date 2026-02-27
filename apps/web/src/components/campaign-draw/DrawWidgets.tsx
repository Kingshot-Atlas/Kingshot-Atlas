import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Campaign, CampaignWinner } from '../../hooks/useCampaignQueries';
import { getPrizeTierColor, formatPrize } from '../../utils/campaignUtils';

// ─── Slot Reel Component ──────────────────────────────────────

interface SlotReelProps {
  sequence: number[];
  isSpinning: boolean;
  duration: number; // seconds
  onComplete: () => void;
}

export const SlotReel: React.FC<SlotReelProps> = ({ sequence, isSpinning, duration, onComplete }) => {
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

export const PrizeQueue: React.FC<PrizeQueueProps> = ({ rewards, winners, currentDrawOrder, reRollingDraw }) => {
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
      {[...rewards].reverse().map((r) => {
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

export const DrawStats: React.FC<DrawStatsProps> = ({ totalTickets, qualifyingKingdoms, drawsCompleted, totalDraws, reRolls }) => {
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

export const QualifiedKingdomsPanel: React.FC<{
  qualifying: { kingdom_number: number; tickets: number; atlas_users: number; percentage: number }[];
  totalTickets: number;
}> = ({ qualifying, totalTickets }) => {
  const [expanded, setExpanded] = useState(false);

  if (qualifying.length === 0) return null;

  return (
    <div style={{
      maxWidth: 480, margin: '1rem auto 0', padding: '0 1rem',
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
            display: 'flex', padding: '0.4rem 0.6rem',
            fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ width: 28, textAlign: 'center' }}>#</span>
            <span style={{ flex: 1 }}>Kingdom</span>
            <span style={{ width: 55, textAlign: 'right' }}>Tickets</span>
            <span style={{ width: 55, textAlign: 'right' }}>Chance</span>
          </div>

          {qualifying.map((k, i) => (
            <div
              key={k.kingdom_number}
              style={{
                display: 'flex', alignItems: 'center', padding: '0.35rem 0.6rem',
                fontSize: '0.8rem',
                borderBottom: i < qualifying.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(34,211,238,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ width: 28, textAlign: 'center', color: '#6b7280', fontSize: '0.7rem' }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, color: '#fff', fontWeight: 600 }}>
                Kingdom {k.kingdom_number}
              </span>
              <span style={{ width: 55, textAlign: 'right', color: '#22d3ee', fontWeight: 600, fontFamily: "'Orbitron', sans-serif", fontSize: '0.75rem' }}>
                {k.tickets}
              </span>
              <span style={{ width: 55, textAlign: 'right', color: '#9ca3af', fontSize: '0.7rem' }}>
                {totalTickets > 0 ? `${k.percentage.toFixed(1)}%` : '—'}
              </span>
            </div>
          ))}

          {/* Total row */}
          <div style={{
            display: 'flex', alignItems: 'center', padding: '0.4rem 0.6rem',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
            fontSize: '0.75rem', fontWeight: 700,
          }}>
            <span style={{ width: 28 }} />
            <span style={{ flex: 1, color: '#9ca3af' }}>Total</span>
            <span style={{ width: 55, textAlign: 'right', color: '#22d3ee', fontFamily: "'Orbitron', sans-serif" }}>
              {totalTickets}
            </span>
            <span style={{ width: 55, textAlign: 'right', color: '#9ca3af' }}>100%</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Confetti Effect ──────────────────────────────────────────

export const Confetti: React.FC<{ color: string; active: boolean }> = ({ color, active }) => {
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

// ─── Control Button ───────────────────────────────────────────

export const ControlButton: React.FC<{
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
