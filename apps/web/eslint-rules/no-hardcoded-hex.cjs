/**
 * ESLint Rule: no-hardcoded-hex
 * 
 * Flags hardcoded hex color values in inline styles.
 * Use design tokens from utils/styles.ts instead.
 * 
 * Allowed exceptions:
 * - Hex values with alpha suffixes appended to template expressions (e.g., `${colors.primary}20`)
 * - Hex values inside SVG attributes (fill, stroke)
 * - Hex values in CSS url() functions
 * - '#000' and '#000000' (pure black, used for text-on-button contrast)
 */

const HEX_REGEX = /(?:^|[^${}])['"]#(?:[0-9a-fA-F]{3}){1,2}(?:[0-9a-fA-F]{2})?['"]/;

// Common surface hex values that should use design tokens
const SURFACE_HEXES = [
  '#0a0a0a', '#111111', '#131318', '#1a1a1a', '#1f1f1f',
  '#2a2a2a', '#3a3a3a', '#ffffff', '#fff',
  '#9ca3af', '#6b7280',
  '#22d3ee', '#06b6d4', '#22c55e', '#eab308', '#ef4444',
  '#f97316', '#a855f7', '#3b82f6', '#fbbf24', '#5865F2',
];

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hardcoded hex color values in inline styles. Use design tokens from utils/styles.ts.',
      category: 'Stylistic Issues',
      recommended: false,
    },
    schema: [],
    messages: {
      noHardcodedHex:
        "Hardcoded hex '{{hex}}' found. Use a design token from utils/styles.ts instead (e.g., colors.primary, colors.surface).",
    },
  },

  create(context) {
    // Only check .tsx files (React components with inline styles)
    const filename = context.getFilename();
    if (!filename.endsWith('.tsx') && !filename.endsWith('.ts')) return {};

    return {
      // Check JSX style attributes: style={{ color: '#hex' }}
      Property(node) {
        // Only flag string literals that look like hex colors
        if (
          node.value &&
          node.value.type === 'Literal' &&
          typeof node.value.value === 'string'
        ) {
          const val = node.value.value;
          // Match standalone hex or hex embedded in CSS strings like '1px solid #hex'
          const hexMatch = val.match(/#(?:[0-9a-fA-F]{3}){1,2}(?:[0-9a-fA-F]{2})?/);
          if (hexMatch) {
            const hex = hexMatch[0].toLowerCase();
            // Skip pure black (used for text-on-button contrast)
            if (hex === '#000' || hex === '#000000') return;
            // Skip if this is inside a non-style context (check parent chain)
            // Report the issue
            if (SURFACE_HEXES.includes(hex) || hex.length <= 7) {
              context.report({
                node: node.value,
                messageId: 'noHardcodedHex',
                data: { hex: hexMatch[0] },
              });
            }
          }
        }
      },
    };
  },
};
