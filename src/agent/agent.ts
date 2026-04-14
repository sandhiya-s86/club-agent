import { markAttendance, getAttendance } from '../tools/attendance';
import { scheduleEvent, setReminder, getEvents, cancelReminder, listReminders, deleteEvent, setTimezone, getTimezone } from '../tools/scheduler';
import { getMemory } from '../tools/memory';
import { generateReport } from '../tools/report';
import { addTask, getPendingTasks, completeTask, getCompletedTasks, deleteTask } from '../tools/tasks';
import { addInternship, getInternships, updateInternshipStatus, deleteInternship, checkInternshipStatus } from '../tools/internships';

// MiniMax Token Plan API configuration (Anthropic-compatible)
const API_KEY = process.env.TOKEN_PLAN_KEY || process.env.MINIMAX_API_KEY || '';
const BASE_URL = 'https://api.minimax.io/anthropic/v1';

// Types for Anthropic API response
interface AnthropicContent {
  type: string;
  text?: string;
  name?: string;
  input?: any;
  id?: string;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  model: string;
  content: AnthropicContent[];
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Tool definitions for MiniMax (Anthropic format)
const tools = [
  // Attendance
  {
    name: 'markAttendance',
    description: 'Mark a person as present or absent for attendance tracking',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the person' },
        status: { type: 'string', enum: ['present', 'absent'], description: 'Attendance status' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format (optional, defaults to today)' },
      },
      required: ['name', 'status'],
    },
  },
  {
    name: 'getAttendance',
    description: 'Retrieve all attendance records in a spreadsheet format',
    input_schema: { type: 'object', properties: {} },
  },

  // Events
  {
    name: 'scheduleEvent',
    description: 'Schedule a recurring event (like a class) on specific days and time',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the event' },
        days: { type: 'array', items: { type: 'string' }, description: 'Days of the week (lowercase)' },
        time: { type: 'string', description: 'Time in 24h format (e.g., "09:00")' },
      },
      required: ['title', 'days', 'time'],
    },
  },
  {
    name: 'getEvents',
    description: 'Get all scheduled events for the user',
    input_schema: { type: 'object', properties: {} },
  },

  // Reminders
  {
    name: 'setReminder',
    description: 'Set a one-time reminder for a task at a specific time',
    input_schema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'What to be reminded about' },
        triggerTime: { type: 'string', description: 'When to trigger (relative like "in 30 minutes" or "tomorrow at 4pm")' },
      },
      required: ['task', 'triggerTime'],
    },
  },
  {
    name: 'listReminders',
    description: 'List all pending reminders for the user',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'cancelReminder',
    description: 'Cancel/delete a specific reminder by task name',
    input_schema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Task name to cancel (partial match)' },
      },
    },
  },

  // Tasks / Works
  {
    name: 'addTask',
    description: 'Add a new task, assignment or work item to track',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the task' },
        category: { type: 'string', enum: ['assignment', 'personal', 'work', 'study', 'other'], description: 'Category of task' },
        dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format (optional)' },
        priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Priority level' },
        description: { type: 'string', description: 'Additional description (optional)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'getPendingTasks',
    description: 'Get all pending tasks/assignments with priority',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'completeTask',
    description: 'Mark a task as completed (removes from pending list)',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of task to complete (partial match)' },
      },
    },
  },
  {
    name: 'getCompletedTasks',
    description: 'Get list of completed tasks',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'deleteTask',
    description: 'Delete a task completely',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of task to delete' },
      },
    },
  },

  // Internships
  {
    name: 'addInternship',
    description: 'Add a new internship/job application to track',
    input_schema: {
      type: 'object',
      properties: {
        companyName: { type: 'string', description: 'Name of the company' },
        position: { type: 'string', description: 'Position/role applied for' },
        applicationUrl: { type: 'string', description: 'URL to the job posting (optional)' },
        notes: { type: 'string', description: 'Additional notes (optional)' },
      },
      required: ['companyName', 'position'],
    },
  },
  {
    name: 'getInternships',
    description: 'Get all internship/job applications with status',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'updateInternshipStatus',
    description: 'Update the status of an internship application',
    input_schema: {
      type: 'object',
      properties: {
        companyName: { type: 'string', description: 'Name of the company' },
        status: { type: 'string', enum: ['applied', 'pending', 'processing', 'interview', 'rejected', 'offer', 'withdrawn'] },
      },
      required: ['companyName', 'status'],
    },
  },
  {
    name: 'checkInternshipStatus',
    description: 'Check the status of an internship application',
    input_schema: {
      type: 'object',
      properties: {
        companyName: { type: 'string', description: 'Name of the company' },
      },
    },
  },
  {
    name: 'deleteInternship',
    description: 'Delete an internship application',
    input_schema: {
      type: 'object',
      properties: {
        companyName: { type: 'string', description: 'Name of the company' },
      },
    },
  },

  // Reports & Memory
  {
    name: 'generateReport',
    description: 'Generate an attendance report with statistics',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'getMemory',
    description: 'Retrieve stored information about events, attendance, reminders, tasks, or all data',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to search for (optional)' },
      },
    },
  },

  // Settings
  {
    name: 'setTimezone',
    description: 'Set the user timezone for accurate reminder times',
    input_schema: {
      type: 'object',
      properties: {
        timezone: { type: 'string', description: 'Timezone (e.g., "Asia/Kolkata", "America/New_York")' },
      },
      required: ['timezone'],
    },
  },
  {
    name: 'getTimezone',
    description: 'Get the current user timezone',
    input_schema: { type: 'object', properties: {} },
  },
];

// System prompt
const systemPrompt = `You are Club Assistant, an intelligent productivity bot that helps track attendance, schedules, tasks, assignments, and internship applications.

═══════════════════════════════════════════
YOUR CAPABILITIES
═══════════════════════════════════════════

ATTENDANCE TRACKING:
- Mark people as present/absent for any date
- View attendance in a spreadsheet format
- Generate attendance reports

EVENTS & SCHEDULING:
- Schedule recurring events (classes, meetings)
- Set one-time reminders
- View upcoming events

TASK/ASSIGNMENT TRACKING:
- Add tasks with due dates and priority
- Track completion
- See overdue tasks
- Completed tasks are removed from pending list

INTERNSHIP/JOB APPLICATION TRACKING:
- Track job applications (Oracle, Google, Microsoft, Amazon, etc.)
- When you add an application, bot AUTOMATICALLY sets a reminder to check status in 3 days
- The bot will remind you every 3 days to check status until you update it
- You tell the bot when status changes: "Oracle is now interview", "Google rejected me", etc.
- Status options: applied, pending, processing, interview, rejected, offer, withdrawn

REMINDERS:
- Set smart reminders for anything
- Remind about tasks before due date
- Daily reminders for ongoing things
- Internship check reminders (auto-scheduled every 3 days)

═══════════════════════════════════════════
PHRASE MATCHING EXAMPLES
═══════════════════════════════════════════

ATTENDANCE:
- "mark John present" / "John is absent today" → markAttendance
- "show attendance" / "attendance register" → getAttendance
- "attendance report" → generateReport

TASKS:
- "I have an assignment due tomorrow" → addTask with assignment category
- "add task finish project by Friday high priority" → addTask
- "show my tasks" / "what work do I have" → getPendingTasks
- "I completed the math homework" → completeTask
- "show completed tasks" → getCompletedTasks

INTERNSHIPS:
- "I applied for Oracle as software developer" → addInternship (ALSO auto-sets check reminder in 3 days!)
- "I applied for Google" → addInternship
- "show my applications" / "internship status" → getInternships
- "Oracle is now interview" / "Google status changed to rejected" → updateInternshipStatus
- "check Oracle application" → checkInternshipStatus
- "delete Oracle application" → deleteInternship

REMINDERS:
- "remind me to submit report tomorrow at 5pm" → setReminder
- "wake me up at 7am" → setReminder
- "nag me about assignment every day" → setReminder (daily category)

TIME EXAMPLES:
- "tomorrow at 3pm" → triggerTime: "tomorrow at 3pm"
- "next Monday" → triggerTime: "next Monday"
- "in 2 hours" → triggerTime: "in 2 hours"
- "every day at 9am" → daily reminder

═══════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════

1. When user says they did/will do/completed something about TASKS:
   → Use completeTask when they say they FINISHED something
   → Use addTask when they mention a new task/assignment

2. When user says they APPLIED for a company:
   → Use addInternship

3. For internships, if user says status changed:
   → Use updateInternshipStatus

4. If user asks "what work do I have?" or "show my tasks":
   → Use getPendingTasks (shows pending only, completed are hidden)

5. If user says "remind me EVERY DAY" or similar:
   → Set a daily recurring reminder

6. ⚠️ DO NOT ASK FOLLOW-UP QUESTIONS. If you understand what the user wants, just do it.
   - If user says "remind me to do X", just call setReminder with your best interpretation of the time.
   - If user says "schedule Y on Monday", just call scheduleEvent.
   - NEVER ask "did you mean this?" or "which option?" or "please confirm".
   - NEVER give the user choices or options. Just execute if you understand.

7. ⚠️ FOR TIMES: Trust the user. If they say "12:40 AM", they mean exactly that (midnight). Do NOT question or correct their time. Just use it.

8. If you're unsure about something minor, make your best guess and proceed. Do not ask the user to clarify.

9. For tasks without due dates, set reminder for next day at 9am by default.

10. Error responses should be honest: if API fails, say "The database seems busy, please try again in a moment."

Be DECISIVE. Execute immediately if you understand. Do not ask questions.`;

// Execute tool calls with better error handling
async function executeTool(name: string, args: any, userId?: number): Promise<string> {
  let result: any;

  try {
    switch (name) {
      case 'markAttendance':
        result = await markAttendance(args, userId);
        break;
      case 'getAttendance':
        result = await getAttendance(userId);
        break;
      case 'scheduleEvent':
        result = await scheduleEvent(args, userId);
        break;
      case 'setReminder':
        result = await setReminder(args, userId);
        break;
      case 'getEvents':
        result = await getEvents(userId);
        break;
      case 'getMemory':
        result = await getMemory(args?.query, userId);
        break;
      case 'generateReport':
        result = await generateReport(userId);
        break;
      case 'listReminders':
        result = await listReminders(userId);
        break;
      case 'cancelReminder':
        result = await cancelReminder(args, userId);
        break;
      case 'deleteEvent':
        result = await deleteEvent(args, userId);
        break;
      case 'setTimezone':
        result = await setTimezone(args, userId);
        break;
      case 'getTimezone':
        result = await getTimezone(userId);
        break;

      // Tasks
      case 'addTask':
        result = await addTask(args, userId);
        break;
      case 'getPendingTasks':
        result = await getPendingTasks(userId);
        break;
      case 'completeTask':
        result = await completeTask(args, userId);
        break;
      case 'getCompletedTasks':
        result = await getCompletedTasks(userId);
        break;
      case 'deleteTask':
        result = await deleteTask(args, userId);
        break;

      // Internships
      case 'addInternship':
        result = await addInternship(args, userId);
        break;
      case 'getInternships':
        result = await getInternships(userId);
        break;
      case 'updateInternshipStatus':
        result = await updateInternshipStatus(args, userId);
        break;
      case 'checkInternshipStatus':
        result = await checkInternshipStatus(args, userId);
        break;
      case 'deleteInternship':
        result = await deleteInternship(args, userId);
        break;

      default:
        return `I don't know how to do that yet.`;
    }

    // Check if tool returned an error
    if (result && result.success === false) {
      return result.message;
    }

    return result.message || JSON.stringify(result);

  } catch (error) {
    // This catches actual JavaScript errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Agent] Tool "${name}" failed:`, errorMessage);

    // Return a helpful error message
    if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
      return `🌐 Network issue detected. The server might be busy or offline. Please try again in a moment.`;
    }
    if (errorMessage.includes('Supabase') || errorMessage.includes('database') || errorMessage.includes('PG')) {
      return `🗄️ Database is temporarily unavailable. Please try again in a few seconds.`;
    }
    if (errorMessage.includes('API') || errorMessage.includes('401') || errorMessage.includes('403')) {
      return `🔑 API issue. Please check if the AI service is configured correctly.`;
    }

    return `❌ Something went wrong with "${name}": ${errorMessage}\n\nPlease try again.`;
  }
}

// Call Anthropic API with better error handling
async function callAnthropicAPI(messages: any[], system?: string, tools?: any[], toolChoice?: any, maxTokens = 1024): Promise<AnthropicResponse> {
  try {
    const response = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
        messages,
        system,
        max_tokens: maxTokens,
        ...(tools && tools.length > 0 ? { tools } : {}),
        ...(toolChoice ? { tool_choice: toolChoice } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetail = `API Error ${response.status}`;

      if (response.status === 401) {
        errorDetail = 'Invalid API key. Please check your MINIMAX_API_KEY in .env';
      } else if (response.status === 429) {
        errorDetail = 'API rate limit reached. Please wait a moment and try again.';
      } else if (response.status >= 500) {
        errorDetail = 'AI service is temporarily unavailable. Please try again later.';
      }

      throw new Error(`${errorDetail}: ${errorText.slice(0, 200)}`);
    }

    return (await response.json()) as AnthropicResponse;

  } catch (error) {
    if (error instanceof Error && error.message.includes('API Error')) {
      throw error; // Re-throw API errors with details
    }
    throw new Error(`Failed to connect to AI service: ${error instanceof Error ? error.message : 'Unknown network error'}`);
  }
}

// Process a user message and get a response
export async function processMessage(
  message: string,
  userId?: number
): Promise<string> {
  try {
    // First call - check if model wants to use tools
    const response = await callAnthropicAPI(
      [{ role: 'user', content: message }],
      systemPrompt,
      tools,
      { type: 'auto' }
    );

    // Check if model wants to call tools
    if (response.stop_reason === 'tool_use' && response.content) {
      const toolCalls = response.content.filter((c: any) => c.type === 'tool_use');

      console.log('[Agent] Tool calls:', JSON.stringify(toolCalls, null, 2));

      // Execute each tool call
      const toolResults: any[] = [];
      for (const toolCall of toolCalls) {
        const name = toolCall.name || '';
        const args = toolCall.input || {};
        console.log(`[Agent] Executing: ${name}`, args);
        const result = await executeTool(name, args, userId);
        console.log(`[Agent] Result: ${result.slice(0, 100)}...`);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: result,
        });
      }

      // Second call - send tool results back to model
      const secondResponse = await callAnthropicAPI(
        [
          { role: 'user', content: message },
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults },
        ],
        systemPrompt
      );

      // Extract text response
      const textContent = secondResponse.content?.find((c: any) => c.type === 'text');
      return textContent?.text || 'Got no response. Please try again.';

    }

    // No tool call - return text response
    const textContent = response.content?.find((c: any) => c.type === 'text');
    return textContent?.text || 'I\'m not sure how to help with that. Try asking about attendance, tasks, reminders, or internships.';

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Agent] Error:', errorMessage);

    // Return specific error messages
    if (errorMessage.includes('API Error 401')) {
      return `🔑 Authentication failed. Please check your MINIMAX_API_KEY in the .env file.\n\nError: Invalid API key`;
    }
    if (errorMessage.includes('API Error 429')) {
      return `⏳ Too many requests! The AI service is rate-limiting us. Please wait about 30 seconds before trying again.`;
    }
    if (errorMessage.includes('API Error 5')) {
      return `🤖 The AI service is having issues right now. Please try again in a few minutes.`;
    }
    if (errorMessage.includes('Failed to connect') || errorMessage.includes('fetch')) {
      return `🌐 Can't reach the AI server. Check your internet connection and try again.`;
    }
    if (errorMessage.includes('database') || errorMessage.includes('Supabase')) {
      return `🗄️ Database is busy. Please try again in a moment.`;
    }

    // Generic fallback with details
    return `❌ I ran into an issue: ${errorMessage.slice(0, 150)}\n\nPlease try again or rephrase your request.`;
  }
}