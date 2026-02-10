// Basic content moderation for user-generated text (bios, pitches, etc.)
// This is a lightweight client-side filter. Production systems should also
// enforce server-side moderation via Supabase Edge Functions or similar.

const BLOCKED_PATTERNS: RegExp[] = [
  // Slurs and hate speech (abbreviated patterns to catch common variations)
  /\bn[i1!][g9][g9]+[e3]?[r]?\b/i,
  /\bf[a@][g9]+[o0]?t?\b/i,
  /\br[e3]t[a@]rd/i,
  /\bk[i1][k]+[e3]\b/i,
  /\bch[i1]nk\b/i,
  /\bsp[i1]c\b/i,
  /\bw[e3]tb[a@]ck/i,
  /\bcr[a@]ck[e3]r\b/i,
  /\btr[a@]nn/i,

  // Extreme profanity
  /\bf+u+c+k+/i,
  /\bs+h+[i1!]+t+/i,
  /\bc+u+n+t+/i,
  /\bd[i1!]c?k\b/i,
  /\ba+s+s+h+o+l+e+/i,
  /\bb[i1!]t?ch/i,
  /\bwh[o0]re/i,
  /\bsl[u]+t/i,

  // Scam / phishing patterns
  /\bfree\s*(gems?|gold|coins?|hack)/i,
  /\b(dm|message)\s*me\s*(for|to)\s*(free|hack|cheat)/i,
  /bit\.ly|tinyurl|goo\.gl/i,

  // Contact info spam (overly aggressive solicitation)
  /\b(add|follow)\s*me\s*(on|@)\s*(instagram|insta|tiktok|snap)/i,
];

// Words that are fine in gaming context but would be flagged by naive filters
const ALLOWLIST = [
  'assassin', 'assault', 'bass', 'class', 'grass', 'pass', 'mass',
  'cockatoo', 'cocktail', 'scunthorpe', 'arsenal', 'classic',
  'therapist', 'dickens', 'hancock', 'hitchcock', 'peacock',
];

export interface ModerationResult {
  isClean: boolean;
  reason?: string;
}

/**
 * Check text against blocked patterns. Returns { isClean: true } if text passes,
 * or { isClean: false, reason } if it contains blocked content.
 */
export function moderateText(text: string): ModerationResult {
  if (!text || text.trim().length === 0) {
    return { isClean: true };
  }

  // Normalize: strip zero-width chars, collapse whitespace
  const normalized = text
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Check if the entire text is in the allowlist context
  const lowerText = normalized.toLowerCase();

  for (const pattern of BLOCKED_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      // Check if matched word is in allowlist
      const matchedWord = match[0].toLowerCase();
      const isAllowed = ALLOWLIST.some(allowed => lowerText.includes(allowed) && allowed.includes(matchedWord));
      if (!isAllowed) {
        return {
          isClean: false,
          reason: 'Contains inappropriate language. Please keep your bio family-friendly.',
        };
      }
    }
  }

  return { isClean: true };
}
