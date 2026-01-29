/**
 * Event Schedule Utilities
 * Calculates KvK and Transfer Event dates based on reference schedules
 */

const config = require('../config');

/**
 * Calculate next KvK event
 */
function getNextKvK() {
  const now = new Date();
  const ref = config.kvkReference;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const cycleMs = ref.frequencyWeeks * msPerWeek;

  // Calculate how many cycles have passed since reference
  const msSinceRef = now - ref.startDate;
  const cyclesPassed = Math.floor(msSinceRef / cycleMs);

  // Calculate current/next KvK start
  let nextStart = new Date(ref.startDate.getTime() + (cyclesPassed * cycleMs));

  // If we're past this KvK's end, move to next
  const prepEndMs = ref.prepDurationDays * 24 * 60 * 60 * 1000;
  const battleEndMs = prepEndMs + (ref.battleDurationHours * 60 * 60 * 1000);
  const kvkEnd = new Date(nextStart.getTime() + battleEndMs);

  if (now > kvkEnd) {
    nextStart = new Date(nextStart.getTime() + cycleMs);
  }

  const kvkNumber = ref.number + cyclesPassed + (now > kvkEnd ? 1 : 0);

  // Calculate prep and battle phase times
  const prepEnd = new Date(nextStart.getTime() + prepEndMs);
  const battleStart = prepEnd;
  const battleEnd = new Date(battleStart.getTime() + (ref.battleDurationHours * 60 * 60 * 1000));

  // Determine current phase
  let phase = null;
  let isActive = false;
  if (now >= nextStart && now < prepEnd) {
    phase = 'Prep Phase';
    isActive = true;
  } else if (now >= battleStart && now < battleEnd) {
    phase = 'Battle Phase';
    isActive = true;
  }

  const daysUntil = Math.ceil((nextStart - now) / (24 * 60 * 60 * 1000));

  return {
    number: kvkNumber,
    startDate: nextStart.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      timeZone: 'UTC'
    }),
    startDateRaw: nextStart,
    prepEnd,
    battleStart,
    battleEnd,
    daysUntil: Math.max(0, daysUntil),
    phase,
    isActive,
  };
}

/**
 * Calculate next Transfer Event
 */
function getNextTransfer() {
  const now = new Date();
  const ref = config.transferReference;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const cycleMs = ref.frequencyWeeks * msPerWeek;

  // Calculate how many cycles have passed since reference
  const msSinceRef = now - ref.startDate;
  const cyclesPassed = Math.floor(msSinceRef / cycleMs);

  // Calculate current/next Transfer start
  let nextStart = new Date(ref.startDate.getTime() + (cyclesPassed * cycleMs));

  // Total duration of transfer event
  const totalDays = ref.phases.preTransfer + ref.phases.invitational + ref.phases.open;
  const eventEnd = new Date(nextStart.getTime() + (totalDays * 24 * 60 * 60 * 1000));

  if (now > eventEnd) {
    nextStart = new Date(nextStart.getTime() + cycleMs);
  }

  const eventNumber = ref.number + cyclesPassed + (now > eventEnd ? 1 : 0);

  // Calculate phase boundaries
  const preTransferEnd = new Date(nextStart.getTime() + (ref.phases.preTransfer * 24 * 60 * 60 * 1000));
  const invitationalEnd = new Date(preTransferEnd.getTime() + (ref.phases.invitational * 24 * 60 * 60 * 1000));
  const openEnd = new Date(invitationalEnd.getTime() + (ref.phases.open * 24 * 60 * 60 * 1000));

  // Determine current phase
  let phase = null;
  let isActive = false;
  if (now >= nextStart && now < preTransferEnd) {
    phase = 'Pre-Transfer Phase';
    isActive = true;
  } else if (now >= preTransferEnd && now < invitationalEnd) {
    phase = 'Invitational Transfer Phase';
    isActive = true;
  } else if (now >= invitationalEnd && now < openEnd) {
    phase = 'Open Transfer Phase';
    isActive = true;
  }

  const daysUntil = Math.ceil((nextStart - now) / (24 * 60 * 60 * 1000));

  return {
    number: eventNumber,
    startDate: nextStart.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      timeZone: 'UTC'
    }),
    startDateRaw: nextStart,
    preTransferEnd,
    invitationalEnd,
    openEnd,
    daysUntil: Math.max(0, daysUntil),
    phase,
    isActive,
  };
}

/**
 * Get all upcoming events
 */
function getUpcomingEvents() {
  return {
    kvk: getNextKvK(),
    transfer: getNextTransfer(),
  };
}

/**
 * Format time remaining as human-readable string
 */
function formatTimeRemaining(targetDate) {
  const now = new Date();
  const diff = targetDate - now;

  if (diff <= 0) return 'Now!';

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`);

  return parts.join(' ') || 'Less than a minute';
}

/**
 * Format countdown as detailed string
 */
function formatCountdown(targetDate) {
  const now = new Date();
  const diff = targetDate - now;

  if (diff <= 0) return '🔥 HAPPENING NOW 🔥';

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((diff % (60 * 1000)) / 1000);

  return [
    `${days.toString().padStart(2, '0')} days`,
    `${hours.toString().padStart(2, '0')} hours`,
    `${minutes.toString().padStart(2, '0')} minutes`,
    `${seconds.toString().padStart(2, '0')} seconds`,
  ].join('\n');
}

module.exports = {
  getNextKvK,
  getNextTransfer,
  getUpcomingEvents,
  formatTimeRemaining,
  formatCountdown,
};
