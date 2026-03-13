import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS, EVENT_CALENDAR_FAQ_DATA } from '../hooks/useStructuredData';
import { useEventCalendar } from '../hooks/useEventCalendar';
import { colors } from '../utils/styles';
import PageTitle from '../components/PageTitle';
import BackLink from '../components/shared/BackLink';
import type { EventMaterial } from '../data/eventCalendarTypes';

const CYAN = '#22d3ee';

/* ─── Helpers ─── */

function utcDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** end_offset marks the first inactive moment; subtract 1 min to get last active day */
function utcEndDateStr(d: Date): string {
  return utcDateStr(new Date(d.getTime() - 60000));
}

function getDateRange(days: number): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    result.push(utcDateStr(d));
  }
  return result;
}

function formatDayHeader(dateStr: string): { dow: string; date: string } {
  const d = new Date(dateStr + 'T12:00:00Z');
  const dow = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const date = `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
  return { dow, date };
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/* ─── Types ─── */

interface CalendarEventRow {
  eventId: string;
  eventName: string;
  eventColor: string;
  eventEmoji: string;
  daySpans: Map<string, boolean>; // dateStr → active on that day
}

interface DayConcurrency {
  dateStr: string;
  label: string;
  isToday: boolean;
  materials: { material: EventMaterial; eventCount: number; eventNames: string[]; events: { eventId: string; eventName: string; eventColor: string; eventEmoji: string }[] }[];
}

/* ─── Main Component ─── */

const EventCalendar: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('eventCalendar.pageTitle', 'Event Calendar'));
  useMetaTags(PAGE_META_TAGS.eventCalendar);
  useStructuredData({ type: 'BreadcrumbList', data: PAGE_BREADCRUMBS.eventCalendar });
  useStructuredData({ type: 'FAQPage', data: EVENT_CALENDAR_FAQ_DATA });
  const isMobile = useIsMobile();

  const {
    events,
    materials,
    projectedWindows,
    enabledEventIds,
    isLoading,
    toggles,
    toggleEvent,
    resetToggles,
  } = useEventCalendar();

  const [forecastDays, setForecastDays] = useState<7 | 14 | 28>(7);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set());

  const todayStr = useMemo(() => utcDateStr(new Date()), []);
  const dateRange = useMemo(() => getDateRange(forecastDays), [forecastDays]);

  // Build calendar rows: one row per event, spanning across days
  const calendarRows = useMemo<CalendarEventRow[]>(() => {
    const rowMap = new Map<string, CalendarEventRow>();
    for (const w of projectedWindows) {
      if (!enabledEventIds.has(w.eventId)) continue;
      if (!rowMap.has(w.eventId)) {
        rowMap.set(w.eventId, {
          eventId: w.eventId,
          eventName: w.eventName,
          eventColor: w.eventColor,
          eventEmoji: w.eventEmoji,
          daySpans: new Map(),
        });
      }
      const row = rowMap.get(w.eventId)!;
      // Mark every day this window spans
      const wStartStr = utcDateStr(w.startUtc);
      const wEndStr = utcEndDateStr(w.endUtc);
      for (const dateStr of dateRange) {
        if (dateStr >= wStartStr && dateStr <= wEndStr) {
          row.daySpans.set(dateStr, true);
        }
      }
    }
    // Only include events that have at least one active day in range
    return Array.from(rowMap.values()).filter(r =>
      dateRange.some(d => r.daySpans.has(d))
    );
  }, [projectedWindows, enabledEventIds, dateRange]);

  // Track which events have any projected windows in the date range (ignoring toggle state)
  const eventsWithOccurrences = useMemo(() => {
    const set = new Set<string>();
    for (const w of projectedWindows) {
      const wStart = utcDateStr(w.startUtc);
      const wEnd = utcEndDateStr(w.endUtc);
      if (dateRange.some(d => d >= wStart && d <= wEnd)) {
        set.add(w.eventId);
      }
    }
    return set;
  }, [projectedWindows, dateRange]);

  // For enabled events NOT in the current view, find their next occurrence date
  const nextOccurrenceMap = useMemo(() => {
    const map = new Map<string, string>(); // eventId → 'MM/DD'
    const now = Date.now();
    for (const event of events) {
      if (!enabledEventIds.has(event.id)) continue; // skip disabled events
      if (eventsWithOccurrences.has(event.id)) continue; // skip events already in range
      // Find earliest projected window for this event that starts after now
      const future = projectedWindows
        .filter(w => w.eventId === event.id && w.startUtc.getTime() >= now)
        .sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());
      if (future.length > 0) {
        const d = future[0]!.startUtc;
        map.set(event.id, `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`);
      }
    }
    return map;
  }, [events, enabledEventIds, eventsWithOccurrences, projectedWindows]);

  // Build daily concurrency data (today + next 6 days)
  const dailyConcurrencies = useMemo<DayConcurrency[]>(() => {
    const days = getDateRange(7);
    return days.map((dateStr) => {
      const isToday = dateStr === todayStr;
      const label = isToday ? t('eventCalendar.today', 'Today') + ' — ' + formatDayLabel(dateStr) : formatDayLabel(dateStr);

      // Find all windows active on this day
      const activeWindows = projectedWindows.filter(w => {
        if (!enabledEventIds.has(w.eventId)) return false;
        const wStart = utcDateStr(w.startUtc);
        const wEnd = utcEndDateStr(w.endUtc);
        return dateStr >= wStart && dateStr <= wEnd;
      });

      // Group by material → unique events
      const materialEventMap = new Map<string, Set<string>>();
      const materialEventNames = new Map<string, Set<string>>();
      const materialEventDetails = new Map<string, { eventId: string; eventName: string; eventColor: string; eventEmoji: string }[]>();
      for (const w of activeWindows) {
        for (const matId of w.materialIds) {
          if (!materialEventMap.has(matId)) {
            materialEventMap.set(matId, new Set());
            materialEventNames.set(matId, new Set());
            materialEventDetails.set(matId, []);
          }
          if (!materialEventMap.get(matId)!.has(w.eventId)) {
            materialEventDetails.get(matId)!.push({
              eventId: w.eventId,
              eventName: w.eventName,
              eventColor: w.eventColor,
              eventEmoji: w.eventEmoji,
            });
          }
          materialEventMap.get(matId)!.add(w.eventId);
          materialEventNames.get(matId)!.add(w.eventName);
        }
      }

      // Build concurrency list — only materials with 2+ events
      const concurrentMaterials: DayConcurrency['materials'] = [];
      for (const [matId, eventIds] of materialEventMap) {
        if (eventIds.size >= 2) {
          const mat = materials.find(m => m.id === matId);
          if (mat) {
            concurrentMaterials.push({
              material: mat,
              eventCount: eventIds.size,
              eventNames: Array.from(materialEventNames.get(matId) || []),
              events: materialEventDetails.get(matId) || [],
            });
          }
        }
      }
      concurrentMaterials.sort((a, b) => b.eventCount - a.eventCount);

      return { dateStr, label, isToday, materials: concurrentMaterials };
    });
  }, [projectedWindows, enabledEventIds, materials, todayStr, t]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <div className="loading-spinner-sm" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '1rem' : '2rem' }}>
        <PageTitle tagline={t('eventCalendar.subtitle', 'Find the best day to spend your materials when multiple events overlap.')}>
          EVENT CALENDAR
        </PageTitle>
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: colors.textMuted }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📅</div>
          <p style={{ fontSize: '0.9rem' }}>
            {t('eventCalendar.noEvents', 'No events are configured yet. Check back soon!')}
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '1rem' }}>
          <BackLink to="/tools" label={t('common.backToTools', 'Back to Tools')} />
        </div>
      </div>
    );
  }

  const colCount = dateRange.length;
  const is28 = forecastDays === 28;
  const scrollable = is28 || (isMobile && forecastDays > 7);
  const eventColWidth = isMobile ? 80 : (is28 ? 120 : 140);
  const dayColWidth = isMobile ? (forecastDays > 7 ? 38 : undefined) : (is28 ? 52 : undefined);
  const gridCols = dayColWidth
    ? `${eventColWidth}px repeat(${colCount}, ${dayColWidth}px)`
    : `${eventColWidth}px repeat(${colCount}, 1fr)`;
  const minTableWidth = dayColWidth ? `${eventColWidth + colCount * dayColWidth}px` : undefined;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: isMobile ? '0.75rem' : '2rem' }}>
      <PageTitle tagline={t('eventCalendar.subtitle', 'Find the best day to spend your materials when multiple events overlap.')}>
        EVENT CALENDAR
      </PageTitle>

      {/* ─── Forecast Selector ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={{ color: colors.textSecondary, fontSize: '0.8rem', fontWeight: 600 }}>
          {t('eventCalendar.upcoming', 'Upcoming Events')}
        </span>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {([7, 14, 28] as const).map(d => (
            <button
              key={d}
              onClick={() => setForecastDays(d)}
              style={{
                padding: isMobile ? '0.45rem 0.85rem' : '0.3rem 0.65rem',
                backgroundColor: forecastDays === d ? `${CYAN}20` : 'transparent',
                border: `1px solid ${forecastDays === d ? `${CYAN}40` : colors.border}`,
                borderRadius: '6px',
                color: forecastDays === d ? CYAN : colors.textMuted,
                fontSize: isMobile ? '0.8rem' : '0.75rem',
                fontWeight: forecastDays === d ? 600 : 400,
                cursor: 'pointer',
                minHeight: '44px',
              }}
            >
              {d === 7 ? '7 Days' : d === 14 ? '14 Days' : '28 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Calendar Grid ─── */}
      <div style={{
        backgroundColor: colors.card,
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
        overflow: 'hidden',
        marginBottom: '1.5rem',
        position: 'relative',
      }}>
       <div style={{
        overflowX: scrollable ? 'auto' : 'visible',
        WebkitOverflowScrolling: 'touch' as const,
      }}>
        {/* Day headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: gridCols,
          borderBottom: `1px solid ${colors.border}`,
          ...(minTableWidth ? { minWidth: minTableWidth } : {}),
        }}>
          {/* Event column header — sticky on scroll */}
          <div style={{
            padding: isMobile ? '0.4rem 0.25rem' : '0.5rem 0.5rem',
            borderRight: `1px solid ${colors.border}`,
            position: 'sticky',
            left: 0,
            zIndex: 2,
            backgroundColor: colors.card,
            display: 'flex',
            alignItems: 'center',
          }}>
            <span style={{
              fontSize: isMobile ? '0.6rem' : '0.7rem',
              fontWeight: 600,
              color: colors.textSecondary,
            }}>
              {t('eventCalendar.eventHeader', 'Event')}
            </span>
          </div>
          {dateRange.map(dateStr => {
            const isToday = dateStr === todayStr;
            const { dow, date } = formatDayHeader(dateStr);
            return (
              <div key={dateStr} style={{
                padding: isMobile ? '0.35rem 0.1rem' : '0.5rem 0.25rem',
                textAlign: 'center',
                backgroundColor: isToday ? `${CYAN}10` : 'transparent',
                borderRight: `1px solid ${colors.borderSubtle}`,
                position: 'relative',
              }}>
                <div style={{
                  fontSize: isMobile ? '0.55rem' : '0.7rem',
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? CYAN : colors.textSecondary,
                  lineHeight: 1.2,
                }}>
                  {dow}
                </div>
                <div style={{
                  fontSize: isMobile ? '0.5rem' : '0.6rem',
                  color: isToday ? CYAN : colors.textMuted,
                  marginTop: '1px',
                }}>
                  {date}
                </div>
                {isToday && (
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '60%',
                    height: '2px',
                    backgroundColor: CYAN,
                    borderRadius: '1px',
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Event rows */}
        {calendarRows.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.85rem' }}>
            {t('eventCalendar.noEventsInRange', 'No events in this time range.')}
          </div>
        ) : calendarRows.map(row => {
          const isExpanded = expandedEventId === row.eventId;
          // Get materials active for this event in the date range
          const eventWindows = projectedWindows.filter(w =>
            w.eventId === row.eventId && dateRange.some(d => d >= utcDateStr(w.startUtc) && d <= utcEndDateStr(w.endUtc))
          );
          const windowPhases = eventWindows.reduce<{ label: string; materialIds: string[]; start: string; end: string }[]>((acc, w) => {
            if (!acc.some(p => p.label === w.windowLabel)) {
              acc.push({ label: w.windowLabel, materialIds: w.materialIds, start: utcDateStr(w.startUtc), end: utcEndDateStr(w.endUtc) });
            }
            return acc;
          }, []);

          return (
          <React.Fragment key={row.eventId}>
          <div
            onClick={() => setExpandedEventId(isExpanded ? null : row.eventId)}
            style={{
              display: 'grid',
              gridTemplateColumns: gridCols,
              borderBottom: `1px solid ${colors.borderSubtle}`,
              minHeight: isMobile ? '44px' : '42px',
              cursor: 'pointer',
              ...(minTableWidth ? { minWidth: minTableWidth } : {}),
            }}
          >
            {/* Event label — sticky on horizontal scroll */}
            <div style={{
              padding: isMobile ? '0.3rem 0.25rem' : '0.4rem 0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              borderRight: `1px solid ${colors.border}`,
              overflow: 'hidden',
              position: 'sticky',
              left: 0,
              zIndex: 1,
              backgroundColor: colors.card,
            }}>
              <span style={{ fontSize: isMobile ? '0.75rem' : '0.85rem', flexShrink: 0, lineHeight: 1.3 }}>{row.eventEmoji}</span>
              <span style={{
                color: row.eventColor,
                fontSize: isMobile ? '0.6rem' : '0.75rem',
                fontWeight: 600,
                lineHeight: 1.3,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const,
                overflow: 'hidden',
              }}>
                {row.eventName}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '0.5rem', color: colors.textMuted, flexShrink: 0 }}>
                {isExpanded ? '▲' : '▼'}
              </span>
            </div>
            {/* Day cells */}
            {dateRange.map(dateStr => {
              const active = row.daySpans.has(dateStr);
              const isToday = dateStr === todayStr;

              // Find neighboring active cells for connected bar effect
              const dateIdx = dateRange.indexOf(dateStr);
              const prevActive = dateIdx > 0 && row.daySpans.has(dateRange[dateIdx - 1]!);
              const nextActive = dateIdx < dateRange.length - 1 && row.daySpans.has(dateRange[dateIdx + 1]!);

              return (
                <div key={dateStr} style={{
                  padding: '4px 1px',
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: isToday ? `${CYAN}06` : 'transparent',
                  borderRight: `1px solid ${colors.borderSubtle}`,
                }}>
                  {active && (
                    <div style={{
                      width: '100%',
                      height: isMobile ? '20px' : '26px',
                      backgroundColor: `${row.eventColor}30`,
                      borderTop: `2px solid ${row.eventColor}`,
                      borderRadius: prevActive && nextActive ? '0'
                        : !prevActive && !nextActive ? '4px'
                        : !prevActive ? '4px 0 0 4px'
                        : '0 4px 4px 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {/* Show a dot indicator on active cells */}
                      <div style={{
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        backgroundColor: row.eventColor,
                        opacity: 0.7,
                      }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* ─── Expanded detail panel (mobile tap-to-expand) ─── */}
          {isExpanded && windowPhases.length > 0 && (
            <div style={{
              backgroundColor: `${row.eventColor}08`,
              borderBottom: `1px solid ${colors.borderSubtle}`,
              padding: '0.5rem 0.6rem',
            }}>
              <div style={{ fontSize: '0.65rem', color: colors.textSecondary, fontWeight: 600, marginBottom: '0.35rem' }}>
                Window Phases
              </div>
              {windowPhases.map((phase, pi) => (
                <div key={pi} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.15rem',
                  padding: '0.3rem 0.4rem',
                  backgroundColor: colors.bg,
                  borderRadius: '6px',
                  border: `1px solid ${colors.borderSubtle}`,
                  marginBottom: pi < windowPhases.length - 1 ? '0.3rem' : 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: row.eventColor, fontSize: '0.7rem', fontWeight: 600 }}>{phase.label}</span>
                    <span style={{ color: colors.textMuted, fontSize: '0.55rem' }}>{phase.start} → {phase.end}</span>
                  </div>
                  {phase.materialIds.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {phase.materialIds.map(mid => {
                        const mat = materials.find(m => m.id === mid);
                        if (!mat) return null;
                        return (
                          <span key={mid} style={{
                            fontSize: '0.6rem',
                            padding: '0.1rem 0.3rem',
                            backgroundColor: `${CYAN}10`,
                            border: `1px solid ${CYAN}25`,
                            borderRadius: '4px',
                            color: colors.text,
                          }}>
                            {mat.emoji} {mat.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </React.Fragment>
          );
        })}
      </div>
      </div>

      {/* ─── Event Filters ─── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            padding: isMobile ? '0.6rem 0.9rem' : '0.45rem 0.75rem',
            backgroundColor: 'transparent',
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            color: colors.textSecondary,
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            minHeight: '44px',
          }}
        >
          <span>{showFilters ? '▾' : '▸'}</span>
          {t('eventCalendar.eventFilters', 'Event Filters')}
          {Object.values(toggles).some(v => v === false) && (
            <span style={{
              backgroundColor: `${colors.warning}20`,
              color: colors.warning,
              fontSize: '0.6rem',
              fontWeight: 700,
              padding: '0.1rem 0.35rem',
              borderRadius: '6px',
            }}>
              Filtered
            </span>
          )}
        </button>

        {showFilters && (
          <div style={{
            backgroundColor: colors.cardAlt,
            borderRadius: '8px',
            border: `1px solid ${colors.border}`,
            padding: '0.75rem',
            marginTop: '0.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600 }}>
                {t('eventCalendar.toggleEvents', 'Toggle events you have access to')}
              </span>
              <button
                onClick={resetToggles}
                style={{
                  padding: '0.35rem 0.65rem',
                  backgroundColor: 'transparent',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  color: colors.textMuted,
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  minHeight: '36px',
                }}
              >
                {t('eventCalendar.resetAll', 'Reset All')}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {events.map(event => {
                const enabled = enabledEventIds.has(event.id);
                return (
                  <button
                    key={event.id}
                    onClick={() => toggleEvent(event.id)}
                    style={{
                      padding: '0.5rem 0.65rem',
                      backgroundColor: enabled ? `${event.color}10` : colors.bg,
                      border: `1px solid ${enabled ? `${event.color}30` : colors.border}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      opacity: enabled ? 1 : 0.5,
                      width: '100%',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      border: `2px solid ${enabled ? event.color : colors.textMuted}`,
                      backgroundColor: enabled ? `${event.color}30` : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      color: event.color,
                      flexShrink: 0,
                    }}>
                      {enabled ? '✓' : ''}
                    </span>
                    <span style={{ fontSize: '0.9rem' }}>{event.emoji}</span>
                    <span style={{ color: enabled ? event.color : colors.textMuted, fontWeight: 500, fontSize: '0.85rem' }}>
                      {event.name}
                    </span>
                    {nextOccurrenceMap.has(event.id) && (
                      <span style={{
                        backgroundColor: `${colors.warning}15`,
                        color: colors.warning,
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap',
                      }}>
                        {t('eventCalendar.nextDate', 'Next: {{date}}', { date: nextOccurrenceMap.get(event.id) })}
                      </span>
                    )}
                    <span style={{ color: colors.textMuted, fontSize: '0.65rem', marginLeft: 'auto', flexShrink: 0 }}>
                      {event.event_kind === 'cyclical' && event.cadence_weeks
                        ? `${event.cadence_weeks}w cycle`
                        : 'Special'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── Daily Concurrency Section ─── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <span style={{ color: colors.textSecondary, fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.6rem' }}>
          {t('eventCalendar.materialOverlaps', 'Material Overlaps — Next 7 Days')}
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {dailyConcurrencies.map(day => (
            <div
              key={day.dateStr}
              style={{
                backgroundColor: day.isToday ? `${CYAN}06` : colors.cardAlt,
                borderRadius: '10px',
                border: `1px solid ${day.isToday ? `${CYAN}20` : colors.border}`,
                padding: isMobile ? '0.65rem 0.75rem' : '0.75rem 1rem',
              }}
            >
              {/* Day header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: day.materials.length > 0 ? '0.5rem' : 0 }}>
                {day.isToday && (
                  <span style={{
                    backgroundColor: `${CYAN}20`,
                    color: CYAN,
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.35rem',
                    borderRadius: '4px',
                  }}>
                    TODAY
                  </span>
                )}
                <span style={{
                  color: day.isToday ? colors.text : colors.textSecondary,
                  fontWeight: day.isToday ? 700 : 600,
                  fontSize: isMobile ? '0.8rem' : '0.85rem',
                }}>
                  {formatDayLabel(day.dateStr)}
                </span>
                {day.materials.length > 0 && (
                  <span style={{
                    backgroundColor: `${CYAN}15`,
                    color: CYAN,
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '6px',
                    marginLeft: 'auto',
                  }}>
                    {day.materials.length} overlap{day.materials.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Concurrent materials */}
              {day.materials.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {day.materials.map(({ material, eventCount, events: matEvents }) => {
                    const matKey = `${day.dateStr}-${material.id}`;
                    const isMatExpanded = expandedMaterials.has(matKey);
                    return (
                      <div key={material.id} style={{
                        backgroundColor: colors.bg,
                        borderRadius: '6px',
                        border: `1px solid ${isMatExpanded ? `${CYAN}30` : colors.borderSubtle}`,
                        overflow: 'hidden',
                      }}>
                        {/* Collapsed row — always visible */}
                        <button
                          onClick={() => {
                            setExpandedMaterials(prev => {
                              const next = new Set(prev);
                              if (next.has(matKey)) next.delete(matKey);
                              else next.add(matKey);
                              return next;
                            });
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.35rem 0.5rem',
                            width: '100%',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            minHeight: isMobile ? '44px' : '36px',
                          }}
                        >
                          <span style={{ fontSize: '0.85rem' }}>{material.emoji}</span>
                          <span style={{ color: colors.text, fontSize: '0.8rem', fontWeight: 500 }}>
                            {material.name}
                          </span>
                          <span style={{
                            backgroundColor: `${CYAN}15`,
                            color: CYAN,
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                            flexShrink: 0,
                            marginLeft: 'auto',
                          }}>
                            {eventCount}x
                          </span>
                          <span style={{
                            color: colors.textMuted,
                            fontSize: '0.6rem',
                            flexShrink: 0,
                            transition: 'transform 0.15s ease',
                            transform: isMatExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          }}>
                            ▸
                          </span>
                        </button>
                        {/* Expanded: show overlapping events */}
                        {isMatExpanded && (
                          <div style={{
                            padding: '0.25rem 0.5rem 0.4rem',
                            borderTop: `1px solid ${colors.borderSubtle}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.2rem',
                          }}>
                            {matEvents.map(ev => (
                              <div key={ev.eventId} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                padding: '0.2rem 0.35rem',
                                borderRadius: '4px',
                                backgroundColor: `${ev.eventColor}08`,
                              }}>
                                <span style={{ fontSize: '0.75rem' }}>{ev.eventEmoji}</span>
                                <span style={{ color: ev.eventColor, fontSize: '0.7rem', fontWeight: 500 }}>
                                  {ev.eventName}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.25rem 0',
                }}>
                  <span style={{ color: colors.textMuted, fontSize: '0.75rem', fontStyle: 'italic' }}>
                    {t('eventCalendar.noOverlaps', 'No material overlaps')}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Back Link ─── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', paddingBottom: '1rem', flexWrap: 'wrap' }}>
        <BackLink to="/tools" label={t('common.allTools', 'All Tools')} />
        <BackLink to="/" label={t('common.backToHome', 'Home')} variant="secondary" />
      </div>
    </div>
  );
};

export default EventCalendar;
