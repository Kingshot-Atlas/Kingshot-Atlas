import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
import type { CampaignWinner } from '../hooks/useCampaignQueries';
import {
  weightedRandomSelect,
  getPrizeTierColor,
  formatPrize,
  generateReelSequence,
  generateDiscordAnnouncement,
} from '../utils/campaignUtils';
import { useCampaignAudio } from '../hooks/useCampaignAudio';
import { SlotReel, PrizeQueue, DrawStats, QualifiedKingdomsPanel, Confetti, ControlButton } from '../components/campaign-draw/DrawWidgets';

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

  // Audio (extracted to custom hook)
  const { playSound, startSpinSound, stopSpinSound, playJackpotSound } = useCampaignAudio(soundEnabled, rollDuration);

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

export default AdminCampaignDraw;
