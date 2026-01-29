/**
 * Webhook Test Script
 * Test posting patch notes to Discord via webhook
 * 
 * Usage: npm run webhook:test
 */

require('dotenv').config();
const webhook = require('./services/webhook');

// Sample patch notes for testing
const samplePatchNotes = {
  date: new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }),
  new: [
    'Added Discord bot integration with Atlas',
    'Kingdom comparison now shows winner indicators',
    'New /tier command to browse kingdoms by tier',
  ],
  fixed: [
    'Fixed timezone display for KvK countdown',
    'Corrected win rate calculations for new kingdoms',
  ],
  improved: [
    'Faster kingdom data loading',
    'Better mobile layout for comparison view',
  ],
};

async function testWebhook() {
  console.log('🧪 Testing webhook...\n');
  console.log('📋 Sample patch notes:');
  console.log(JSON.stringify(samplePatchNotes, null, 2));
  console.log('\n');

  const result = await webhook.postPatchNotes(samplePatchNotes);

  if (result.success) {
    console.log('✅ Webhook test successful!');
    console.log('Check your Discord channel for the message.');
  } else {
    console.error('❌ Webhook test failed:', result.error);
  }
}

testWebhook();
