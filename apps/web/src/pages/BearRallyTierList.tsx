import React from 'react';
import BackLink from '../components/shared/BackLink';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { FONT_DISPLAY } from '../utils/styles';
import { useTranslation } from 'react-i18next';
import {
  isPlayerComplete,
  assignBearTier,
  BEAR_DISCLAIMER_KEY,
  BEAR_DISCLAIMER_DEFAULT,
  type BearPlayerEntry,
} from '../data/bearHuntData';
import { useBearRallyState, emptyForm } from '../hooks/useBearRallyState';
import BearBulkInput from '../components/bear/BearBulkInput';
import BearBulkEdit from '../components/bear/BearBulkEdit';
import BearListManager from '../components/bear/BearListManager';
import BearPlayerForm from '../components/bear/BearPlayerForm';
import BearTierTable from '../components/bear/BearTierTable';
import BearTierCutoffEditor from '../components/bear/BearTierCutoffEditor';

// ─── Constants ──────────────────────────────────────────────────────────────

const ACCENT = '#3b82f6'; // Blue theme for alliance tools

// ─── Component ──────────────────────────────────────────────────────────────

const BearRallyTierList: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  useDocumentTitle(t('bearRally.pageTitle', 'Bear Rally Tier List — Kingshot Atlas'));
  useMetaTags({
    title: t('bearRally.pageTitle', 'Bear Rally Tier List — Kingshot Atlas'),
    description: t('bearRally.metaDesc', 'Rank your alliance members for Bear Rally events with our tier list tool. Score players based on troop bonuses, heroes, and Exclusive Gear.'),
  });
  useStructuredData({
    type: 'BreadcrumbList',
    data: [
      ...(PAGE_BREADCRUMBS.tools || []),
      { name: 'Alliance Center', url: 'https://ks-atlas.com/alliance-center' },
      { name: 'Bear Rally Tier List', url: 'https://ks-atlas.com/tools/bear-rally' },
    ],
  });

  const state = useBearRallyState();

  // ── Disclaimer state ──
  const [disclaimerText, setDisclaimerText] = React.useState(() => {
    try { return localStorage.getItem(BEAR_DISCLAIMER_KEY) ?? BEAR_DISCLAIMER_DEFAULT; }
    catch { return BEAR_DISCLAIMER_DEFAULT; }
  });
  const [editingDisclaimer, setEditingDisclaimer] = React.useState(false);

  // Persist disclaimer
  const saveDisclaimer = React.useCallback((text: string) => {
    try { localStorage.setItem(BEAR_DISCLAIMER_KEY, text); } catch { /* ignore */ }
    setDisclaimerText(text);
    setEditingDisclaimer(false);
  }, []);

  // ── Bulk Input handler ──
  const handleBulkPlayers = React.useCallback((newPlayers: BearPlayerEntry[]) => {
    state.pushUndo(state.players);
    state.setPlayers((prev: BearPlayerEntry[]) => {
      const merged = [...prev, ...newPlayers];
      const complete = merged.filter(isPlayerComplete);
      const allScores = complete.map(p => p.bearScore);
      return merged.map(p => isPlayerComplete(p) ? { ...p, tier: assignBearTier(p.bearScore, allScores, state.tierOverrides) } : p);
    });
    state.setShowBulkInput(false);
  }, [state]);

  // ── Bulk Edit handler ──
  const handleBulkEdit = React.useCallback((updatedPlayers: BearPlayerEntry[]) => {
    state.pushUndo(state.players);
    state.setPlayers(updatedPlayers);
    state.setShowBulkEdit(false);
  }, [state]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      color: '#e5e7eb',
      padding: isMobile ? '1rem 0.5rem 4rem' : '2rem 1.5rem 4rem',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? '1.5rem' : '2rem' }}>
          <h1 style={{
            fontSize: isMobile ? '1.6rem' : '2.2rem',
            fontWeight: 800,
            fontFamily: FONT_DISPLAY,
            marginBottom: '0.5rem',
            letterSpacing: '0.02em',
          }}>
            <span style={{ color: '#fff' }}>{t('bearRally.title1', 'BEAR RALLY')}</span>{' '}
            <span style={{ color: ACCENT }}>{t('bearRally.title2', 'TIER LIST')}</span>
          </h1>
          <p style={{ fontSize: isMobile ? '0.75rem' : '0.85rem', color: '#6b7280', maxWidth: '600px', margin: '0 auto', lineHeight: 1.5 }}>
            {t('bearRally.subtitle', 'Rank your alliance by Bear Hunt rally power. Input scouted stats — Atlas handles the math.')}
          </p>
          {state.ac.alliance && (
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.25rem 0.6rem', backgroundColor: `${ACCENT}15`,
                border: `1px solid ${ACCENT}25`, borderRadius: '6px',
                fontSize: '0.7rem', color: ACCENT, fontWeight: 600,
              }}>
                👥 {state.ac.alliance.name}
                {!state.canEdit && (
                  <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: '0.3rem' }}>
                    ({t('bearRally.viewOnly', 'view only')})
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* ── List Manager ── */}
        <BearListManager
          isMobile={isMobile}
          canEdit={state.canEdit}
          listsIndex={state.listsIndex}
          activeListId={state.activeListId}
          players={state.players}
          showListMenu={state.showListMenu}
          setShowListMenu={state.setShowListMenu}
          listMenuRef={state.listMenuRef}
          editingListName={state.editingListName}
          setEditingListName={state.setEditingListName}
          listNameDraft={state.listNameDraft}
          setListNameDraft={state.setListNameDraft}
          handleRenameList={state.handleRenameList}
          showNewListPrompt={state.showNewListPrompt}
          setShowNewListPrompt={state.setShowNewListPrompt}
          newListNameDraft={state.newListNameDraft}
          setNewListNameDraft={state.setNewListNameDraft}
          openNewListPrompt={state.openNewListPrompt}
          handleCreateList={state.handleCreateList}
          handleSwitchList={state.handleSwitchList}
          deleteListConfirm={state.deleteListConfirm}
          setDeleteListConfirm={state.setDeleteListConfirm}
          handleDeleteList={state.handleDeleteList}
          undoStackLength={state.undoStack.current.length}
          handleUndo={state.handleUndo}
          showShareMenu={state.showShareMenu}
          setShowShareMenu={state.setShowShareMenu}
          shareMenuRef={state.shareMenuRef}
          isCapturing={state.isCapturing}
          handleCopyImage={state.handleCopyImage}
          handleCopyLink={state.handleCopyLink}
          handleExportCSV={state.handleExportCSV}
        />

        {/* ── Undo Toast ── */}
        {state.showUndoToast && (
          <div style={{
            position: 'fixed', bottom: '5rem', left: '50%', transform: 'translateX(-50%)',
            zIndex: 100, padding: '0.6rem 1.2rem', backgroundColor: '#1a1a1a',
            border: `1px solid ${ACCENT}30`, borderRadius: '10px',
            color: ACCENT, fontSize: '0.8rem', fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            animation: 'fadeInUp 0.2s ease-out',
          }}>
            ↩️ {t('bearRally.undone', 'Action undone')}
          </div>
        )}

        {/* ── Action Buttons ── */}
        {state.canEdit && state.listsIndex.length > 0 && (
          <div style={{
            display: 'flex', gap: isMobile ? '0.35rem' : '0.5rem', flexWrap: 'nowrap',
            marginBottom: '1rem',
            justifyContent: isMobile ? 'flex-start' : 'center',
          }}>
            {!state.showForm && (
              <>
                <button
                  onClick={() => {
                    state.setForm(emptyForm);
                    state.setEditingId(null);
                    state.setShowForm(true);
                    state.setShowBulkInput(false);
                    state.setShowBulkEdit(false);
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: isMobile ? '0.45rem 0.7rem' : '0.5rem 1rem', backgroundColor: ACCENT,
                    border: 'none', borderRadius: '8px',
                    color: '#fff', fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  + {t('bearRally.addPlayer', 'Add Player')}
                </button>
                <button
                  onClick={() => { state.setShowBulkInput(true); state.setShowBulkEdit(false); state.setShowForm(false); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: isMobile ? '0.45rem 0.7rem' : '0.5rem 1rem', backgroundColor: '#1a1a1a',
                    border: '1px solid #333', borderRadius: '8px',
                    color: '#d1d5db', fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  📋 {t('bearRally.bulkAdd', 'Bulk Add')}
                </button>
                {state.players.length > 0 && (
                  <button
                    onClick={() => { state.setShowBulkEdit(true); state.setShowBulkInput(false); state.setShowForm(false); }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                      padding: isMobile ? '0.45rem 0.7rem' : '0.5rem 1rem', backgroundColor: '#1a1a1a',
                      border: '1px solid #333', borderRadius: '8px',
                      color: '#d1d5db', fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    ✏️ {t('bearRally.bulkEdit', 'Edit All')}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Bulk Input ── */}
        {state.showBulkInput && (
          <BearBulkInput
            existingPlayers={state.players}
            onSave={handleBulkPlayers}
            onClose={() => state.setShowBulkInput(false)}
            isMobile={isMobile}
            rosterNames={state.rosterNames}
          />
        )}

        {/* ── Bulk Edit ── */}
        {state.showBulkEdit && (
          <BearBulkEdit
            existingPlayers={state.players}
            unscoredNames={state.unscoredRosterMembers}
            onSave={handleBulkEdit}
            onClose={() => state.setShowBulkEdit(false)}
            isMobile={isMobile}
          />
        )}

        {/* ── Player Form ── */}
        {state.showForm && (
          <BearPlayerForm
            isMobile={isMobile}
            form={state.form}
            editingId={state.editingId}
            formError={state.formError}
            showSuggestions={state.showSuggestions}
            setShowSuggestions={state.setShowSuggestions}
            nameSuggestions={state.nameSuggestions}
            nameInputRef={state.nameInputRef}
            suggestionsRef={state.suggestionsRef}
            rosterNames={state.rosterNames}
            updateForm={state.updateForm}
            handleSubmit={state.handleSubmit}
            handleCancelForm={state.handleCancelForm}
          />
        )}

        {/* ── Tier Table ── */}
        {state.players.length > 0 ? (
          <BearTierTable
            isMobile={isMobile}
            canEdit={state.canEdit}
            rankedPlayers={state.rankedPlayers}
            incompletePlayers={state.incompletePlayers}
            unscoredRosterMembers={state.unscoredRosterMembers}
            expandedCards={state.expandedCards}
            setExpandedCards={state.setExpandedCards}
            deleteConfirm={state.deleteConfirm}
            setDeleteConfirm={state.setDeleteConfirm}
            handleEdit={state.handleEdit}
            handleDelete={state.handleDelete}
            handleAddRosterMember={state.handleAddRosterMember}
            tierListRef={state.tierListRef}
            lastEditedBy={state.lastEditedBy}
            players={state.players}
          />
        ) : state.listsIndex.length > 0 ? (
          /* ── Empty State ── */
          <div style={{
            textAlign: 'center',
            padding: isMobile ? '2rem 1rem' : '3rem 2rem',
            backgroundColor: '#111111',
            borderRadius: '16px',
            border: '1px solid #2a2a2a',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🐻</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
              {t('bearRally.emptyTitle', 'No players scored yet')}
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', maxWidth: '400px', margin: '0 auto 1rem' }}>
              {t('bearRally.emptyDesc', 'Add alliance members and their troop stats to generate Bear Rally rankings.')}
            </p>
            {state.canEdit && (
              <button
                onClick={() => {
                  state.setForm(emptyForm);
                  state.setEditingId(null);
                  state.setShowForm(true);
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.6rem 1.5rem', backgroundColor: ACCENT,
                  border: 'none', borderRadius: '8px',
                  color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                }}
              >
                + {t('bearRally.addFirstPlayer', 'Add First Player')}
              </button>
            )}
          </div>
        ) : null}

        {/* ── Tier Cutoff Editor ── */}
        <BearTierCutoffEditor
          rankedPlayers={state.rankedPlayers}
          tierOverrides={state.tierOverrides}
          autoBoundaries={state.autoBoundaries}
          onSetOverrides={state.handleSetTierOverrides}
          canEdit={state.canEdit}
          isMobile={isMobile}
        />

        {/* ── Info Card ── */}
        <div style={{
          marginTop: '1.5rem',
          padding: isMobile ? '1rem' : '1.25rem',
          backgroundColor: '#111111',
          borderRadius: '12px',
          border: '1px solid #2a2a2a',
        }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
            ℹ️ {t('bearRally.howItWorksTitle', 'How Bear Score Works')}
          </h3>
          <ul style={{ fontSize: '0.75rem', color: '#9ca3af', paddingLeft: '1.25rem', lineHeight: 1.7, margin: 0 }}>
            <li>{t('bearRally.howScore1', 'Each troop type (Infantry, Cavalry, Archer) contributes Attack + Lethality stats.')}</li>
            <li>{t('bearRally.howScore2', 'Hero Exclusive Gear (EG) levels add bonus multipliers.')}</li>
            <li>{t('bearRally.howScore3', 'Cross-hero stacking bonuses are applied automatically.')}</li>
            <li>{t('bearRally.howScore4', 'Archers are weighted highest (90%), followed by Cavalry (9%), then Infantry (1%).')}</li>
            <li>{t('bearRally.howScore5', 'Tiers use a natural-breaks algorithm that finds the largest score gaps between players to create meaningful tier boundaries. Managers can also set custom cutoffs.')}</li>
          </ul>
        </div>

        {/* ── Disclaimer ── */}
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', backgroundColor: '#0d0d0d', borderRadius: '10px', border: '1px solid #1a1a1a' }}>
          {editingDisclaimer ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <textarea
                value={disclaimerText}
                onChange={(e) => setDisclaimerText(e.target.value)}
                style={{
                  width: '100%', minHeight: '60px', padding: '0.5rem',
                  backgroundColor: '#1a1a1a', border: '1px solid #333',
                  borderRadius: '6px', color: '#9ca3af', fontSize: '0.7rem',
                  resize: 'vertical', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => saveDisclaimer(disclaimerText)} style={{
                  padding: '0.25rem 0.75rem', backgroundColor: ACCENT, border: 'none',
                  borderRadius: '6px', color: '#fff', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
                }}>
                  {t('common.save', 'Save')}
                </button>
                <button onClick={() => saveDisclaimer(BEAR_DISCLAIMER_DEFAULT)} style={{
                  padding: '0.25rem 0.75rem', background: 'none', border: '1px solid #333',
                  borderRadius: '6px', color: '#6b7280', fontSize: '0.65rem', cursor: 'pointer',
                }}>
                  {t('common.reset', 'Reset')}
                </button>
                <button onClick={() => setEditingDisclaimer(false)} style={{
                  background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.65rem',
                }}>
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => { if (state.canEdit) setEditingDisclaimer(true); }}
              style={{ cursor: state.canEdit ? 'pointer' : 'default' }}
              title={state.canEdit ? t('bearRally.clickToEditDisclaimer', 'Click to edit disclaimer') : undefined}
            >
              <p style={{ fontSize: '0.7rem', color: '#6b7280', margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>
                ⚠️ {disclaimerText}
              </p>
            </div>
          )}
        </div>

        {/* ── Back Links ── */}
        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <BackLink to="/alliance-center" label={t('bearRally.backToAlliance', 'Alliance Center')} />
          <BackLink to="/" label={t('common.backToHome', 'Home')} variant="secondary" />
        </div>

      </div>
    </div>
  );
};

export default BearRallyTierList;
