/**
 * Set up Telegram webhook for Vercel deployment
 *
 * Run AFTER deploying to Vercel:
 *   npx tsx scripts/set-webhook.ts
 *
 * Or:
 *   npm run setup:webhook
 */

import * as dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set in .env');
  process.exit(1);
}

if (!WEBHOOK_URL) {
  console.error('❌ WEBHOOK_URL is not set in .env');
  console.error('   Format: https://your-app.vercel.app');
  process.exit(1);
}

async function setupWebhook() {
  const bot = new TelegramBot(TOKEN, { polling: false });

  console.log(`\n🔧 Setting up Telegram webhook...`);
  console.log(`   Token: ${TOKEN.slice(0, 10)}...`);
  console.log(`   URL: ${WEBHOOK_URL}/api/telegram\n`);

  try {
    // Set the webhook
    const result = await bot.setWebHook(`${WEBHOOK_URL}/api/telegram`);
    console.log(`✅ Webhook set successfully!`);
    console.log(`   Telegram will send updates to:`);
    console.log(`   ${WEBHOOK_URL}/api/telegram\n`);

    // Verify the webhook
    const info = await bot.getWebHookInfo();
    console.log(`📋 Current webhook info:`);
    console.log(`   URL: ${info.url || '(none)'}`);
    console.log(`   Has custom cert: ${info.has_custom_certificate}`);
    console.log(`   Pending updates: ${info.pending_update_count}`);

    console.log(`\n✨ Done! Your bot is ready on Vercel.`);
    console.log(`   Send a message to your bot on Telegram to test!\n`);
  } catch (error) {
    console.error(`❌ Failed to set webhook:`, error);
    process.exit(1);
  }
}

setupWebhook();
