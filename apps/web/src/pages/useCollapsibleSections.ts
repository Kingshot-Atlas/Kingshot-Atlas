import { useState } from 'react';

const SECTION_NAMES = ['breakdown', 'scoreHistory', 'rankingHistory', 'simulator', 'path', 'trend'] as const;
type SectionName = typeof SECTION_NAMES[number];

export function useCollapsibleSections() {
  const [expanded, setExpanded] = useState<Record<SectionName, boolean>>({
    breakdown: false,
    scoreHistory: false,
    rankingHistory: false,
    simulator: false,
    path: false,
    trend: false,
  });

  const allExpanded = SECTION_NAMES.every(s => expanded[s]);

  const toggle = (name: SectionName) =>
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));

  const toggleAll = () => {
    const newState = !allExpanded;
    const next = {} as Record<SectionName, boolean>;
    for (const s of SECTION_NAMES) next[s] = newState;
    setExpanded(next);
  };

  return { expanded, allExpanded, toggle, toggleAll };
}
