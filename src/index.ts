import * as dotenv from 'dotenv';
import { startBot, getBotInfo } from './bot/telegram';
import { initDatabase } from './db/supabase';
import { validateLlmConfig } from './services/llm';
import { startReminderScheduler } from './services/scheduler';

dotenv.config();

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

  // 3. Get Bot Info
  console.log('[3/4] Connecting to Telegram...');
  const botInfo = await getBotInfo();
  if (botInfo) {
    console.log(`✓ Bot connected: @${botInfo.username}\n`);
  } else {
    console.error('❌ Failed to connect to Telegram. Check your BOT_TOKEN.');
    process.exit(1);
  }

  // 4. Start Reminder Scheduler
  console.log('[4/4] Starting reminder scheduler...');
  startReminderScheduler();
  console.log('✓ Reminder scheduler started\n');

  // 5. Start Telegram Bot
  console.log('═══════════════════════════════════════════');
  console.log('✅ Club Assistant is now running!');
  console.log('═══════════════════════════════════════════');
  console.log('\nSend a message to your bot on Telegram to start.\n');
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
