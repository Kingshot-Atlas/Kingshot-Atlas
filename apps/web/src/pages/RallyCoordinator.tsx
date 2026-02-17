import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useIsMobile, useIsTablet } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import {
  ALLY_COLOR, ENEMY_COLOR,
  RALLY_COLORS, COUNTER_COLORS,
  CARD, cardHeader, focusRingStyle,
  getBuildingLabel,
  IntervalSlider, GanttChart, PlayerModal, CallOrderOutput,
  QueueDropZone,
  RallyPlayersColumn, BuffConfirmPopup,
  useRallyCoordinator,
} from '../components/rally';

const RallyCoordinator: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle('KvK Battle Planner');
  const isMobile = useIsMobile();

  const isTablet = useIsTablet();
  const rc = useRallyCoordinator();

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<'players' | 'rally' | 'counter'>('players');

  // Tab badge animation — flash when queue counts change from another tab
  const prevRallyCount = useRef(rc.rallyQueue.length);
  const prevCounterCount = useRef(rc.counterQueue.length);
  const [flashRally, setFlashRally] = useState(false);
  const [flashCounter, setFlashCounter] = useState(false);
  useEffect(() => {
    if (rc.rallyQueue.length !== prevRallyCount.current && mobileTab !== 'rally') {
      setFlashRally(true);
      const timer = setTimeout(() => setFlashRally(false), 600);
      prevRallyCount.current = rc.rallyQueue.length;
      return () => clearTimeout(timer);
    }
    prevRallyCount.current = rc.rallyQueue.length;
    return undefined;
  }, [rc.rallyQueue.length, mobileTab]);
  useEffect(() => {
    if (rc.counterQueue.length !== prevCounterCount.current && mobileTab !== 'counter') {
      setFlashCounter(true);
      const timer = setTimeout(() => setFlashCounter(false), 600);
      prevCounterCount.current = rc.counterQueue.length;
      return () => clearTimeout(timer);
    }
    prevCounterCount.current = rc.counterQueue.length;
    return undefined;
  }, [rc.counterQueue.length, mobileTab]);

  // Tab swipe gesture
  const tabOrder: ('players' | 'rally' | 'counter')[] = ['players', 'rally', 'counter'];
  const swipeStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) swipeStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, []);
  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (!swipeStartRef.current) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - swipeStartRef.current.x;
    const dy = touch.clientY - swipeStartRef.current.y;
    const dt = Date.now() - swipeStartRef.current.time;
    swipeStartRef.current = null;
    // Must be horizontal, fast, and far enough
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.7 || dt > 400) return;
    const curIdx = tabOrder.indexOf(mobileTab);
    if (dx < 0 && curIdx < tabOrder.length - 1) setMobileTab(tabOrder[curIdx + 1]!);
    if (dx > 0 && curIdx > 0) setMobileTab(tabOrder[curIdx - 1]!);
  }, [mobileTab]);

  // Loading state while checking access
  if (rc.hasAccess === null) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Loading...</div>
      </div>
    );
  }

  // No access — coming soon gate
  if (!rc.hasAccess) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '440px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>⚔️</div>
          <h2 style={{ color: '#fff', fontSize: '1.5rem', fontFamily: FONT_DISPLAY, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
            <span style={{ color: '#fff' }}>KvK BATTLE </span>
            <span style={neonGlow('#ef4444')}>PLANNER</span>
          </h2>
          <div style={{
            display: 'inline-block', padding: '0.25rem 0.75rem', marginBottom: '1rem',
            backgroundColor: '#ef444420', border: '1px solid #ef444440', borderRadius: '20px',
            fontSize: '0.7rem', fontWeight: '700', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {t('battlePlanner.accessRequired', 'Gold Tier Required')}
          </div>
          <p style={{ color: '#9ca3af', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {t('rallyCoordinator.accessDeniedDesc', 'Coordinate multi-rally strikes with surgical precision. The Battle Planner is available for Gold Tier kingdoms, editors, and admins.')}
          </p>
          <Link to="/tools" style={{
            display: 'inline-block', padding: '0.6rem 1.5rem',
            backgroundColor: '#ef444420', border: '1px solid #ef444450', borderRadius: '8px',
            color: '#ef4444', textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem',
          }}>
            {t('rallyCoordinator.backToTools', '← Back to Tools')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hero */}
      <div style={{
        padding: isMobile ? '1rem 0.75rem 0.75rem' : '1.25rem 2rem 1rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Link to="/tools" style={{ color: '#9ca3af', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}>
            {t('rallyCoordinator.backToTools')}
          </Link>
          <h1 style={{
            fontSize: isMobile ? '1.3rem' : '1.75rem', fontWeight: 'bold',
            fontFamily: FONT_DISPLAY, letterSpacing: '0.05em', marginBottom: '0.3rem',
          }}>
            <span style={{ color: '#fff' }}>{t('rallyCoordinator.title')}</span>
            <span style={{ ...neonGlow('#ef4444'), marginLeft: '0.4rem' }}>{t('rallyCoordinator.titleAccent')}</span>
          </h1>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.75rem' : '0.9rem' }}>
            {t('rallyCoordinator.subtitle')}
          </p>
        </div>
      </div>

      {/* Keyframes + focus ring styles + reduced-motion support */}
      <style>{`
        @keyframes buffTimerPulse {
          0%, 100% { box-shadow: 0 0 8px #f59e0b30; }
          50% { box-shadow: 0 0 14px #f59e0b50; }
        }
        @keyframes tabBadgeFlash {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); filter: brightness(1.4); }
          100% { transform: scale(1); }
        }
        @keyframes dropZonePulse {
          0%, 100% { border-color: #2a2a2a; box-shadow: none; }
          50% { border-color: #4b5563; box-shadow: inset 0 0 12px #ffffff06; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
        @media (forced-colors: active) {
          .rally-focusable:focus-visible {
            outline: 2px solid CanvasText !important;
          }
          button, [role="button"] {
            border: 1px solid ButtonText !important;
          }
        }
        ${focusRingStyle}
      `}</style>

      {/* Main Content — 3x3 Grid */}
      {/* Screen reader announcements for queue changes */}
      <div aria-live="polite" aria-atomic="true" style={{
        position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
        overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
      }}>
        {rc.lastAnnouncement}
      </div>
      <div role="main" style={{
        maxWidth: '1400px', margin: '0 auto',
        padding: isMobile ? '0.5rem' : '0.75rem 1.5rem 2rem',
      }}>
        {/* Mobile Tab Bar */}
        {isMobile && (
          <>
            <div role="tablist" aria-label="Battle planner sections" style={{
              display: 'flex', gap: '4px', marginBottom: '0.5rem',
              position: 'sticky', top: 0, zIndex: 20,
              backgroundColor: '#0a0a0a', padding: '0.5rem 0',
              borderBottom: '1px solid #1a1a1a',
            }}>
              {([
                { key: 'players' as const, label: t('battlePlanner.tabPlayers', 'Players'), icon: '👥', color: '#fff', count: rc.players.length, flash: false },
                { key: 'rally' as const, label: t('battlePlanner.tabRally', 'Rally'), icon: '⚔️', color: ALLY_COLOR, count: rc.rallyQueue.length, flash: flashRally },
                { key: 'counter' as const, label: t('battlePlanner.tabCounter', 'Counter'), icon: '🛡️', color: ENEMY_COLOR, count: rc.counterQueue.length, flash: flashCounter },
              ]).map(tab => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={mobileTab === tab.key}
                  aria-controls={`panel-${tab.key}`}
                  className="rally-focusable"
                  onClick={() => setMobileTab(tab.key)}
                  style={{
                    flex: 1, padding: '0.5rem 0.25rem',
                    backgroundColor: mobileTab === tab.key ? `${tab.color}15` : 'transparent',
                    border: `1px solid ${mobileTab === tab.key ? `${tab.color}50` : '#2a2a2a'}`,
                    borderRadius: '10px', cursor: 'pointer',
                    color: mobileTab === tab.key ? tab.color : '#9ca3af',
                    fontSize: '0.75rem', fontWeight: '700',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                    minHeight: '52px', justifyContent: 'center',
                    transition: 'all 0.2s',
                    animation: tab.flash ? 'tabBadgeFlash 0.6s ease' : 'none',
                  }}
                >
                  <span style={{ fontSize: '1rem' }} aria-hidden="true">{tab.icon}</span>
                  <span>{tab.label}{tab.count > 0 ? ` (${tab.count})` : ''}</span>
                </button>
              ))}
            </div>
            {/* Mobile context bar — shows building + queue info on Rally/Counter tabs */}
            {mobileTab !== 'players' && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.35rem 0.6rem', marginBottom: '0.5rem',
                backgroundColor: '#111111', borderRadius: '8px',
                border: '1px solid #2a2a2a', fontSize: '0.7rem',
              }}>
                <span style={{ color: '#9ca3af' }}>
                  🏰 {getBuildingLabel(rc.selectedBuilding, t)}
                </span>
                <span style={{ color: '#6b7280' }}>
                  ⚔️ {rc.rallyQueue.length} &nbsp;|&nbsp; 🛡️ {rc.counterQueue.length}
                </span>
              </div>
            )}
          </>
        )}

        <div
          onTouchStart={isMobile ? handleSwipeStart : undefined}
          onTouchEnd={isMobile ? handleSwipeEnd : undefined}
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : '1fr 1fr 1fr',
            gap: '0.75rem',
          }}
        >

          {/* ===== COLUMN 1: PLAYERS ===== */}
          {(!isMobile || mobileTab === 'players') && <RallyPlayersColumn
            allies={rc.allies}
            enemies={rc.enemies}
            players={rc.players}
            selectedBuilding={rc.selectedBuilding}
            setSelectedBuilding={rc.setSelectedBuilding}
            marchType={rc.marchType}
            setMarchType={rc.setMarchType}
            queuedPlayerIds={rc.queuedPlayerIds}
            counterQueuedIds={rc.counterQueuedIds}
            buffTimers={rc.buffTimers}
            presets={rc.presets}
            presetName={rc.presetName}
            setPresetName={rc.setPresetName}
            showPresetSave={rc.showPresetSave}
            setShowPresetSave={rc.setShowPresetSave}
            howToOpen={rc.howToOpen}
            setHowToOpen={rc.setHowToOpen}
            rallyQueue={rc.rallyQueue}
            isMobile={isMobile}
            onAddAlly={() => { rc.setEditingPlayer(null); rc.setDefaultTeam('ally'); rc.setPlayerModalOpen(true); }}
            onAddEnemy={() => { rc.setEditingPlayer(null); rc.setDefaultTeam('enemy'); rc.setPlayerModalOpen(true); }}
            onAddToQueue={rc.addToQueue}
            onAddToCounterQueue={rc.addToCounterQueue}
            onEditPlayer={(p, team) => { rc.setEditingPlayer(p); rc.setDefaultTeam(team); rc.setPlayerModalOpen(true); }}
            onDeletePlayer={rc.handleDeletePlayer}
            onSavePreset={rc.savePreset}
            onLoadPreset={rc.loadPreset}
            onDeletePreset={rc.deletePreset}
            onExportPlayers={rc.exportPlayers}
            onImportPlayers={rc.importPlayers}
            onDuplicatePlayer={rc.duplicatePlayer}
          />}

          {/* ===== COLUMN 2: RALLY ===== */}
          {(!isMobile || mobileTab === 'rally') && <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

            {/* Rally Queue */}
            <QueueDropZone
              queue={rc.rallyQueue}
              onDrop={rc.handleDrop}
              onRemove={rc.removeFromQueue}
              onMove={rc.moveInQueue}
              onToggleBuff={(i: number) => rc.toggleBuff('rally', i)}
              onClear={rc.clearQueue}
              queueType="rally"
              title={`⚔️ RALLY QUEUE — ${getBuildingLabel(rc.selectedBuilding, t)}`}
              accent={ALLY_COLOR}
              colors={RALLY_COLORS}
              minPlayers={2}
              isMobile={isMobile}
              buffTimers={rc.buffTimers}
              tickNow={rc.tickNow}
              touchDrag={rc.rallyTouchDrag}
              scrollRef={rc.rallyQueueRef}
            />

            {/* 📢 RALLY CALL ORDER */}
            {rc.calculatedRallies.length >= 2 ? (
              <CallOrderOutput
                rallies={rc.calculatedRallies}
                building={rc.selectedBuilding}
                isMobile={isMobile}
                title="📢 RALLY ORDER"
                colors={RALLY_COLORS}
                accentColor={ALLY_COLOR}
              />
            ) : (
              <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100px' }}>
                <p style={{ color: '#9ca3af', fontSize: '0.75rem', textAlign: 'center' }}>
                  {t('rallyCoordinator.addToRallyQueue')}
                </p>
              </div>
            )}

            {/* ⚔️ RALLY CONFIGURATION + RALLY TIMELINE (touching) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ ...CARD, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
                <h4 style={cardHeader(ALLY_COLOR)}>⚔️ RALLY CONFIGURATION</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => { rc.setHitMode('simultaneous'); }} className="rally-focusable" aria-pressed={rc.hitMode === 'simultaneous'} style={{
                      flex: 1, padding: '0.3rem', minHeight: '32px',
                      backgroundColor: rc.hitMode === 'simultaneous' ? `${ALLY_COLOR}20` : 'transparent',
                      border: `1px solid ${rc.hitMode === 'simultaneous' ? `${ALLY_COLOR}50` : '#2a2a2a'}`,
                      borderRadius: '7px', cursor: 'pointer',
                      color: rc.hitMode === 'simultaneous' ? ALLY_COLOR : '#9ca3af',
                      fontSize: '0.65rem', fontWeight: '600',
                    }}>
                      💥 {t('rallyCoordinator.simultaneous')}
                    </button>
                    <button onClick={() => { rc.setHitMode('interval'); if (rc.interval < 1) rc.setInterval(1); }} className="rally-focusable" aria-pressed={rc.hitMode === 'interval'} style={{
                      flex: 1, padding: '0.3rem', minHeight: '32px',
                      backgroundColor: rc.hitMode === 'interval' ? `${ALLY_COLOR}20` : 'transparent',
                      border: `1px solid ${rc.hitMode === 'interval' ? `${ALLY_COLOR}50` : '#2a2a2a'}`,
                      borderRadius: '7px', cursor: 'pointer',
                      color: rc.hitMode === 'interval' ? ALLY_COLOR : '#9ca3af',
                      fontSize: '0.65rem', fontWeight: '600',
                    }}>
                      🔗 {t('rallyCoordinator.chainHits')}
                    </button>
                  </div>
                  {rc.hitMode === 'interval' && (
                    <IntervalSlider value={rc.interval} onChange={rc.setInterval} accentColor={ALLY_COLOR} />
                  )}
                </div>
              </div>
              {rc.calculatedRallies.length >= 2 ? (
                <>
                  <div style={{
                    display: 'flex', justifyContent: 'space-around', padding: '0.35rem 0.5rem',
                    backgroundColor: '#0a0a0a', borderLeft: '1px solid #2a2a2a', borderRight: '1px solid #2a2a2a',
                    fontSize: '0.6rem', color: '#9ca3af',
                  }}>
                    <span>👥 {rc.rallyQueue.length} players</span>
                    <span>⏱ avg {Math.round(rc.rallyQueue.reduce((s, q) => s + q.marchTime, 0) / rc.rallyQueue.length)}s</span>
                    <span>🎯 {rc.calculatedRallies.length >= 2
                      ? `${Math.round((rc.calculatedRallies[rc.calculatedRallies.length - 1]?.arrivalTime ?? 0) - (rc.calculatedRallies[0]?.arrivalTime ?? 0))}s window`
                      : '—'}</span>
                  </div>
                  <div style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, overflow: 'hidden' }}>
                    <GanttChart
                      rallies={rc.calculatedRallies}
                      isMobile={isMobile}
                      title="⚔️ RALLY TIMELINE"
                      colors={RALLY_COLORS}
                    />
                  </div>
                </>
              ) : (
                <div style={{ ...CARD, borderTopLeftRadius: 0, borderTopRightRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80px' }}>
                  <p style={{ color: '#9ca3af', fontSize: '0.75rem', textAlign: 'center' }}>
                    {t('rallyCoordinator.rallyTimelineEmpty')}
                  </p>
                </div>
              )}
            </div>

          </div>}

          {/* ===== COLUMN 3: COUNTER ===== */}
          {(!isMobile || mobileTab === 'counter') && <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

            {/* 🛡️ COUNTER QUEUE */}
            <QueueDropZone
              queue={rc.counterQueue}
              onDrop={rc.handleCounterDrop}
              onRemove={rc.removeFromCounterQueue}
              onMove={rc.moveInCounterQueue}
              onToggleBuff={(i: number) => rc.toggleBuff('counter', i)}
              onClear={rc.clearCounterQueue}
              queueType="counter"
              title={`🛡️ COUNTER QUEUE — ${getBuildingLabel(rc.selectedBuilding, t)}`}
              accent={ENEMY_COLOR}
              colors={COUNTER_COLORS}
              minPlayers={1}
              isMobile={isMobile}
              buffTimers={rc.buffTimers}
              tickNow={rc.tickNow}
              touchDrag={rc.counterTouchDrag}
              scrollRef={rc.counterQueueRef}
            />

            {/* 📢 COUNTER CALL ORDER */}
            {rc.calculatedCounters.length >= 1 ? (
              <CallOrderOutput
                rallies={rc.calculatedCounters}
                building={rc.selectedBuilding}
                isMobile={isMobile}
                title="📢 COUNTER ORDER"
                colors={COUNTER_COLORS}
                accentColor={ENEMY_COLOR}
              />
            ) : (
              <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100px' }}>
                <p style={{ color: '#9ca3af', fontSize: '0.75rem', textAlign: 'center' }}>
                  {t('rallyCoordinator.addToCounterQueue')}
                </p>
              </div>
            )}

            {/* 🛡️ COUNTER CONFIGURATION + COUNTER TIMELINE (touching) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ ...CARD, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
                <h4 style={cardHeader(ENEMY_COLOR)}>🛡️ COUNTER CONFIGURATION</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => { rc.setCounterHitMode('simultaneous'); }} className="rally-focusable" aria-pressed={rc.counterHitMode === 'simultaneous'} style={{
                      flex: 1, padding: '0.3rem', minHeight: '32px',
                      backgroundColor: rc.counterHitMode === 'simultaneous' ? `${ENEMY_COLOR}20` : 'transparent',
                      border: `1px solid ${rc.counterHitMode === 'simultaneous' ? `${ENEMY_COLOR}50` : '#2a2a2a'}`,
                      borderRadius: '7px', cursor: 'pointer',
                      color: rc.counterHitMode === 'simultaneous' ? ENEMY_COLOR : '#9ca3af',
                      fontSize: '0.65rem', fontWeight: '600',
                    }}>
                      💥 {t('rallyCoordinator.simultaneous')}
                    </button>
                    <button onClick={() => { rc.setCounterHitMode('interval'); if (rc.counterInterval < 1) rc.setCounterInterval(1); }} className="rally-focusable" aria-pressed={rc.counterHitMode === 'interval'} style={{
                      flex: 1, padding: '0.3rem', minHeight: '32px',
                      backgroundColor: rc.counterHitMode === 'interval' ? `${ENEMY_COLOR}20` : 'transparent',
                      border: `1px solid ${rc.counterHitMode === 'interval' ? `${ENEMY_COLOR}50` : '#2a2a2a'}`,
                      borderRadius: '7px', cursor: 'pointer',
                      color: rc.counterHitMode === 'interval' ? ENEMY_COLOR : '#9ca3af',
                      fontSize: '0.65rem', fontWeight: '600',
                    }}>
                      🔗 {t('rallyCoordinator.chainHits')}
                    </button>
                  </div>
                  {rc.counterHitMode === 'interval' && (
                    <IntervalSlider value={rc.counterInterval} onChange={rc.setCounterInterval} accentColor={ENEMY_COLOR} />
                  )}
                  {/* Counter auto-timing: arrive X seconds after enemy */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    marginTop: '0.3rem', padding: '0.3rem 0.4rem',
                    backgroundColor: rc.counterAutoOffset > 0 ? `${ENEMY_COLOR}10` : 'transparent',
                    border: `1px solid ${rc.counterAutoOffset > 0 ? `${ENEMY_COLOR}30` : '#1a1a1a'}`,
                    borderRadius: '7px',
                  }}>
                    <span style={{ color: '#9ca3af', fontSize: '0.6rem', whiteSpace: 'nowrap' }}>
                      {t('rallyCoordinator.arriveAfter', 'Arrive')}
                    </span>
                    <input
                      type="number" min="0" max="30"
                      value={rc.counterAutoOffset || ''}
                      onChange={e => rc.setCounterAutoOffset(Math.max(0, Math.min(30, parseInt(e.target.value) || 0)))}
                      placeholder="0"
                      style={{
                        width: '42px', padding: '0.15rem 0.25rem',
                        backgroundColor: '#0a0a0a', border: `1px solid ${rc.counterAutoOffset > 0 ? `${ENEMY_COLOR}40` : '#2a2a2a'}`,
                        borderRadius: '4px', color: rc.counterAutoOffset > 0 ? ENEMY_COLOR : '#9ca3af',
                        fontSize: '0.7rem', fontWeight: 600, textAlign: 'center',
                      }}
                    />
                    <span style={{ color: '#9ca3af', fontSize: '0.6rem', whiteSpace: 'nowrap' }}>
                      {t('rallyCoordinator.secondsAfterEnemy', 's after rally hits')}
                    </span>
                  </div>
                </div>
              </div>
              {rc.calculatedCounters.length >= 1 ? (
                <>
                  <div style={{
                    display: 'flex', justifyContent: 'space-around', padding: '0.35rem 0.5rem',
                    backgroundColor: '#0a0a0a', borderLeft: '1px solid #2a2a2a', borderRight: '1px solid #2a2a2a',
                    fontSize: '0.6rem', color: '#9ca3af',
                  }}>
                    <span>👥 {rc.counterQueue.length} players</span>
                    <span>⏱ avg {Math.round(rc.counterQueue.reduce((s, q) => s + q.marchTime, 0) / rc.counterQueue.length)}s</span>
                    <span>🎯 {rc.calculatedCounters.length >= 2
                      ? `${Math.round((rc.calculatedCounters[rc.calculatedCounters.length - 1]?.arrivalTime ?? 0) - (rc.calculatedCounters[0]?.arrivalTime ?? 0))}s window`
                      : '—'}</span>
                  </div>
                  <div style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, overflow: 'hidden' }}>
                    <GanttChart
                      rallies={rc.calculatedCounters}
                      isMobile={isMobile}
                      title="🛡️ COUNTER TIMELINE"
                      colors={COUNTER_COLORS}
                    />
                  </div>
                </>
              ) : (
                <div style={{ ...CARD, borderTopLeftRadius: 0, borderTopRightRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80px' }}>
                  <p style={{ color: '#9ca3af', fontSize: '0.75rem', textAlign: 'center' }}>
                    {t('rallyCoordinator.counterTimelineEmpty')}
                  </p>
                </div>
              )}
            </div>

          </div>}
        </div>

        {/* Slow march warning */}
        {(rc.rallyQueue.some(s => s.marchTime > 100) || rc.counterQueue.some(s => s.marchTime > 100)) && (
          <div style={{
            padding: '0.4rem 0.6rem', backgroundColor: '#f59e0b10',
            border: '1px solid #f59e0b25', borderRadius: '8px', marginTop: '0.75rem',
          }}>
            <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>
              ⚠️ {t('rallyCoordinator.slowMarchWarning')}
            </span>
          </div>
        )}
      </div>

      {/* Community credit */}
      <div style={{
        marginTop: '2rem', paddingTop: '1rem', paddingBottom: '2rem',
        textAlign: 'center',
      }}>
        <p style={{
          display: 'inline-block', maxWidth: '420px',
          padding: '0.5rem 1rem', borderRadius: '20px',
          border: '1px solid #22d3ee25', backgroundColor: '#22d3ee08',
          color: '#6b7280', fontSize: '0.8rem', letterSpacing: '0.03em', lineHeight: 1.6,
          margin: 0,
        }}>
          ⚔️ {t('battlePlanner.communityCredit', 'Huge shoutout to')}{' '}
          <Link
            to="/profile/57d266cf-9800-4a7d-a8a5-f2cbc616bc22"
            style={{ color: '#22d3ee', textDecoration: 'none', fontWeight: '600', fontFamily: FONT_DISPLAY }}
          >bAdClimber</Link>{' '}
          {t('battlePlanner.communityCreditSuffix', 'for rallying this idea into existence. Built by the community, for the community.')}
        </p>
      </div>

      {/* Modal */}
      <PlayerModal
        isOpen={rc.playerModalOpen}
        onClose={() => { rc.setPlayerModalOpen(false); rc.setEditingPlayer(null); }}
        onSave={rc.handleSavePlayer}
        editingPlayer={rc.editingPlayer}
        defaultTeam={rc.defaultTeam}
      />

      {/* Buff timer confirmation popup */}
      {rc.buffConfirmPopup && (
        <BuffConfirmPopup
          onCancel={() => rc.setBuffConfirmPopup(null)}
          onConfirm={() => {
            if (rc.buffConfirmPopup) {
              rc.toggleBuff(rc.buffConfirmPopup.queueType, rc.buffConfirmPopup.index, true);
            }
            rc.setBuffConfirmPopup(null);
          }}
        />
      )}
    </div>
  );
};

export default RallyCoordinator;
