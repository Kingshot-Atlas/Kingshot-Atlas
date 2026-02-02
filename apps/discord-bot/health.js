// Health check endpoint for Render
// Required for Web Services on free tier
// IMPORTANT: Set up UptimeRobot to ping /health every 5-10 minutes
// to prevent Render free tier spin-down (15 min inactivity timeout)
// 
// Service: Atlas-Discord-bot
// Service ID: srv-d5too04r85hc73ej2b00
// URL: https://atlas-discord-bot-trnf.onrender.com
// Health endpoint: https://atlas-discord-bot-trnf.onrender.com/health
//
// Last deploy trigger: 2026-02-02

const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: 'discord-bot' }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Health server running on port ${PORT}`);
});

// Keep the process alive
setInterval(() => {
  // Prevent process from exiting
}, 30000);
