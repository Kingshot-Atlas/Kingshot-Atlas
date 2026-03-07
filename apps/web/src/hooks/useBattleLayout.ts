import { useState, useCallback, useRef, useEffect } from 'react';
import { getBuildingType } from '../config/allianceBuildings';
import type { PlacedBuilding } from './useBaseDesigner';

// ─── Fixed battle buildings (castle + 4 turrets) ───
// Positioned around center (600, 600) of the 1200×1200 grid
// In isometric: N = +x+y, S = -x-y, E = +x-y, W = -x+y
const FIXED_BUILDINGS: PlacedBuilding[] = [
  { id: 'fixed-castle', typeId: 'battle-castle', x: 597, y: 597 },
  { id: 'fixed-turret-south', typeId: 'battle-turret-south', x: 594, y: 594 },
  { id: 'fixed-turret-north', typeId: 'battle-turret-north', x: 604, y: 604 },
  { id: 'fixed-turret-east', typeId: 'battle-turret-east', x: 604, y: 594 },
  { id: 'fixed-turret-west', typeId: 'battle-turret-west', x: 594, y: 604 },
];

const FIXED_IDS = new Set(FIXED_BUILDINGS.map(b => b.id));

// Forbidden zone: the diamond area between turrets where cities cannot be placed
// Covers the rectangle from turret corners (594,594) to (605,605) inclusive
const FORBIDDEN_ZONE = { x: 594, y: 594, size: 12 };

const isFixed = (id: string) => FIXED_IDS.has(id);

const MIN_ZOOM = 3;
const MAX_ZOOM = 40;
const DEFAULT_ZOOM = 14;
const STORAGE_KEY = 'kvk-battle-layout-v2';

let nextBuildingId = 1;
const generateId = () => `bc_${Date.now()}_${nextBuildingId++}`;

export function useBattleLayout() {
  // Viewport
  const [centerX, setCenterX] = useState(600);
  const [centerY, setCenterY] = useState(600);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  // Buildings = fixed + user-placed cities
  const [userCities, setUserCities] = useState<PlacedBuilding[]>([]);
  const buildings: PlacedBuilding[] = [...FIXED_BUILDINGS, ...userCities];

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedToolType, setSelectedToolType] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);

  // Drag state
  const [dragBuilding, setDragBuilding] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // History for undo/redo (only tracks user cities)
  const historyRef = useRef<PlacedBuilding[][]>([[]]);
  const historyIndexRef = useRef(0);

  const pushHistory = useCallback((newCities: PlacedBuilding[]) => {
    const idx = historyIndexRef.current;
    const newHistory = historyRef.current.slice(0, idx + 1);
    newHistory.push(JSON.parse(JSON.stringify(newCities)));
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
  }, []);

  // Collision check (against all buildings including fixed)
  const canPlace = useCallback((typeId: string, x: number, y: number, excludeId?: string): boolean => {
    const type = getBuildingType(typeId);
    if (!type) return false;
    const size = type.size;
    if (x < 0 || y < 0 || x + size > 1200 || y + size > 1200) return false;

    // Check forbidden zone overlap (only for user-placed buildings, not fixed)
    const fz = FORBIDDEN_ZONE;
    if (x < fz.x + fz.size && x + size > fz.x && y < fz.y + fz.size && y + size > fz.y) {
      return false;
    }

    const allBuildings = [...FIXED_BUILDINGS, ...userCities];
    for (const b of allBuildings) {
      if (excludeId && b.id === excludeId) continue;
      const bType = getBuildingType(b.typeId);
      if (!bType) continue;
      const bSize = bType.size;
      if (x < b.x + bSize && x + size > b.x && y < b.y + bSize && y + size > b.y) {
        return false;
      }
    }
    return true;
  }, [userCities]);

  const placeBuilding = useCallback((typeId: string, x: number, y: number, label?: string): string | null => {
    // Only allow cities
    if (typeId !== 'city') return null;
    if (!canPlace(typeId, x, y)) return null;
    const newBuilding: PlacedBuilding = { id: generateId(), typeId, x, y, label };
    const newCities = [...userCities, newBuilding];
    setUserCities(newCities);
    pushHistory(newCities);
    return newBuilding.id;
  }, [userCities, canPlace, pushHistory]);

  const moveBuilding = useCallback((id: string, newX: number, newY: number): boolean => {
    if (isFixed(id)) return false; // Cannot move fixed buildings
    const building = userCities.find((b) => b.id === id);
    if (!building) return false;
    if (!canPlace(building.typeId, newX, newY, id)) return false;
    const newCities = userCities.map((b) => b.id === id ? { ...b, x: newX, y: newY } : b);
    setUserCities(newCities);
    pushHistory(newCities);
    return true;
  }, [userCities, canPlace, pushHistory]);

  const removeBuilding = useCallback((id: string) => {
    if (isFixed(id)) return; // Cannot remove fixed buildings
    const newCities = userCities.filter((b) => b.id !== id);
    setUserCities(newCities);
    pushHistory(newCities);
    if (selectedBuildingId === id) setSelectedBuildingId(null);
  }, [userCities, pushHistory, selectedBuildingId]);

  const updateBuildingLabel = useCallback((id: string, label: string) => {
    if (isFixed(id)) return;
    setUserCities((prev) => prev.map((b) => b.id === id ? { ...b, label } : b));
  }, []);

  const clearAll = useCallback(() => {
    setUserCities([]);
    pushHistory([]);
    setSelectedBuildingId(null);
  }, [pushHistory]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      setUserCities(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current])));
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      setUserCities(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current])));
    }
  }, []);

  // Zoom
  const zoomBy = useCallback((factor: number) => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor)));
  }, []);
  const zoomIn = useCallback(() => zoomBy(1.25), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / 1.25), [zoomBy]);

  // Pan
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

  const panByPixels = useCallback((dScreenX: number, dScreenY: number) => {
    const hc = zoom;
    const dgx = (-dScreenX / hc + dScreenY / hc) / 2;
    const dgy = (dScreenX / hc + dScreenY / hc) / 2;
    setCenterX((x) => Math.max(0, Math.min(1199, x + dgx)));
    setCenterY((y) => Math.max(0, Math.min(1199, y + dgy)));
  }, [zoom]);

  // Clipboard
  const [clipboard, setClipboard] = useState<PlacedBuilding | null>(null);

  const copyBuilding = useCallback((id: string) => {
    if (isFixed(id)) return;
    const b = userCities.find((b) => b.id === id);
    if (b) setClipboard({ ...b });
  }, [userCities]);

  const pasteBuilding = useCallback((): string | null => {
    if (!clipboard) return null;
    const offsets = [[2, 2], [2, 0], [0, 2], [-2, 0], [0, -2], [4, 4], [-2, -2]];
    for (const off of offsets) {
      const nx = clipboard.x + off[0]!;
      const ny = clipboard.y + off[1]!;
      if (canPlace('city', nx, ny)) {
        const newBuilding: PlacedBuilding = { id: generateId(), typeId: 'city', x: nx, y: ny, label: '' };
        const newCities = [...userCities, newBuilding];
        setUserCities(newCities);
        pushHistory(newCities);
        setSelectedBuildingId(newBuilding.id);
        return newBuilding.id;
      }
    }
    return null;
  }, [clipboard, userCities, canPlace, pushHistory]);

  // localStorage persistence
  const isRestoredRef = useRef(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const s = JSON.parse(saved);
        if (s.cities?.length > 0) {
          setUserCities(s.cities);
          historyRef.current = [s.cities];
          historyIndexRef.current = 0;
          nextBuildingId = s.cities.length + 1;
        }
        if (s.centerX != null) setCenterX(s.centerX);
        if (s.centerY != null) setCenterY(s.centerY);
        if (s.zoom != null) setZoom(s.zoom);
        if (s.showLabels != null) setShowLabels(s.showLabels);
      }
    } catch { /* corrupted storage */ }
    setTimeout(() => { isRestoredRef.current = true; }, 200);
  }, []);

  useEffect(() => {
    if (!isRestoredRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        cities: userCities, centerX, centerY, zoom, showLabels,
        savedAt: new Date().toISOString(),
      }));
    } catch { /* storage full */ }
  }, [userCities, centerX, centerY, zoom, showLabels]);

  // Building counts
  const buildingCounts = buildings.reduce<Record<string, number>>((acc, b) => {
    acc[b.typeId] = (acc[b.typeId] || 0) + 1;
    return acc;
  }, {});

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') { if (selectedBuildingId && !isFixed(selectedBuildingId)) { e.preventDefault(); copyBuilding(selectedBuildingId); } }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); pasteBuilding(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedBuildingId && !isFixed(selectedBuildingId)) { e.preventDefault(); removeBuilding(selectedBuildingId); } }
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

    // Helpers
    isFixed,
    userCityCount: userCities.length,

    // Forbidden zone for rendering
    forbiddenZones: [FORBIDDEN_ZONE],

    // Stubs for compatibility with GridCanvas (which expects full useBaseDesigner shape)
    designName: 'Battle Layout',
    setDesignName: () => {},
    isDirty: false,
  };
}
