import { useMemo, useState, useCallback } from 'react';
import { useGameEvents, useEventMaterials } from './useGameEvents';
import { projectEventWindows, rankWindowsByMaterial, buildMaterialHeatmap, getWindowsForDate } from '../data/eventCalendarProjection';
import type { ProjectedWindow, EventToggles } from '../data/eventCalendarTypes';
import { EVENT_TOGGLES_KEY } from '../data/eventCalendarTypes';

function loadToggles(): EventToggles {
  try {
    const raw = localStorage.getItem(EVENT_TOGGLES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToggles(toggles: EventToggles) {
  try {
    localStorage.setItem(EVENT_TOGGLES_KEY, JSON.stringify(toggles));
  } catch { /* ignore */ }
}

export function useEventCalendar() {
  const { data: events = [], isLoading: eventsLoading } = useGameEvents();
  const { data: materials = [], isLoading: materialsLoading } = useEventMaterials();

  const [toggles, setToggles] = useState<EventToggles>(loadToggles);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [heatmapDays, setHeatmapDays] = useState<7 | 14 | 28>(14);

  // Enabled event IDs (all enabled by default unless explicitly disabled)
  const enabledEventIds = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (toggles[e.id] !== false) {
        set.add(e.id);
      }
    }
    return set;
  }, [events, toggles]);

  // Project all windows
  const projectedWindows = useMemo<ProjectedWindow[]>(() => {
    if (!events.length) return [];
    return projectEventWindows(events);
  }, [events]);

  // Ranked opportunities for selected material
  const rankedOpportunities = useMemo(() => {
    if (!selectedMaterialId) return [];
    return rankWindowsByMaterial(projectedWindows, selectedMaterialId, enabledEventIds);
  }, [projectedWindows, selectedMaterialId, enabledEventIds]);

  // Heatmap data for selected material
  const heatmap = useMemo(() => {
    if (!selectedMaterialId) return [];
    return buildMaterialHeatmap(projectedWindows, selectedMaterialId, heatmapDays, new Date(), enabledEventIds);
  }, [projectedWindows, selectedMaterialId, heatmapDays, enabledEventIds]);

  // Windows for selected date
  const dateWindows = useMemo(() => {
    if (!selectedDate) return [];
    return getWindowsForDate(projectedWindows, selectedDate, enabledEventIds);
  }, [projectedWindows, selectedDate, enabledEventIds]);

  // Best recommendation
  const bestRecommendation = useMemo(() => {
    if (!rankedOpportunities.length) return null;
    return rankedOpportunities[0];
  }, [rankedOpportunities]);

  // Toggle an event on/off
  const toggleEvent = useCallback((eventId: string) => {
    setToggles(prev => {
      const next = { ...prev, [eventId]: prev[eventId] === false ? true : false };
      // Clean up: remove true entries (default is enabled)
      if (next[eventId] === true) delete next[eventId];
      saveToggles(next);
      return next;
    });
  }, []);

  // Reset all toggles
  const resetToggles = useCallback(() => {
    setToggles({});
    saveToggles({});
  }, []);

  // Auto-select first material if none selected
  const effectiveMaterialId = selectedMaterialId || (materials.length > 0 ? materials[0]!.id : null);

  return {
    // Data
    events,
    materials,
    projectedWindows,
    rankedOpportunities,
    heatmap,
    dateWindows,
    bestRecommendation,
    enabledEventIds,

    // Loading
    isLoading: eventsLoading || materialsLoading,

    // Selection state
    selectedMaterialId: effectiveMaterialId,
    setSelectedMaterialId,
    selectedDate,
    setSelectedDate,
    heatmapDays,
    setHeatmapDays,

    // Toggles
    toggles,
    toggleEvent,
    resetToggles,
  };
}
