import { z } from 'zod';
import { db } from '../db/supabase';

// Tool input schemas
export const scheduleEventInput = z.object({
  title: z.string().describe('Title of the event (e.g., "Class", "Meeting")'),
  days: z.array(z.string()).describe('Days of the week (e.g., ["tuesday", "thursday"])'),
  time: z.string().describe('Time in 24h format (e.g., "09:00")'),
});

export const setReminderInput = z.object({
  task: z.string().describe('What to be reminded about'),
  triggerTime: z.string().describe('When to trigger (ISO timestamp or relative like "in 30 minutes")'),
});

// Schedule event tool
export async function scheduleEvent(
  args: { title: string; days: string[]; time: string },
  userId?: number
) {
  try {
    const result = await db.addEvent(args.title, args.days, args.time, userId);

    const daysFormatted = args.days
      .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
      .join(', ');

    return {
      success: true,
      message: `✓ Scheduled "${args.title}" for ${daysFormatted} at ${args.time}`,
      record: result,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to schedule event: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Set reminder tool
export async function setReminder(
  args: { task: string; triggerTime: string },
  userId?: number
) {
  try {
    const triggerTimestamp = parseTimeString(args.triggerTime);

    if (!triggerTimestamp) {
      return {
        success: false,
        message: `I couldn't understand the time "${args.triggerTime}". Please try formats like "tomorrow at 4pm", "11:30am", "in 2 hours", "next Monday at 3pm".`,
      };
    }

    // If time has passed, suggest tomorrow
    const now = new Date();
    if (triggerTimestamp <= now) {
      triggerTimestamp.setDate(triggerTimestamp.getDate() + 1);
    }

    // Log for debugging
    console.log(`[setReminder] Parsed time: ${triggerTimestamp.toISOString()}`);
    console.log(`[setReminder] User input: ${args.triggerTime}`);

    const result = await db.addReminder(args.task, triggerTimestamp.toISOString(), userId);

    const timeFormatted = triggerTimestamp.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    // Also show 24h format for clarity
    const time24h = triggerTimestamp.toLocaleString('en-US', {
      hour12: false,
      hour: 'numeric',
      minute: '2-digit',
    });

    // Generate Google Calendar link
    const calendarLink = generateGoogleCalendarLink(args.task, triggerTimestamp);

    return {
      success: true,
      message: `✓ Reminder set!\n\n📝 Task: "${args.task}"\n⏰ Time: ${timeFormatted}\n🕐 24h: ${time24h}\n\nThe bot will notify you at this time. Make sure the bot is running!`,
      record: result,
      calendarLink,
      triggerTime: triggerTimestamp.toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to set reminder: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Cancel reminder tool
export async function cancelReminder(args: { task?: string }, userId?: number) {
  try {
    const reminders = await db.getReminders(userId);

    if (reminders.length === 0) {
      return {
        success: true,
        message: 'You have no reminders set.',
      };
    }

    // If task provided, find and delete that specific reminder
    if (args.task) {
      const matching = reminders.find((r) =>
        r.task.toLowerCase().includes(args.task!.toLowerCase())
      );

      if (matching && matching.id) {
        await db.deleteReminder(matching.id);
        return {
          success: true,
          message: `✓ Deleted reminder: "${matching.task}"`,
        };
      } else {
        return {
          success: false,
          message: `No reminder found matching "${args.task}". Use /reminders to see all your reminders.`,
        };
      }
    }

    // If no task provided, return list of reminders
    let message = '📋 Your current reminders:\n\n';
    for (const reminder of reminders) {
      const time = new Date(reminder.trigger_time).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      message += `• "${reminder.task}" — ${time}\n`;
    }
    message += '\n💡 To delete a reminder, say "cancel reminder [task name]"';

    return {
      success: true,
      message,
      reminders,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to manage reminders: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// List pending reminders
export async function listReminders(userId?: number) {
  try {
    const reminders = await db.getReminders(userId);

    if (reminders.length === 0) {
      return {
        success: true,
        message: '📋 You have no reminders set.\n\n💡 Say "remind me to..." to create one!',
        reminders: [],
      };
    }

    let message = '📋 Your current reminders:\n\n';
    for (const reminder of reminders) {
      const time = new Date(reminder.trigger_time).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      message += `• "${reminder.task}" — ${time}\n`;
    }

    return {
      success: true,
      message,
      reminders,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to list reminders: ${error instanceof Error ? error.message : 'Unknown error'}`,
      reminders: [],
    };
  }
}

// Generate Google Calendar URL for an event
function generateGoogleCalendarLink(title: string, date: Date): string {
  const formatDate = (d: Date): string => {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const startDate = formatDate(date);
  // Default 1 hour duration
  const endDate = formatDate(new Date(date.getTime() + 60 * 60 * 1000));

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startDate}/${endDate}`,
    details: `Reminder set via Club Assistant Bot`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Parse various time formats into a Date object
function parseTimeString(timeStr: string): Date | null {
  const now = new Date();
  const lower = timeStr.toLowerCase().trim();

  // Handle ISO date formats like "2026-04-13" or "April 13, 2026"
  const isoDateMatch = timeStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateMatch) {
    const result = new Date(timeStr);
    if (!isNaN(result.getTime())) {
      // Check if there's also a time
      const timeInStr = timeStr.match(/(\d{1,2}):(\d{2})(?:\s*(am|pm))?/i);
      if (timeInStr) {
        let hours = parseInt(timeInStr[1]);
        const minutes = parseInt(timeInStr[2]);
        const ampm = timeInStr[3] || '';
        if (ampm.toLowerCase() === 'pm' && hours !== 12) hours += 12;
        if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
        result.setHours(hours, minutes, 0, 0);
      }
      return result;
    }
  }

  // Handle "in X minutes/hours"
  if (lower.includes('minute') || lower.includes('hour')) {
    const match = lower.match(/(\d+)\s*(minute|hour|minutes|hours|min|mins|h|hr|hrs)/i);
    if (match) {
      const amount = parseInt(match[1]);
      const result = new Date(now);
      if (lower.includes('minute') || lower.includes('min')) {
        result.setMinutes(result.getMinutes() + amount);
      } else {
        result.setHours(result.getHours() + amount);
      }
      return result;
    }
  }

  // Handle "today at X" or just "X" with AM/PM
  // Match patterns like: "11:12", "11:12pm", "4pm", "4:30am", "3 o'clock", "00:40", "12 : 47 am"
  const timeRegex = /(\d{1,2})\s*:?\s*(\d{2})?\s*(am|pm)?/i;
  const timeMatch = lower.match(timeRegex);
  if (timeMatch && timeMatch[1]) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const ampm = timeMatch[3] || '';
    const isPM = ampm.toLowerCase() === 'pm';
    const isAM = ampm.toLowerCase() === 'am';

    // Handle 12am (midnight) and 12pm (noon)
    if (isPM && hours !== 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    if (isPM && hours === 12) hours = 12; // 12pm stays 12

    const result = new Date(now);
    result.setHours(hours, minutes, 0, 0);

    // If time has passed today, use tomorrow (unless "today" explicitly stated)
    if (result <= now && !lower.includes('today')) {
      result.setDate(result.getDate() + 1);
    }

    // Check for "today" explicitly
    if (lower.includes('today')) {
      result.setDate(now.getDate());
    }
    // Check for "tomorrow"
    else if (lower.includes('tomorrow')) {
      result.setDate(now.getDate() + 1);
    }

    // Handle "at midnight" or "at noon"
    if (lower.includes('midnight')) {
      result.setHours(0, 0, 0, 0);
      if (result <= now) result.setDate(result.getDate() + 1);
    }
    if (lower.includes('noon')) {
      result.setHours(12, 0, 0, 0);
    }

    return result;
  }

  // Handle day names like "monday at 4pm", "next monday", "this monday"
  const dayMatch = lower.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  if (dayMatch) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = days.indexOf(dayMatch[1]);
    const today = now.getDay();
    let daysUntil = targetDay - today;

    // Handle "next" prefix - means next week
    if (lower.includes('next ')) {
      daysUntil += 7;
    } else if (lower.includes('this ')) {
      // "this monday" - if already passed this week, go to next
      if (daysUntil <= 0) daysUntil += 7;
    } else if (daysUntil <= 0) {
      daysUntil += 7; // Default to next occurrence
    }

    const result = new Date(now);
    result.setDate(result.getDate() + daysUntil);

    // Extract and apply time if provided
    const timeInDay = lower.match(timeRegex);
    if (timeInDay) {
      let hours = parseInt(timeInDay[1] || timeInDay[4]);
      const mins = timeInDay[2] ? parseInt(timeInDay[2]) : 0;
      const ampmStr: string = timeInDay[3] || '';
      const isPM = ampmStr.toLowerCase() === 'pm';
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      result.setHours(hours, mins, 0, 0);
    } else {
      result.setHours(9, 0, 0, 0); // Default to 9am
    }

    // If the calculated date is in the past (e.g., "monday" when it's already monday evening), go to next week
    if (result <= now) {
      result.setDate(result.getDate() + 7);
    }

    return result;
  }

  // Handle "every day", "daily"
  if (lower.includes('every day') || lower === 'daily') {
    const result = new Date(now);
    result.setDate(result.getDate() + 1);
    result.setHours(9, 0, 0, 0);
    return result;
  }

  // Handle "weekdays"
  if (lower.includes('weekday')) {
    const result = new Date(now);
    // Find next weekday
    do {
      result.setDate(result.getDate() + 1);
    } while (result.getDay() === 0 || result.getDay() === 6); // Skip Sunday/Saturday
    result.setHours(9, 0, 0, 0);
    return result;
  }

  // Handle "weekends"
  if (lower.includes('weekend')) {
    const result = new Date(now);
    do {
      result.setDate(result.getDate() + 1);
    } while (result.getDay() !== 0 && result.getDay() !== 6); // Find Saturday or Sunday
    result.setHours(10, 0, 0, 0);
    return result;
  }

  // Try native Date parsing as fallback
  const parsed = new Date(timeStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

// Get events
export async function getEvents(userId?: number) {
  try {
    const events = await db.getEvents(userId);

    if (events.length === 0) {
      return {
        success: true,
        message: '📅 No events scheduled.\n\n💡 Say "schedule my class on Monday and Wednesday at 9am" to add one!',
        events: [],
      };
    }

    let message = '📅 Your Scheduled Events:\n\n';
    for (const event of events) {
      const daysFormatted = event.days
        .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
        .join(', ');
      message += `• ${event.title}\n`;
      message += `  ${daysFormatted} at ${event.time}\n\n`;
    }

    return {
      success: true,
      message: message.trim(),
      events,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get events: ${error instanceof Error ? error.message : 'Unknown error'}`,
      events: [],
    };
  }
}

// Delete event tool
export async function deleteEvent(args: { title?: string; day?: string }, userId?: number) {
  try {
    const events = await db.getEvents(userId);

    if (events.length === 0) {
      return {
        success: true,
        message: 'You have no events to delete.',
      };
    }

    // Try to find matching event
    let matching = events;
    if (args.title) {
      matching = events.filter((e) =>
        e.title.toLowerCase().includes(args.title!.toLowerCase())
      );
    }

    if (matching.length === 0) {
      return {
        success: false,
        message: `No event found matching "${args.title}". Use /events to see all your events.`,
      };
    }

    // Delete the first matching event
    if (matching[0].id) {
      await db.deleteEvent(matching[0].id);
      return {
        success: true,
        message: `✓ Deleted event: "${matching[0].title}"`,
      };
    }

    return {
      success: false,
      message: 'Failed to delete event.',
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to delete event: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Set timezone tool
export async function setTimezone(args: { timezone: string }, userId?: number) {
  try {
    // Validate timezone by checking if Intl.DateTimeFormat works with it
    try {
      Intl.DateTimeFormat(undefined, { timeZone: args.timezone });
    } catch {
      return {
        success: false,
        message: `Invalid timezone: "${args.timezone}". Please use a valid timezone like "Asia/Kolkata", "America/New_York", "Europe/London".`,
      };
    }

    await db.setUserTimezone(args.timezone, userId);

    // Get current time in the new timezone to confirm
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: args.timezone,
      dateStyle: 'full',
      timeStyle: 'short',
    });

    return {
      success: true,
      message: `✓ Timezone set to "${args.timezone}"\n\n🕐 Current time: ${formatter.format(now)}\n\nReminder times will now be based on this timezone.`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to set timezone: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Get current timezone
export async function getTimezone(userId?: number) {
  try {
    const timezone = await db.getUserTimezone(userId);

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      dateStyle: 'full',
      timeStyle: 'short',
    });

    return {
      success: true,
      message: `🌍 Your current timezone: ${timezone}\n\n🕐 Current time: ${formatter.format(now)}`,
      timezone,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get timezone: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}