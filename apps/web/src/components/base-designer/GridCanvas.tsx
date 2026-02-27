import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useBaseDesigner, PlacedBuilding } from '../../hooks/useBaseDesigner';
import { getBuildingType } from '../../config/allianceBuildings';

// ─── Isometric Coordinate Transforms ───
// Grid: (0,0)=bottom, (1199,1199)=top, (0,1199)=left, (1199,0)=right
export const g2s = (gx: number, gy: number, cx: number, cy: number, hc: number, cw: number, ch: number) => ({
  x: ((gx - cx) - (gy - cy)) * hc + cw / 2,
  y: -((gx - cx) + (gy - cy)) * hc + ch / 2,
});
export const s2g = (sx: number, sy: number, cx: number, cy: number, hc: number, cw: number, ch: number) => {
  const px = (sx - cw / 2) / hc;
  const py = -(sy - ch / 2) / hc;
  return { x: Math.floor((px + py) / 2 + cx), y: Math.floor((py - px) / 2 + cy) };
};

// ─── Grid Canvas (Isometric Diamond) ───
interface GridCanvasProps {
  designer: ReturnType<typeof useBaseDesigner>;
  canvasWidth: number;
  canvasHeight: number;
  onEditBuilding?: (building: PlacedBuilding, screenX: number, screenY: number) => void;
}

const GridCanvas: React.FC<GridCanvasProps> = ({ designer, canvasWidth, canvasHeight, onEditBuilding }) => {
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
  const [longPressHighlight, setLongPressHighlight] = useState<{ x: number; y: number; size: number } | null>(null);

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

    // Draw territory zones (soft green) for buildings with territoryRadius
    for (const b of buildings) {
      const bType = getBuildingType(b.typeId);
      if (!bType?.territoryRadius) continue;
      // Effective radius accounts for building size so territoryRadius means tiles past the edge
      const r = bType.territoryRadius + (bType.size - 1) / 2;
      const bcx = b.x + bType.size / 2;
      const bcy = b.y + bType.size / 2;
      // Bounding box of territory in grid coords
      const tMinX = Math.max(0, Math.floor(bcx - r));
      const tMaxX = Math.min(1199, Math.ceil(bcx + r) - 1);
      const tMinY = Math.max(0, Math.floor(bcy - r));
      const tMaxY = Math.min(1199, Math.ceil(bcy + r) - 1);
      // Quick screen-space visibility check
      const tCenter = g2s((tMinX + tMaxX) / 2, (tMinY + tMaxY) / 2, centerX, centerY, hc, canvasWidth, canvasHeight);
      const tExtent = r * 2 * hc * 1.5;
      if (tCenter.x + tExtent < 0 || tCenter.x - tExtent > canvasWidth || tCenter.y + tExtent < 0 || tCenter.y - tExtent > canvasHeight) continue;
      // Draw the entire territory as one large diamond
      const top = g2s(tMaxX + 1, tMaxY + 1, centerX, centerY, hc, canvasWidth, canvasHeight);
      const right = g2s(tMaxX + 1, tMinY, centerX, centerY, hc, canvasWidth, canvasHeight);
      const bottom = g2s(tMinX, tMinY, centerX, centerY, hc, canvasWidth, canvasHeight);
      const left = g2s(tMinX, tMaxY + 1, centerX, centerY, hc, canvasWidth, canvasHeight);
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(right.x, right.y);
      ctx.lineTo(bottom.x, bottom.y);
      ctx.lineTo(left.x, left.y);
      ctx.closePath();
      ctx.fillStyle = '#22c55e12';
      ctx.fill();
      ctx.strokeStyle = '#22c55e30';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
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

    // Long-press pulsing highlight
    if (longPressHighlight) {
      const pulse = (Math.sin(Date.now() / 120) + 1) / 2; // 0..1 oscillation
      drawDiamond(ctx, longPressHighlight.x, longPressHighlight.y, longPressHighlight.size);
      ctx.strokeStyle = `rgba(34, 211, 238, ${0.4 + pulse * 0.6})`;
      ctx.lineWidth = 3 + pulse * 2;
      ctx.stroke();
      ctx.fillStyle = `rgba(34, 211, 238, ${0.05 + pulse * 0.12})`;
      ctx.fill();
    }
  }, [
    canvasWidth, canvasHeight, centerX, centerY, hc,
    buildings, selectedBuildingId, selectedToolType, showLabels, hoveredCell,
    dragBuilding, dragPreview, canPlace, longPressHighlight,
  ]);

  // Animate pulsing highlight
  useEffect(() => {
    if (!longPressHighlight) return;
    let raf: number;
    const tick = () => {
      // Force re-render of canvas by triggering dependency change
      setLongPressHighlight((prev) => prev ? { ...prev } : null);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [!!longPressHighlight]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // Show pulsing highlight immediately
        const bType = getBuildingType(building.typeId);
        setLongPressHighlight({ x: building.x, y: building.y, size: bType?.size || 1 });
        // Start long-press timer for drag
        longPressTimer.current = setTimeout(() => {
          isDraggingTouch.current = true;
          setSelectedBuildingId(building.id);
          setDragBuilding(building.id);
          setDragOffset({ dx: cell.x - building.x, dy: cell.y - building.y });
          setDragPreview(null);
          setLongPressHighlight(null);
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
            setLongPressHighlight(null);
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
    // Prevent iOS double-tap zoom
    _e.preventDefault();
    // Cancel long-press timer
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    setLongPressHighlight(null);

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
            if (placed) { setSelectedBuildingId(placed); if (navigator.vibrate) navigator.vibrate(15); }
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

export default GridCanvas;
