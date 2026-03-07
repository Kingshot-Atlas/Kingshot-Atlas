// Alliance Base Designer — Building type definitions
// Source of truth for all building types, sizes, colors, and icons

export type BuildingCategory = 'player' | 'relocatable' | 'obstacle' | 'battle';

export interface BuildingType {
  id: string;
  name: string;
  shortName: string;
  size: number; // NxN grid squares
  color: string;
  icon: string; // emoji for canvas rendering
  category: BuildingCategory;
  description: string;
  maxCount?: number; // optional limit per design
  labelField?: 'playerName' | 'timeSlot'; // what kind of custom label this building supports
  territoryRadius?: number; // radius (in grid squares) of alliance territory this building provides
}

export const BUILDING_TYPES: BuildingType[] = [
  // Player-owned buildings (only owner can move)
  {
    id: 'city',
    name: 'Player City',
    shortName: 'City',
    size: 2,
    color: '#22d3ee',
    icon: '🏙️',
    category: 'player',
    description: 'Player city (2×2). Only the owner can move this.',
    maxCount: 100,
    labelField: 'playerName',
  },
  // R5/R4 relocatable buildings
  {
    id: 'trap',
    name: 'Hunting Trap',
    shortName: 'Trap',
    size: 3,
    color: '#eab308',
    icon: '🐻',
    category: 'relocatable',
    description: 'Hunting Trap (3×3). Used for Bear Hunts. R5/R4 can relocate.',
    labelField: 'timeSlot',
  },
  {
    id: 'special',
    name: 'Special Building',
    shortName: 'Special',
    size: 2,
    color: '#f97316',
    icon: '⭐',
    category: 'relocatable',
    description: 'Special Building (2×2). R5/R4 can relocate.',
  },
  {
    id: 'banner',
    name: 'Alliance Banner',
    shortName: 'Banner',
    size: 1,
    color: '#ef4444',
    icon: '🏳',
    category: 'relocatable',
    description: 'Alliance Banner (1×1). R5/R4 can relocate.',
    territoryRadius: 3,
  },
  {
    id: 'hq',
    name: 'Headquarters',
    shortName: 'HQ',
    size: 3,
    color: '#3b82f6',
    icon: '🏰',
    category: 'relocatable',
    description: 'Alliance Headquarters (3×3). R5/R4 can relocate.',
    maxCount: 1,
    territoryRadius: 6,
  },
  // Obstacles (game-placed, immovable)
  {
    id: 'mill',
    name: 'Alliance Mill',
    shortName: 'Mill',
    size: 2,
    color: '#a855f7',
    icon: '🍞',
    category: 'obstacle',
    description: 'Alliance Mill (2×2). Food resource. Cannot be moved.',
  },
  {
    id: 'woodmill',
    name: 'Alliance Woodmill',
    shortName: 'Wood',
    size: 2,
    color: '#a855f7',
    icon: '🪵',
    category: 'obstacle',
    description: 'Alliance Woodmill (2×2). Wood resource. Cannot be moved.',
  },
  {
    id: 'quarry',
    name: 'Alliance Quarry',
    shortName: 'Quarry',
    size: 2,
    color: '#a855f7',
    icon: '🪨',
    category: 'obstacle',
    description: 'Alliance Quarry (2×2). Stone resource. Cannot be moved.',
  },
  {
    id: 'mine',
    name: 'Alliance Mine',
    shortName: 'Mine',
    size: 2,
    color: '#a855f7',
    icon: '⛏️',
    category: 'obstacle',
    description: 'Alliance Mine (2×2). Iron resource. Cannot be moved.',
  },
  // ─── KvK Battle Layout buildings (not shown in Alliance Base Designer) ───
  {
    id: 'battle-castle',
    name: "King's Castle",
    shortName: 'Castle',
    size: 6,
    color: '#f59e0b',
    icon: '🏰',
    category: 'battle',
    description: "The King's Castle (6×6). Center of the KvK battlefield. Immovable.",
    maxCount: 1,
  },
  {
    id: 'battle-turret-south',
    name: 'South Turret',
    shortName: 'S Turret',
    size: 2,
    color: '#f59e0b',
    icon: '🗼',
    category: 'battle',
    description: 'South Turret (2×2). Provides Lethality bonus. Immovable.',
    maxCount: 1,
  },
  {
    id: 'battle-turret-west',
    name: 'West Turret',
    shortName: 'W Turret',
    size: 2,
    color: '#f59e0b',
    icon: '🗼',
    category: 'battle',
    description: 'West Turret (2×2). Provides Lethality bonus. Immovable.',
    maxCount: 1,
  },
  {
    id: 'battle-turret-east',
    name: 'East Turret',
    shortName: 'E Turret',
    size: 2,
    color: '#f59e0b',
    icon: '🗼',
    category: 'battle',
    description: 'East Turret (2×2). Provides Lethality bonus. Immovable.',
    maxCount: 1,
  },
  {
    id: 'battle-turret-north',
    name: 'North Turret',
    shortName: 'N Turret',
    size: 2,
    color: '#f59e0b',
    icon: '🗼',
    category: 'battle',
    description: 'North Turret (2×2). Provides Lethality bonus. Immovable.',
    maxCount: 1,
  },
];

export const getBuildingType = (id: string): BuildingType | undefined =>
  BUILDING_TYPES.find((b) => b.id === id);

export const BUILDING_CATEGORIES: { key: BuildingCategory; label: string; color: string }[] = [
  { key: 'player', label: 'Player Buildings', color: '#22d3ee' },
  { key: 'relocatable', label: 'Alliance Buildings', color: '#f97316' },
  { key: 'obstacle', label: 'Obstacles (Immovable)', color: '#a855f7' },
];
