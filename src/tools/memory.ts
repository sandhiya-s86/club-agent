import { db } from '../db/supabase';

// Get memory - retrieves stored information
export async function getMemory(query?: string, userId?: number) {
  try {
    // If query mentions "task" or "assignment" or "work"
    if (query && (query.includes('task') || query.includes('assignment') || query.includes('work'))) {
      const tasks = await db.getPendingTasks(userId);
      const overdue = await db.getOverdueTasks(userId);

      if (tasks.length === 0 && overdue.length === 0) {
        return {
          success: true,
          message: '✅ You have no pending tasks!\n\n💡 Say "add task [title]" to create one.',
          data: [],
        };
      }

      let message = '📋 Your Pending Tasks:\n\n';
      for (const task of tasks) {
        const due = task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No due date';
        message += `• ${task.title} (${task.category}) - Due: ${due}\n`;
      }

      return { success: true, message, data: tasks };
    }

    // If query mentions "event", "class", or "schedule"
    if (query && (query.includes('event') || query.includes('class') || query.includes('schedule'))) {
      const events = await db.getEvents(userId);

      if (events.length === 0) {
        return {
          success: true,
          message: '📅 No events or classes scheduled yet.\n\n💡 Say "schedule my class on Monday at 9am" to add one!',
          data: [],
        };
      }

      let message = '📅 Your scheduled events:\n\n';
      for (const event of events) {
        const daysFormatted = event.days.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
        message += `• ${event.title}: ${daysFormatted} at ${event.time}\n`;
      }

      return { success: true, message, data: events };
    }

    // If query mentions "internship" or "application" or "job"
    if (query && (query.includes('internship') || query.includes('application') || query.includes('job'))) {
      const internships = await db.getInternships(userId);

      if (internships.length === 0) {
        return {
          success: true,
          message: '📋 No internship applications yet.\n\n💡 Say "I applied for Oracle as software engineer" to add one!',
          data: [],
        };
      }

      let message = '📋 Your Applications:\n\n';
      for (const app of internships) {
        message += `• ${app.company_name} (${app.position}) - ${app.status}\n`;
      }

      return { success: true, message, data: internships };
    }

    // If query mentions "reminder"
    if (query && query.includes('reminder')) {
      const reminders = await db.getReminders(userId);

      if (reminders.length === 0) {
        return {
          success: true,
          message: '🔔 You have no reminders set.\n\n💡 Say "remind me to..." to create one!',
          data: [],
        };
      }

      let message = '🔔 Your Reminders:\n\n';
      for (const reminder of reminders) {
        const time = new Date(reminder.trigger_time).toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        });
        message += `• "${reminder.task}" — ${time}\n`;
      }

      return { success: true, message, data: reminders };
    }

    // Default: return summary of everything
    const [events, tasks, internships, reminders] = await Promise.all([
      db.getEvents(userId),
      db.getPendingTasks(userId),
      db.getInternships(userId),
      db.getReminders(userId),
    ]);

    let message = '📋 Club Assistant Summary:\n\n';

    if (events.length > 0) {
      message += `📅 Events: ${events.length} scheduled\n`;
    }
    if (tasks.length > 0) {
      message += `📝 Tasks: ${tasks.length} pending\n`;
    }
    if (internships.length > 0) {
      message += `🏢 Applications: ${internships.length}\n`;
    }
    if (reminders.length > 0) {
      message += `🔔 Reminders: ${reminders.length} active\n`;
    }

    if (events.length === 0 && tasks.length === 0 && internships.length === 0 && reminders.length === 0) {
      message = '📋 No data yet! Start by:\n';
      message += '• "Mark John as present"\n';
      message += '• "Add task finish project"\n';
      message += '• "I applied for Google"\n';
      message += '• "Remind me at 5pm"';
    }

    return {
      success: true,
      message,
      data: { events, tasks, internships, reminders },
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to get memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null,
    };
  }
}