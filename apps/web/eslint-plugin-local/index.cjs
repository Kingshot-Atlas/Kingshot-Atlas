/**
 * Local ESLint Plugin
 * Custom rules for Kingshot Atlas design system enforcement.
 */
const noHardcodedHex = require('../eslint-rules/no-hardcoded-hex.cjs');

module.exports = {
  rules: {
    'no-hardcoded-hex': noHardcodedHex,
  },
};
