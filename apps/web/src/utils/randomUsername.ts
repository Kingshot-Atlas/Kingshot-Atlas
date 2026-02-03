// Random username generator for new users
// Uses adjective + noun pattern with non-binary, game-friendly words

const ADJECTIVES = [
  'Swift', 'Bold', 'Clever', 'Fierce', 'Noble', 'Silent', 'Brave', 'Keen',
  'Wild', 'Storm', 'Shadow', 'Iron', 'Crystal', 'Golden', 'Silver', 'Crimson',
  'Azure', 'Emerald', 'Frost', 'Thunder', 'Ember', 'Mystic', 'Ancient', 'Void',
  'Regal', 'Cosmic', 'Primal', 'Arcane', 'Radiant', 'Spectral', 'Phantom', 'Valiant',
  'Stellar', 'Lunar', 'Solar', 'Astral', 'Titan', 'Elite', 'Prime', 'Alpha',
  'Omega', 'Delta', 'Apex', 'Zero', 'Rogue', 'Maverick', 'Nexus', 'Cipher'
];

const NOUNS = [
  'Hawk', 'Wolf', 'Bear', 'Fox', 'Raven', 'Dragon', 'Phoenix', 'Tiger',
  'Eagle', 'Viper', 'Falcon', 'Panther', 'Lion', 'Serpent', 'Griffin', 'Sphinx',
  'Knight', 'Ranger', 'Scout', 'Hunter', 'Sage', 'Warden', 'Guardian', 'Sentinel',
  'Blade', 'Shield', 'Arrow', 'Spear', 'Hammer', 'Crown', 'Throne', 'Banner',
  'Storm', 'Flame', 'Frost', 'Stone', 'Wave', 'Wind', 'Star', 'Moon',
  'Seeker', 'Walker', 'Runner', 'Striker', 'Rider', 'Keeper', 'Breaker', 'Caller'
];

/**
 * Generates a random username in the format: AdjectiveNoun123
 * Examples: SwiftHawk42, BoldDragon789, CrimsonPhoenix156
 */
export const generateRandomUsername = (): string => {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const number = Math.floor(Math.random() * 900) + 100; // 100-999
  
  return `${adjective}${noun}${number}`;
};

/**
 * Check if a username looks like it was randomly generated
 * (for display purposes - to show "Click to customize" hint)
 */
export const isRandomUsername = (username: string): boolean => {
  // Check if it matches pattern: Word + Word + 3 digits
  const pattern = /^[A-Z][a-z]+[A-Z][a-z]+\d{3}$/;
  return pattern.test(username);
};
