import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';
import { processMessage } from '../agent/agent';
import { db } from '../db/supabase';

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';

// Create bot instance - polling or webhook mode
export const bot = new TelegramBot(TOKEN, { polling: !USE_WEBHOOK });

// Track last processed message to avoid duplicates
const processedMessages = new Set<string>();

// Quick action reply keyboard - shown at the bottom for fast access
const quickActionsKeyboard = {
  keyboard: [
    [{ text: '📋 Mark Present' }, { text: '📋 Mark Absent' }],
    [{ text: '📅 My Events' }, { text: '📊 My Report' }],
    [{ text: '🔔 My Reminders' }],
  ],
  resize_keyboard: true,
  one_time_keyboard: false,
};

// Inline keyboard for attendance actions
const attendanceInlineKeyboard = {
  inline_keyboard: [
    [{ text: '✓ Mark Present', callback_data: 'att_present' },
     { text: '✗ Mark Absent', callback_data: 'att_absent' }],
    [{ text: '📊 View Report', callback_data: 'view_report' }],
    [{ text: '📋 View All Records', callback_data: 'view_attendance' }],
  ],
};

// Inline keyboard for reminder management
const reminderInlineKeyboard = {
  inline_keyboard: [
    [{ text: '🔔 New Reminder', callback_data: 'new_reminder' },
     { text: '📋 View All', callback_data: 'view_reminders' }],
  ],
};

// Handle incoming messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const text = msg.text || '';
  const messageId = msg.message_id.toString();

  // Ignore non-text messages
  if (!text) {
    return;
  }

  // Ignore commands (start with /)
  if (text.startsWith('/')) {
    handleCommand(text, chatId, userId);
    return;
  }

  // Skip if already processed this exact message
  const msgKey = `${chatId}:${messageId}`;
  if (processedMessages.has(msgKey)) {
    return;
  }
  processedMessages.add(msgKey);

  // Clean old entries to prevent memory buildup
  if (processedMessages.size > 1000) {
    const entries = Array.from(processedMessages);
    processedMessages.clear();
    entries.slice(-500).forEach((e) => processedMessages.add(e));
  }

  console.log(`[${chatId}] User: ${text}`);

  try {
    // Send "typing" indicator
    await bot.sendChatAction(chatId, 'typing');

    // Save user's chat ID and user ID for reminder notifications
    if (userId) {
      db.setUserChatId(chatId, userId).catch((err) => console.error('Failed to save chat ID:', err));
    }

    // Check if it's a quick action button
    let processedText = text;
    let showQuickActions = true;

    if (text === '📋 Mark Present') {
      processedText = 'Mark me present';
    } else if (text === '📋 Mark Absent') {
      processedText = 'Mark me absent';
    } else if (text === '📅 My Events') {
      processedText = 'What events do I have?';
    } else if (text === '📊 My Report') {
      processedText = 'Generate attendance report';
    } else if (text === '🔔 My Reminders') {
      processedText = 'Show my reminders';
    } else {
      // Only show keyboard for non-quick-action messages
      showQuickActions = false;
    }

    // Process message through the AI agent
    const response = await processMessage(processedText, userId);

    // Send response back to user with keyboard
    const options: any = {
      parse_mode: 'Markdown',
      reply_markup: showQuickActions ? quickActionsKeyboard : undefined,
    };

    await bot.sendMessage(chatId, response, options);

    console.log(`[${chatId}] Bot: ${response}`);
  } catch (error) {
    console.error(`[${chatId}] Error:`, error);
    await bot.sendMessage(chatId, 'Sorry, something went wrong. Please try again.');
  }
});

// Handle callback queries from inline buttons
bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat.id;
  const userId = query.from.id;
  const data = query.data;

  if (!chatId || !data) {
    await bot.answerCallbackQuery(query.id);
    return;
  }

  console.log(`[${chatId}] Callback query: ${data}`);

  try {
    let response: string;

    switch (data) {
      case 'att_present':
        response = await processMessage('Mark me present', userId);
        break;
      case 'att_absent':
        response = await processMessage('Mark me absent', userId);
        break;
      case 'view_report':
        response = await processMessage('Generate attendance report', userId);
        break;
      case 'view_attendance':
        response = await processMessage('Show attendance records', userId);
        break;
      case 'view_reminders':
        response = await processMessage('Show my reminders', userId);
        break;
      case 'new_reminder':
        response = 'To set a new reminder, just tell me what you need to be reminded about and when! For example: "Remind me to call mom tomorrow at 3pm"';
        break;
      default:
        response = 'Unknown action. Please try again.';
    }

    // Edit the original message with the response
    await bot.editMessageText(response, {
      chat_id: chatId,
      message_id: query.message?.message_id,
      parse_mode: 'Markdown',
    });

    // Answer the callback query
    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    console.error(`[${chatId}] Callback error:`, error);
    await bot.answerCallbackQuery(query.id, { text: 'Error processing request' });
  }
});

// Handle bot commands
function handleCommand(command: string, chatId: number, userId?: number) {
  switch (command) {
    case '/start':
      bot.sendMessage(
        chatId,
        '👋 Welcome to Club Assistant!\n\n' +
        'I can help you with:\n' +
        '• Marking attendance (e.g., "John is absent")\n' +
        '• Scheduling events (e.g., "I have class on Tuesday at 9 AM")\n' +
        '• Setting reminders (e.g., "Remind me to submit project at 6 PM")\n' +
        '• Getting information (e.g., "What are my classes?")\n' +
        '• Generating reports (e.g., "Send me the attendance report")\n' +
        '• Cancel reminders (e.g., "cancel my reminder")\n\n' +
        'Just send me a message and I\'ll help you out!'
      );
      break;

    case '/help':
      bot.sendMessage(
        chatId,
        '📖 Available Commands:\n\n' +
        '/start - Welcome message\n' +
        '/help - Show this help\n' +
        '/events - View your scheduled events\n' +
        '/attendance - View attendance records\n' +
        '/report - Generate attendance report\n' +
        '/reminders - View your pending reminders\n\n' +
        'Or just type naturally, for example:\n' +
        '"Mark John as present"\n' +
        '"Schedule my class on Monday and Wednesday at 10 AM"\n' +
        '"Remind me to call mom at 5 PM"\n' +
        '"Cancel my meeting reminder"'
      );
      break;

    case '/events':
      bot.sendMessage(chatId, 'Fetching your events...');
      getEventsHandler(chatId, userId);
      break;

    case '/attendance':
      bot.sendMessage(chatId, 'Fetching attendance records...');
      getAttendanceHandler(chatId, userId);
      break;

    case '/report':
      bot.sendMessage(chatId, 'Generating your report...');
      getReportHandler(chatId, userId);
      break;

    case '/reminders':
      bot.sendMessage(chatId, 'Fetching your reminders...');
      getRemindersHandler(chatId, userId);
      break;

    default:
      bot.sendMessage(chatId, 'Unknown command. Type /help for available commands.');
  }
}

// Quick handlers for slash commands (without AI)
async function getEventsHandler(chatId: number, userId?: number) {
  try {
    const { getEvents } = await import('../tools/scheduler');
    const result = await getEvents(userId);
    await bot.sendMessage(chatId, result.message);
  } catch (error) {
    await bot.sendMessage(chatId, 'Failed to fetch events.');
  }
}

async function getAttendanceHandler(chatId: number, userId?: number) {
  try {
    const { getAttendance } = await import('../tools/attendance');
    const result = await getAttendance(userId);
    await bot.sendMessage(chatId, result.message);
  } catch (error) {
    await bot.sendMessage(chatId, 'Failed to fetch attendance.');
  }
}

async function getReportHandler(chatId: number, userId?: number) {
  try {
    const { generateReport } = await import('../tools/report');
    const result = await generateReport(userId);
    await bot.sendMessage(chatId, result.message);
  } catch (error) {
    await bot.sendMessage(chatId, 'Failed to generate report.');
  }
}

async function getRemindersHandler(chatId: number, userId?: number) {
  try {
    const { listReminders } = await import('../tools/scheduler');
    const result = await listReminders(userId);
    await bot.sendMessage(chatId, result.message);
  } catch (error) {
    await bot.sendMessage(chatId, 'Failed to fetch reminders.');
  }
}

// Error handling
bot.on('error', (error) => {
  console.error('Telegram bot error:', error);
});

// Start the bot
export function startBot() {
  if (!TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is not set in .env');
    process.exit(1);
  }

  console.log('✅ Telegram bot is running!');
  console.log('   Send a message to your bot on Telegram to start');
}

// Helper to get bot info
export async function getBotInfo() {
  try {
    const botInfo = await bot.getMe();
    return botInfo;
  } catch (error) {
    console.error('Failed to get bot info:', error);
    return null;
  }
}

// Set webhook URL for Telegram (used in Vercel/production mode)
export async function setWebhook(url: string): Promise<void> {
  try {
    await bot.setWebHook(url);
    console.log(`Webhook set to: ${url}`);
  } catch (error) {
    console.error('Failed to set webhook:', error);
    throw error;
  }
}

// Verify webhook (for Telegram's verification challenge)
export function verifyWebhook(token: string): boolean {
  return token === TOKEN;
}
