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
    abbrev: '🏳️',
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

export const getOutcome = (prepResult: string, battleResult: string): OutcomeType => {
  const prep = prepResult.toLowerCase();
  const battle = battleResult.toLowerCase();
  const prepWin = prep === 'win' || prep === 'w';
  const battleWin = battle === 'win' || battle === 'w';
  
  if (prep === 'bye' || battle === 'bye') return 'Bye';
  if (prepWin && battleWin) return 'Domination';
  if (prepWin && !battleWin) return 'Reversal';
  if (!prepWin && battleWin) return 'Comeback';
  return 'Defeat';
};

export const getOutcomeFromOverall = (overallResult: string): OutcomeType => {
  switch (overallResult) {
    case 'Win':
    case 'W':
      return 'Domination';
    case 'Loss':
    case 'L':
      return 'Defeat';
    case 'Bye':
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

export const neonGlow = (color: string) => ({
  color: color,
  textShadow: `0 0 8px ${color}40, 0 0 12px ${color}20`
});
