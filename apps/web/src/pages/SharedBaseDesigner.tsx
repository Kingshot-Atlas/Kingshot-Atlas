import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { supabase } from '../lib/supabase';
import { PlacedBuilding } from '../hooks/useBaseDesigner';
import { getBuildingType } from '../config/allianceBuildings';
import { FONT_DISPLAY } from '../utils/styles';

// Isometric transforms (duplicated for standalone read-only page)
const g2s = (gx: number, gy: number, cx: number, cy: number, hc: number, cw: number, ch: number) => ({
  x: ((gx - cx) - (gy - cy)) * hc + cw / 2,
  y: -((gx - cx) + (gy - cy)) * hc + ch / 2,
});
const s2g = (sx: number, sy: number, cx: number, cy: number, hc: number, cw: number, ch: number) => {
  const px = (sx - cw / 2) / hc;
  const py = -(sy - ch / 2) / hc;
  return { x: Math.floor((px + py) / 2 + cx), y: Math.floor((py - px) / 2 + cy) };
};

const SharedBaseDesigner: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  useDocumentTitle('Shared Base Design');

  const [design, setDesign] = useState<{ name: string; buildings: PlacedBuilding[]; gridSize: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Viewport state for panning/zooming
  const [centerX, setCenterX] = useState(600);
  const [centerY, setCenterY] = useState(600);
  const [zoom, setZoom] = useState(12);
  const [showLabels, setShowLabels] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 600 });

  // Pan/zoom refs
  const panStart = useRef<{ x: number; y: number } | null>(null);
  const touchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  // Fetch shared design
  useEffect(() => {
    if (!token || !supabase) {
      setError(t('baseDesigner.shareNotFound', 'Shared design not found.'));
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error: err } = await supabase
        .from('base_designs')
        .select('name, buildings, grid_size')
        .eq('share_token', token)
        .single();
      if (err || !data) {
        setError(t('baseDesigner.shareNotFound', 'Shared design not found.'));
      } else {
        setDesign({ name: data.name, buildings: data.buildings as PlacedBuilding[], gridSize: data.grid_size as number });
      }
      setLoading(false);
    })();
  }, [token, t]);

  // Focus on base once loaded
  useEffect(() => {
    if (!design || design.buildings.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of design.buildings) {
      const bt = getBuildingType(b.typeId);
      const size = bt?.size || 1;
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + size > maxX) maxX = b.x + size;
      if (b.y + size > maxY) maxY = b.y + size;
    }
    setCenterX((minX + maxX) / 2);
    setCenterY((minY + maxY) / 2);
    const range = Math.max(maxX - minX, maxY - minY, 10);
    const targetZoom = Math.min(40, Math.max(3, Math.min(canvasSize.width, canvasSize.height) / (range * 2.5)));
    setZoom(targetZoom);
  }, [design, canvasSize]);

  // Canvas sizing
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

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !design) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width: cw, height: ch } = canvasSize;
    canvas.width = cw;
    canvas.height = ch;
    const hc = zoom;

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, cw, ch);

    // Map boundary
    const bTop = g2s(1200, 1200, centerX, centerY, hc, cw, ch);
    const bRight = g2s(1200, 0, centerX, centerY, hc, cw, ch);
    const bBottom = g2s(0, 0, centerX, centerY, hc, cw, ch);
    const bLeft = g2s(0, 1200, centerX, centerY, hc, cw, ch);
    ctx.beginPath();
    ctx.moveTo(bTop.x, bTop.y); ctx.lineTo(bRight.x, bRight.y);
    ctx.lineTo(bBottom.x, bBottom.y); ctx.lineTo(bLeft.x, bLeft.y);
    ctx.closePath();
    ctx.fillStyle = '#131920';
    ctx.fill();

    // Grid
    const gridStep = hc > 20 ? 1 : hc > 10 ? 5 : hc > 5 ? 10 : 50;
    ctx.strokeStyle = '#1e2a35';
    ctx.lineWidth = 0.5;
    const corners = [
      s2g(0, 0, centerX, centerY, hc, cw, ch), s2g(cw, 0, centerX, centerY, hc, cw, ch),
      s2g(0, ch, centerX, centerY, hc, cw, ch), s2g(cw, ch, centerX, centerY, hc, cw, ch),
    ];
    const minGX = Math.max(0, Math.min(...corners.map(c => c.x)) - 1);
    const maxGX = Math.min(1200, Math.max(...corners.map(c => c.x)) + 2);
    const minGY = Math.max(0, Math.min(...corners.map(c => c.y)) - 1);
    const maxGY = Math.min(1200, Math.max(...corners.map(c => c.y)) + 2);
    for (let x = Math.floor(minGX / gridStep) * gridStep; x <= maxGX; x += gridStep) {
      const from = g2s(x, Math.max(0, minGY), centerX, centerY, hc, cw, ch);
      const to = g2s(x, Math.min(1200, maxGY), centerX, centerY, hc, cw, ch);
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    }
    for (let y = Math.floor(minGY / gridStep) * gridStep; y <= maxGY; y += gridStep) {
      const from = g2s(Math.max(0, minGX), y, centerX, centerY, hc, cw, ch);
      const to = g2s(Math.min(1200, maxGX), y, centerX, centerY, hc, cw, ch);
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    }

    // Map boundary outline
    ctx.beginPath();
    ctx.moveTo(bTop.x, bTop.y); ctx.lineTo(bRight.x, bRight.y);
    ctx.lineTo(bBottom.x, bBottom.y); ctx.lineTo(bLeft.x, bLeft.y);
    ctx.closePath();
    ctx.strokeStyle = '#22d3ee40';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Territory zones
    for (const b of design.buildings) {
      const bType = getBuildingType(b.typeId);
      if (!bType?.territoryRadius) continue;
      const r = bType.territoryRadius + (bType.size - 1) / 2;
      const bcx = b.x + bType.size / 2;
      const bcy = b.y + bType.size / 2;
      const tMinX = Math.max(0, Math.floor(bcx - r));
      const tMaxX = Math.min(1199, Math.ceil(bcx + r) - 1);
      const tMinY = Math.max(0, Math.floor(bcy - r));
      const tMaxY = Math.min(1199, Math.ceil(bcy + r) - 1);
      const top = g2s(tMaxX + 1, tMaxY + 1, centerX, centerY, hc, cw, ch);
      const right = g2s(tMaxX + 1, tMinY, centerX, centerY, hc, cw, ch);
      const bottom = g2s(tMinX, tMinY, centerX, centerY, hc, cw, ch);
      const left = g2s(tMinX, tMaxY + 1, centerX, centerY, hc, cw, ch);
      ctx.beginPath();
      ctx.moveTo(top.x, top.y); ctx.lineTo(right.x, right.y);
      ctx.lineTo(bottom.x, bottom.y); ctx.lineTo(left.x, left.y);
      ctx.closePath();
      ctx.fillStyle = '#22c55e12';
      ctx.fill();
      ctx.strokeStyle = '#22c55e30';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Buildings
    const drawDiamond = (gx: number, gy: number, size: number) => {
      const top = g2s(gx + size, gy + size, centerX, centerY, hc, cw, ch);
      const right = g2s(gx + size, gy, centerX, centerY, hc, cw, ch);
      const bottom = g2s(gx, gy, centerX, centerY, hc, cw, ch);
      const left = g2s(gx, gy + size, centerX, centerY, hc, cw, ch);
      ctx.beginPath();
      ctx.moveTo(top.x, top.y); ctx.lineTo(right.x, right.y);
      ctx.lineTo(bottom.x, bottom.y); ctx.lineTo(left.x, left.y);
      ctx.closePath();
    };

    for (const b of design.buildings) {
      const type = getBuildingType(b.typeId);
      if (!type) continue;
      const center = g2s(b.x + type.size / 2, b.y + type.size / 2, centerX, centerY, hc, cw, ch);
      const extent = type.size * hc * 1.5;
      if (center.x + extent < 0 || center.x - extent > cw || center.y + extent < 0 || center.y - extent > ch) continue;

      drawDiamond(b.x, b.y, type.size);
      ctx.fillStyle = type.color + '80';
      ctx.fill();
      ctx.strokeStyle = type.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      const bCenter = g2s(b.x + type.size / 2, b.y + type.size / 2, centerX, centerY, hc, cw, ch);
      if (b.typeId === 'city') {
        if (showLabels && b.label) {
          const baseFontSize = Math.max(7, hc * 0.7);
          const len = b.label.length;
          const dynamicSize = len <= 8 ? baseFontSize : len <= 14 ? baseFontSize * 0.8 : len <= 20 ? baseFontSize * 0.65 : baseFontSize * 0.55;
          ctx.font = `bold ${Math.max(5, dynamicSize)}px sans-serif`;
          ctx.fillStyle = '#ffffffdd';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(b.label, bCenter.x, bCenter.y, type.size * hc * 1.6);
        }
      } else {
        const iconSize = Math.max(8, hc * type.size * 0.6);
        ctx.font = `${iconSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(type.icon, bCenter.x, bCenter.y);
        if (showLabels && b.label) {
          const labelSize = Math.max(6, hc * 0.55);
          ctx.font = `bold ${labelSize}px sans-serif`;
          ctx.fillStyle = '#ffffffcc';
          ctx.fillText(b.label, bCenter.x, bCenter.y + iconSize * 0.6, type.size * hc * 1.6);
        }
      }
    }
  }, [design, canvasSize, centerX, centerY, zoom, showLabels]);

  // Mouse panning
  const handleMouseDown = (e: React.MouseEvent) => {
    panStart.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!panStart.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      const hc = zoom;
      const dgx = (-dx / hc + dy / hc) / 2;
      const dgy = (dx / hc + dy / hc) / 2;
      setCenterX((x) => Math.max(0, Math.min(1199, x + dgx)));
      setCenterY((y) => Math.max(0, Math.min(1199, y + dgy)));
      panStart.current = { x: e.clientX, y: e.clientY };
    }
  };
  const handleMouseUp = () => { panStart.current = null; };

  // Wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      setZoom((z) => Math.min(40, Math.max(3, z * factor)));
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, []);

  // Touch panning/zooming
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t0 = e.touches[0]!, t1 = e.touches[1]!;
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      touchRef.current = { dist, cx: (t0.clientX + t1.clientX) / 2, cy: (t0.clientY + t1.clientY) / 2 };
    } else if (e.touches.length === 1) {
      panStart.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchRef.current) {
      e.preventDefault();
      const t0 = e.touches[0]!, t1 = e.touches[1]!;
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const factor = dist / touchRef.current.dist;
      setZoom((z) => Math.min(40, Math.max(3, z * factor)));
      const ncx = (t0.clientX + t1.clientX) / 2;
      const ncy = (t0.clientY + t1.clientY) / 2;
      const hc = zoom;
      const dx = ncx - touchRef.current.cx;
      const dy = ncy - touchRef.current.cy;
      const dgx = (-dx / hc + dy / hc) / 2;
      const dgy = (dx / hc + dy / hc) / 2;
      setCenterX((x) => Math.max(0, Math.min(1199, x + dgx)));
      setCenterY((y) => Math.max(0, Math.min(1199, y + dgy)));
      touchRef.current = { dist, cx: ncx, cy: ncy };
    } else if (e.touches.length === 1 && panStart.current) {
      const touch = e.touches[0]!;
      const dx = touch.clientX - panStart.current.x;
      const dy = touch.clientY - panStart.current.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        const hc = zoom;
        const dgx = (-dx / hc + dy / hc) / 2;
        const dgy = (dx / hc + dy / hc) / 2;
        setCenterX((x) => Math.max(0, Math.min(1199, x + dgx)));
        setCenterY((y) => Math.max(0, Math.min(1199, y + dgy)));
        panStart.current = { x: touch.clientX, y: touch.clientY };
      }
    }
  };
  const handleTouchEnd = () => {
    panStart.current = null;
    touchRef.current = null;
  };

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Loading shared design...</div>
      </div>
    );
  }

  if (error || !design) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
        <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '0.5rem' }}>{t('baseDesigner.shareNotFound', 'Shared design not found.')}</h2>
        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          {t('baseDesigner.shareNotFoundDesc', 'This link may have expired or been removed.')}
        </p>
        <Link to="/tools/base-designer/about" style={{ color: '#22d3ee', textDecoration: 'none', fontWeight: 600 }}>
          ← {t('baseDesigner.backToDesigner', 'Back to Base Designer')}
        </Link>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0a0a0a', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '0.5rem 0.75rem' : '0.6rem 1.5rem',
        background: 'linear-gradient(180deg, #111827 0%, #0d1117 100%)',
        borderBottom: '1px solid #1e2a35',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '0.85rem' : '1.1rem', fontWeight: 'bold', fontFamily: FONT_DISPLAY, letterSpacing: '0.04em', margin: 0 }}>
            <span style={{ color: '#fff' }}>{design.name} </span>
            <span style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: '400' }}>({t('baseDesigner.readOnly', 'read-only')})</span>
          </h1>
          <p style={{ color: '#4b5563', fontSize: '0.6rem', margin: 0 }}>
            {design.buildings.length} {t('baseDesigner.buildings', 'buildings')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            style={{
              padding: '0.3rem 0.5rem', backgroundColor: showLabels ? '#22d3ee15' : '#0d1117',
              border: `1px solid ${showLabels ? '#22d3ee40' : '#1e2a35'}`, borderRadius: '4px',
              color: showLabels ? '#22d3ee' : '#9ca3af', cursor: 'pointer', fontSize: '0.65rem',
            }}
            onClick={() => setShowLabels(!showLabels)}
          >🏷️</button>
          <Link to="/tools/base-designer/about" style={{
            padding: '0.3rem 0.6rem', backgroundColor: '#22d3ee15',
            border: '1px solid #22d3ee40', borderRadius: '4px',
            color: '#22d3ee', textDecoration: 'none', fontSize: '0.65rem', fontWeight: '600',
          }}>
            {t('baseDesigner.openDesigner', 'Open Designer')}
          </Link>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          style={{
            borderRadius: '0', border: 'none', cursor: 'grab',
            display: 'block', width: '100%', height: '100%', touchAction: 'none',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={(e) => e.preventDefault()}
        />
        {/* Read-only badge */}
        <div style={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#0d1117dd', padding: '0.3rem 0.75rem', borderRadius: '20px',
          border: '1px solid #1e2a35', fontSize: '0.6rem', color: '#6b7280',
          backdropFilter: 'blur(8px)',
        }}>
          👁️ {t('baseDesigner.viewOnly', 'View Only — Pan & Zoom to explore')}
        </div>
      </div>
    </div>
  );
};

export default SharedBaseDesigner;
