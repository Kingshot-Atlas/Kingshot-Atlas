import React from 'react';
import { useTranslation } from 'react-i18next';
import type { BearListMeta } from '../../data/bearHuntData';
import BearShareMenu from './BearShareMenu';

const ACCENT = '#3b82f6';

interface BearListManagerProps {
  isMobile: boolean;
  canEdit: boolean;
  listsIndex: BearListMeta[];
  activeListId: string | null;
  players: unknown[];
  // List menu
  showListMenu: boolean;
  setShowListMenu: React.Dispatch<React.SetStateAction<boolean>>;
  listMenuRef: React.RefObject<HTMLDivElement | null>;
  // Rename
  editingListName: string | null;
  setEditingListName: React.Dispatch<React.SetStateAction<string | null>>;
  listNameDraft: string;
  setListNameDraft: React.Dispatch<React.SetStateAction<string>>;
  handleRenameList: (listId: string, newName: string) => void;
  // New list
  showNewListPrompt: boolean;
  setShowNewListPrompt: React.Dispatch<React.SetStateAction<boolean>>;
  newListNameDraft: string;
  setNewListNameDraft: React.Dispatch<React.SetStateAction<string>>;
  openNewListPrompt: () => void;
  handleCreateList: (name?: string) => void;
  // Switch / Delete
  handleSwitchList: (listId: string) => void;
  deleteListConfirm: string | null;
  setDeleteListConfirm: React.Dispatch<React.SetStateAction<string | null>>;
  handleDeleteList: (listId: string) => void;
  // Undo
  undoStackLength: number;
  handleUndo: () => void;
  // Share
  showShareMenu: boolean;
  setShowShareMenu: React.Dispatch<React.SetStateAction<boolean>>;
  shareMenuRef: React.RefObject<HTMLDivElement | null>;
  isCapturing: boolean;
  handleCopyImage: () => void;
  handleCopyLink: () => void;
  handleExportCSV: () => void;
}

const BearListManager: React.FC<BearListManagerProps> = ({
  isMobile,
  canEdit,
  listsIndex,
  activeListId,
  players,
  showListMenu,
  setShowListMenu,
  listMenuRef,
  editingListName,
  setEditingListName,
  listNameDraft,
  setListNameDraft,
  handleRenameList,
  showNewListPrompt,
  setShowNewListPrompt,
  newListNameDraft,
  setNewListNameDraft,
  openNewListPrompt,
  handleCreateList,
  handleSwitchList,
  deleteListConfirm,
  setDeleteListConfirm,
  handleDeleteList,
  undoStackLength,
  handleUndo,
  showShareMenu,
  setShowShareMenu,
  shareMenuRef,
  isCapturing,
  handleCopyImage,
  handleCopyLink,
  handleExportCSV,
}) => {
  const { t } = useTranslation();

  return (
    <div style={{
      marginBottom: '1rem',
      padding: isMobile ? '0.75rem' : '0.85rem 1rem',
      backgroundColor: '#111111',
      borderRadius: '12px',
      border: '1px solid #2a2a2a',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      flexWrap: 'wrap',
      position: 'relative',
    }} ref={listMenuRef}>
      <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        📋 {t('bearRally.listLabel', 'List')}:
      </span>

      {listsIndex.length === 0 ? (
        canEdit ? (
          showNewListPrompt ? (
            <form
              onSubmit={(e) => { e.preventDefault(); handleCreateList(newListNameDraft); }}
              style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}
            >
              <input
                autoFocus
                value={newListNameDraft}
                onChange={(e) => setNewListNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setShowNewListPrompt(false); }}
                placeholder={t('bearRally.listNamePlaceholder', 'List name')}
                style={{
                  padding: '0.3rem 0.5rem', backgroundColor: '#1a1a1a',
                  border: `1px solid ${ACCENT}50`, borderRadius: '6px',
                  color: '#fff', fontSize: '0.8rem', outline: 'none', width: '180px',
                }}
              />
              <button type="submit" style={{
                padding: '0.3rem 0.6rem', backgroundColor: ACCENT, border: 'none',
                borderRadius: '6px', color: '#fff', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
              }}>
                {t('common.create', 'Create')}
              </button>
              <button type="button" onClick={() => setShowNewListPrompt(false)} style={{
                background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.7rem',
              }}>
                {t('common.cancel', 'Cancel')}
              </button>
            </form>
          ) : (
            <button
              onClick={openNewListPrompt}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.35rem 0.75rem', backgroundColor: `${ACCENT}20`,
                border: `1px solid ${ACCENT}40`, borderRadius: '6px',
                color: ACCENT, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              + {t('bearRally.createFirstList', 'Create First List')}
            </button>
          )
        ) : (
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            {t('bearRally.noListsYet', 'No tier lists created yet.')}
          </span>
        )
      ) : (
        <>
          {/* Active list name / selector */}
          {editingListName === activeListId ? (
            <form
              onSubmit={(e) => { e.preventDefault(); if (activeListId) handleRenameList(activeListId, listNameDraft); }}
              style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}
            >
              <input
                autoFocus
                value={listNameDraft}
                onChange={(e) => setListNameDraft(e.target.value)}
                onBlur={() => { if (activeListId) handleRenameList(activeListId, listNameDraft); }}
                style={{
                  padding: '0.3rem 0.5rem', backgroundColor: '#1a1a1a',
                  border: `1px solid ${ACCENT}50`, borderRadius: '6px',
                  color: '#fff', fontSize: '0.8rem', outline: 'none', width: '160px',
                }}
              />
            </form>
          ) : (
            <button
              onClick={() => setShowListMenu(prev => !prev)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.35rem 0.65rem', backgroundColor: '#1a1a1a',
                border: '1px solid #333', borderRadius: '6px',
                color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {listsIndex.find(l => l.id === activeListId)?.name ?? '—'}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
          )}

          {/* Rename button */}
          {canEdit && editingListName !== activeListId && activeListId && (
            <button
              onClick={() => {
                const current = listsIndex.find(l => l.id === activeListId);
                setListNameDraft(current?.name ?? '');
                setEditingListName(activeListId);
              }}
              title={t('bearRally.renameList', 'Rename list')}
              style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}

          {/* New List button / prompt */}
          {canEdit && (
            showNewListPrompt ? (
              <form
                onSubmit={(e) => { e.preventDefault(); handleCreateList(newListNameDraft); }}
                style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}
              >
                <input
                  autoFocus
                  value={newListNameDraft}
                  onChange={(e) => setNewListNameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setShowNewListPrompt(false); }}
                  placeholder={t('bearRally.listNamePlaceholder', 'List name')}
                  style={{
                    padding: '0.3rem 0.5rem', backgroundColor: '#1a1a1a',
                    border: `1px solid ${ACCENT}50`, borderRadius: '6px',
                    color: '#fff', fontSize: '0.75rem', outline: 'none', width: isMobile ? '130px' : '170px',
                  }}
                />
                <button type="submit" style={{
                  padding: '0.3rem 0.55rem', backgroundColor: ACCENT, border: 'none',
                  borderRadius: '6px', color: '#fff', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
                }}>
                  ✓
                </button>
                <button type="button" onClick={() => setShowNewListPrompt(false)} style={{
                  background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.65rem', padding: '0.2rem',
                }}>
                  ✕
                </button>
              </form>
            ) : (
              <button
                onClick={openNewListPrompt}
                title={t('bearRally.newList', 'New list')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.3rem 0.6rem', backgroundColor: `${ACCENT}15`,
                  border: `1px solid ${ACCENT}30`, borderRadius: '6px',
                  color: ACCENT, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                {!isMobile && t('bearRally.newList', 'New List')}
              </button>
            )
          )}

          {/* Undo / Share buttons */}
          {players.length > 0 && (
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', marginLeft: 'auto' }}>
              {canEdit && undoStackLength > 0 && (
                <button
                  onClick={handleUndo}
                  title={t('bearRally.undo', 'Undo (Ctrl+Z)')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.3rem 0.55rem', backgroundColor: '#1a1a1a',
                    border: `1px solid ${ACCENT}30`, borderRadius: '6px',
                    color: ACCENT, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                  {!isMobile && t('bearRally.undo', 'Undo')}
                </button>
              )}
              <BearShareMenu
                showShareMenu={showShareMenu}
                setShowShareMenu={setShowShareMenu}
                shareMenuRef={shareMenuRef}
                isCapturing={isCapturing}
                isMobile={isMobile}
                handleCopyImage={handleCopyImage}
                handleCopyLink={handleCopyLink}
                handleExportCSV={handleExportCSV}
              />
            </div>
          )}

          {/* Dropdown menu */}
          {showListMenu && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '10px',
              marginTop: '4px', maxHeight: '300px', overflowY: 'auto',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}>
              {listsIndex.map((list) => (
                <div
                  key={list.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.6rem 0.85rem', borderBottom: '1px solid #2a2a2a',
                    backgroundColor: list.id === activeListId ? `${ACCENT}10` : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.1s',
                  }}
                  onClick={() => handleSwitchList(list.id)}
                  onMouseEnter={(e) => { if (list.id !== activeListId) e.currentTarget.style.backgroundColor = '#2a2a2a'; }}
                  onMouseLeave={(e) => { if (list.id !== activeListId) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.8rem', fontWeight: list.id === activeListId ? 700 : 500,
                      color: list.id === activeListId ? ACCENT : '#fff',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {list.name}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.15rem' }}>
                      {t('bearRally.listPlayerCount', '{{count}} players', { count: list.playerCount })}
                      {' · '}
                      {new Date(list.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  {list.id === activeListId && (
                    <span style={{ fontSize: '0.65rem', color: ACCENT, fontWeight: 700, marginLeft: '0.5rem' }}>✓</span>
                  )}
                  {canEdit && listsIndex.length > 1 && (
                    deleteListConfirm === list.id ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }}
                        style={{
                          background: 'none', border: '1px solid #ef444460', borderRadius: '4px',
                          color: '#ef4444', cursor: 'pointer', padding: '0.15rem 0.4rem',
                          fontSize: '0.6rem', fontWeight: 700, marginLeft: '0.5rem',
                        }}
                      >
                        {t('common.confirm', 'Confirm')}
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteListConfirm(list.id); }}
                        title={t('bearRally.deleteList', 'Delete list')}
                        style={{ background: 'none', border: 'none', color: '#6b728080', cursor: 'pointer', padding: '0.2rem', marginLeft: '0.5rem', display: 'flex' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BearListManager;
