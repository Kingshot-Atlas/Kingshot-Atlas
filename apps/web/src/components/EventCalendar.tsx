import React, { useState } from 'react';

interface GameEvent {
  id: string;
  name: string;
  type: 'kvk' | 'transfer' | 'event';
  startDate: Date;
  endDate?: Date;
  description: string;
  icon: string;
  color: string;
}

// Kingshot Game Schedule
// KvK: Every 4 weeks
//   - Preparation Phase: Monday 00:00 UTC to Saturday 10:00 UTC
//   - Battle Phase: Saturday 10:00 UTC to Saturday 22:00 UTC
//   - Reference: KvK #10 started Monday, January 26, 2026 at 00:00 UTC
// Transfer Event: Every 8 weeks
//   - Pre-Transfer Phase: Sunday 00:00 UTC to Wednesday 00:00 UTC
//   - Invitational Transfer Phase: Wednesday 00:00 UTC to Friday 00:00 UTC
//   - Open Transfer Phase: Friday 00:00 UTC to Sunday 00:00 UTC
//   - Reference: Transfer Event #3 started Sunday, January 4, 2026 at 00:00 UTC

const generateEvents = (): GameEvent[] => {
  const events: GameEvent[] = [];
  
  // KvK #10 started Monday, January 26, 2026 at 00:00 UTC
  // Calculate KvK #1 start date by going back 9 cycles (9 * 28 days)
  const kvk10Start = new Date('2026-01-26T00:00:00Z');
  const kvk1Start = new Date(kvk10Start);
  kvk1Start.setDate(kvk1Start.getDate() - (9 * 28));
  
  // Transfer Event #3 started Sunday, January 4, 2026 at 00:00 UTC
  // Calculate Transfer #1 start date by going back 2 cycles (2 * 56 days)
  const transfer3Start = new Date('2026-01-04T00:00:00Z');
  const transfer1Start = new Date(transfer3Start);
  transfer1Start.setDate(transfer1Start.getDate() - (2 * 56));
  
  // Generate KvK events (past and future)
  for (let i = 0; i < 20; i++) {
    const kvkNumber = i + 1;
    const kvkStart = new Date(kvk1Start);
    kvkStart.setDate(kvkStart.getDate() + (i * 28)); // 4 weeks = 28 days
    
    // Prep Phase: Monday 00:00 UTC to Saturday 10:00 UTC
    const prepStart = new Date(kvkStart);
    const prepEnd = new Date(kvkStart);
    prepEnd.setDate(prepEnd.getDate() + 5);
    prepEnd.setHours(10, 0, 0, 0);
    
    // Battle Phase: Saturday 10:00 UTC to Saturday 22:00 UTC
    const battleStart = new Date(prepEnd);
    const battleEnd = new Date(battleStart);
    battleEnd.setHours(22, 0, 0, 0);

    events.push({
      id: `kvk-prep-${kvkNumber}`,
      name: `KvK #${kvkNumber} Prep`,
      type: 'kvk',
      startDate: prepStart,
      endDate: prepEnd,
      description: 'Preparation Phase - Build points, gather resources',
      icon: '🛡️',
      color: '#eab308'
    });

    events.push({
      id: `kvk-battle-${kvkNumber}`,
      name: `KvK #${kvkNumber} Battle`,
      type: 'kvk',
      startDate: battleStart,
      endDate: battleEnd,
      description: 'Battle Phase - Fight for victory',
      icon: '⚔️',
      color: '#f97316'
    });
  }

  // Generate Transfer events
  for (let i = 0; i < 10; i++) {
    const transferNumber = i + 1;
    const cycleStart = new Date(transfer1Start);
    cycleStart.setDate(cycleStart.getDate() + (i * 56)); // 8 weeks = 56 days
    
    // Pre-Transfer Phase: Sunday 00:00 UTC to Wednesday 00:00 UTC
    const preTransferStart = new Date(cycleStart);
    const preTransferEnd = new Date(cycleStart);
    preTransferEnd.setDate(preTransferEnd.getDate() + 3);
    
    // Invitational Transfer Phase: Wednesday 00:00 UTC to Friday 00:00 UTC
    const inviteStart = new Date(preTransferEnd);
    const inviteEnd = new Date(inviteStart);
    inviteEnd.setDate(inviteEnd.getDate() + 2);
    
    // Open Transfer Phase: Friday 00:00 UTC to Sunday 00:00 UTC
    const openStart = new Date(inviteEnd);
    const openEnd = new Date(openStart);
    openEnd.setDate(openEnd.getDate() + 2);

    events.push({
      id: `transfer-pre-${transferNumber}`,
      name: `Transfer #${transferNumber} Pre`,
      type: 'transfer',
      startDate: preTransferStart,
      endDate: preTransferEnd,
      description: 'Pre-Transfer Phase - Announcement period',
      icon: '📢',
      color: '#a855f7'
    });

    events.push({
      id: `transfer-invite-${transferNumber}`,
      name: `Transfer #${transferNumber} Invite`,
      type: 'transfer',
      startDate: inviteStart,
      endDate: inviteEnd,
      description: 'Invitational Transfer Phase - Priority migration',
      icon: '✉️',
      color: '#8b5cf6'
    });

    events.push({
      id: `transfer-open-${transferNumber}`,
      name: `Transfer #${transferNumber} Open`,
      type: 'transfer',
      startDate: openStart,
      endDate: openEnd,
      description: 'Open Transfer Phase - All eligible kingdoms',
      icon: '🚀',
      color: '#7c3aed'
    });
  }

  return events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
};

const EventCalendar: React.FC = () => {
  const [events] = useState<GameEvent[]>(generateEvents);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const now = new Date();

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventStart = new Date(event.startDate);
      const eventEnd = event.endDate ? new Date(event.endDate) : eventStart;
      eventStart.setHours(0, 0, 0, 0);
      eventEnd.setHours(23, 59, 59, 999);
      date.setHours(12, 0, 0, 0);
      return date >= eventStart && date <= eventEnd;
    });
  };

  const navigateMonth = (direction: number) => {
    setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  const daysInMonth = getDaysInMonth(selectedMonth);
  const firstDay = getFirstDayOfMonth(selectedMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const upcomingEvents = events
    .filter(e => e.startDate >= now)
    .slice(0, 4);

  return (
    <div style={{
      backgroundColor: '#131318',
      borderRadius: '16px',
      border: '1px solid #2a2a2a',
      padding: '1.5rem'
    }}>
      <h2 style={{ 
        color: '#fff', 
        fontSize: '1.1rem', 
        fontWeight: '600', 
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        📅 Event Calendar
      </h2>

      {/* Month Navigation */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <button
          onClick={() => navigateMonth(-1)}
          style={{
            background: 'none',
            border: '1px solid #3a3a3a',
            borderRadius: '6px',
            color: '#9ca3af',
            padding: '0.4rem 0.75rem',
            cursor: 'pointer'
          }}
        >
          ←
        </button>
        <span style={{ color: '#fff', fontWeight: '600' }}>
          {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={() => navigateMonth(1)}
          style={{
            background: 'none',
            border: '1px solid #3a3a3a',
            borderRadius: '6px',
            color: '#9ca3af',
            padding: '0.4rem 0.75rem',
            cursor: 'pointer'
          }}
        >
          →
        </button>
      </div>

      {/* Calendar Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '2px',
        marginBottom: '1.5rem'
      }}>
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} style={{
            textAlign: 'center',
            padding: '0.5rem',
            color: '#6b7280',
            fontSize: '0.7rem',
            fontWeight: '600'
          }}>
            {day}
          </div>
        ))}

        {/* Blank days */}
        {blanks.map(i => (
          <div key={`blank-${i}`} style={{ padding: '0.5rem' }} />
        ))}

        {/* Calendar days */}
        {days.map(day => {
          const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
          const dayEvents = getEventsForDate(new Date(date));
          const isToday = date.toDateString() === now.toDateString();
          
          return (
            <div
              key={day}
              style={{
                position: 'relative',
                padding: '0.4rem',
                textAlign: 'center',
                backgroundColor: isToday ? '#22d3ee15' : dayEvents.length > 0 ? '#1a1a20' : 'transparent',
                borderRadius: '6px',
                border: isToday ? '1px solid #22d3ee50' : '1px solid transparent',
                minHeight: '40px'
              }}
            >
              <div style={{
                fontSize: '0.8rem',
                color: isToday ? '#22d3ee' : '#fff',
                fontWeight: isToday ? '600' : '400'
              }}>
                {day}
              </div>
              {dayEvents.length > 0 && (
                <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', marginTop: '2px' }}>
                  {dayEvents.slice(0, 2).map((e, i) => (
                    <div
                      key={i}
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: e.color
                      }}
                      title={e.name}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Upcoming Events List */}
      <div>
        <h3 style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          Upcoming Events
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {upcomingEvents.map(event => (
            <div
              key={event.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                backgroundColor: '#1a1a20',
                borderRadius: '8px',
                borderLeft: `3px solid ${event.color}`
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{event.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '500' }}>
                  {event.name}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  {event.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {event.endDate && ` - ${event.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </div>
              </div>
              <div style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: `${event.color}20`,
                borderRadius: '4px',
                fontSize: '0.7rem',
                color: event.color,
                fontWeight: '500'
              }}>
                {Math.ceil((event.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))}d
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginTop: '1rem',
        paddingTop: '1rem',
        borderTop: '1px solid #2a2a2a'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22d3ee' }} />
          <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>KvK</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#a855f7' }} />
          <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>Transfer</span>
        </div>
      </div>
    </div>
  );
};

export default EventCalendar;
