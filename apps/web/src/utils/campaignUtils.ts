/**
 * Campaign utility functions — weighted random selection, seed generation, helpers
 */

export interface WeightedKingdom {
  kingdom_number: number;
  tickets: number;
}

/**
 * Generate a cryptographically secure random seed and return both the seed and a random float [0, 1)
 */
export function generateRandomDraw(): { seed: string; value: number } {
  const array = new Uint32Array(4);
  crypto.getRandomValues(array);
  const seed = Array.from(array).map(n => n.toString(16).padStart(8, '0')).join('');
  // Use first two uint32 values to create a float [0, 1)
  const value = (array[0]! * 0x100000000 + array[1]!) / (0x10000000000000000);
  return { seed, value };
}

/**
 * Select a kingdom using weighted random selection.
 * Each kingdom's probability = tickets / totalTickets.
 * Returns the selected kingdom number.
 */
export function weightedRandomSelect(
  kingdoms: WeightedKingdom[],
  excludeKingdoms: Set<number> = new Set()
): { kingdom_number: number; seed: string } | null {
  // Filter out excluded kingdoms
  const eligible = kingdoms.filter(k => !excludeKingdoms.has(k.kingdom_number) && k.tickets > 0);
  if (eligible.length === 0) return null;

  const totalTickets = eligible.reduce((sum, k) => sum + k.tickets, 0);
  if (totalTickets === 0) return null;

  const { seed, value } = generateRandomDraw();
  const target = value * totalTickets;

  let cumulative = 0;
  for (const kingdom of eligible) {
    cumulative += kingdom.tickets;
    if (target < cumulative) {
      return { kingdom_number: kingdom.kingdom_number, seed };
    }
  }

  // Fallback to last eligible kingdom (floating point edge case)
  return { kingdom_number: eligible[eligible.length - 1]!.kingdom_number, seed };
}

/**
 * Get prize tier color based on amount
 */
export function getPrizeTierColor(amount: number): string {
  if (amount >= 100) return '#fbbf24'; // gold
  if (amount >= 50) return '#a855f7';  // purple
  if (amount >= 25) return '#3b82f6';  // blue
  if (amount >= 10) return '#22c55e';  // green
  return '#e5e7eb'; // white/gray
}

/**
 * Get prize tier label
 */
export function getPrizeTierLabel(amount: number): string {
  if (amount >= 100) return 'Grand Prize';
  if (amount >= 50) return 'Major Prize';
  if (amount >= 25) return 'Prize';
  if (amount >= 10) return 'Reward';
  return 'Bonus';
}

/**
 * Format prize amount with dollar sign
 */
export function formatPrize(amount: number): string {
  return `$${amount}`;
}

/**
 * Generate the slot machine reel sequence for animation.
 * Creates a sequence of kingdom numbers that ends on the target.
 */
export function generateReelSequence(
  kingdoms: WeightedKingdom[],
  targetKingdom: number,
  totalItems: number = 40
): number[] {
  if (kingdoms.length === 0) return [targetKingdom];
  const sequence: number[] = [];
  for (let i = 0; i < totalItems - 1; i++) {
    const randomIdx = Math.floor(Math.random() * kingdoms.length);
    sequence.push(kingdoms[randomIdx]!.kingdom_number);
  }
  // Last item is the target
  sequence.push(targetKingdom);
  return sequence;
}

/**
 * Format a Discord announcement from winners data
 */
export function generateDiscordAnnouncement(
  campaignName: string,
  campaignNumber: number,
  winners: { draw_order: number; prize_amount: number; kingdom_number: number; tickets_at_draw: number }[],
  totalTickets: number,
  totalKingdoms: number
): string {
  const sortedWinners = [...winners].sort((a, b) => b.prize_amount - a.prize_amount || b.draw_order - a.draw_order);
  
  const tierEmoji = (amount: number) => {
    if (amount >= 100) return '🥇';
    if (amount >= 50) return '🥈';
    if (amount >= 25) return '🥉';
    if (amount >= 10) return '💚';
    return '⚪';
  };

  let text = `🏰 **${campaignName.toUpperCase()} — CAMPAIGN #${campaignNumber} RESULTS** 🏰\n\n`;
  
  for (const w of sortedWinners) {
    text += `${tierEmoji(w.prize_amount)} $${w.prize_amount} → Kingdom ${w.kingdom_number} (${w.tickets_at_draw} tickets)\n`;
  }

  text += `\nTotal: ${totalTickets} tickets across ${totalKingdoms} kingdoms`;
  text += `\nCongratulations to all winners! 🎉`;

  return text;
}
