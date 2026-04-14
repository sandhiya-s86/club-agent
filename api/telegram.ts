import type { VercelRequest, VercelResponse } from '@vercel/node';
import TelegramBot from 'node-telegram-bot-api';
import { processMessage } from '../src/agent/agent';
import { db } from '../src/db/supabase';
import * as dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

// Track processed messages to avoid duplicates
const processedMessages = new Set<string>();

// Quick action reply keyboard
const quickActionsKeyboard = {
  keyboard: [
    [{ text: '📋 Mark Present' }, { text: '📋 Mark Absent' }],
    [{ text: '📅 My Events' }, { text: '📊 My Report' }],
    [{ text: '🔔 My Reminders' }],
  ],
  resize_keyboard: true,
  one_time_keyboard: false,
};

// Create bot instance for sending messages
function getBot(): TelegramBot {
  return new TelegramBot(TOKEN, { polling: false });
}

// Handle incoming Telegram webhook updates
async function handleUpdate(update: any): Promise<void> {
  // Handle callback queries (inline button clicks)
  if (update.callback_query) {
    const query = update.callback_query;
    const chatId = query.message?.chat.id;
    const userId = query.from.id;
    const data = query.data;

    if (!chatId || !data) return;

    console.log(`[Webhook] Callback query: ${data}`);

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
          response = 'To set a new reminder, just tell me what you need to be reminded about and when!';
          break;
        default:
          response = 'Unknown action. Please try again.';
      }

      const bot = getBot();
      await bot.editMessageText(response, {
        chat_id: chatId,
        message_id: query.message?.message_id,
        parse_mode: 'Markdown',
      });
      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      console.error(`[Webhook] Callback error:`, error);
    }
    return;
  }

  // Handle regular messages
  const msg = update.message;
  if (!msg || !msg.text) return;

  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const text = msg.text;
  const messageId = msg.message_id.toString();

  // Ignore commands
  if (text.startsWith('/')) {
    await handleCommand(text, chatId, userId);
    return;
  }

  // Skip duplicates
  const msgKey = `${chatId}:${messageId}`;
  if (processedMessages.has(msgKey)) return;
  processedMessages.add(msgKey);

  if (processedMessages.size > 1000) {
    processedMessages.clear();
  }

  console.log(`[${chatId}] User: ${text}`);

  try {
    const bot = getBot();
    await bot.sendChatAction(chatId, 'typing');

    // Save user's chat ID
    if (userId) {
      db.setUserChatId(chatId, userId).catch((err) => console.error('Failed to save chat ID:', err));
    }

    // Quick action translation
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
      showQuickActions = false;
    }

    const response = await processMessage(processedText, userId);

    const options: any = {
      parse_mode: 'Markdown',
      reply_markup: showQuickActions ? quickActionsKeyboard : undefined,
    };

    await bot.sendMessage(chatId, response, options);
    console.log(`[${chatId}] Bot: ${response}`);
  } catch (error) {
    console.error(`[${chatId}] Error:`, error);
  }
}

// Handle bot commands via webhook
async function handleCommand(command: string, chatId: number, userId?: number): Promise<void> {
  const bot = getBot();

  switch (command) {
    case '/start':
      await bot.sendMessage(
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
      await bot.sendMessage(
        chatId,
        '📖 Available Commands:\n\n' +
        '/start - Welcome message\n' +
        '/help - Show this help\n' +
        '/events - View your scheduled events\n' +
        '/attendance - View attendance records\n' +
        '/report - Generate attendance report\n' +
        '/reminders - View your pending reminders\n\n' +
        'Or just type naturally!'
      );
      break;

    case '/events': {
      const { getEvents } = await import('../src/tools/scheduler');
      const result = await getEvents(userId);
      await bot.sendMessage(chatId, result.message);
      break;
    }

    case '/attendance': {
      const { getAttendance } = await import('../src/tools/attendance');
      const result = await getAttendance(userId);
      await bot.sendMessage(chatId, result.message);
      break;
    }

    case '/report': {
      const { generateReport } = await import('../src/tools/report');
      const result = await generateReport(userId);
      await bot.sendMessage(chatId, result.message);
      break;
    }

    case '/reminders': {
      const { listReminders } = await import('../src/tools/scheduler');
      const result = await listReminders(userId);
      await bot.sendMessage(chatId, result.message);
      break;
    }

    default:
      await bot.sendMessage(chatId, 'Unknown command. Type /help for available commands.');
  }
}

// POST handler for Telegram webhook
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true });
    return;
  }

  const update = req.body;

  // Verify it's a real Telegram update
  if (!update || !update.update_id) {
    res.status(200).json({ ok: false, reason: 'Invalid update' });
    return;
  }

  console.log(`[Webhook] Received update ${update.update_id}`);

  // Process asynchronously (don't wait, respond immediately)
  handleUpdate(update).catch((err) => console.error('Handle update error:', err));

  // Respond quickly to Telegram
  res.status(200).json({ ok: true });
}

// GET handler for webhook verification (Telegram calls this when you set webhook)
export async function verifyWebhook(req: VercelRequest, res: VercelResponse) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Verify the webhook
  if (mode === 'subscribe' && token === TOKEN) {
    console.log('Webhook verified!');
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
}
