/**
 * DEPRECATED - Health server is now integrated into src/bot.js
 * 
 * This file is kept for reference only.
 * The unified architecture ensures /health accurately reflects Discord connection status.
 * 
 * Service: Atlas-Discord-bot
 * Service ID: srv-d5too04r85hc73ej2b00
 * URL: https://atlas-discord-bot-trnf.onrender.com
 * Health endpoint: https://atlas-discord-bot-trnf.onrender.com/health
 * 
 * Migration date: 2026-02-02
 * Reason: Split process architecture caused health endpoint to return 200 OK
 *         even when the bot process had crashed, masking failures.
 */

console.warn('⚠️ DEPRECATED: health.js is no longer used. Health server is integrated into bot.js');
process.exit(0);
