import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useBaseDesigner, PlacedBuilding } from '../hooks/useBaseDesigner';
import { BUILDING_TYPES, BUILDING_CATEGORIES, getBuildingType } from '../config/allianceBuildings';
import { useToolAccess } from '../hooks/useToolAccess';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';

// ─── Isometric Coordinate Transforms ───
// Grid: (0,0)=bottom, (1199,1199)=top, (0,1199)=left, (1199,0)=right
const g2s = (gx: number, gy: number, cx: number, cy: number, hc: number, cw: number, ch: number) => ({
  x: ((gx - cx) - (gy - cy)) * hc + cw / 2,
  y: -((gx - cx) + (gy - cy)) * hc + ch / 2,
});
const s2g = (sx: number, sy: number, cx: number, cy: number, hc: number, cw: number, ch: number) => {
  const px = (sx - cw / 2) / hc;
  const py = -(sy - ch / 2) / hc;
  return { x: Math.floor((px + py) / 2 + cx), y: Math.floor((py - px) / 2 + cy) };
};

// ─── Access Gate ───
const AccessGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hasAccess } = useToolAccess();
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!hasAccess) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2 style={{ color: '#fff', fontFamily: FONT_DISPLAY, fontSize: '1.5rem', marginBottom: '0.75rem' }}>{t('baseDesigner.pageTitle', 'Alliance Base Designer')}</h2>
        <p style={{ color: '#9ca3af', maxWidth: '400px', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          {t('baseDesigner.gateDesc', 'This tool is available to Atlas Supporters, Ambassadors, Discord Server Boosters, and Admins. Support Atlas to unlock powerful alliance management tools.')}
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => navigate('/support')} style={{ padding: '0.6rem 1.5rem', backgroundColor: '#22d3ee', color: '#000', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}>
            {t('baseDesigner.becomeSupporter', 'Become a Supporter')}
          </button>
          <Link to="/tools" style={{ padding: '0.6rem 1.5rem', backgroundColor: 'transparent', color: '#9ca3af', border: '1px solid #333', borderRadius: '8px', textDecoration: 'none', fontSize: '0.9rem' }}>
            {t('baseDesigner.backToTools', 'Back to Tools')}
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};

// ─── Grid Canvas (Isometric Diamond) ───
interface GridCanvasProps {
  designer: ReturnType<typeof useBaseDesigner>;
  canvasWidth: number;
  canvasHeight: number;
  mapBounds?: { x1: number; y1: number; x2: number; y2: number } | null;
  onEditBuilding?: (building: PlacedBuilding, screenX: number, screenY: number) => void;
}

const GridCanvas: React.FC<GridCanvasProps> = ({ designer, canvasWidth, canvasHeight, mapBounds, onEditBuilding }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(null);
  const touchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  // Mobile gesture refs
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isDraggingTouch = useRef(false);
  const hasMoved = useRef(false);

  const {
    centerX, centerY, zoom, buildings, selectedBuildingId, selectedToolType,
    showLabels, hoveredCell, setHoveredCell, placeBuilding, moveBuilding,
    setSelectedBuildingId, dragBuilding, setDragBuilding,
    setDragOffset, dragOffset, canPlace, panByPixels, zoomBy,
  } = designer;

  const hc = zoom; // half-cell size in px

  // Helper: draw an isometric diamond path for a building at (gx,gy) with given size
  const drawDiamond = (ctx: CanvasRenderingContext2D, gx: number, gy: number, size: number) => {
    const top = g2s(gx + size, gy + size, centerX, centerY, hc, canvasWidth, canvasHeight);
    const right = g2s(gx + size, gy, centerX, centerY, hc, canvasWidth, canvasHeight);
    const bottom = g2s(gx, gy, centerX, centerY, hc, canvasWidth, canvasHeight);
    const left = g2s(gx, gy + size, centerX, centerY, hc, canvasWidth, canvasHeight);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(left.x, left.y);
    ctx.closePath();
  };

  // Draw the isometric grid
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Map boundary diamond (0,0)→(1200,0)→(1200,1200)→(0,1200)
    const bTop = g2s(1200, 1200, centerX, centerY, hc, canvasWidth, canvasHeight);
    const bRight = g2s(1200, 0, centerX, centerY, hc, canvasWidth, canvasHeight);
    const bBottom = g2s(0, 0, centerX, centerY, hc, canvasWidth, canvasHeight);
    const bLeft = g2s(0, 1200, centerX, centerY, hc, canvasWidth, canvasHeight);

    // Fill map area
    ctx.beginPath();
    ctx.moveTo(bTop.x, bTop.y);
    ctx.lineTo(bRight.x, bRight.y);
    ctx.lineTo(bBottom.x, bBottom.y);
    ctx.lineTo(bLeft.x, bLeft.y);
    ctx.closePath();
    ctx.fillStyle = '#131920';
    ctx.fill();

    // Grid lines — adapt spacing to zoom
    const gridStep = hc > 20 ? 1 : hc > 10 ? 5 : hc > 5 ? 10 : 50;
    ctx.strokeStyle = '#1e2a35';
    ctx.lineWidth = 0.5;

    // Compute visible grid range from canvas corners
    const corners = [
      s2g(0, 0, centerX, centerY, hc, canvasWidth, canvasHeight),
      s2g(canvasWidth, 0, centerX, centerY, hc, canvasWidth, canvasHeight),
      s2g(0, canvasHeight, centerX, centerY, hc, canvasWidth, canvasHeight),
      s2g(canvasWidth, canvasHeight, centerX, centerY, hc, canvasWidth, canvasHeight),
    ];
    const minGX = Math.max(0, Math.min(...corners.map(c => c.x)) - 1);
    const maxGX = Math.min(1200, Math.max(...corners.map(c => c.x)) + 2);
    const minGY = Math.max(0, Math.min(...corners.map(c => c.y)) - 1);
    const maxGY = Math.min(1200, Math.max(...corners.map(c => c.y)) + 2);

    const startX = Math.floor(minGX / gridStep) * gridStep;
    const startY = Math.floor(minGY / gridStep) * gridStep;

    // Lines of constant x (diagonal NW-SE in screen)
    for (let x = startX; x <= maxGX; x += gridStep) {
      const y0 = Math.max(0, minGY);
      const y1 = Math.min(1200, maxGY);
      const from = g2s(x, y0, centerX, centerY, hc, canvasWidth, canvasHeight);
      const to = g2s(x, y1, centerX, centerY, hc, canvasWidth, canvasHeight);
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    }
    // Lines of constant y (diagonal NE-SW in screen)
    for (let y = startY; y <= maxGY; y += gridStep) {
      const x0 = Math.max(0, minGX);
      const x1 = Math.min(1200, maxGX);
      const from = g2s(x0, y, centerX, centerY, hc, canvasWidth, canvasHeight);
      const to = g2s(x1, y, centerX, centerY, hc, canvasWidth, canvasHeight);
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    }

    // Map boundary outline
    ctx.beginPath();
    ctx.moveTo(bTop.x, bTop.y);
    ctx.lineTo(bRight.x, bRight.y);
    ctx.lineTo(bBottom.x, bBottom.y);
    ctx.lineTo(bLeft.x, bLeft.y);
    ctx.closePath();
    ctx.strokeStyle = '#22d3ee40';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Corner labels
    ctx.font = `${Math.max(9, hc * 0.8)}px monospace`;
    ctx.fillStyle = '#22d3ee60';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (hc > 4) {
      ctx.fillText('(0,0)', bBottom.x, bBottom.y + 12);
      ctx.fillText('(1199,1199)', bTop.x, bTop.y - 12);
      ctx.fillText('(0,1199)', bLeft.x - 8, bLeft.y);
      ctx.fillText('(1199,0)', bRight.x + 8, bRight.y);
    }

    // Draw user-defined map bounds highlight
    if (mapBounds) {
      const mbTop = g2s(mapBounds.x2, mapBounds.y2, centerX, centerY, hc, canvasWidth, canvasHeight);
      const mbRight = g2s(mapBounds.x2, mapBounds.y1, centerX, centerY, hc, canvasWidth, canvasHeight);
      const mbBottom = g2s(mapBounds.x1, mapBounds.y1, centerX, centerY, hc, canvasWidth, canvasHeight);
      const mbLeft = g2s(mapBounds.x1, mapBounds.y2, centerX, centerY, hc, canvasWidth, canvasHeight);
      ctx.beginPath();
      ctx.moveTo(mbTop.x, mbTop.y);
      ctx.lineTo(mbRight.x, mbRight.y);
      ctx.lineTo(mbBottom.x, mbBottom.y);
      ctx.lineTo(mbLeft.x, mbLeft.y);
      ctx.closePath();
      ctx.fillStyle = '#f59e0b08';
      ctx.fill();
      ctx.strokeStyle = '#f59e0b60';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw placed buildings
    for (const b of buildings) {
      const type = getBuildingType(b.typeId);
      if (!type) continue;

      // Quick visibility check
      const center = g2s(b.x + type.size / 2, b.y + type.size / 2, centerX, centerY, hc, canvasWidth, canvasHeight);
      const extent = type.size * hc * 1.5;
      if (center.x + extent < 0 || center.x - extent > canvasWidth || center.y + extent < 0 || center.y - extent > canvasHeight) continue;

      // Dragged building — ghost + preview
      if (dragBuilding === b.id && dragPreview) {
        const valid = canPlace(b.typeId, dragPreview.x, dragPreview.y, b.id);
        // Ghost
        ctx.globalAlpha = 0.2;
        drawDiamond(ctx, b.x, b.y, type.size);
        ctx.fillStyle = type.color;
        ctx.fill();
        ctx.globalAlpha = 1;
        // Preview
        drawDiamond(ctx, dragPreview.x, dragPreview.y, type.size);
        ctx.fillStyle = valid ? type.color + '80' : '#ef444480';
        ctx.fill();
        ctx.strokeStyle = valid ? type.color : '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();
        continue;
      }

      const isSelected = selectedBuildingId === b.id;

      // Fill diamond
      drawDiamond(ctx, b.x, b.y, type.size);
      ctx.fillStyle = type.color + (isSelected ? 'cc' : '80');
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#fff' : type.color;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // Center point of building
      const bCenter = g2s(b.x + type.size / 2, b.y + type.size / 2, centerX, centerY, hc, canvasWidth, canvasHeight);

      if (b.typeId === 'city') {
        // Player cities: no icon, only centered label when present
        if (showLabels && b.label) {
          // Dynamic font sizing: shrink for longer names (min 5px for readability)
          const baseFontSize = Math.max(7, hc * 0.7);
          const len = b.label.length;
          const dynamicSize = len <= 8 ? baseFontSize
            : len <= 14 ? baseFontSize * 0.8
            : len <= 20 ? baseFontSize * 0.65
            : baseFontSize * 0.55;
          const fontSize = Math.max(5, dynamicSize);
          // Max width: diamond width (~size * hc * 1.8) with padding
          const maxLabelWidth = type.size * hc * 1.6;
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.fillStyle = '#ffffffdd';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(b.label, bCenter.x, bCenter.y, maxLabelWidth);
        }
      } else {
        // All other buildings: show icon
        const iconSize = Math.max(8, hc * type.size * 0.6);
        ctx.font = `${iconSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(type.icon, bCenter.x, bCenter.y);

        // Label below icon
        if (showLabels && b.label) {
          const labelSize = Math.max(6, hc * 0.55);
          const maxLabelWidth = type.size * hc * 1.6;
          ctx.font = `bold ${labelSize}px sans-serif`;
          ctx.fillStyle = '#ffffffcc';
          ctx.textAlign = 'center';
          ctx.fillText(b.label, bCenter.x, bCenter.y + iconSize * 0.6, maxLabelWidth);
        }
      }
    }

    // Hover preview when placing
    if (hoveredCell && selectedToolType) {
      const type = getBuildingType(selectedToolType);
      if (type) {
        const valid = canPlace(selectedToolType, hoveredCell.x, hoveredCell.y);
        drawDiamond(ctx, hoveredCell.x, hoveredCell.y, type.size);
        ctx.fillStyle = valid ? type.color + '40' : '#ef444440';
        ctx.fill();
        ctx.strokeStyle = valid ? type.color : '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Show icon in hover preview (skip for city buildings)
        if (selectedToolType !== 'city') {
          const hCenter = g2s(hoveredCell.x + type.size / 2, hoveredCell.y + type.size / 2, centerX, centerY, hc, canvasWidth, canvasHeight);
          const iconSize = Math.max(8, hc * type.size * 0.5);
          ctx.font = `${iconSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = '#fff';
          ctx.fillText(type.icon, hCenter.x, hCenter.y);
          ctx.globalAlpha = 1;
        }
      }
    }
  }, [
    canvasWidth, canvasHeight, centerX, centerY, hc,
    buildings, selectedBuildingId, selectedToolType, showLabels, hoveredCell,
    dragBuilding, dragPreview, canPlace, mapBounds,
  ]);

  // Screen → grid
  const getCellFromMouse = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (canvasWidth / rect.width);
    const sy = (e.clientY - rect.top) * (canvasHeight / rect.height);
    return s2g(sx, sy, centerX, centerY, hc, canvasWidth, canvasHeight);
  }, [centerX, centerY, hc, canvasWidth, canvasHeight]);

  const getBuildingAtCell = useCallback((cx: number, cy: number): PlacedBuilding | null => {
    for (let i = buildings.length - 1; i >= 0; i--) {
      const b = buildings[i]!;
      const type = getBuildingType(b.typeId);
      if (!type) continue;
      if (cx >= b.x && cx < b.x + type.size && cy >= b.y && cy < b.y + type.size) return b;
    }
    return null;
  }, [buildings]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const cell = getCellFromMouse(e);
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }
    if (selectedToolType) {
      const placed = placeBuilding(selectedToolType, cell.x, cell.y);
      if (placed) setSelectedBuildingId(placed);
      return;
    }
    const building = getBuildingAtCell(cell.x, cell.y);
    if (building) {
      setSelectedBuildingId(building.id);
      setDragBuilding(building.id);
      setDragOffset({ dx: cell.x - building.x, dy: cell.y - building.y });
      setDragPreview(null);
    } else {
      setSelectedBuildingId(null);
      // Left-click on empty space starts panning
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, [getCellFromMouse, selectedToolType, placeBuilding, getBuildingAtCell, setSelectedBuildingId, setDragBuilding, setDragOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const cell = getCellFromMouse(e);
    setHoveredCell(cell);
    if (isPanning && panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        panByPixels(dx, dy);
        setPanStart({ x: e.clientX, y: e.clientY });
      }
      return;
    }
    if (dragBuilding) {
      setDragPreview({ x: cell.x - dragOffset.dx, y: cell.y - dragOffset.dy });
    }
  }, [getCellFromMouse, setHoveredCell, isPanning, panStart, panByPixels, dragBuilding, dragOffset]);

  const handleMouseUp = useCallback(() => {
    if (isPanning) { setIsPanning(false); setPanStart(null); return; }
    if (dragBuilding && dragPreview) moveBuilding(dragBuilding, dragPreview.x, dragPreview.y);
    setDragBuilding(null);
    setDragPreview(null);
  }, [isPanning, dragBuilding, dragPreview, moveBuilding, setDragBuilding]);

  // Native wheel handler (passive: false) to prevent page scroll
  const wheelRef = useRef<((e: WheelEvent) => void) | null>(null);
  wheelRef.current = (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 50) {
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      zoomBy(factor);
    } else {
      panByPixels(-e.deltaX, -e.deltaY);
    }
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => wheelRef.current?.(e);
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, []);

  // Helper: convert touch event to grid cell
  const getCellFromTouch = useCallback((touch: React.Touch): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = (touch.clientX - rect.left) * (canvasWidth / rect.width);
    const sy = (touch.clientY - rect.top) * (canvasHeight / rect.height);
    return s2g(sx, sy, centerX, centerY, hc, canvasWidth, canvasHeight);
  }, [centerX, centerY, hc, canvasWidth, canvasHeight]);

  // Touch support: single-finger pan, two-finger pinch zoom,
  // long-press to drag buildings, double-tap to edit labels
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Cancel any pending long-press
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
      isDraggingTouch.current = false;
      e.preventDefault();
      const t0 = e.touches[0]!, t1 = e.touches[1]!;
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      touchRef.current = { dist, cx: (t0.clientX + t1.clientX) / 2, cy: (t0.clientY + t1.clientY) / 2 };
    } else if (e.touches.length === 1) {
      const touch = e.touches[0]!;
      hasMoved.current = false;
      touchStartPos.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };

      // Check if touch is on a building for long-press drag
      const cell = getCellFromTouch(touch);
      const building = getBuildingAtCell(cell.x, cell.y);

      if (building && !selectedToolType) {
        // Start long-press timer for drag
        longPressTimer.current = setTimeout(() => {
          isDraggingTouch.current = true;
          setSelectedBuildingId(building.id);
          setDragBuilding(building.id);
          setDragOffset({ dx: cell.x - building.x, dy: cell.y - building.y });
          setDragPreview(null);
          // Haptic feedback if available
          if (navigator.vibrate) navigator.vibrate(30);
        }, 500);
      }

      // Start panning (will be overridden if long-press activates)
      setIsPanning(true);
      setPanStart({ x: touch.clientX, y: touch.clientY });
    }
  }, [getCellFromTouch, getBuildingAtCell, selectedToolType, setSelectedBuildingId, setDragBuilding, setDragOffset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchRef.current) {
      e.preventDefault();
      const t0 = e.touches[0]!, t1 = e.touches[1]!;
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const factor = dist / touchRef.current.dist;
      zoomBy(factor);
      const ncx = (t0.clientX + t1.clientX) / 2;
      const ncy = (t0.clientY + t1.clientY) / 2;
      panByPixels(ncx - touchRef.current.cx, ncy - touchRef.current.cy);
      touchRef.current = { dist, cx: ncx, cy: ncy };
    } else if (e.touches.length === 1) {
      const touch = e.touches[0]!;

      // Check if finger moved enough to cancel long-press
      if (touchStartPos.current) {
        const dx = touch.clientX - touchStartPos.current.x;
        const dy = touch.clientY - touchStartPos.current.y;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          hasMoved.current = true;
          if (!isDraggingTouch.current && longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }
      }

      if (isDraggingTouch.current && dragBuilding) {
        // Dragging a building via long-press
        const cell = getCellFromTouch(touch);
        setDragPreview({ x: cell.x - dragOffset.dx, y: cell.y - dragOffset.dy });
      } else if (isPanning && panStart) {
        const dx = touch.clientX - panStart.x;
        const dy = touch.clientY - panStart.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          panByPixels(dx, dy);
          setPanStart({ x: touch.clientX, y: touch.clientY });
        }
      }
    }
  }, [isPanning, panStart, panByPixels, zoomBy, dragBuilding, dragOffset, getCellFromTouch]);

  const handleTouchEnd = useCallback((_e: React.TouchEvent) => {
    // Cancel long-press timer
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }

    // Complete drag if active
    if (isDraggingTouch.current && dragBuilding && dragPreview) {
      moveBuilding(dragBuilding, dragPreview.x, dragPreview.y);
    }
    if (isDraggingTouch.current) {
      setDragBuilding(null);
      setDragPreview(null);
      isDraggingTouch.current = false;
      touchRef.current = null;
      setIsPanning(false);
      setPanStart(null);
      touchStartPos.current = null;
      return;
    }

    // Detect taps (short touch, no significant movement)
    if (touchStartPos.current && !hasMoved.current) {
      const elapsed = Date.now() - touchStartPos.current.time;
      if (elapsed < 300) {
        const now = Date.now();
        const tap = touchStartPos.current;

        // Check for double-tap (two taps within 300ms, within 30px)
        if (lastTapRef.current) {
          const dt = now - lastTapRef.current.time;
          const dist = Math.hypot(tap.x - lastTapRef.current.x, tap.y - lastTapRef.current.y);
          if (dt < 350 && dist < 30 && onEditBuilding) {
            // Double-tap detected
            lastTapRef.current = null;
            const canvas = canvasRef.current;
            if (canvas) {
              const rect = canvas.getBoundingClientRect();
              const sx = (tap.x - rect.left) * (canvasWidth / rect.width);
              const sy = (tap.y - rect.top) * (canvasHeight / rect.height);
              const cell = s2g(sx, sy, centerX, centerY, hc, canvasWidth, canvasHeight);
              const building = getBuildingAtCell(cell.x, cell.y);
              if (building && getBuildingType(building.typeId)?.labelField) {
                onEditBuilding(building, tap.x - rect.left, tap.y - rect.top);
              }
            }
            touchRef.current = null;
            setIsPanning(false);
            setPanStart(null);
            touchStartPos.current = null;
            return;
          }
        }
        lastTapRef.current = { x: tap.x, y: tap.y, time: now };

        // Single tap: select building or place tool
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const sx = (tap.x - rect.left) * (canvasWidth / rect.width);
          const sy = (tap.y - rect.top) * (canvasHeight / rect.height);
          const cell = s2g(sx, sy, centerX, centerY, hc, canvasWidth, canvasHeight);
          if (selectedToolType) {
            const placed = placeBuilding(selectedToolType, cell.x, cell.y);
            if (placed) setSelectedBuildingId(placed);
          } else {
            const building = getBuildingAtCell(cell.x, cell.y);
            setSelectedBuildingId(building ? building.id : null);
          }
        }
      }
    }

    touchRef.current = null;
    setIsPanning(false);
    setPanStart(null);
    touchStartPos.current = null;
  }, [dragBuilding, dragPreview, moveBuilding, setDragBuilding, onEditBuilding,
    centerX, centerY, hc, canvasWidth, canvasHeight, getBuildingAtCell,
    selectedToolType, placeBuilding, setSelectedBuildingId]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      style={{
        borderRadius: '8px',
        border: '1px solid #1e2a35',
        cursor: isPanning ? 'grabbing' : selectedToolType ? 'crosshair' : dragBuilding ? 'grabbing' : 'grab',
        display: 'block',
        width: '100%',
        height: '100%',
        touchAction: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setHoveredCell(null); setIsPanning(false); setPanStart(null); if (dragBuilding) { setDragBuilding(null); setDragPreview(null); } }}
      onDoubleClick={(e) => {
        if (!onEditBuilding) return;
        const cell = getCellFromMouse(e);
        const building = getBuildingAtCell(cell.x, cell.y);
        if (building && getBuildingType(building.typeId)?.labelField) {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          onEditBuilding(building, e.clientX - rect.left, e.clientY - rect.top);
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
};

// ─── Save/Load Modal ───
interface DesignModalProps {
  mode: 'save' | 'load' | null;
  onClose: () => void;
  designer: ReturnType<typeof useBaseDesigner>;
}

const DesignModal: React.FC<DesignModalProps> = ({ mode, onClose, designer }) => {
  const [saveName, setSaveName] = useState(designer.designName);
  const designs = designer.getSavedDesigns();

  if (!mode) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#111',
        borderRadius: '12px',
        border: '1px solid #2a2a2a',
        padding: '1.5rem',
        maxWidth: '440px',
        width: '100%',
        maxHeight: '70vh',
        overflowY: 'auto',
      }} onClick={(e) => e.stopPropagation()}>
        {mode === 'save' && (
          <>
            <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '1rem' }}>💾 Save Design</h3>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Design name..."
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '0.4rem 1rem', backgroundColor: 'transparent', border: '1px solid #333', borderRadius: '6px', color: '#9ca3af', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
              <button
                onClick={() => { designer.setDesignName(saveName); designer.saveDesign(saveName); onClose(); }}
                style={{ padding: '0.4rem 1.2rem', backgroundColor: '#22d3ee', color: '#000', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '0.8rem' }}
              >Save</button>
            </div>
          </>
        )}

        {mode === 'load' && (
          <>
            <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '1rem' }}>📂 Load Design</h3>
            {designs.length === 0 ? (
              <p style={{ color: '#666', fontSize: '0.85rem' }}>No saved designs yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {designs.map((d) => (
                  <div key={d.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem', backgroundColor: '#1a1a1a', borderRadius: '6px', border: '1px solid #2a2a2a',
                  }}>
                    <div>
                      <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600' }}>{d.name}</div>
                      <div style={{ color: '#666', fontSize: '0.6rem' }}>
                        {d.buildings.length} buildings • {new Date(d.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={() => { designer.loadDesign(d.id); onClose(); }}
                        style={{ padding: '0.3rem 0.6rem', backgroundColor: '#22d3ee20', border: '1px solid #22d3ee50', borderRadius: '4px', color: '#22d3ee', cursor: 'pointer', fontSize: '0.7rem' }}>
                        Load
                      </button>
                      <button onClick={() => { if (confirm(`Delete "${d.name}"?`)) designer.deleteDesign(d.id); }}
                        style={{ padding: '0.3rem 0.5rem', backgroundColor: '#ef444420', border: '1px solid #ef444450', borderRadius: '4px', color: '#ef4444', cursor: 'pointer', fontSize: '0.7rem' }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button onClick={onClose} style={{ padding: '0.4rem 1rem', backgroundColor: 'transparent', border: '1px solid #333', borderRadius: '6px', color: '#9ca3af', cursor: 'pointer', fontSize: '0.8rem' }}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Floating Map Controls (D-pad + Zoom) ───
const MapControls: React.FC<{ designer: ReturnType<typeof useBaseDesigner>; isMobile: boolean }> = ({ designer, isMobile }) => {
  const sz = isMobile ? '38px' : '30px';
  const btn: React.CSSProperties = {
    width: sz, height: sz,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0d1117cc', border: '1px solid #1e2a35', borderRadius: '5px',
    color: '#9ca3af', cursor: 'pointer', fontSize: isMobile ? '0.9rem' : '0.75rem',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', touchAction: 'manipulation',
  };

  return (
    <div style={{ position: 'absolute', bottom: isMobile ? 10 : 12, right: isMobile ? 10 : 12, display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px' }}>
        <div />
        <button style={btn} onClick={designer.panUp} title="Pan Up">▲</button>
        <div />
        <button style={btn} onClick={designer.panLeft} title="Pan Left">◀</button>
        <button style={{ ...btn, fontSize: '0.55rem', color: '#22d3ee60' }} onClick={() => { designer.setCenterX(600); designer.setCenterY(600); }} title="Center">⊙</button>
        <button style={btn} onClick={designer.panRight} title="Pan Right">▶</button>
        <div />
        <button style={btn} onClick={designer.panDown} title="Pan Down">▼</button>
        <div />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <button style={btn} onClick={designer.zoomIn} title="Zoom In">＋</button>
        <button style={btn} onClick={designer.zoomOut} title="Zoom Out">−</button>
      </div>
    </div>
  );
};

// ─── Sidebar Section Header ───
const SidebarSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid #1e2a35' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.5rem 0.75rem', backgroundColor: 'transparent', border: 'none',
          color: '#9ca3af', cursor: 'pointer', fontSize: '0.65rem', fontWeight: '700',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}
      >
        {title}
        <span style={{ fontSize: '0.55rem', color: '#4b5563' }}>{open ? '▼' : '▶'}</span>
      </button>
      {open && <div style={{ padding: '0 0.75rem 0.75rem' }}>{children}</div>}
    </div>
  );
};

// ─── Map Bounds Editor ───
interface MapBoundsEditorProps {
  bounds: { x1: number; y1: number; x2: number; y2: number };
  onChange: (b: { x1: number; y1: number; x2: number; y2: number }) => void;
  onFocus: () => void;
}
const MapBoundsEditor: React.FC<MapBoundsEditorProps> = ({ bounds, onChange, onFocus }) => {
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.25rem 0.4rem', backgroundColor: '#0d1117',
    border: '1px solid #1e2a35', borderRadius: '4px', color: '#e5e7eb',
    fontSize: '0.7rem', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { color: '#6b7280', fontSize: '0.6rem', marginBottom: '2px' };
  const parse = (v: string) => Math.max(0, Math.min(1199, parseInt(v) || 0));

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        <div>
          <div style={labelStyle}>Top Corner X</div>
          <input style={inputStyle} type="number" min={0} max={1199} value={bounds.x1}
            onChange={(e) => onChange({ ...bounds, x1: parse(e.target.value) })} />
        </div>
        <div>
          <div style={labelStyle}>Top Corner Y</div>
          <input style={inputStyle} type="number" min={0} max={1199} value={bounds.y1}
            onChange={(e) => onChange({ ...bounds, y1: parse(e.target.value) })} />
        </div>
        <div>
          <div style={labelStyle}>Bottom Corner X</div>
          <input style={inputStyle} type="number" min={0} max={1199} value={bounds.x2}
            onChange={(e) => onChange({ ...bounds, x2: parse(e.target.value) })} />
        </div>
        <div>
          <div style={labelStyle}>Bottom Corner Y</div>
          <input style={inputStyle} type="number" min={0} max={1199} value={bounds.y2}
            onChange={(e) => onChange({ ...bounds, y2: parse(e.target.value) })} />
        </div>
      </div>
      <button
        onClick={onFocus}
        style={{
          width: '100%', marginTop: '0.4rem', padding: '0.3rem',
          backgroundColor: '#f59e0b15', border: '1px solid #f59e0b40', borderRadius: '4px',
          color: '#f59e0b', cursor: 'pointer', fontSize: '0.65rem', fontWeight: '600',
        }}
      >
        Focus on Area
      </button>
    </div>
  );
};

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
  const designer = useBaseDesigner();
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 600 });
  const [modalMode, setModalMode] = useState<'save' | 'load' | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mapBounds, setMapBounds] = useState(() => {
    try {
      const saved = localStorage.getItem('atlas_base_designer_mapbounds');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x1: 550, y1: 550, x2: 650, y2: 650 };
  });
  const [mobilePanelTab, setMobilePanelTab] = useState<'buildings' | 'area' | 'props'>('buildings');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [autoSaveFlash, setAutoSaveFlash] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingLabel, setEditingLabel] = useState<{ buildingId: string; screenX: number; screenY: number; value: string } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Persist mapBounds
  useEffect(() => {
    try { localStorage.setItem('atlas_base_designer_mapbounds', JSON.stringify(mapBounds)); } catch {}
  }, [mapBounds]);

  // Desktop: Enter key opens inline label editor for selected building
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key !== 'Enter') return;
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

  // Focus view on map bounds
  const focusBounds = useCallback(() => {
    const cx = (mapBounds.x1 + mapBounds.x2) / 2;
    const cy = (mapBounds.y1 + mapBounds.y2) / 2;
    designer.setCenterX(cx);
    designer.setCenterY(cy);
    // Auto-zoom to fit the bounds
    const range = Math.max(mapBounds.x2 - mapBounds.x1, mapBounds.y2 - mapBounds.y1, 10);
    const targetZoom = Math.min(40, Math.max(3, Math.min(canvasSize.width, canvasSize.height) / (range * 2.5)));
    designer.setZoom(targetZoom);
  }, [mapBounds, canvasSize, designer]);

  const selectedBuilding = designer.selectedBuildingId
    ? designer.buildings.find((b) => b.id === designer.selectedBuildingId) ?? null
    : null;
  const selectedBuildingType = selectedBuilding ? getBuildingType(selectedBuilding.typeId) : undefined;

  const sidebarBtnStyle: React.CSSProperties = {
    padding: '0.3rem 0.5rem', backgroundColor: '#0d1117', border: '1px solid #1e2a35',
    borderRadius: '4px', color: '#9ca3af', cursor: 'pointer', fontSize: '0.65rem',
    fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.2rem', whiteSpace: 'nowrap',
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
            <span style={neonGlow('#22d3ee')}>DESIGNER</span>
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
                <button style={sidebarBtnStyle} onClick={designer.undo} disabled={!designer.canUndo} title="Undo (Ctrl+Z)">↩</button>
                <button style={sidebarBtnStyle} onClick={designer.redo} disabled={!designer.canRedo} title="Redo (Ctrl+Y)">↪</button>
                <div style={{ width: '1px', height: '20px', backgroundColor: '#1e2a35' }} />
                <button style={sidebarBtnStyle} onClick={() => setModalMode('save')} title="Save">💾</button>
                <button style={sidebarBtnStyle} onClick={() => setModalMode('load')} title="Load">📂</button>
                <div style={{ width: '1px', height: '20px', backgroundColor: '#1e2a35' }} />
                <button
                  style={{ ...sidebarBtnStyle, ...(designer.showLabels ? { backgroundColor: '#22d3ee15', borderColor: '#22d3ee40', color: '#22d3ee' } : {}) }}
                  onClick={() => designer.setShowLabels(!designer.showLabels)} title="Toggle Labels"
                >🏷️</button>
                <button
                  style={{ ...sidebarBtnStyle, borderColor: '#ef444440', color: '#ef4444' }}
                  onClick={() => setShowClearConfirm(true)} title="Clear All"
                >🗑️</button>
              </div>

              {/* Design name */}
              <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #1e2a35' }}>
                <div style={{ color: '#6b7280', fontSize: '0.6rem', marginBottom: '3px' }}>Design Name</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input
                    type="text" value={designer.designName} onChange={(e) => designer.setDesignName(e.target.value)}
                    placeholder="Untitled..." style={{
                      flex: 1, padding: '0.25rem 0.4rem', backgroundColor: '#0a0a0a', border: '1px solid #1e2a35',
                      borderRadius: '4px', color: '#e5e7eb', fontSize: '0.7rem', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  {designer.isDirty && <span style={{ fontSize: '0.55rem', color: '#f59e0b' }}>●</span>}
                </div>
              </div>

              {/* Map Area */}
              <SidebarSection title="Map Area" defaultOpen={true}>
                <MapBoundsEditor bounds={mapBounds} onChange={setMapBounds} onFocus={focusBounds} />
              </SidebarSection>

              {/* Buildings */}
              <SidebarSection title="Buildings" defaultOpen={true}>
                {BUILDING_CATEGORIES.map((cat) => (
                  <div key={cat.key} style={{ marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: '600', color: cat.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
                      {cat.label}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {BUILDING_TYPES.filter((b) => b.category === cat.key).map((building) => {
                        const isSelected = designer.selectedToolType === building.id;
                        const count = designer.buildingCounts[building.id] || 0;
                        return (
                          <button
                            key={building.id}
                            onClick={() => designer.setSelectedToolType(isSelected ? null : building.id)}
                            title={`${building.name} (${building.size}×${building.size})\n${building.description}`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.2rem',
                              padding: '0.25rem 0.4rem',
                              backgroundColor: isSelected ? building.color + '25' : '#0a0a0a',
                              border: `1px solid ${isSelected ? building.color : '#1e2a35'}`,
                              borderRadius: '4px', color: isSelected ? building.color : '#9ca3af',
                              cursor: 'pointer', fontSize: '0.65rem', fontWeight: isSelected ? '600' : '400',
                              transition: 'all 0.1s', whiteSpace: 'nowrap',
                            }}
                          >
                            <span>{building.icon}</span>
                            <span>{building.shortName}</span>
                            <span style={{ fontSize: '0.5rem', color: '#4b5563' }}>{building.size}²</span>
                            {count > 0 && <span style={{ fontSize: '0.5rem', color: building.color, fontWeight: '700' }}>×{count}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </SidebarSection>

              {/* Properties */}
              {selectedBuilding && selectedBuildingType && (
                <SidebarSection title="Properties" defaultOpen={true}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1rem' }}>{selectedBuildingType.icon}</span>
                    <div>
                      <div style={{ color: selectedBuildingType.color, fontSize: '0.75rem', fontWeight: '700' }}>{selectedBuildingType.name}</div>
                      <div style={{ color: '#4b5563', fontSize: '0.6rem' }}>{selectedBuildingType.size}×{selectedBuildingType.size} • ({selectedBuilding.x}, {selectedBuilding.y})</div>
                    </div>
                  </div>
                  {selectedBuildingType.labelField && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <div style={{ color: '#6b7280', fontSize: '0.6rem', marginBottom: '2px' }}>
                        {selectedBuildingType.labelField === 'playerName' ? 'Player Name' : 'Time Slot (UTC)'}
                      </div>
                      <input type="text" value={selectedBuilding.label || ''}
                        onChange={(e) => designer.updateBuildingLabel(selectedBuilding.id, e.target.value)}
                        placeholder={selectedBuildingType.labelField === 'playerName' ? 'e.g. PlayerOne' : 'e.g. 14:00'}
                        style={{
                          width: '100%', padding: '0.25rem 0.4rem', backgroundColor: '#0a0a0a',
                          border: '1px solid #1e2a35', borderRadius: '4px', color: '#e5e7eb',
                          fontSize: '0.7rem', outline: 'none', boxSizing: 'border-box',
                        }}
                      />
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

              {/* Tips */}
              <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.55rem', color: '#4b5563', lineHeight: 1.6 }}>
                <strong style={{ color: '#6b7280' }}>Shortcuts:</strong> Click to place · Drag to move · Delete to remove · Enter to edit name · Ctrl+Z undo · Ctrl+C/V copy/paste · Double-click to edit name · Scroll to pan · Pinch to zoom
              </div>

              {/* Reset to Default */}
              <div style={{ padding: '0.5rem 0.75rem' }}>
                <button
                  onClick={() => {
                    if (confirm('Reset everything? This clears all buildings, viewport, and design name from local storage.')) {
                      designer.clearAll();
                      designer.setDesignName('');
                      designer.setCenterX(600);
                      designer.setCenterY(600);
                      designer.setZoom(8);
                      setMapBounds({ x1: 550, y1: 550, x2: 650, y2: 650 });
                      try {
                        localStorage.removeItem('atlas_base_designer_session');
                        localStorage.removeItem('atlas_base_designer_mapbounds');
                      } catch {}
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
              </div>

              {/* Back link */}
              <div style={{ padding: '0.5rem 0.75rem', marginTop: 'auto', borderTop: '1px solid #1e2a35' }}>
                <Link to="/tools" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.65rem' }}>← Back to Tools</Link>
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
                  mapBounds={mapBounds}
                  onEditBuilding={(building, sx, sy) => {
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
                      onBlur={() => setEditingLabel(null)}
                      placeholder="Name..."
                      style={{
                        width: '140px', padding: '0.25rem 0.5rem',
                        backgroundColor: '#111827', border: '1px solid #22d3ee',
                        borderRadius: '4px', color: '#fff', fontSize: '0.75rem',
                        outline: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
                        textAlign: 'center',
                      }}
                    />
                  </div>
                )}
              </div>
              <MapControls designer={designer} isMobile={false} />
            </div>
          </div>
        </AccessGate>

        <DesignModal mode={modalMode} onClose={() => setModalMode(null)} designer={designer} />

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
                <button onClick={() => setShowClearConfirm(false)} style={{
                  padding: '0.45rem 0.9rem', backgroundColor: '#1e2a35', border: 'none',
                  borderRadius: '6px', color: '#9ca3af', cursor: 'pointer', fontSize: '0.8rem',
                }}>Cancel</button>
                <button onClick={() => { designer.clearAll(); setShowClearConfirm(false); }} style={{
                  padding: '0.45rem 0.9rem', backgroundColor: '#ef4444', border: 'none',
                  borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
                }}>Clear All</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Mobile Layout ───
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0a0a0a', overflow: 'hidden' }}>
      {/* Mobile header */}
      <div style={{ padding: '0.5rem 0.75rem', background: 'linear-gradient(180deg, #111827 0%, #0d1117 100%)', borderBottom: '1px solid #1e2a35', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1rem', fontWeight: 'bold', fontFamily: FONT_DISPLAY, letterSpacing: '0.04em', margin: 0 }}>
          <span style={{ color: '#fff' }}>BASE </span>
          <span style={neonGlow('#22d3ee')}>DESIGNER</span>
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.6rem', margin: '0.15rem 0 0' }}>Alliance fortress layout planner</p>
      </div>

      {/* Canvas fills most of the screen */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <GridCanvas
          designer={designer}
          canvasWidth={canvasSize.width}
          canvasHeight={canvasSize.height}
          mapBounds={mapBounds}
          onEditBuilding={(building, sx, sy) => {
            setEditingLabel({ buildingId: building.id, screenX: sx, screenY: sy, value: building.label || '' });
            designer.setSelectedBuildingId(building.id);
            setTimeout(() => editInputRef.current?.focus(), 50);
          }}
        />
        {/* Inline label editor overlay (mobile) */}
        {editingLabel && (
          <div style={{
            position: 'absolute',
            left: Math.max(8, Math.min(editingLabel.screenX - 70, canvasSize.width - 156)),
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
              onBlur={() => setEditingLabel(null)}
              placeholder="Name..."
              style={{
                width: '140px', padding: '0.25rem 0.5rem',
                backgroundColor: '#111827', border: '1px solid #22d3ee',
                borderRadius: '4px', color: '#fff', fontSize: '0.75rem',
                outline: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
                textAlign: 'center',
              }}
            />
          </div>
        )}
        <MapControls designer={designer} isMobile={true} />

        {/* Mobile floating toolbar */}
        <div style={{
          position: 'absolute', top: 8, left: 8, right: 8, zIndex: 10,
          display: 'flex', gap: '0.25rem', alignItems: 'center',
          backgroundColor: '#0d1117dd', padding: '0.3rem 0.5rem', borderRadius: '8px',
          backdropFilter: 'blur(10px)', border: '1px solid #1e2a35',
        }}>
          <button style={sidebarBtnStyle} onClick={designer.undo} disabled={!designer.canUndo}>↩</button>
          <button style={sidebarBtnStyle} onClick={designer.redo} disabled={!designer.canRedo}>↪</button>
          <button style={sidebarBtnStyle} onClick={() => setModalMode('save')}>💾</button>
          <button style={sidebarBtnStyle} onClick={() => setModalMode('load')}>📂</button>
          <button
            style={{ ...sidebarBtnStyle, ...(designer.showLabels ? { color: '#22d3ee' } : {}) }}
            onClick={() => designer.setShowLabels(!designer.showLabels)}
          >🏷️</button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: '0.55rem', color: '#4b5563' }}>{designer.buildings.length} bldgs</span>
        </div>
      </div>

      {/* Mobile bottom panel with tabs */}
      <div style={{ borderTop: '1px solid #1e2a35', backgroundColor: '#0d1117' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e2a35' }}>
          {(['buildings', 'area', 'props'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobilePanelTab(tab)}
              style={{
                flex: 1, padding: '0.4rem', backgroundColor: 'transparent', border: 'none',
                color: mobilePanelTab === tab ? '#22d3ee' : '#6b7280', cursor: 'pointer',
                fontSize: '0.65rem', fontWeight: mobilePanelTab === tab ? '700' : '400',
                borderBottom: mobilePanelTab === tab ? '2px solid #22d3ee' : '2px solid transparent',
              }}
            >
              {tab === 'buildings' ? '🧱 Build' : tab === 'area' ? '📐 Area' : '⚙️ Props'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ maxHeight: '180px', overflowY: 'auto', padding: '0.5rem 0.75rem' }}>
          {mobilePanelTab === 'buildings' && (
            <div>
              {BUILDING_CATEGORIES.map((cat) => (
                <div key={cat.key} style={{ marginBottom: '0.4rem' }}>
                  <div style={{ fontSize: '0.55rem', fontWeight: '600', color: cat.color, textTransform: 'uppercase', marginBottom: '0.2rem' }}>{cat.label}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {BUILDING_TYPES.filter((b) => b.category === cat.key).map((building) => {
                      const isSelected = designer.selectedToolType === building.id;
                      return (
                        <button key={building.id} onClick={() => designer.setSelectedToolType(isSelected ? null : building.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.3rem 0.4rem',
                            backgroundColor: isSelected ? building.color + '25' : '#0a0a0a',
                            border: `1px solid ${isSelected ? building.color : '#1e2a35'}`,
                            borderRadius: '4px', color: isSelected ? building.color : '#9ca3af',
                            cursor: 'pointer', fontSize: '0.65rem', whiteSpace: 'nowrap',
                          }}>
                          <span>{building.icon}</span><span>{building.shortName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {mobilePanelTab === 'area' && (
            <div>
              <MapBoundsEditor bounds={mapBounds} onChange={setMapBounds} onFocus={focusBounds} />
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ color: '#6b7280', fontSize: '0.6rem', marginBottom: '3px' }}>Design Name</div>
                <input type="text" value={designer.designName} onChange={(e) => designer.setDesignName(e.target.value)}
                  style={{ width: '100%', padding: '0.25rem 0.4rem', backgroundColor: '#0a0a0a', border: '1px solid #1e2a35', borderRadius: '4px', color: '#e5e7eb', fontSize: '0.7rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}

          {mobilePanelTab === 'props' && (
            <div>
              {selectedBuilding && selectedBuildingType ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1rem' }}>{selectedBuildingType.icon}</span>
                    <div>
                      <div style={{ color: selectedBuildingType.color, fontSize: '0.75rem', fontWeight: '700' }}>{selectedBuildingType.name}</div>
                      <div style={{ color: '#4b5563', fontSize: '0.6rem' }}>({selectedBuilding.x}, {selectedBuilding.y})</div>
                    </div>
                  </div>
                  {selectedBuildingType.labelField && (
                    <input type="text" value={selectedBuilding.label || ''}
                      onChange={(e) => designer.updateBuildingLabel(selectedBuilding.id, e.target.value)}
                      placeholder={selectedBuildingType.labelField === 'playerName' ? 'Player name' : 'Time slot'}
                      style={{ width: '100%', padding: '0.25rem 0.4rem', backgroundColor: '#0a0a0a', border: '1px solid #1e2a35', borderRadius: '4px', color: '#e5e7eb', fontSize: '0.7rem', outline: 'none', marginBottom: '0.4rem', boxSizing: 'border-box' }}
                    />
                  )}
                  <button onClick={() => designer.removeBuilding(selectedBuilding.id)} style={{
                    width: '100%', padding: '0.3rem', backgroundColor: '#ef444415', border: '1px solid #ef444440',
                    borderRadius: '4px', color: '#ef4444', cursor: 'pointer', fontSize: '0.65rem',
                  }}>🗑️ Remove</button>
                </>
              ) : (
                <p style={{ color: '#4b5563', fontSize: '0.7rem', textAlign: 'center' }}>Select a building to edit</p>
              )}
            </div>
          )}
        </div>
      </div>

      <DesignModal mode={modalMode} onClose={() => setModalMode(null)} designer={designer} />
    </div>
  );
};

export default AllianceBaseDesigner;
