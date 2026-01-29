#!/bin/bash

# Start health server in background
node health.js &

# Wait a moment for health server to start
sleep 2

# Start the bot (this will be the main process)
node src/bot.js
