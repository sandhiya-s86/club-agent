import type { VercelRequest, VercelResponse } from '@vercel/node';
import TelegramBot from 'node-telegram-bot-api';
import { db } from '../src/db/supabase';
import * as dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

// GET /api/cron - Called by Vercel Cron every minute
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron sends this header
  if (req.headers['x-vercel-cron']) {
    console.log('[Cron] Vercel Cron trigger detected');
  }

  // Optional: verify a secret token to prevent unauthorized calls
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  await checkDueReminders();

  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
}

async function checkDueReminders(): Promise<void> {
  try {
    const dueReminders = await db.getDueReminders();

    if (dueReminders.length === 0) {
      console.log('[Cron] No due reminders');
      return;
    }

    console.log(`[Cron] Found ${dueReminders.length} due reminder(s)`);

    for (const reminder of dueReminders) {
      try {
        const reminderTime = new Date(reminder.trigger_time).toLocaleString();
        console.log(`[Cron] Processing: "${reminder.task}" (category: ${reminder.category})`);

        // Get chat ID for this specific user
        const chatId = await db.getUserChatId(reminder.user_id);
        if (!chatId) {
          console.log(`[Cron] No chat ID for user ${reminder.user_id}`);
          if (reminder.id) {
            await db.markReminderSent(reminder.id);
          }
          continue;
        }

        const bot = new TelegramBot(TOKEN, { polling: false });

        if (reminder.category === 'internship_check') {
          const companyName = reminder.metadata?.companyName || 'your application';
          await bot.sendMessage(
            chatId,
            `🏢 Internship Check Reminder!\n\n` +
            `Time to check: ${companyName}\n\n` +
            `Have you heard back from them?\n` +
            `If status changed, tell me! (e.g., "Oracle is now interview")`
          );

          if (reminder.id) {
            const nextCheck = new Date();
            nextCheck.setDate(nextCheck.getDate() + 3);
            await db.updateReminderTime(reminder.id, nextCheck.toISOString());
            console.log(`[Cron] ↻ Rescheduled internship check for ${nextCheck.toISOString()}`);
          }
        } else {
          await bot.sendMessage(
            chatId,
            `⏰ REMINDER!\n\n📝 ${reminder.task}\n\nTime: ${reminderTime}`
          );

          if (reminder.id) {
            await db.deleteReminder(reminder.id);
            console.log(`[Cron] ✓ Sent and deleted: ${reminder.task}`);
          }
        }
      } catch (error) {
        console.error(`[Cron] Failed to send reminder "${reminder.task}":`, error);
      }
    }
  } catch (error) {
    console.error('[Cron] Error checking reminders:', error);
  }
}
