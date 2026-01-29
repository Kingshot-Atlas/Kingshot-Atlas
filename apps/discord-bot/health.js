// Health check endpoint for Render
// Required for Web Services on free tier

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
