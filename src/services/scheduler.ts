import cron from 'node-cron';
import { db } from '../db/supabase';
import { bot } from '../bot/telegram';

// Reminder scheduler - checks every minute for due reminders
let isSchedulerRunning = false;

export function startReminderScheduler(): void {
  if (isSchedulerRunning) {
    console.log('Reminder scheduler already running');
    return;
  }

  // Run every minute
  cron.schedule('* * * * *', async () => {
    await checkDueReminders();
  });

  isSchedulerRunning = true;
  console.log('Reminder scheduler started (runs every minute)');
}

async function checkDueReminders(): Promise<void> {
  try {
    // Get all reminders that are due
    const dueReminders = await db.getDueReminders();

    const now = new Date();
    console.log(`[Scheduler] ${now.toISOString()} - Checking reminders...`);

    if (dueReminders.length === 0) {
      return;
    }

    console.log(`[Scheduler] Found ${dueReminders.length} due reminder(s)`);

    // Process each reminder - each reminder may belong to a different user
    for (const reminder of dueReminders) {
      try {
        const reminderTime = new Date(reminder.trigger_time).toLocaleString();
        console.log(`[Scheduler] Sending reminder: "${reminder.task}" (category: ${reminder.category})`);

        // Get the chat ID for THIS specific reminder's user
        const chatId = await db.getUserChatId(reminder.user_id);
        if (!chatId) {
          console.log(`[Scheduler] No chat ID for user ${reminder.user_id}. User needs to message the bot first!`);
          // Mark as sent anyway to avoid infinite loop
          if (reminder.id) {
            await db.markReminderSent(reminder.id);
          }
          continue;
        }

        // Send reminder notification to user
        if (reminder.category === 'internship_check') {
          // Special message for internship check reminders
          const companyName = reminder.metadata?.companyName || 'your application';
          await bot.sendMessage(
            chatId,
            `🏢 Internship Check Reminder!\n\n` +
            `Time to check: ${companyName}\n\n` +
            `Have you heard back from them?\n` +
            `If status changed, tell me! (e.g., "Oracle is now interview")`
          );

          // For internship_check, reschedule for 3 days later
          if (reminder.id) {
            const nextCheck = new Date();
            nextCheck.setDate(nextCheck.getDate() + 3);
            await db.updateReminderTime(reminder.id, nextCheck.toISOString());
            console.log(`[Scheduler] ↻ Rescheduled internship check for ${nextCheck.toISOString()}`);
          }
        } else {
          // Regular reminder
          await bot.sendMessage(
            chatId,
            `⏰ REMINDER!\n\n📝 ${reminder.task}\n\nTime: ${reminderTime}`
          );

          // Delete the reminder after sending (unless it's internship_check)
          if (reminder.id) {
            await db.deleteReminder(reminder.id);
            console.log(`[Scheduler] ✓ Sent and deleted: ${reminder.task}`);
          }
        }
      } catch (error) {
        console.error(`[Scheduler] Failed to send reminder "${reminder.task}":`, error);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error checking reminders:', error);
  }
}

// Stop the scheduler (for testing)
export function stopReminderScheduler(): void {
  isSchedulerRunning = false;
  console.log('Reminder scheduler stopped');
}
