import { useState, useCallback, useRef, useEffect } from 'react';
import { getBuildingType } from '../config/allianceBuildings';

export interface PlacedBuilding {
  id: string;
  typeId: string;
  x: number;
  y: number;
  label?: string;
}

export interface BaseDesign {
  id: string;
  name: string;
  buildings: PlacedBuilding[];
  gridSize: number;
  createdAt: string;
  updatedAt: string;
}

const MIN_ZOOM = 3;
const MAX_ZOOM = 40;
const DEFAULT_ZOOM = 12;

let nextBuildingId = 1;
const generateId = () => `b_${Date.now()}_${nextBuildingId++}`;

export function useBaseDesigner() {
  // Isometric viewport: center point in grid coords + zoom (half-cell px size)
  const [centerX, setCenterX] = useState(600);
  const [centerY, setCenterY] = useState(600);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  // Building state
  const [buildings, setBuildings] = useState<PlacedBuilding[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedToolType, setSelectedToolType] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);

  // Design metadata
  const [designName, setDesignName] = useState('Untitled Design');
  const [isDirty, setIsDirty] = useState(false);

  // Drag state
  const [dragBuilding, setDragBuilding] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // Clipboard for copy/paste
  const [clipboard, setClipboard] = useState<PlacedBuilding | null>(null);

  // History for undo/redo
  const historyRef = useRef<PlacedBuilding[][]>([[]]);
  const historyIndexRef = useRef(0);

  const pushHistory = useCallback((newBuildings: PlacedBuilding[]) => {
    const idx = historyIndexRef.current;
    const newHistory = historyRef.current.slice(0, idx + 1);
    newHistory.push(JSON.parse(JSON.stringify(newBuildings)));
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
  }, []);

  // Types that must be placed within alliance territory (HQ/Banner radius)
  const TERRITORY_REQUIRED_TYPES = new Set(['city', 'trap', 'special']);

  // Check if a cell (gx, gy) is within any territory zone
  const isCellInTerritory = useCallback((gx: number, gy: number, excludeBuildingId?: string): boolean => {
    for (const b of buildings) {
      if (excludeBuildingId && b.id === excludeBuildingId) continue;
      const bType = getBuildingType(b.typeId);
      if (!bType?.territoryRadius) continue;
      const bcx = b.x + bType.size / 2;
      const bcy = b.y + bType.size / 2;
      const dx = gx + 0.5 - bcx;
      const dy = gy + 0.5 - bcy;
      // Effective radius accounts for building size so territoryRadius means tiles past the edge
      const effectiveR = bType.territoryRadius + (bType.size - 1) / 2;
      if (Math.abs(dx) <= effectiveR && Math.abs(dy) <= effectiveR) return true;
    }
    return false;
  }, [buildings]);

  // Check if a building can be placed at a position (no overlap + territory rules)
  const canPlace = useCallback((typeId: string, x: number, y: number, excludeId?: string): boolean => {
    const type = getBuildingType(typeId);
    if (!type) return false;
    const size = type.size;
    if (x < 0 || y < 0 || x + size > 1200 || y + size > 1200) return false;

    for (const b of buildings) {
      if (excludeId && b.id === excludeId) continue;
      const bType = getBuildingType(b.typeId);
      if (!bType) continue;
      const bSize = bType.size;
      if (x < b.x + bSize && x + size > b.x && y < b.y + bSize && y + size > b.y) {
        return false;
      }
    }

    // Territory enforcement: city, trap, special must be fully inside territory
    if (TERRITORY_REQUIRED_TYPES.has(typeId)) {
      for (let gx = x; gx < x + size; gx++) {
        for (let gy = y; gy < y + size; gy++) {
          if (!isCellInTerritory(gx, gy, excludeId)) return false;
        }
      }
    }

    return true;
  }, [buildings, isCellInTerritory]);

  const placeBuilding = useCallback((typeId: string, x: number, y: number, label?: string): string | null => {
    if (!canPlace(typeId, x, y)) return null;
    const newBuilding: PlacedBuilding = { id: generateId(), typeId, x, y, label };
    const newBuildings = [...buildings, newBuilding];
    setBuildings(newBuildings);
    pushHistory(newBuildings);
    setIsDirty(true);
    return newBuilding.id;
  }, [buildings, canPlace, pushHistory]);

  const moveBuilding = useCallback((id: string, newX: number, newY: number): boolean => {
    const building = buildings.find((b) => b.id === id);
    if (!building) return false;
    if (!canPlace(building.typeId, newX, newY, id)) return false;
    const newBuildings = buildings.map((b) => b.id === id ? { ...b, x: newX, y: newY } : b);
    setBuildings(newBuildings);
    pushHistory(newBuildings);
    setIsDirty(true);
    return true;
  }, [buildings, canPlace, pushHistory]);

  const removeBuilding = useCallback((id: string) => {
    const newBuildings = buildings.filter((b) => b.id !== id);
    setBuildings(newBuildings);
    pushHistory(newBuildings);
    setIsDirty(true);
    if (selectedBuildingId === id) setSelectedBuildingId(null);
  }, [buildings, pushHistory, selectedBuildingId]);

  const updateBuildingLabel = useCallback((id: string, label: string) => {
    setBuildings((prev) => prev.map((b) => b.id === id ? { ...b, label } : b));
    setIsDirty(true);
  }, []);

  const copyBuilding = useCallback((id: string) => {
    const b = buildings.find((b) => b.id === id);
    if (b) setClipboard({ ...b });
  }, [buildings]);

  const pasteBuilding = useCallback((): string | null => {
    if (!clipboard) return null;
    const type = getBuildingType(clipboard.typeId);
    if (!type) return null;
    // Try to paste at an offset from original position; find nearest open spot
    const offsets = [
      [2, 2], [2, 0], [0, 2], [-2, 0], [0, -2], [4, 4], [-2, -2], [4, 0], [0, 4],
    ];
    for (const off of offsets) {
      const nx = clipboard.x + off[0]!;
      const ny = clipboard.y + off[1]!;
      if (canPlace(clipboard.typeId, nx, ny)) {
        // Strip label for cities (player names shouldn't duplicate)
        const label = clipboard.typeId === 'city' ? '' : clipboard.label;
        const newBuilding: PlacedBuilding = { id: generateId(), typeId: clipboard.typeId, x: nx, y: ny, label };
        const newBuildings = [...buildings, newBuilding];
        setBuildings(newBuildings);
        pushHistory(newBuildings);
        setIsDirty(true);
        setSelectedBuildingId(newBuilding.id);
        return newBuilding.id;
      }
    }
    return null;
  }, [clipboard, buildings, canPlace, pushHistory]);

  const clearAll = useCallback(() => {
    setBuildings([]);
    pushHistory([]);
    setSelectedBuildingId(null);
    setIsDirty(true);
  }, [pushHistory]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      setBuildings(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current])));
      setIsDirty(true);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      setBuildings(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current])));
      setIsDirty(true);
    }
  }, []);

  // Smooth zoom: multiply by factor
  const zoomBy = useCallback((factor: number) => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor)));
  }, []);
  const zoomIn = useCallback(() => zoomBy(1.25), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / 1.25), [zoomBy]);

  // Pan by grid units (in isometric space: up = +x+y, right = +x-y)
  const panUp = useCallback(() => {
    const step = Math.max(1, Math.round(5 / (zoom / DEFAULT_ZOOM)));
    setCenterX((x) => Math.min(1199, x + step));
    setCenterY((y) => Math.min(1199, y + step));
  }, [zoom]);
  const panDown = useCallback(() => {
    const step = Math.max(1, Math.round(5 / (zoom / DEFAULT_ZOOM)));
    setCenterX((x) => Math.max(0, x - step));
    setCenterY((y) => Math.max(0, y - step));
  }, [zoom]);
  const panLeft = useCallback(() => {
    const step = Math.max(1, Math.round(5 / (zoom / DEFAULT_ZOOM)));
    setCenterX((x) => Math.max(0, x - step));
    setCenterY((y) => Math.min(1199, y + step));
  }, [zoom]);
  const panRight = useCallback(() => {
    const step = Math.max(1, Math.round(5 / (zoom / DEFAULT_ZOOM)));
    setCenterX((x) => Math.min(1199, x + step));
    setCenterY((y) => Math.max(0, y - step));
  }, [zoom]);

  // Pan by pixel delta (for drag/touch panning)
  const panByPixels = useCallback((dScreenX: number, dScreenY: number) => {
    const hc = zoom;
    const dgx = (-dScreenX / hc + dScreenY / hc) / 2;
    const dgy = (dScreenX / hc + dScreenY / hc) / 2;
    setCenterX((x) => Math.max(0, Math.min(1199, x + dgx)));
    setCenterY((y) => Math.max(0, Math.min(1199, y + dgy)));
  }, [zoom]);

  // Save/Load/Export/Import
  const saveDesign = useCallback((name?: string) => {
    const design: BaseDesign = {
      id: `design_${Date.now()}`,
      name: name || designName,
      buildings: JSON.parse(JSON.stringify(buildings)),
      gridSize: zoom,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = localStorage.getItem('atlas_base_designs');
    const designs: BaseDesign[] = saved ? JSON.parse(saved) : [];
    designs.push(design);
    localStorage.setItem('atlas_base_designs', JSON.stringify(designs));
    setIsDirty(false);
    return design.id;
  }, [buildings, designName, zoom]);

  const loadDesign = useCallback((designId: string): boolean => {
    const saved = localStorage.getItem('atlas_base_designs');
    if (!saved) return false;
    const designs: BaseDesign[] = JSON.parse(saved);
    const design = designs.find((d) => d.id === designId);
    if (!design) return false;
    setBuildings(design.buildings);
    setDesignName(design.name);
    pushHistory(design.buildings);
    setIsDirty(false);
    return true;
  }, [pushHistory]);

  const getSavedDesigns = useCallback((): BaseDesign[] => {
    const saved = localStorage.getItem('atlas_base_designs');
    return saved ? JSON.parse(saved) : [];
  }, []);

  const deleteDesign = useCallback((designId: string) => {
    const saved = localStorage.getItem('atlas_base_designs');
    if (!saved) return;
    const designs: BaseDesign[] = JSON.parse(saved);
    localStorage.setItem('atlas_base_designs', JSON.stringify(designs.filter((d) => d.id !== designId)));
  }, []);

  const exportDesign = useCallback((): string => {
    return JSON.stringify({
      id: `export_${Date.now()}`, name: designName, buildings, gridSize: zoom,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }, null, 2);
  }, [buildings, designName, zoom]);

  const importDesign = useCallback((json: string): boolean => {
    try {
      const design: BaseDesign = JSON.parse(json);
      if (!design.buildings || !Array.isArray(design.buildings)) return false;
      setBuildings(design.buildings);
      setDesignName(design.name || 'Imported Design');
      pushHistory(design.buildings);
      setIsDirty(false);
      return true;
    } catch { return false; }
  }, [pushHistory]);

  const buildingCounts = buildings.reduce<Record<string, number>>((acc, b) => {
    acc[b.typeId] = (acc[b.typeId] || 0) + 1;
    return acc;
  }, {});

  // Auto-persist session to localStorage
  const isRestoredRef = useRef(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('atlas_base_designer_session');
      if (saved) {
        const s = JSON.parse(saved);
        if (s.buildings?.length > 0) {
          setBuildings(s.buildings);
          historyRef.current = [s.buildings];
          historyIndexRef.current = 0;
        }
        if (s.designName) setDesignName(s.designName);
        if (s.centerX != null) setCenterX(s.centerX);
        if (s.centerY != null) setCenterY(s.centerY);
        if (s.zoom != null) setZoom(s.zoom);
        if (s.showLabels != null) setShowLabels(s.showLabels);
      }
    } catch {}
    // Delay enabling auto-save so restored state doesn't trigger a save of defaults
    const t = setTimeout(() => { isRestoredRef.current = true; }, 200);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isRestoredRef.current) return;
    try {
      localStorage.setItem('atlas_base_designer_session', JSON.stringify({
        buildings, designName, centerX, centerY, zoom, showLabels,
      }));
    } catch {}
  }, [buildings, designName, centerX, centerY, zoom, showLabels]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') { if (selectedBuildingId) { e.preventDefault(); copyBuilding(selectedBuildingId); } }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); pasteBuilding(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedBuildingId) { e.preventDefault(); removeBuilding(selectedBuildingId); } }
      if (e.key === 'Escape') { setSelectedBuildingId(null); setSelectedToolType(null); }
      if (e.key === 'ArrowUp') { e.preventDefault(); panUp(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); panDown(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); panLeft(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); panRight(); }
      if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomIn(); }
      if (e.key === '-') { e.preventDefault(); zoomOut(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, selectedBuildingId, removeBuilding, copyBuilding, pasteBuilding, panUp, panDown, panLeft, panRight, zoomIn, zoomOut]);

  return {
    // Viewport
    centerX, centerY, zoom,
    setCenterX, setCenterY, setZoom,
    zoomIn, zoomOut, zoomBy,
    panUp, panDown, panLeft, panRight, panByPixels,

    // Buildings
    buildings, selectedBuildingId, setSelectedBuildingId,
    selectedToolType, setSelectedToolType,
    showLabels, setShowLabels,
    hoveredCell, setHoveredCell,
    placeBuilding, moveBuilding, removeBuilding, updateBuildingLabel,
    clearAll, canPlace, buildingCounts,

    // Drag
    dragBuilding, setDragBuilding,
    dragOffset, setDragOffset,

    // Clipboard
    clipboard, copyBuilding, pasteBuilding,

    // History
    undo, redo,
    canUndo: historyIndexRef.current > 0,
    canRedo: historyIndexRef.current < historyRef.current.length - 1,

    // Design
    designName, setDesignName, isDirty,
    saveDesign, loadDesign, getSavedDesigns, deleteDesign,
    exportDesign, importDesign,
  };
}
