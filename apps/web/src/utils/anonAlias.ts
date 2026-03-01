/**
 * Deterministic anonymous alias generator for transfer profiles.
 *
 * Converts a transfer profile UUID into a memorable, consistent alias
 * like "Anon-falcon38" or "Anon-storm17". The same profile ID always
 * produces the same alias, so recruiters can track conversations with
 * anonymous applicants without revealing real identities.
 *
 * Format: Anon-{word}{2-digit number}  (e.g. Anon-falcon38)
 */

const ALIAS_WORDS = [
  'falcon', 'storm', 'ember', 'frost', 'blaze', 'comet', 'drift', 'flint',
  'grove', 'haven', 'ivory', 'jade', 'knoll', 'lunar', 'maple', 'noble',
  'onyx', 'pearl', 'quill', 'raven', 'slate', 'thorn', 'umbra', 'vapor',
  'wolf', 'apex', 'birch', 'crest', 'dusk', 'echo', 'forge', 'glyph',
  'haze', 'iron', 'jewel', 'karma', 'latch', 'mist', 'nexus', 'orbit',
  'pulse', 'ridge', 'spark', 'titan', 'ultra', 'venom', 'wren', 'xenon',
  'yew', 'zinc', 'amber', 'briar', 'cedar', 'delta', 'ether', 'flame',
  'ghost', 'helix', 'index', 'joker', 'kite', 'lotus', 'mirage', 'nova',
  'opal', 'prism', 'quest', 'reef', 'siege', 'torch', 'unity', 'vortex',
  'wisp', 'xerus', 'yield', 'zephyr', 'abyss', 'blade', 'coral', 'dune',
  'eagle', 'fable', 'grain', 'hound', 'icicle', 'jolt', 'krypton', 'lance',
  'marsh', 'nimbus', 'oxide', 'pixel', 'quartz', 'rumble', 'shard', 'tropic',
  'velvet', 'wander', 'zenith', 'armor', 'baron', 'cipher', 'djinn', 'elixir',
  'fury', 'glider', 'herald', 'imp', 'jaguar', 'keeper', 'lynx', 'mystic',
  'nomad', 'omega', 'panther', 'raptor', 'scout', 'tempest', 'valor', 'wraith',
  'viking', 'sable', 'pebble', 'crater', 'cobalt', 'bronze', 'arrow', 'anchor',
];

/**
 * Simple hash of a UUID string to produce two independent numeric seeds.
 * Uses a basic FNV-1a–style hash on separate halves of the UUID.
 */
function hashUUID(uuid: string): [number, number] {
  const clean = uuid.replace(/-/g, '');
  const half = Math.floor(clean.length / 2);
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < half; i++) {
    h1 ^= clean.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  for (let i = half; i < clean.length; i++) {
    h2 ^= clean.charCodeAt(i);
    h2 = Math.imul(h2, 0x01000193);
  }
  return [Math.abs(h1), Math.abs(h2)];
}

/**
 * Returns a deterministic anonymous alias for the given profile ID.
 * @param profileId  UUID of the transfer_profiles row
 * @returns e.g. "Anon-falcon38"
 */
export function getAnonAlias(profileId: string): string {
  const [h1, h2] = hashUUID(profileId);
  const word = ALIAS_WORDS[h1 % ALIAS_WORDS.length];
  const num = (h2 % 90) + 10; // two-digit: 10–99
  return `Anon-${word}${num}`;
}
