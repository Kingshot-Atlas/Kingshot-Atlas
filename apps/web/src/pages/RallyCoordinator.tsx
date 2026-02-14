import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import {
  BUILDING_LABELS, ALLY_COLOR, ENEMY_COLOR,
  RALLY_COLORS, COUNTER_COLORS,
  CARD, cardHeader,
  IntervalSlider, GanttChart, PlayerModal, CallOrderOutput,
  QueueDropZone,
  RallyPlayersColumn, BuffConfirmPopup,
  useRallyCoordinator,
} from '../components/rally';

const RallyCoordinator: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle('KvK Battle Planner');
  const isMobile = useIsMobile();

  const rc = useRallyCoordinator();

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
            <span style={neonGlow('#ef4444')}>COORDINATOR</span>
          </h2>
          <div style={{
            display: 'inline-block', padding: '0.25rem 0.75rem', marginBottom: '1rem',
            backgroundColor: '#ef444420', border: '1px solid #ef444440', borderRadius: '20px',
            fontSize: '0.7rem', fontWeight: '700', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {t('common.comingSoon', 'Coming Soon')}
          </div>
          <p style={{ color: '#9ca3af', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {t('rallyCoordinator.comingSoonDesc', 'Coordinate multi-rally strikes with surgical precision. Set march times, call orders, and hit windows — so your alliance lands together, every time. Currently in development.')}
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

      {/* Keyframes for buff timer pulse */}
      <style>{`
        @keyframes buffTimerPulse {
          0%, 100% { box-shadow: 0 0 8px #f59e0b30; }
          50% { box-shadow: 0 0 14px #f59e0b50; }
        }
      `}</style>

      {/* Main Content — 3x3 Grid */}
      <div style={{
        maxWidth: '1400px', margin: '0 auto',
        padding: isMobile ? '0.5rem' : '0.75rem 1.5rem 2rem',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
          gap: isMobile ? '0.75rem' : '0.75rem',
        }}>

          {/* ===== COLUMN 1 ===== */}
          <RallyPlayersColumn
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
          />

          {/* ===== COLUMN 2 ===== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '0.75rem' }}>

            {/* Rally Queue */}
            <QueueDropZone
              queue={rc.rallyQueue}
              onDrop={rc.handleDrop}
              onRemove={rc.removeFromQueue}
              onMove={rc.moveInQueue}
              onToggleBuff={(i: number) => rc.toggleBuff('rally', i)}
              onClear={rc.clearQueue}
              queueType="rally"
              title={`⚔️ RALLY QUEUE — ${BUILDING_LABELS[rc.selectedBuilding]}`}
              accent={ALLY_COLOR}
              colors={RALLY_COLORS}
              minPlayers={2}
              isMobile={isMobile}
              buffTimers={rc.buffTimers}
              tickNow={rc.tickNow}
              touchDrag={rc.rallyTouchDrag}
            />

            {/* 📢 RALLY CALL ORDER */}
            {rc.calculatedRallies.length >= 2 ? (
              <CallOrderOutput
                rallies={rc.calculatedRallies}
                building={rc.selectedBuilding}
                gap={rc.gap}
                isMobile={isMobile}
                title="📢 RALLY CALL ORDER"
                colors={RALLY_COLORS}
                accentColor={ALLY_COLOR}
              />
            ) : (
              <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100px' }}>
                <p style={{ color: '#4b5563', fontSize: '0.75rem', textAlign: 'center' }}>
                  Add 2+ players to Rally Queue<br />to generate call order
                </p>
              </div>
            )}

            {/* ⚔️ RALLY CONFIGURATION + RALLY TIMELINE (touching) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ ...CARD, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
                <h4 style={cardHeader(ALLY_COLOR)}>⚔️ RALLY CONFIGURATION</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => { rc.setHitMode('simultaneous'); }} style={{
                      flex: 1, padding: '0.3rem',
                      backgroundColor: rc.hitMode === 'simultaneous' ? `${ALLY_COLOR}20` : 'transparent',
                      border: `1px solid ${rc.hitMode === 'simultaneous' ? `${ALLY_COLOR}50` : '#2a2a2a'}`,
                      borderRadius: '7px', cursor: 'pointer',
                      color: rc.hitMode === 'simultaneous' ? ALLY_COLOR : '#6b7280',
                      fontSize: '0.65rem', fontWeight: '600',
                    }}>
                      💥 Simultaneous
                    </button>
                    <button onClick={() => { rc.setHitMode('interval'); if (rc.interval < 1) rc.setInterval(1); }} style={{
                      flex: 1, padding: '0.3rem',
                      backgroundColor: rc.hitMode === 'interval' ? `${ALLY_COLOR}20` : 'transparent',
                      border: `1px solid ${rc.hitMode === 'interval' ? `${ALLY_COLOR}50` : '#2a2a2a'}`,
                      borderRadius: '7px', cursor: 'pointer',
                      color: rc.hitMode === 'interval' ? ALLY_COLOR : '#6b7280',
                      fontSize: '0.65rem', fontWeight: '600',
                    }}>
                      🔗 Chain Hits
                    </button>
                  </div>
                  {rc.hitMode === 'interval' && (
                    <IntervalSlider value={rc.interval} onChange={rc.setInterval} accentColor={ALLY_COLOR} />
                  )}
                </div>
              </div>
              {rc.calculatedRallies.length >= 2 ? (
                <div style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, overflow: 'hidden' }}>
                  <GanttChart
                    rallies={rc.calculatedRallies}
                    isMobile={isMobile}
                    title="⚔️ RALLY TIMELINE"
                    colors={RALLY_COLORS}
                  />
                </div>
              ) : (
                <div style={{ ...CARD, borderTopLeftRadius: 0, borderTopRightRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80px' }}>
                  <p style={{ color: '#4b5563', fontSize: '0.75rem', textAlign: 'center' }}>
                    Rally timeline appears here once you queue 2+ players
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* ===== COLUMN 3 ===== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '0.75rem' }}>

            {/* 🛡️ COUNTER QUEUE */}
            <QueueDropZone
              queue={rc.counterQueue}
              onDrop={rc.handleCounterDrop}
              onRemove={rc.removeFromCounterQueue}
              onMove={rc.moveInCounterQueue}
              onToggleBuff={(i: number) => rc.toggleBuff('counter', i)}
              onClear={rc.clearCounterQueue}
              queueType="counter"
              title={`🛡️ COUNTER QUEUE — ${BUILDING_LABELS[rc.selectedBuilding]}`}
              accent={ENEMY_COLOR}
              colors={COUNTER_COLORS}
              minPlayers={1}
              isMobile={isMobile}
              buffTimers={rc.buffTimers}
              tickNow={rc.tickNow}
              touchDrag={rc.counterTouchDrag}
            />

            {/* 📢 COUNTER CALL ORDER */}
            {rc.calculatedCounters.length >= 1 ? (
              <CallOrderOutput
                rallies={rc.calculatedCounters}
                building={rc.selectedBuilding}
                gap={rc.cGap}
                isMobile={isMobile}
                title="📢 COUNTER CALL ORDER"
                colors={COUNTER_COLORS}
                accentColor={ENEMY_COLOR}
              />
            ) : (
              <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100px' }}>
                <p style={{ color: '#4b5563', fontSize: '0.75rem', textAlign: 'center' }}>
                  Add players to Counter Queue<br />to generate counter timing
                </p>
              </div>
            )}

            {/* 🛡️ COUNTER CONFIGURATION + COUNTER TIMELINE (touching) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ ...CARD, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
                <h4 style={cardHeader(ENEMY_COLOR)}>🛡️ COUNTER CONFIGURATION</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => { rc.setCounterHitMode('simultaneous'); }} style={{
                      flex: 1, padding: '0.3rem',
                      backgroundColor: rc.counterHitMode === 'simultaneous' ? `${ENEMY_COLOR}20` : 'transparent',
                      border: `1px solid ${rc.counterHitMode === 'simultaneous' ? `${ENEMY_COLOR}50` : '#2a2a2a'}`,
                      borderRadius: '7px', cursor: 'pointer',
                      color: rc.counterHitMode === 'simultaneous' ? ENEMY_COLOR : '#6b7280',
                      fontSize: '0.65rem', fontWeight: '600',
                    }}>
                      💥 Simultaneous
                    </button>
                    <button onClick={() => { rc.setCounterHitMode('interval'); if (rc.counterInterval < 1) rc.setCounterInterval(1); }} style={{
                      flex: 1, padding: '0.3rem',
                      backgroundColor: rc.counterHitMode === 'interval' ? `${ENEMY_COLOR}20` : 'transparent',
                      border: `1px solid ${rc.counterHitMode === 'interval' ? `${ENEMY_COLOR}50` : '#2a2a2a'}`,
                      borderRadius: '7px', cursor: 'pointer',
                      color: rc.counterHitMode === 'interval' ? ENEMY_COLOR : '#6b7280',
                      fontSize: '0.65rem', fontWeight: '600',
                    }}>
                      🔗 Chain Hits
                    </button>
                  </div>
                  {rc.counterHitMode === 'interval' && (
                    <IntervalSlider value={rc.counterInterval} onChange={rc.setCounterInterval} accentColor={ENEMY_COLOR} />
                  )}
                </div>
              </div>
              {rc.calculatedCounters.length >= 1 ? (
                <div style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, overflow: 'hidden' }}>
                  <GanttChart
                    rallies={rc.calculatedCounters}
                    isMobile={isMobile}
                    title="🛡️ COUNTER TIMELINE"
                    colors={COUNTER_COLORS}
                  />
                </div>
              ) : (
                <div style={{ ...CARD, borderTopLeftRadius: 0, borderTopRightRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80px' }}>
                  <p style={{ color: '#4b5563', fontSize: '0.75rem', textAlign: 'center' }}>
                    Counter timeline appears when you have players queued
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Slow march warning */}
        {(rc.rallyQueue.some(s => s.marchTime > 100) || rc.counterQueue.some(s => s.marchTime > 100)) && (
          <div style={{
            padding: '0.4rem 0.6rem', backgroundColor: '#f59e0b10',
            border: '1px solid #f59e0b25', borderRadius: '8px', marginTop: '0.75rem',
          }}>
            <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>
              ⚠️ Some players have march times over 100s — double-check those values.
            </span>
          </div>
        )}
      </div>

      {/* Community credit */}
      <div style={{
        marginTop: '2rem', paddingTop: '1rem', paddingBottom: '2rem',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.4rem 0.85rem', borderRadius: '20px',
          border: '1px solid #22d3ee25', backgroundColor: '#22d3ee08',
        }}>
          <span style={{ color: '#6b7280', fontSize: '0.8rem', letterSpacing: '0.03em' }}>
            ⚔️ {t('battlePlanner.communityCredit', 'Huge shoutout to')}
          </span>
          <Link
            to="/profile/57d266cf-9800-4a7d-a8a5-f2cbc616bc22"
            style={{ color: '#22d3ee', textDecoration: 'none', fontWeight: '600', fontFamily: FONT_DISPLAY, fontSize: '0.8rem' }}
          >
            bAdClimber
          </Link>
          <span style={{ color: '#6b7280', fontSize: '0.8rem', letterSpacing: '0.03em' }}>
            {t('battlePlanner.communityCreditSuffix', 'for rallying this idea into existence. Built by the community, for the community.')}
          </span>
        </div>
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
