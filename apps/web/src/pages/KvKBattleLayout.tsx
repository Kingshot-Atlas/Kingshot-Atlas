import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackLink from '../components/shared/BackLink';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { useBattleLayout } from '../hooks/useBattleLayout';
import { useAuth } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
import { useKingdomFund, useBattleManagers, useAddBattleManager, useRemoveBattleManager, useKingdomEditor, useSearchProfiles } from '../hooks/useKingdomProfileQueries';
import { getBuildingType } from '../config/allianceBuildings';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { Button } from '../components/shared';
import GridCanvas, { g2s } from '../components/base-designer/GridCanvas';
import { MapControls, SidebarSection, CoordinateSearch } from '../components/base-designer/DesignerWidgets';

// ─── Gold-Tier Access Gate ───
const BattleAccessGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, user } = useAuth();
  const { isAdmin } = usePremium();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const kingdomNumber = profile?.home_kingdom ?? profile?.linked_kingdom ?? undefined;
  const { data: fund, isLoading } = useKingdomFund(kingdomNumber);
  const { data: managers } = useBattleManagers(kingdomNumber);

  // Admins bypass
  if (isAdmin) return <>{children}</>;

  // Battle managers bypass gold gate
  const isBattleManager = !!(user && managers?.some(m => m.user_id === user.id));
  if (isBattleManager) return <>{children}</>;

  if (isLoading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Loading...</span>
      </div>
    );
  }

  const tier = fund?.tier || 'standard';
  const isGold = tier === 'gold';

  if (!isGold) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2 style={{ color: '#fff', fontFamily: FONT_DISPLAY, fontSize: '1.5rem', marginBottom: '0.75rem' }}>
          {t('battleLayout.goldRequired', 'Gold Tier Required')}
        </h2>
        <p style={{ color: '#9ca3af', maxWidth: '400px', marginBottom: '0.5rem', lineHeight: 1.6 }}>
          {t('battleLayout.goldGateDesc', 'The KvK Battle Layout is a premium kingdom tool available to Gold tier kingdoms. Contribute to your kingdom fund to unlock it.')}
        </p>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '1.5rem' }}>
          {t('battleLayout.currentTier', 'Current tier: {{tier}}', { tier: tier.charAt(0).toUpperCase() + tier.slice(1) })}
          {fund ? ` ($${fund.balance} balance)` : ''}
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {kingdomNumber && (
            <Button variant="primary" onClick={() => navigate(`/kingdom/${kingdomNumber}`)}>
              {t('battleLayout.viewKingdom', 'View Kingdom Fund')}
            </Button>
          )}
          <BackLink to="/tools" label={t('common.allTools', 'All Tools')} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// ─── Main Page ───
const KvKBattleLayout: React.FC = () => {
  useDocumentTitle('KvK Battle Layout');
  useStructuredData({
    type: 'BreadcrumbList',
    data: [
      ...(PAGE_BREADCRUMBS.tools || []),
      { name: 'KvK Battle Layout', url: 'https://ks-atlas.com/tools/battle-layout' },
    ],
  });
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const { profile, user } = useAuth();
  const designer = useBattleLayout();
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 600 });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobilePanelTab, setMobilePanelTab] = useState<'place' | 'nav'>('place');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [autoSaveFlash, setAutoSaveFlash] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingLabel, setEditingLabel] = useState<{ buildingId: string; screenX: number; screenY: number; value: string } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [shareToast, setShareToast] = useState(false);
  const [managerInput, setManagerInput] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Battle manager management (editors/co-editors only)
  const kingdomNumber = profile?.home_kingdom ?? profile?.linked_kingdom ?? undefined;
  const { data: editorData } = useKingdomEditor(kingdomNumber, user?.id);
  const { data: battleManagers } = useBattleManagers(kingdomNumber);
  const addManager = useAddBattleManager(kingdomNumber || 0);
  const removeManager = useRemoveBattleManager(kingdomNumber || 0);
  const isEditorOrCoEditor = !!editorData?.isEditor;
  const { data: searchResults } = useSearchProfiles(managerInput);

  // Canvas resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setCanvasSize({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Auto-save flash
  useEffect(() => {
    if (designer.buildings.length === 0) return;
    setAutoSaveFlash(true);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => setAutoSaveFlash(false), 2000);
  }, [designer.buildings]);

  // Enter key opens inline label editor for selected city
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key !== 'Enter') return;
      if (editingLabel) return;
      const sel = designer.selectedBuildingId
        ? designer.buildings.find(b => b.id === designer.selectedBuildingId)
        : null;
      if (!sel || designer.isFixed(sel.id)) return;
      const type = getBuildingType(sel.typeId);
      if (!type?.labelField) return;
      e.preventDefault();
      const bCenter = g2s(
        sel.x + type.size / 2, sel.y + type.size / 2,
        designer.centerX, designer.centerY, designer.zoom,
        canvasSize.width, canvasSize.height,
      );
      setEditingLabel({ buildingId: sel.id, screenX: bCenter.x, screenY: bCenter.y, value: sel.label || '' });
      setTimeout(() => editInputRef.current?.focus(), 50);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [designer.selectedBuildingId, designer.buildings, designer.centerX, designer.centerY, designer.zoom, canvasSize, editingLabel]);

  // Navigate to coordinates
  const goToCoords = useCallback((x: number, y: number) => {
    designer.setCenterX(x);
    designer.setCenterY(y);
    designer.setZoom(Math.max(designer.zoom, 15));
  }, [designer]);

  // Focus on all buildings
  const focusOnBase = useCallback(() => {
    if (designer.buildings.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of designer.buildings) {
      const bt = getBuildingType(b.typeId);
      const size = bt?.size || 1;
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + size > maxX) maxX = b.x + size;
      if (b.y + size > maxY) maxY = b.y + size;
    }
    designer.setCenterX((minX + maxX) / 2);
    designer.setCenterY((minY + maxY) / 2);
    const range = Math.max(maxX - minX, maxY - minY, 10);
    const targetZoom = Math.min(40, Math.max(3, Math.min(canvasSize.width, canvasSize.height) / (range * 2.5)));
    designer.setZoom(targetZoom);
  }, [designer, canvasSize]);

  const selectedBuilding = designer.selectedBuildingId
    ? designer.buildings.find((b) => b.id === designer.selectedBuildingId) ?? null
    : null;
  const selectedBuildingType = selectedBuilding ? getBuildingType(selectedBuilding.typeId) : undefined;
  const selectedIsFixed = selectedBuilding ? designer.isFixed(selectedBuilding.id) : false;

  const sidebarBtnStyle: React.CSSProperties = {
    padding: '0.3rem 0.5rem', backgroundColor: '#0d1117', border: '1px solid #1e2a35',
    borderRadius: '4px', color: '#9ca3af', cursor: 'pointer', fontSize: '0.65rem',
    fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.2rem', whiteSpace: 'nowrap',
  };

  const mobileBtnStyle: React.CSSProperties = {
    padding: '0.35rem 0.45rem', backgroundColor: '#0d1117', border: '1px solid #1e2a35',
    borderRadius: '6px', color: '#9ca3af', cursor: 'pointer', fontSize: '0.85rem',
    fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center',
    minWidth: '36px', minHeight: '36px',
  };

  // Swipe-to-dismiss refs for floating action chip
  const fabSwipeStart = useRef<number | null>(null);

  // ─── Desktop Layout ───
  if (!isMobile) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0a0a0a', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: '0.6rem 1.5rem',
          background: 'linear-gradient(180deg, #111827 0%, #0d1117 100%)',
          borderBottom: '1px solid #1e2a35',
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 'bold', fontFamily: FONT_DISPLAY, letterSpacing: '0.05em', margin: 0 }}>
            <span style={{ color: '#fff' }}>KVK BATTLE </span>
            <span style={neonGlow('#f97316')}>LAYOUT</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.2rem 0 0', letterSpacing: '0.02em' }}>
            {t('battleLayout.subtitle', 'Plan your alliance positioning around the castle and turrets')}
          </p>
        </div>

        <BattleAccessGate>
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left sidebar */}
            <div style={{
              width: sidebarOpen ? '240px' : '0px',
              minWidth: sidebarOpen ? '240px' : '0px',
              transition: 'all 0.2s ease',
              overflow: sidebarOpen ? 'auto' : 'hidden',
              backgroundColor: '#0d1117',
              borderRight: '1px solid #1e2a35',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* Action bar */}
              <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #1e2a35', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                <button style={sidebarBtnStyle} onClick={designer.undo} disabled={!designer.canUndo} title="Undo (Ctrl+Z)">↩ {t('baseDesigner.btnUndo', 'Undo')}</button>
                <button style={sidebarBtnStyle} onClick={designer.redo} disabled={!designer.canRedo} title="Redo (Ctrl+Y)">↪ {t('baseDesigner.btnRedo', 'Redo')}</button>
                <div style={{ width: '1px', height: '20px', backgroundColor: '#1e2a35' }} />
                <button
                  style={{ ...sidebarBtnStyle, ...(designer.showLabels ? { backgroundColor: '#f9731615', borderColor: '#f9731640', color: '#f97316' } : {}) }}
                  onClick={() => designer.setShowLabels(!designer.showLabels)} title="Toggle Labels"
                >🏷️ {t('baseDesigner.btnLabel', 'Label')}</button>
                <button
                  style={{ ...sidebarBtnStyle, borderColor: '#ef444440', color: '#ef4444' }}
                  onClick={() => setShowClearConfirm(true)} title="Clear All Cities"
                >🗑️ {t('battleLayout.clearAll', 'Clear')}</button>
                <div style={{ width: '1px', height: '20px', backgroundColor: '#1e2a35' }} />
                <button
                  style={{ ...sidebarBtnStyle, borderColor: '#3b82f640', color: '#3b82f6' }}
                  onClick={async () => {
                    const canvas = containerRef.current?.querySelector('canvas');
                    if (!canvas) return;
                    try {
                      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
                      if (blob) {
                        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                        setShareToast(true);
                        setTimeout(() => setShareToast(false), 2500);
                      }
                    } catch {
                      // Fallback: download
                      const url = canvas.toDataURL('image/png');
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'battle-layout.png';
                      a.click();
                    }
                  }}
                  title={t('battleLayout.shareTooltip', 'Copy layout image to clipboard')}
                >📋 {t('battleLayout.share', 'Share')}</button>
              </div>

              {/* City placement toggle */}
              <SidebarSection title={t('battleLayout.placeCities', 'Place Cities')} defaultOpen={true}>
                <button
                  onClick={() => designer.setSelectedToolType(designer.selectedToolType === 'city' ? null : 'city')}
                  style={{
                    width: '100%', padding: '0.4rem 0.5rem', marginBottom: '0.5rem',
                    backgroundColor: designer.selectedToolType === 'city' ? '#f9731618' : '#0d1117',
                    border: `1px solid ${designer.selectedToolType === 'city' ? '#f97316' : '#1e2a35'}`,
                    borderRadius: '6px', cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ color: designer.selectedToolType === 'city' ? '#f97316' : '#9ca3af', fontSize: '0.65rem', fontWeight: '600' }}>
                    {designer.selectedToolType === 'city' ? '🏙️ ' + t('battleLayout.cityTool', 'City Placement Active') : '🏙️ ' + t('battleLayout.placeCities', 'Place Cities')}
                  </div>
                  {designer.selectedToolType === 'city' && (
                    <div style={{ color: '#6b7280', fontSize: '0.6rem', lineHeight: 1.5, marginTop: '0.15rem' }}>
                      {t('battleLayout.cityToolDesc', 'Click on the map to place alliance cities. Drag to reposition. Double-click or press Enter to rename.')}
                    </div>
                  )}
                </button>
                <div style={{ color: '#4b5563', fontSize: '0.6rem' }}>
                  {designer.userCityCount} {designer.userCityCount === 1 ? 'city' : 'cities'} placed
                </div>
              </SidebarSection>

              {/* Navigate */}
              <SidebarSection title={t('baseDesigner.navigate', 'Navigate')} defaultOpen={true}>
                <CoordinateSearch onGo={goToCoords} onFocusBase={focusOnBase} hasBuildings={designer.buildings.length > 0} focusLabel={t('battleLayout.focusOnCastle', 'Focus On Castle')} />
              </SidebarSection>

              {/* Properties */}
              {selectedBuilding && selectedBuildingType && (
                <SidebarSection title="Properties" defaultOpen={true}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1rem' }}>{selectedBuildingType.icon}</span>
                    <div>
                      <div style={{ color: selectedBuildingType.color, fontSize: '0.75rem', fontWeight: '700' }}>{selectedBuildingType.name}</div>
                      <div style={{ color: '#4b5563', fontSize: '0.6rem' }}>
                        {selectedBuildingType.size}×{selectedBuildingType.size} • ({selectedBuilding.x}, {selectedBuilding.y})
                        {selectedIsFixed && <span style={{ color: '#f59e0b', marginLeft: '0.3rem' }}>🔒 Fixed</span>}
                      </div>
                    </div>
                  </div>
                  {!selectedIsFixed && selectedBuildingType.labelField && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <div style={{ color: '#6b7280', fontSize: '0.6rem', marginBottom: '2px' }}>Player Name</div>
                      <input type="text" value={selectedBuilding.label || ''}
                        onChange={(e) => designer.updateBuildingLabel(selectedBuilding.id, e.target.value)}
                        placeholder="e.g. PlayerOne"
                        style={{
                          width: '100%', padding: '0.25rem 0.4rem', backgroundColor: '#0a0a0a',
                          border: '1px solid #1e2a35', borderRadius: '4px', color: '#e5e7eb',
                          fontSize: '0.7rem', outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  )}
                  {selectedIsFixed && (
                    <p style={{ color: '#9ca3af', fontSize: '0.6rem', margin: '0 0 0.5rem', lineHeight: 1.4 }}>
                      {selectedBuildingType.description}
                    </p>
                  )}
                  {!selectedIsFixed && (
                    <button onClick={() => designer.removeBuilding(selectedBuilding.id)} style={{
                      width: '100%', padding: '0.3rem', backgroundColor: '#ef444415', border: '1px solid #ef444440',
                      borderRadius: '4px', color: '#ef4444', cursor: 'pointer', fontSize: '0.65rem', fontWeight: '600',
                    }}>
                      🗑️ Remove
                    </button>
                  )}
                </SidebarSection>
              )}

              {/* Battle Managers (editors/co-editors only) */}
              {isEditorOrCoEditor && (
                <SidebarSection title={t('battleLayout.battleManagers', 'Battle Managers')} defaultOpen={false}>
                  <div style={{ fontSize: '0.6rem', color: '#6b7280', marginBottom: '0.4rem', lineHeight: 1.4 }}>
                    {t('battleLayout.battleManagersDesc', 'Assign up to 2 players who can edit this layout. They bypass the Gold tier gate.')}
                  </div>
                  {(battleManagers || []).map((m) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid #1e2a35' }}>
                      <span style={{ color: '#e5e7eb', fontSize: '0.7rem' }}>👤 {m.username}</span>
                      <button onClick={() => removeManager.mutate(m.id)} style={{
                        background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.6rem', padding: '0.15rem 0.3rem',
                      }}>✕</button>
                    </div>
                  ))}
                  {(battleManagers?.length || 0) < 2 && (
                    <div style={{ position: 'relative', marginTop: '0.4rem' }}>
                      <input
                        type="text"
                        value={managerInput}
                        onChange={(e) => { setManagerInput(e.target.value); setShowSearchResults(true); }}
                        onFocus={() => setShowSearchResults(true)}
                        onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                        placeholder={t('battleLayout.managerPlaceholder', 'Search by username...')}
                        style={{
                          width: '100%', padding: '0.25rem 0.4rem', backgroundColor: '#0a0a0a',
                          border: '1px solid #1e2a35', borderRadius: '4px', color: '#e5e7eb',
                          fontSize: '0.65rem', outline: 'none',
                        }}
                      />
                      {showSearchResults && managerInput.length >= 2 && searchResults && searchResults.length > 0 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                          backgroundColor: '#111', border: '1px solid #1e2a35', borderRadius: '4px',
                          maxHeight: '120px', overflowY: 'auto', marginTop: '2px',
                        }}>
                          {searchResults
                            .filter(r => !(battleManagers || []).some(m => m.user_id === r.id))
                            .map((result) => (
                            <button
                              key={result.id}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                if (!user) return;
                                addManager.mutate({ userId: result.id, assignedBy: user.id }, {
                                  onSuccess: () => { setManagerInput(''); setShowSearchResults(false); },
                                });
                              }}
                              style={{
                                display: 'block', width: '100%', padding: '0.3rem 0.4rem', border: 'none',
                                backgroundColor: 'transparent', color: '#e5e7eb', fontSize: '0.65rem',
                                cursor: 'pointer', textAlign: 'left',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a2332'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              {result.linked_username || result.username || 'Unknown'}
                            </button>
                          ))}
                        </div>
                      )}
                      {showSearchResults && managerInput.length >= 2 && searchResults && searchResults.filter(r => !(battleManagers || []).some(m => m.user_id === r.id)).length === 0 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                          backgroundColor: '#111', border: '1px solid #1e2a35', borderRadius: '4px',
                          padding: '0.3rem 0.4rem', marginTop: '2px',
                          color: '#6b7280', fontSize: '0.6rem',
                        }}>
                          {t('battleLayout.noUsersFound', 'No users found')}
                        </div>
                      )}
                    </div>
                  )}
                  {addManager.isError && (
                    <div style={{ color: '#ef4444', fontSize: '0.55rem', marginTop: '0.3rem' }}>
                      {(addManager.error as Error)?.message || 'Failed to add'}
                    </div>
                  )}
                </SidebarSection>
              )}

              {/* Tips */}
              <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.55rem', color: '#4b5563', lineHeight: 1.6 }}>
                <strong style={{ color: '#6b7280' }}>Shortcuts:</strong> Toggle Place Cities to start · Click map to place · Drag to move · Delete to remove · Enter to edit name · Esc to deactivate · Ctrl+Z undo
              </div>

              {/* Back link */}
              <div style={{ padding: '0.5rem 0.75rem', marginTop: 'auto', borderTop: '1px solid #1e2a35' }}>
                <BackLink to="/tools" label={t('common.allTools', 'All Tools')} variant="secondary" />
              </div>
            </div>

            {/* Canvas area */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {/* Sidebar toggle */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{
                  position: 'absolute', top: 8, left: 8, zIndex: 10,
                  width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: '#0d1117cc', border: '1px solid #1e2a35', borderRadius: '5px',
                  color: '#9ca3af', cursor: 'pointer', fontSize: '0.7rem', backdropFilter: 'blur(8px)',
                }}
                title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              >
                {sidebarOpen ? '◁' : '▷'}
              </button>

              {/* Status bar */}
              <div style={{
                position: 'absolute', top: 8, left: 44, zIndex: 10,
                display: 'flex', gap: '0.5rem', fontSize: '0.55rem', color: '#4b5563',
                backgroundColor: '#0d1117aa', padding: '0.2rem 0.5rem', borderRadius: '4px',
                backdropFilter: 'blur(6px)',
              }}>
                <span>({Math.round(designer.centerX)}, {Math.round(designer.centerY)})</span>
                <span>Zoom: {designer.zoom.toFixed(1)}</span>
                {designer.hoveredCell && <span>Cursor: ({designer.hoveredCell.x}, {designer.hoveredCell.y})</span>}
                <span>{designer.userCityCount} cities</span>
                {autoSaveFlash && <span style={{ color: '#22c55e', transition: 'opacity 0.3s' }}>✓ Saved</span>}
              </div>

              <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
                <GridCanvas
                  designer={designer as never}
                  canvasWidth={canvasSize.width}
                  canvasHeight={canvasSize.height}
                  forbiddenZones={designer.forbiddenZones}
                  onEditBuilding={(building, sx, sy) => {
                    if (designer.isFixed(building.id)) return;
                    setEditingLabel({ buildingId: building.id, screenX: sx, screenY: sy, value: building.label || '' });
                    designer.setSelectedBuildingId(building.id);
                    setTimeout(() => editInputRef.current?.focus(), 50);
                  }}
                />
                {/* Inline label editor overlay */}
                {editingLabel && (
                  <div style={{
                    position: 'absolute',
                    left: editingLabel.screenX - 70,
                    top: editingLabel.screenY - 14,
                    zIndex: 20,
                  }}>
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editingLabel.value}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditingLabel((prev) => prev ? { ...prev, value: val } : null);
                        designer.updateBuildingLabel(editingLabel.buildingId, val);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                          e.preventDefault();
                          setEditingLabel(null);
                        }
                      }}
                      onBlur={() => setTimeout(() => setEditingLabel(null), 150)}
                      placeholder="Name..."
                      style={{
                        width: '140px', padding: '0.25rem 0.5rem',
                        backgroundColor: '#111827', border: '1px solid #f97316',
                        borderRadius: '4px', color: '#fff', fontSize: '0.75rem',
                        outline: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
                        textAlign: 'center',
                      }}
                    />
                  </div>
                )}
              </div>
              <MapControls designer={designer as never} isMobile={false} />
            </div>
          </div>
        </BattleAccessGate>

        {/* Clear confirmation dialog */}
        {showClearConfirm && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 999,
          }} onClick={() => setShowClearConfirm(false)}>
            <div onClick={(e) => e.stopPropagation()} style={{
              backgroundColor: '#111827', border: '1px solid #1e2a35',
              borderRadius: '12px', padding: '1.25rem', width: '100%', maxWidth: '340px',
            }}>
              <h4 style={{ color: '#fff', fontSize: '0.95rem', margin: '0 0 0.5rem', fontWeight: '600' }}>
                {t('battleLayout.clearConfirmTitle', 'Clear All Cities?')}
              </h4>
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', lineHeight: 1.5, margin: '0 0 1rem' }}>
                {t('battleLayout.clearConfirmDesc', 'This will remove all {{count}} placed cities. Castle and turrets will remain.', { count: designer.userCityCount })}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <Button variant="ghost" size="sm" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
                <Button variant="danger" size="sm" onClick={() => { designer.clearAll(); setShowClearConfirm(false); }}
                  style={{ backgroundColor: '#ef4444', color: '#fff', borderColor: '#ef4444' }}>Clear All</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Mobile Layout ───
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0a0a0a', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}>
      {/* Mobile header */}
      <div style={{ padding: '0.5rem 0.75rem', background: 'linear-gradient(180deg, #111827 0%, #0d1117 100%)', borderBottom: '1px solid #1e2a35', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <h1 style={{ fontSize: '1rem', fontWeight: 'bold', fontFamily: FONT_DISPLAY, letterSpacing: '0.04em', margin: 0 }}>
          <span style={{ color: '#fff' }}>BATTLE </span>
          <span style={neonGlow('#f97316')}>LAYOUT</span>
        </h1>
        <div style={{ position: 'absolute', right: '0.75rem' }}>
          <BackLink to="/tools" label={t('common.allTools', 'Tools')} variant="secondary" />
        </div>
      </div>

      <BattleAccessGate>
        {/* Canvas */}
        <div ref={containerRef} style={{ flex: 1, minHeight: '55vh', position: 'relative', overflow: 'hidden', WebkitTouchCallout: 'none' } as React.CSSProperties}>
          <GridCanvas
            designer={designer as never}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
            forbiddenZones={designer.forbiddenZones}
            onEditBuilding={(building, sx, sy) => {
              if (designer.isFixed(building.id)) return;
              setEditingLabel({ buildingId: building.id, screenX: sx, screenY: sy, value: building.label || '' });
              designer.setSelectedBuildingId(building.id);
              setTimeout(() => editInputRef.current?.focus(), 50);
            }}
          />
          {/* Inline label editor (mobile) */}
          {editingLabel && (
            <div style={{ position: 'absolute', left: Math.max(8, Math.min(editingLabel.screenX - 70, canvasSize.width - 156)), top: editingLabel.screenY - 14, zIndex: 20 }}>
              <input ref={editInputRef} type="text" value={editingLabel.value}
                onChange={(e) => { const val = e.target.value; setEditingLabel((prev) => prev ? { ...prev, value: val } : null); designer.updateBuildingLabel(editingLabel.buildingId, val); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setEditingLabel(null); } }}
                onBlur={() => setTimeout(() => setEditingLabel(null), 150)} placeholder="Name..."
                style={{ width: '140px', padding: '0.25rem 0.5rem', backgroundColor: '#111827', border: '1px solid #f97316', borderRadius: '4px', color: '#fff', fontSize: '0.75rem', outline: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.5)', textAlign: 'center', userSelect: 'text', WebkitUserSelect: 'text' } as React.CSSProperties} />
            </div>
          )}

          {/* Mobile floating toolbar */}
          <div style={{
            position: 'absolute', top: 8, left: 8, right: 8, zIndex: 10,
            display: 'flex', gap: '0.3rem', alignItems: 'center',
            backgroundColor: '#0d1117dd', padding: '0.3rem 0.4rem', borderRadius: '10px',
            backdropFilter: 'blur(10px)', border: '1px solid #1e2a35',
          }}>
            <button style={mobileBtnStyle} onClick={designer.undo} disabled={!designer.canUndo} title="Undo">↩</button>
            <button style={mobileBtnStyle} onClick={designer.redo} disabled={!designer.canRedo} title="Redo">↪</button>
            <button
              style={{ ...mobileBtnStyle, ...(designer.showLabels ? { backgroundColor: '#f9731615', borderColor: '#f9731640', color: '#f97316' } : {}) }}
              onClick={() => designer.setShowLabels(!designer.showLabels)} title="Labels"
            >🏷️</button>
            <button
              style={{ ...mobileBtnStyle, borderColor: '#3b82f640', color: '#3b82f6' }}
              onClick={async () => {
                const canvas = containerRef.current?.querySelector('canvas');
                if (!canvas) return;
                try {
                  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
                  if (blob) {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    setShareToast(true);
                    setTimeout(() => setShareToast(false), 2500);
                  }
                } catch {
                  const url = canvas.toDataURL('image/png');
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'battle-layout.png';
                  a.click();
                }
              }}
              title={t('battleLayout.shareTooltip', 'Copy layout image to clipboard')}
            >📋</button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: '0.55rem', color: '#4b5563' }}>{designer.userCityCount} cities</span>
          </div>

          {/* Floating action for selected city */}
          {selectedBuilding && selectedBuildingType && !selectedIsFixed && (
            <div style={{
              position: 'absolute', bottom: 12, right: 12, zIndex: 10,
              display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end',
            }}>
              <div
                onTouchStart={(e) => { fabSwipeStart.current = e.touches[0]!.clientX; }}
                onTouchEnd={(e) => {
                  if (fabSwipeStart.current !== null) {
                    const dx = e.changedTouches[0]!.clientX - fabSwipeStart.current;
                    if (dx > 60) designer.setSelectedBuildingId(null);
                    fabSwipeStart.current = null;
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  backgroundColor: '#0d1117ee', padding: '0.3rem 0.6rem', borderRadius: '8px',
                  border: `1px solid ${selectedBuildingType.color}40`, backdropFilter: 'blur(10px)',
                }}
              >
                <span style={{ fontSize: '0.8rem' }}>{selectedBuildingType.icon}</span>
                <span style={{ color: selectedBuildingType.color, fontSize: '0.65rem', fontWeight: '700' }}>{selectedBuildingType.name}</span>
                <span style={{ color: '#4b5563', fontSize: '0.55rem' }}>({selectedBuilding.x},{selectedBuilding.y})</span>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  onClick={() => {
                    const bCenter = g2s(
                      selectedBuilding.x + (selectedBuildingType?.size || 1) / 2,
                      selectedBuilding.y + (selectedBuildingType?.size || 1) / 2,
                      designer.centerX, designer.centerY, designer.zoom,
                      canvasSize.width, canvasSize.height,
                    );
                    setEditingLabel({ buildingId: selectedBuilding.id, screenX: bCenter.x, screenY: bCenter.y, value: selectedBuilding.label || '' });
                    setTimeout(() => editInputRef.current?.focus(), 50);
                  }}
                  style={{
                    padding: '0.5rem 0.75rem', backgroundColor: '#0d1117ee',
                    border: '1px solid #f9731640', borderRadius: '8px',
                    color: '#f97316', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600',
                    backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: '0.25rem',
                    touchAction: 'manipulation',
                  }}
                >
                  ✏️ {t('baseDesigner.renameBtn', 'Rename')}
                </button>
                <button
                  onClick={() => designer.removeBuilding(selectedBuilding.id)}
                  style={{
                    padding: '0.5rem 0.75rem', backgroundColor: '#0d1117ee',
                    border: '1px solid #ef444440', borderRadius: '8px',
                    color: '#ef4444', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600',
                    backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: '0.25rem',
                    touchAction: 'manipulation',
                  }}
                >
                  🗑️ {t('baseDesigner.removeBtn', 'Remove')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile bottom panel */}
        <div style={{ borderTop: '1px solid #1e2a35', backgroundColor: '#0d1117', maxHeight: '40vh', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #1e2a35' }}>
            {(['place', 'nav'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setMobilePanelTab(tab)}
                style={{
                  flex: 1, padding: '0.5rem', backgroundColor: 'transparent', border: 'none',
                  color: mobilePanelTab === tab ? '#f97316' : '#6b7280', cursor: 'pointer',
                  fontSize: '0.7rem', fontWeight: mobilePanelTab === tab ? '700' : '400',
                  borderBottom: mobilePanelTab === tab ? '2px solid #f97316' : '2px solid transparent',
                }}
              >
                {tab === 'place' ? t('battleLayout.placeTab', '🏙️ Place Cities') : t('baseDesigner.navTab', '🧭 Navigate')}
              </button>
            ))}
          </div>
          <div style={{ padding: '0.5rem 0.75rem', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {mobilePanelTab === 'place' && (
              <div>
                <button
                  onClick={() => designer.setSelectedToolType(designer.selectedToolType === 'city' ? null : 'city')}
                  style={{
                    width: '100%', padding: '0.5rem', marginBottom: '0.5rem',
                    backgroundColor: designer.selectedToolType === 'city' ? '#f9731618' : '#0d1117',
                    border: `1px solid ${designer.selectedToolType === 'city' ? '#f97316' : '#1e2a35'}`,
                    borderRadius: '6px', cursor: 'pointer', textAlign: 'left',
                    touchAction: 'manipulation',
                  }}
                >
                  <div style={{ color: designer.selectedToolType === 'city' ? '#f97316' : '#9ca3af', fontSize: '0.65rem', fontWeight: '600' }}>
                    {designer.selectedToolType === 'city' ? '🏙️ ' + t('battleLayout.cityTool', 'City Placement Active') : '🏙️ ' + t('battleLayout.placeCities', 'Place Cities')}
                  </div>
                  {designer.selectedToolType === 'city' && (
                    <div style={{ color: '#6b7280', fontSize: '0.55rem', lineHeight: 1.4, marginTop: '0.15rem' }}>
                      {t('battleLayout.cityToolDescMobile', 'Tap map to place. Drag to move. Long-press or double-tap to rename.')}
                    </div>
                  )}
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#4b5563', fontSize: '0.6rem' }}>{designer.userCityCount} cities placed</span>
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    disabled={designer.userCityCount === 0}
                    style={{
                      padding: '0.3rem 0.5rem', fontSize: '0.6rem', fontWeight: 600,
                      backgroundColor: '#0d1117', border: '1px solid #ef444440',
                      borderRadius: 4, color: designer.userCityCount > 0 ? '#ef4444' : '#4b5563', cursor: designer.userCityCount > 0 ? 'pointer' : 'not-allowed',
                    }}
                  >
                    🗑️ {t('battleLayout.clearAll', 'Clear')}
                  </button>
                </div>
              </div>
            )}
            {mobilePanelTab === 'nav' && (
              <CoordinateSearch onGo={goToCoords} onFocusBase={focusOnBase} hasBuildings={designer.buildings.length > 0} focusLabel={t('battleLayout.focusOnCastle', 'Focus On Castle')} />
            )}
          </div>
        </div>
      </BattleAccessGate>

      {/* Clear confirmation dialog (mobile) */}
      {showClearConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }} onClick={() => setShowClearConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#111827', border: '1px solid #1e2a35',
            borderRadius: '12px', padding: '1.25rem', width: '100%', maxWidth: '340px', margin: '0 1rem',
          }}>
            <h4 style={{ color: '#fff', fontSize: '0.95rem', margin: '0 0 0.5rem', fontWeight: '600' }}>
              {t('battleLayout.clearConfirmTitle', 'Clear All Cities?')}
            </h4>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', lineHeight: 1.5, margin: '0 0 1rem' }}>
              {t('battleLayout.clearConfirmDesc', 'This will remove all {{count}} placed cities. Castle and turrets will remain.', { count: designer.userCityCount })}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <Button variant="ghost" size="sm" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={() => { designer.clearAll(); setShowClearConfirm(false); }}
                style={{ backgroundColor: '#ef4444', color: '#fff', borderColor: '#ef4444' }}>Clear All</Button>
            </div>
          </div>
        </div>
      )}

      {/* Share toast notification */}
      {shareToast && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#22c55e', color: '#fff', padding: '0.6rem 1.25rem',
          borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600',
          boxShadow: '0 4px 20px rgba(34,197,94,0.3)', zIndex: 1000,
          animation: 'fadeInUp 0.3s ease',
        }}>
          📋 {t('battleLayout.shareSuccess', 'Layout image copied to clipboard!')}
        </div>
      )}
    </div>
  );
};

export default KvKBattleLayout;
