export type OutcomeType = 'Domination' | 'Reversal' | 'Comeback' | 'Defeat' | 'Bye';

export interface OutcomeInfo {
  name: OutcomeType;
  abbrev: string;
  color: string;
  bgColor: string;
  description: string;
}

export const OUTCOMES: Record<OutcomeType, OutcomeInfo> = {
  Domination: {
    name: 'Domination',
    abbrev: '👑',
    color: '#22c55e',
    bgColor: '#22c55e20',
    description: 'Won both Prep and Battle'
  },
  Reversal: {
    name: 'Reversal',
    abbrev: '🔄',
    color: '#a855f7',
    bgColor: '#a855f720',
    description: 'Won Prep but lost Battle'
  },
  Comeback: {
    name: 'Comeback',
    abbrev: '💪',
    color: '#3b82f6',
    bgColor: '#3b82f620',
    description: 'Lost Prep but won Battle'
  },
  Defeat: {
    name: 'Defeat',
    abbrev: '💀',
    color: '#ef4444',
    bgColor: '#ef444420',
    description: 'Lost both Prep and Battle'
  },
  Bye: {
    name: 'Bye',
    abbrev: '⏸️',
    color: '#6b7280',
    bgColor: '#6b728020',
    description: 'No opponent this round'
  }
};

export const getOutcome = (prepResult: string | null, battleResult: string | null): OutcomeType => {
  // Handle NULL values (Bye records may have NULL prep/battle results)
  if (prepResult === null || battleResult === null) return 'Bye';
  
  const prep = prepResult.toLowerCase();
  const battle = battleResult.toLowerCase();
  const prepWin = prep === 'win' || prep === 'w';
  const battleWin = battle === 'win' || battle === 'w';
  
  // 'B' or 'bye' indicates a Bye
  if (prep === 'bye' || battle === 'bye' || prep === 'b' || battle === 'b') return 'Bye';
  if (prepWin && battleWin) return 'Domination';
  if (prepWin && !battleWin) return 'Reversal';
  if (!prepWin && battleWin) return 'Comeback';
  return 'Defeat';
};

export const getOutcomeFromOverall = (overallResult: string): OutcomeType => {
  // Handle actual API response values
  const result = overallResult.toLowerCase();
  switch (result) {
    case 'domination':
    case 'win':
    case 'w':
      return 'Domination';
    case 'reversal':
      return 'Reversal';
    case 'comeback':
      return 'Comeback';
    case 'defeat':
    case 'loss':
    case 'l':
      return 'Defeat';
    case 'bye':
      return 'Bye';
    default:
      return 'Defeat';
  }
};

export const getOutcomeInfo = (prepResult: string, battleResult: string): OutcomeInfo => {
  return OUTCOMES[getOutcome(prepResult, battleResult)];
};

export const getOutcomeStyle = (outcome: OutcomeType) => ({
  color: OUTCOMES[outcome].color,
  textShadow: `0 0 8px ${OUTCOMES[outcome].color}40`
});

// Note: neonGlow is defined in utils/styles.ts - import from there
// Keeping this export for backward compatibility but it should be removed in future refactor
export { neonGlow } from './styles';
