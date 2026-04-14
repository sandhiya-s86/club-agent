import * as dotenv from 'dotenv';
import { startBot, getBotInfo, setWebhook } from './bot/telegram';
import { initDatabase } from './db/supabase';
import { validateLlmConfig } from './services/llm';
import { startReminderScheduler } from './services/scheduler';

dotenv.config();

const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('        Club Assistant Bot Starting...      ');
  console.log('═══════════════════════════════════════════\n');

  // 1. Validate LLM Config (MiniMax)
  console.log('[1/4] Validating LLM configuration...');
  const llmValid = validateLlmConfig();
  if (!llmValid) {
    console.error('❌ LLM configuration failed. Please check your .env file.');
    process.exit(1);
  }
  console.log('✓ LLM configuration valid\n');

  // 2. Initialize Database
  console.log('[2/4] Connecting to Supabase...');
  await initDatabase();
  console.log('✓ Database connected\n');

  if (USE_WEBHOOK) {
    // Webhook mode (Vercel/production)
    console.log('[3/4] Setting up Telegram webhook...');
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) {
      console.error('❌ USE_WEBHOOK=true but WEBHOOK_URL is not set!');
      process.exit(1);
    }
    await setWebhook(webhookUrl);
    console.log(`✓ Webhook set to: ${webhookUrl}\n`);

    // No reminder scheduler in webhook mode - Vercel Cron handles it
    console.log('[4/4] Reminder scheduler handled by Vercel Cron (/api/cron)\n');
  } else {
    // Polling mode (local development)
    console.log('[3/4] Connecting to Telegram (polling mode)...');
    const botInfo = await getBotInfo();
    if (botInfo) {
      console.log(`✓ Bot connected: @${botInfo.username}\n`);
    } else {
      console.error('❌ Failed to connect to Telegram. Check your BOT_TOKEN.');
      process.exit(1);
    }

    // 4. Start Reminder Scheduler (local only)
    console.log('[4/4] Starting reminder scheduler...');
    startReminderScheduler();
    console.log('✓ Reminder scheduler started\n');
  }

  // 5. Start Telegram Bot
  startBot();

  console.log('═══════════════════════════════════════════');
  console.log('✅ Club Assistant is now running!');
  console.log('═══════════════════════════════════════════');
  console.log(USE_WEBHOOK
    ? '\nWebhook mode: Send a message to your bot on Telegram!\n'
    : '\nPolling mode: Send a message to your bot on Telegram to start.\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nShutting down gracefully...');
  process.exit(0);
});

// Run the bot
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
