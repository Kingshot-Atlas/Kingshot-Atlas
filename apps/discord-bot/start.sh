#!/bin/bash

# Atlas Discord Bot Startup
# Health server is now integrated into bot.js for accurate health reporting
# This ensures the /health endpoint reflects actual Discord connection status

exec node src/bot.js
