import { db } from '../db/supabase';

// Add a task/assignment/work
export async function addTask(
  args: {
    title: string;
    category?: 'assignment' | 'personal' | 'work' | 'study' | 'other';
    dueDate?: string;
    priority?: 'high' | 'medium' | 'low';
    description?: string;
  },
  userId?: number
) {
  try {
    const result = await db.addTask(
      args.title,
      args.category || 'other',
      userId,
      args.dueDate,
      args.priority || 'medium',
      args.description
    );

    let message = `✅ Task added!\n\n`;
    message += `📝 Title: ${args.title}\n`;
    if (args.category) message += `🏷️ Category: ${args.category}\n`;
    if (args.dueDate) message += `📅 Due: ${new Date(args.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}\n`;
    if (args.priority) message += `⭐ Priority: ${args.priority}\n`;

    return { success: true, message, task: result };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to add task: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Get pending tasks
export async function getPendingTasks(userId?: number) {
  try {
    const tasks = await db.getPendingTasks(userId);
    const overdue = await db.getOverdueTasks(userId);

    if (tasks.length === 0 && overdue.length === 0) {
      return {
        success: true,
        message: '✅ You have no pending tasks!\n\n💡 Say "add task [title]" to create one.',
        tasks: [],
        overdue: [],
      };
    }

    let message = '📋 Your Pending Tasks:\n\n';

    if (overdue.length > 0) {
      message += '🔴 OVERDUE:\n';
      for (const task of overdue) {
        const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No due date';
        message += `  ⚠️ ${task.title}\n     Due: ${dueDate}\n`;
      }
      message += '\n';
    }

    const highPriority = tasks.filter(t => t.priority === 'high');
    const medPriority = tasks.filter(t => t.priority === 'medium');
    const lowPriority = tasks.filter(t => t.priority === 'low');

    if (highPriority.length > 0) {
      message += '🔴 High Priority:\n';
      for (const task of highPriority) {
        const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No due date';
        message += `  • ${task.title} (Due: ${dueDate})\n`;
      }
      message += '\n';
    }

    if (medPriority.length > 0) {
      message += '🟡 Medium Priority:\n';
      for (const task of medPriority) {
        const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No due date';
        message += `  • ${task.title} (Due: ${dueDate})\n`;
      }
      message += '\n';
    }

    if (lowPriority.length > 0) {
      message += '🟢 Low Priority:\n';
      for (const task of lowPriority) {
        const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No due date';
        message += `  • ${task.title} (Due: ${dueDate})\n`;
      }
    }

    return { success: true, message, tasks, overdue };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to get tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
      tasks: [],
      overdue: [],
    };
  }
}

// Complete a task
export async function completeTask(args: { title?: string; id?: number }, userId?: number) {
  try {
    const tasks = await db.getPendingTasks(userId);
    let task;

    if (args.id) {
      task = tasks.find(t => t.id === args.id);
    } else if (args.title) {
      task = tasks.find(t => t.title.toLowerCase().includes(args.title!.toLowerCase()));
    }

    if (!task) {
      return {
        success: false,
        message: `❌ Task not found. Use "show tasks" to see your pending tasks.`,
      };
    }

    if (task.id) {
      await db.updateTaskStatus(task.id, 'completed');
    }

    return {
      success: true,
      message: `✅ Completed: "${task.title}"\n\nThis task has been marked as done and removed from your pending list.`,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to complete task: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Get completed tasks
export async function getCompletedTasks(userId?: number) {
  try {
    const tasks = await db.getCompletedTasks(userId);

    if (tasks.length === 0) {
      return {
        success: true,
        message: '📋 No completed tasks yet.',
        tasks: [],
      };
    }

    let message = '✅ Completed Tasks:\n\n';
    for (const task of tasks.slice(0, 10)) { // Show last 10
      const completedAt = task.completed_at ? new Date(task.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      message += `✓ ${task.title}`;
      if (completedAt) message += ` (${completedAt})`;
      message += '\n';
    }

    if (tasks.length > 10) {
      message += `\n...and ${tasks.length - 10} more`;
    }

    return { success: true, message, tasks };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to get completed tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
      tasks: [],
    };
  }
}

// Delete a task
export async function deleteTask(args: { title?: string; id?: number }, userId?: number) {
  try {
    const tasks = await db.getTasks(userId, true);
    let task;

    if (args.id) {
      task = tasks.find(t => t.id === args.id);
    } else if (args.title) {
      task = tasks.find(t => t.title.toLowerCase().includes(args.title!.toLowerCase()));
    }

    if (!task) {
      return {
        success: false,
        message: `❌ Task not found. Use "show tasks" to see all tasks.`,
      };
    }

    if (task.id) {
      await db.deleteTask(task.id);
    }

    return {
      success: true,
      message: `🗑️ Deleted: "${task.title}"`,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Update task status
export async function updateTaskStatus(args: { title?: string; id?: number; status: 'pending' | 'in_progress' | 'completed' }, userId?: number) {
  try {
    const tasks = await db.getTasks(userId);
    let task;

    if (args.id) {
      task = tasks.find(t => t.id === args.id);
    } else if (args.title) {
      task = tasks.find(t => t.title.toLowerCase().includes(args.title!.toLowerCase()));
    }

    if (!task) {
      return {
        success: false,
        message: `❌ Task not found.`,
      };
    }

    if (task.id) {
      await db.updateTaskStatus(task.id, args.status);
    }

    const statusEmoji = args.status === 'completed' ? '✅' : args.status === 'in_progress' ? '🔄' : '⏳';
    return {
      success: true,
      message: `${statusEmoji} Updated "${task.title}" to ${args.status}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}