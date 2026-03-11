import React, { useRef, useCallback, useEffect, useState } from 'react';
import BackLink from '../components/shared/BackLink';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useBaseDesigner } from '../hooks/useBaseDesigner';
import { useAllianceRoster } from '../hooks/useAllianceRoster';
import { useToolAccess } from '../hooks/useToolAccess';
import { getBuildingType } from '../config/allianceBuildings';
import { useAuth } from '../contexts/AuthContext';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { Button } from '../components/shared';
import DesignModal from '../components/base-designer/DesignModal';
import BuildingPalette from '../components/base-designer/BuildingPalette';
import GridCanvas, { g2s } from '../components/base-designer/GridCanvas';
import { AccessGate, MapControls, SidebarSection, CoordinateSearch } from '../components/base-designer/DesignerWidgets';
import ToolDelegates from '../components/ToolDelegates';

// ─── Main Page ───
const AllianceBaseDesigner: React.FC = () => {
  useDocumentTitle('Alliance Base Designer');
  useStructuredData({
    type: 'BreadcrumbList',
    data: [
      ...(PAGE_BREADCRUMBS.tools || []),
      { name: 'Alliance Base Designer', url: 'https://ks-atlas.com/tools/base-designer' },
    ],
  });
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { user } = useAuth();

  // Alliance roster names for city label autocomplete (lightweight — no profile/troop waterfall)
  const roster = useAllianceRoster();
  const { hasAccess, reason } = useToolAccess();

  // Load the alliance owner's design so all members see the same base
  // For the owner, this equals their own ID; for delegates/members, it loads the owner's design
  const designOwnerId = roster.ownerId;
  const designer = useBaseDesigner(undefined, designOwnerId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 600 });
  const [modalMode, setModalMode] = useState<'save' | 'load' | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobilePanelTab, setMobilePanelTab] = useState<'buildings' | 'nav'>('buildings');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [autoSaveFlash, setAutoSaveFlash] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingLabel, setEditingLabel] = useState<{ buildingId: string; screenX: number; screenY: number; value: string } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [shareMenu, setShareMenu] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Determine edit permission: admin always edits; owner always edits; manager/delegate need tool access
  const canEdit = reason === 'admin' || roster.accessRole === 'owner' || (user && roster.ownerId === user.id) || (hasAccess && (roster.accessRole === 'manager' || (roster.accessRole === 'delegate' && roster.hasDelegateAccessTo('base_designer'))));
  const rosterNames = roster.sortedNames;
  const [labelSuggestions, setLabelSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(-1);

  // Swipe-to-dismiss refs for floating action chip
  const fabSwipeStart = useRef<number | null>(null);

  // Share handlers
  const handleShareLink = useCallback(async () => {
    if (!user) { setShareToast(t('baseDesigner.loginToShare', 'Log in to share designs')); setTimeout(() => setShareToast(null), 2500); return; }
    try {
      const result = await designer.saveDesign();
      const token = await designer.getShareToken(result.id);
      if (token) {
        const url = `${window.location.origin}/tools/base-designer/view/${token}`;
        await navigator.clipboard.writeText(url);
        setShareToast(t('baseDesigner.linkCopied', 'Share link copied to clipboard!'));
      } else {
        setShareToast(t('baseDesigner.shareFailed', 'Could not generate share link'));
      }
    } catch {
      setShareToast(t('baseDesigner.shareFailed', 'Could not generate share link'));
    }
    setShareMenu(false);
    setTimeout(() => setShareToast(null), 2500);
  }, [user, designer, t]);

  const handleShareImage = useCallback(async () => {
    const canvas = containerRef.current?.querySelector('canvas');
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setShareToast(t('baseDesigner.imageCopied', 'Base image copied to clipboard!'));
      }
    } catch {
      // Fallback: download
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${designer.designName || 'base-design'}.png`;
      a.click();
      setShareToast(t('baseDesigner.imageDownloaded', 'Base image downloaded!'));
    }
    setShareMenu(false);
    setTimeout(() => setShareToast(null), 2500);
  }, [designer.designName, t]);

  // Desktop: Enter key opens inline label editor for selected building
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key !== 'Enter') return;
      if (!canEdit) return; // Read-only mode
      if (editingLabel) return; // Already editing
      const sel = designer.selectedBuildingId
        ? designer.buildings.find(b => b.id === designer.selectedBuildingId)
        : null;
      if (!sel) return;
      const type = getBuildingType(sel.typeId);
      if (!type?.labelField) return;
      e.preventDefault();
      // Compute screen position of building center using g2s
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

  // Flash auto-saved indicator when buildings change
  useEffect(() => {
    if (designer.buildings.length === 0) return;
    setAutoSaveFlash(true);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => setAutoSaveFlash(false), 2000);
  }, [designer.buildings, designer.designName]);

  // Canvas fills available space
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setCanvasSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Navigate to specific coordinates
  const goToCoords = useCallback((x: number, y: number) => {
    designer.setCenterX(x);
    designer.setCenterY(y);
    designer.setZoom(Math.max(designer.zoom, 15));
  }, [designer]);

  // Focus on the center of all placed buildings
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

  // Check if any territory-providing buildings (HQ/Banner) are placed
  const hasTerritory = designer.buildings.some(b => {
    const bt = getBuildingType(b.typeId);
    return !!bt?.territoryRadius;
  });

  const selectedBuilding = designer.selectedBuildingId
    ? designer.buildings.find((b) => b.id === designer.selectedBuildingId) ?? null
    : null;
  const selectedBuildingType = selectedBuilding ? getBuildingType(selectedBuilding.typeId) : undefined;

  const sidebarBtnStyle: React.CSSProperties = {
    padding: '0.3rem 0.5rem', backgroundColor: '#0d1117', border: '1px solid #1e2a35',
    borderRadius: '4px', color: '#9ca3af', cursor: 'pointer', fontSize: '0.65rem',
    fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.2rem', whiteSpace: 'nowrap',
  };

  const mobileBtnStyle: React.CSSProperties = {
    padding: '0.35rem 0.45rem', backgroundColor: '#0d1117', border: '1px solid #1e2a35',
    borderRadius: '6px', color: '#9ca3af', cursor: 'pointer', fontSize: '0.85rem',
    fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center',
    minWidth: '44px', minHeight: '44px', WebkitTapHighlightColor: 'transparent',
  };

  // ─── Desktop Layout ───
  if (!isMobile) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0a0a0a', overflow: 'hidden' }}>
        {/* Compact centered header */}
        <div style={{
          padding: '0.6rem 1.5rem',
          background: 'linear-gradient(180deg, #111827 0%, #0d1117 100%)',
          borderBottom: '1px solid #1e2a35',
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 'bold', fontFamily: FONT_DISPLAY, letterSpacing: '0.05em', margin: 0 }}>
            <span style={{ color: '#fff' }}>ALLIANCE BASE </span>
            <span style={neonGlow('#3b82f6')}>DESIGNER</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.2rem 0 0', letterSpacing: '0.02em' }}>
            Plan and coordinate your alliance fortress layout
          </p>
        </div>

        <AccessGate>
          {/* Workspace fills remaining viewport */}
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
                {canEdit && <><button style={sidebarBtnStyle} onClick={designer.undo} disabled={!designer.canUndo} title="Undo (Ctrl+Z)">↩ {t('baseDesigner.btnUndo', 'Undo')}</button>
                <button style={sidebarBtnStyle} onClick={designer.redo} disabled={!designer.canRedo} title="Redo (Ctrl+Y)">↪ {t('baseDesigner.btnRedo', 'Redo')}</button>
                <div style={{ width: '1px', height: '20px', backgroundColor: '#1e2a35' }} />
                <button style={sidebarBtnStyle} onClick={() => setModalMode('save')} title="Save">💾 {t('baseDesigner.btnSave', 'Save')}</button></>}
                <button style={sidebarBtnStyle} onClick={() => setModalMode('load')} title="Load">📂 {t('baseDesigner.btnLoad', 'Load')}</button>
                <div style={{ width: '1px', height: '20px', backgroundColor: '#1e2a35' }} />
                <button
                  style={{ ...sidebarBtnStyle, ...(designer.showLabels ? { backgroundColor: '#3b82f615', borderColor: '#3b82f640', color: '#3b82f6' } : {}) }}
                  onClick={() => designer.setShowLabels(!designer.showLabels)} title="Toggle Labels"
                >🏷️ {t('baseDesigner.btnLabel', 'Label')}</button>
                {canEdit && <><button
                  style={{ ...sidebarBtnStyle, position: 'relative' }}
                  onClick={() => setShareMenu(!shareMenu)} title="Share"
                >📤 {t('baseDesigner.btnShare', 'Share')}</button>
                <button
                  style={{ ...sidebarBtnStyle, borderColor: '#ef444440', color: '#ef4444' }}
                  onClick={() => setShowClearConfirm(true)} title="Clear All"
                >🗑️ {t('baseDesigner.btnClear', 'Clear')}</button></>}
              </div>

              {/* Read-only banner */}
              {!canEdit && (
                <div style={{ padding: '0.4rem 0.75rem', backgroundColor: '#f59e0b12', borderBottom: '1px solid #f59e0b30', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ fontSize: '0.7rem' }}>👁️</span>
                  <span style={{ color: '#f59e0b', fontSize: '0.6rem', fontWeight: '600' }}>{t('baseDesigner.readOnly', 'View Only')}</span>
                </div>
              )}

              {/* Design name */}
              <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #1e2a35' }}>
                <div style={{ color: '#6b7280', fontSize: '0.6rem', marginBottom: '3px' }}>Design Name</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input
                    type="text" value={designer.designName} onChange={(e) => canEdit && designer.setDesignName(e.target.value)}
                    readOnly={!canEdit}
                    placeholder="Untitled..." style={{
                      flex: 1, padding: '0.25rem 0.4rem', backgroundColor: '#0a0a0a', border: '1px solid #1e2a35',
                      borderRadius: '4px', color: '#e5e7eb', fontSize: '0.7rem', outline: 'none', boxSizing: 'border-box',
                      ...(canEdit ? {} : { opacity: 0.6, cursor: 'default' }),
                    }}
                  />
                  {canEdit && designer.isDirty && <span style={{ fontSize: '0.55rem', color: '#f59e0b' }}>●</span>}
                </div>
              </div>

              {/* Navigate */}
              <SidebarSection title={t('baseDesigner.navigate', 'Navigate')} defaultOpen={true}>
                <CoordinateSearch onGo={goToCoords} onFocusBase={focusOnBase} hasBuildings={designer.buildings.length > 0} />
              </SidebarSection>

              {/* Buildings */}
              {canEdit && (
                <SidebarSection title="Buildings" defaultOpen={true}>
                  <BuildingPalette
                    selectedToolType={designer.selectedToolType}
                    buildingCounts={designer.buildingCounts}
                    onSelectTool={designer.setSelectedToolType}
                    hasTerritory={hasTerritory}
                  />
                </SidebarSection>
              )}

              {/* Properties */}
              {canEdit && selectedBuilding && selectedBuildingType && (
                <SidebarSection title="Properties" defaultOpen={true}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1rem' }}>{selectedBuildingType.icon}</span>
                    <div>
                      <div style={{ color: selectedBuildingType.color, fontSize: '0.75rem', fontWeight: '700' }}>{selectedBuildingType.name}</div>
                      <div style={{ color: '#4b5563', fontSize: '0.6rem' }}>{selectedBuildingType.size}×{selectedBuildingType.size} • ({selectedBuilding.x}, {selectedBuilding.y})</div>
                    </div>
                  </div>
                  {selectedBuildingType.labelField && (
                    <div style={{ marginBottom: '0.5rem', position: 'relative' }}>
                      <div style={{ color: '#6b7280', fontSize: '0.6rem', marginBottom: '2px' }}>
                        {selectedBuildingType.labelField === 'playerName' ? 'Player Name' : 'Time Slot (UTC)'}
                      </div>
                      <input type="text" value={selectedBuilding.label || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          designer.updateBuildingLabel(selectedBuilding.id, val);
                          if (selectedBuildingType.labelField === 'playerName' && rosterNames.length > 0 && val.trim()) {
                            const filtered = rosterNames.filter(n => n.toLowerCase().includes(val.toLowerCase()) && n.toLowerCase() !== val.toLowerCase());
                            setLabelSuggestions(filtered.slice(0, 6));
                            setSelectedSuggestionIdx(-1);
                          } else {
                            setLabelSuggestions([]);
                          }
                        }}
                        onFocus={() => {
                          const val = selectedBuilding.label || '';
                          if (selectedBuildingType.labelField === 'playerName' && rosterNames.length > 0 && val.trim()) {
                            const filtered = rosterNames.filter(n => n.toLowerCase().includes(val.toLowerCase()) && n.toLowerCase() !== val.toLowerCase());
                            setLabelSuggestions(filtered.slice(0, 6));
                          }
                        }}
                        onBlur={() => setTimeout(() => setLabelSuggestions([]), 150)}
                        onKeyDown={(e) => {
                          if (labelSuggestions.length > 0) {
                            if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedSuggestionIdx(i => Math.min(i + 1, labelSuggestions.length - 1)); }
                            else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedSuggestionIdx(i => Math.max(i - 1, -1)); }
                            else if (e.key === 'Enter' && selectedSuggestionIdx >= 0) {
                              e.preventDefault();
                              const name = labelSuggestions[selectedSuggestionIdx];
                              if (name) { designer.updateBuildingLabel(selectedBuilding.id, name); setLabelSuggestions([]); }
                            }
                          }
                        }}
                        placeholder={selectedBuildingType.labelField === 'playerName' ? (rosterNames.length > 0 ? 'Type or pick from roster...' : 'e.g. PlayerOne') : 'e.g. 14:00'}
                        style={{
                          width: '100%', padding: '0.25rem 0.4rem', backgroundColor: '#0a0a0a',
                          border: '1px solid #1e2a35', borderRadius: '4px', color: '#e5e7eb',
                          fontSize: '0.7rem', outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                      {labelSuggestions.length > 0 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
                          backgroundColor: '#111827', border: '1px solid #3b82f640', borderRadius: '4px',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.5)', maxHeight: '140px', overflowY: 'auto',
                        }}>
                          {labelSuggestions.map((name, i) => (
                            <button key={name}
                              onMouseDown={(e) => { e.preventDefault(); designer.updateBuildingLabel(selectedBuilding.id, name); setLabelSuggestions([]); }}
                              style={{
                                width: '100%', padding: '0.3rem 0.5rem', border: 'none', textAlign: 'left',
                                backgroundColor: i === selectedSuggestionIdx ? '#3b82f620' : 'transparent',
                                color: '#e5e7eb', fontSize: '0.7rem', cursor: 'pointer', display: 'block',
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#3b82f615'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = i === selectedSuggestionIdx ? '#3b82f620' : 'transparent'; }}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <button onClick={() => designer.removeBuilding(selectedBuilding.id)} style={{
                    width: '100%', padding: '0.3rem', backgroundColor: '#ef444415', border: '1px solid #ef444440',
                    borderRadius: '4px', color: '#ef4444', cursor: 'pointer', fontSize: '0.65rem', fontWeight: '600',
                  }}>
                    🗑️ Remove
                  </button>
                </SidebarSection>
              )}

              {/* Delegates */}
              {canEdit && (
                <SidebarSection title={t('baseDesigner.delegates', 'Delegates')} defaultOpen={false}>
                  <ToolDelegates />
                </SidebarSection>
              )}

              {/* Tips */}
              <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.55rem', color: '#4b5563', lineHeight: 1.6 }}>
                {canEdit
                  ? <><strong style={{ color: '#6b7280' }}>Shortcuts:</strong> Click to place · Drag to move · Delete to remove · Enter to edit name · Ctrl+Z undo · Ctrl+C/V copy/paste · Double-click to edit name · Scroll to pan · Pinch to zoom</>
                  : <><strong style={{ color: '#6b7280' }}>Navigation:</strong> Scroll to pan · Pinch to zoom · Arrow keys to move</>
                }
              </div>

              {/* Reset to Default */}
              {canEdit && <div style={{ padding: '0.5rem 0.75rem' }}>
                <button
                  onClick={() => {
                    if (confirm('Reset everything? This clears all buildings, viewport, and design name from local storage.')) {
                      designer.clearAll();
                      designer.setDesignName('');
                      designer.setCenterX(600);
                      designer.setCenterY(600);
                      designer.setZoom(8);
                      try {
                        localStorage.removeItem('atlas_base_designer_session');
                      } catch { /* storage unavailable */ }
                    }
                  }}
                  style={{
                    width: '100%', padding: '0.3rem',
                    backgroundColor: 'transparent', border: '1px solid #1e2a35',
                    borderRadius: '4px', color: '#6b7280', cursor: 'pointer',
                    fontSize: '0.6rem', fontWeight: '500',
                  }}
                >
                  ↺ Reset to Default
                </button>
              </div>}

              {/* Back link */}
              <div style={{ padding: '0.5rem 0.75rem', marginTop: 'auto', borderTop: '1px solid #1e2a35' }}>
                <BackLink to="/alliance-center" label={t('baseDesigner.backToAlliance', 'Alliance Center')} variant="secondary" />
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

              {/* Status bar overlay */}
              <div style={{
                position: 'absolute', top: 8, left: 44, zIndex: 10,
                display: 'flex', gap: '0.5rem', fontSize: '0.55rem', color: '#4b5563',
                backgroundColor: '#0d1117aa', padding: '0.2rem 0.5rem', borderRadius: '4px',
                backdropFilter: 'blur(6px)',
              }}>
                <span>({Math.round(designer.centerX)}, {Math.round(designer.centerY)})</span>
                <span>Zoom: {designer.zoom.toFixed(1)}</span>
                {designer.hoveredCell && <span>Cursor: ({designer.hoveredCell.x}, {designer.hoveredCell.y})</span>}
                <span>{designer.buildings.length} bldgs</span>
                {autoSaveFlash && <span style={{ color: '#22c55e', transition: 'opacity 0.3s' }}>✓ Saved</span>}
              </div>

              <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
                <GridCanvas
                  designer={designer}
                  canvasWidth={canvasSize.width}
                  canvasHeight={canvasSize.height}
                  readOnly={!canEdit}
                  onEditBuilding={canEdit ? (building, sx, sy) => {
                    setEditingLabel({ buildingId: building.id, screenX: sx, screenY: sy, value: building.label || '' });
                    designer.setSelectedBuildingId(building.id);
                    setTimeout(() => editInputRef.current?.focus(), 50);
                  } : undefined}
                />
                {/* Inline label editor overlay with autocomplete */}
                {editingLabel && (() => {
                  const bld = designer.buildings.find(b => b.id === editingLabel.buildingId);
                  const isCity = bld ? getBuildingType(bld.typeId)?.labelField === 'playerName' : false;
                  const inlineSuggestions = isCity && editingLabel.value.trim() && rosterNames.length > 0
                    ? rosterNames.filter(n => n.toLowerCase().includes(editingLabel.value.toLowerCase()) && n.toLowerCase() !== editingLabel.value.toLowerCase()).slice(0, 5)
                    : [];
                  return (
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
                          backgroundColor: '#111827', border: '1px solid #3b82f6',
                          borderRadius: '4px', color: '#fff', fontSize: '0.75rem',
                          outline: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
                          textAlign: 'center',
                        }}
                      />
                      {inlineSuggestions.length > 0 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
                          backgroundColor: '#111827', border: '1px solid #3b82f640', borderRadius: '4px',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.5)', maxHeight: '120px', overflowY: 'auto',
                        }}>
                          {inlineSuggestions.map((name) => (
                            <button key={name}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                designer.updateBuildingLabel(editingLabel.buildingId, name);
                                setEditingLabel(prev => prev ? { ...prev, value: name } : null);
                                setTimeout(() => setEditingLabel(null), 50);
                              }}
                              style={{
                                width: '100%', padding: '0.25rem 0.5rem', border: 'none', textAlign: 'left',
                                backgroundColor: 'transparent', color: '#e5e7eb', fontSize: '0.7rem', cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#3b82f615'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <MapControls designer={designer} isMobile={false} />
            </div>
          </div>
        </AccessGate>

        <DesignModal mode={modalMode} onClose={() => setModalMode(null)} designer={designer} />

        {/* Share menu popup */}
        {shareMenu && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 998,
          }} onClick={() => setShareMenu(false)}>
            <div onClick={(e) => e.stopPropagation()} style={{
              position: 'absolute', top: isMobile ? 54 : 90, left: isMobile ? 'auto' : 200, right: isMobile ? 12 : 'auto',
              backgroundColor: '#111827', border: '1px solid #1e2a35', borderRadius: '8px',
              padding: '0.5rem', width: '180px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 999,
            }}>
              <button onClick={handleShareLink} style={{
                width: '100%', padding: '0.5rem 0.6rem', backgroundColor: 'transparent',
                border: 'none', borderRadius: '4px', color: '#e5e7eb', cursor: 'pointer',
                fontSize: '0.7rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.4rem',
              }} onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = '#1e2a35'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}>
                🔗 {t('baseDesigner.shareLink', 'Copy Share Link')}
              </button>
              <button onClick={handleShareImage} style={{
                width: '100%', padding: '0.5rem 0.6rem', backgroundColor: 'transparent',
                border: 'none', borderRadius: '4px', color: '#e5e7eb', cursor: 'pointer',
                fontSize: '0.7rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.4rem',
              }} onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = '#1e2a35'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}>
                🖼️ {t('baseDesigner.shareImage', 'Copy as Image')}
              </button>
            </div>
          </div>
        )}

        {/* Share toast */}
        {shareToast && (
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            backgroundColor: '#111827', border: '1px solid #3b82f640', borderRadius: '8px',
            padding: '0.5rem 1rem', color: '#3b82f6', fontSize: '0.75rem', fontWeight: '600',
            zIndex: 1001, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            animation: 'fadeIn 0.2s ease',
          }}>
            {shareToast}
          </div>
        )}

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
              <h4 style={{ color: '#fff', fontSize: '0.95rem', margin: '0 0 0.5rem', fontWeight: '600' }}>Clear All Buildings?</h4>
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', lineHeight: 1.5, margin: '0 0 1rem' }}>
                This will remove all {designer.buildings.length} placed buildings. This action cannot be undone.
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
          <span style={{ color: '#fff' }}>BASE </span>
          <span style={neonGlow('#3b82f6')}>DESIGNER</span>
        </h1>
        <div style={{ position: 'absolute', right: '0.75rem' }}>
          <BackLink to="/alliance-center" label={t('baseDesigner.backToAlliance', 'Alliance Center')} variant="secondary" />
        </div>
      </div>

      {/* Canvas fills most of the screen — minHeight prevents bottom panel from compressing it */}
      <div ref={containerRef} style={{ flex: 1, minHeight: '55vh', position: 'relative', overflow: 'hidden', WebkitTouchCallout: 'none' } as React.CSSProperties}>
        <GridCanvas
          designer={designer}
          canvasWidth={canvasSize.width}
          canvasHeight={canvasSize.height}
          readOnly={!canEdit}
          onEditBuilding={canEdit ? (building, sx, sy) => {
            setEditingLabel({ buildingId: building.id, screenX: sx, screenY: sy, value: building.label || '' });
            designer.setSelectedBuildingId(building.id);
            setTimeout(() => editInputRef.current?.focus(), 50);
          } : undefined}
        />
        {/* Inline label editor overlay (mobile) with autocomplete */}
        {editingLabel && (() => {
          const bld = designer.buildings.find(b => b.id === editingLabel.buildingId);
          const isCity = bld ? getBuildingType(bld.typeId)?.labelField === 'playerName' : false;
          const mSugg = isCity && editingLabel.value.trim() && rosterNames.length > 0
            ? rosterNames.filter(n => n.toLowerCase().includes(editingLabel.value.toLowerCase()) && n.toLowerCase() !== editingLabel.value.toLowerCase()).slice(0, 5) : [];
          return (<div style={{ position: 'absolute', left: Math.max(8, Math.min(editingLabel.screenX - 70, canvasSize.width - 156)), top: editingLabel.screenY - 14, zIndex: 20 }}>
            <input ref={editInputRef} type="text" value={editingLabel.value}
              onChange={(e) => { const val = e.target.value; setEditingLabel((prev) => prev ? { ...prev, value: val } : null); designer.updateBuildingLabel(editingLabel.buildingId, val); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setEditingLabel(null); } }}
              onBlur={() => setTimeout(() => setEditingLabel(null), 150)} placeholder="Name..."
              style={{ width: '140px', padding: '0.25rem 0.5rem', backgroundColor: '#111827', border: '1px solid #3b82f6', borderRadius: '4px', color: '#fff', fontSize: '0.75rem', outline: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.5)', textAlign: 'center', userSelect: 'text', WebkitUserSelect: 'text' } as React.CSSProperties} />
            {mSugg.length > 0 && (<div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, backgroundColor: '#111827', border: '1px solid #3b82f640', borderRadius: '4px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)', maxHeight: '120px', overflowY: 'auto' }}>
              {mSugg.map((name) => (<button key={name} onMouseDown={(e) => { e.preventDefault(); designer.updateBuildingLabel(editingLabel.buildingId, name); setEditingLabel(prev => prev ? { ...prev, value: name } : null); setTimeout(() => setEditingLabel(null), 50); }}
                style={{ width: '100%', padding: '0.25rem 0.5rem', border: 'none', textAlign: 'left', backgroundColor: 'transparent', color: '#e5e7eb', fontSize: '0.7rem', cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#3b82f615'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>{name}</button>))}
            </div>)}
          </div>);
        })()}

        {/* Mobile floating toolbar — icon-only compact buttons */}
        <div style={{
          position: 'absolute', top: 8, left: 8, right: 8, zIndex: 10,
          display: 'flex', gap: '0.3rem', alignItems: 'center',
          backgroundColor: '#0d1117dd', padding: '0.3rem 0.4rem', borderRadius: '10px',
          backdropFilter: 'blur(10px)', border: '1px solid #1e2a35',
        }}>
          {canEdit && <>
            <button style={mobileBtnStyle} onClick={designer.undo} disabled={!designer.canUndo} title={t('baseDesigner.btnUndo', 'Undo')}>↩</button>
            <button style={mobileBtnStyle} onClick={designer.redo} disabled={!designer.canRedo} title={t('baseDesigner.btnRedo', 'Redo')}>↪</button>
            <button style={mobileBtnStyle} onClick={() => setModalMode('save')} title={t('baseDesigner.btnSave', 'Save')}>💾</button>
          </>}
          <button style={mobileBtnStyle} onClick={() => setModalMode('load')} title={t('baseDesigner.btnLoad', 'Load')}>📂</button>
          <button
            style={{ ...mobileBtnStyle, ...(designer.showLabels ? { backgroundColor: '#3b82f615', borderColor: '#3b82f640', color: '#3b82f6' } : {}) }}
            onClick={() => designer.setShowLabels(!designer.showLabels)} title={t('baseDesigner.btnLabel', 'Label')}
          >🏷️</button>
          {canEdit && <button style={mobileBtnStyle} onClick={() => setShareMenu(!shareMenu)} title={t('baseDesigner.btnShare', 'Share')}>📤</button>}
          <div style={{ flex: 1 }} />
          {!canEdit && <span style={{ fontSize: '0.55rem', color: '#f59e0b', fontWeight: '600' }}>👁️ {t('baseDesigner.readOnly', 'View Only')}</span>}
          <span style={{ fontSize: '0.55rem', color: '#4b5563' }}>{designer.buildings.length} bldgs</span>
        </div>

        {/* Floating action buttons for selected building (bottom-right) — edit mode only */}
        {canEdit && selectedBuilding && selectedBuildingType && (
          <div style={{
            position: 'absolute', bottom: 12, right: 12, zIndex: 10,
            display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end',
          }}>
            {/* Building info chip — swipe right to dismiss */}
            <div
              onTouchStart={(e) => { fabSwipeStart.current = e.touches[0]!.clientX; }}
              onTouchEnd={(e) => {
                if (fabSwipeStart.current !== null) {
                  const dx = e.changedTouches[0]!.clientX - fabSwipeStart.current;
                  if (dx > 60) { designer.setSelectedBuildingId(null); }
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
              <span style={{ color: '#4b556380', fontSize: '0.45rem', marginLeft: '0.2rem' }}>→</span>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {/* Rename button (only if building supports labels) */}
              {selectedBuildingType.labelField && (
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
                    border: '1px solid #3b82f640', borderRadius: '8px',
                    color: '#3b82f6', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600',
                    backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: '0.25rem',
                    touchAction: 'manipulation',
                  }}
                >
                  ✏️ {t('baseDesigner.renameBtn', 'Rename')}
                </button>
              )}
              {/* Remove button */}
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

      {/* Mobile bottom panel with tabs — maxHeight + scroll to avoid compressing the map */}
      <div style={{ borderTop: '1px solid #1e2a35', backgroundColor: '#0d1117', maxHeight: '40vh', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e2a35' }}>
          {(canEdit ? ['buildings', 'nav'] as const : ['nav'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobilePanelTab(tab)}
              style={{
                flex: 1, padding: '0.5rem', backgroundColor: 'transparent', border: 'none',
                color: mobilePanelTab === tab ? '#3b82f6' : '#6b7280', cursor: 'pointer',
                fontSize: '0.7rem', fontWeight: mobilePanelTab === tab ? '700' : '400',
                borderBottom: mobilePanelTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
              }}
            >
              {tab === 'buildings' ? t('baseDesigner.buildTab', '🧱 Buildings') : t('baseDesigner.navTab', '🧭 Navigate')}
            </button>
          ))}
        </div>

        {/* Tab content — scrollable within constrained panel height */}
        <div style={{ padding: '0.5rem 0.75rem', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {canEdit && mobilePanelTab === 'buildings' && (
            <BuildingPalette
              selectedToolType={designer.selectedToolType}
              buildingCounts={designer.buildingCounts}
              onSelectTool={designer.setSelectedToolType}
              hasTerritory={hasTerritory}
              compact
            />
          )}

          {mobilePanelTab === 'nav' && (
            <div>
              <CoordinateSearch onGo={goToCoords} onFocusBase={focusOnBase} hasBuildings={designer.buildings.length > 0} />
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ color: '#6b7280', fontSize: '0.6rem', marginBottom: '3px' }}>{t('baseDesigner.designName', 'Design Name')}</div>
                <input type="text" value={designer.designName} onChange={(e) => canEdit && designer.setDesignName(e.target.value)}
                  readOnly={!canEdit}
                  style={{ width: '100%', padding: '0.25rem 0.4rem', backgroundColor: '#0a0a0a', border: '1px solid #1e2a35', borderRadius: '4px', color: '#e5e7eb', fontSize: '0.7rem', outline: 'none', boxSizing: 'border-box', userSelect: 'text', WebkitUserSelect: 'text', ...(canEdit ? {} : { opacity: 0.6, cursor: 'default' }) } as React.CSSProperties}
                />
              </div>
              {canEdit && <div style={{ marginTop: '0.75rem', borderTop: '1px solid #1e2a35', paddingTop: '0.5rem' }}>
                <div style={{ color: '#6b7280', fontSize: '0.6rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                  {t('baseDesigner.delegates', 'Delegates')}
                </div>
                <ToolDelegates />
              </div>}
            </div>
          )}
        </div>
      </div>

      <DesignModal mode={modalMode} onClose={() => setModalMode(null)} designer={designer} />
    </div>
  );
};

export default AllianceBaseDesigner;
