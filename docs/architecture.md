# Personal Productivity + Attendance Agent - Documentation

## Overview

This system is a smart assistant that lives inside Telegram. You talk to it naturally and it:
- Records attendance (present/absent)
- Schedules events and classes
- Sends reminders at the right time
- Retrieves stored information
- Generates attendance reports

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **TypeScript** | Language with type safety (catches errors before running) |
| **Node.js** | Server runtime for running the bot |
| **Mastra AI** | AI framework - the brain that understands messages and decides actions |
| **Supabase** | Cloud database (PostgreSQL) for storing data |
| **Telegram Bot API** | User interface - how users interact with the bot |
| **OpenAI LLM** | The actual AI model that understands language (used by Mastra) |
| **node-cron** | Scheduler for triggering reminders at specific times |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                │
│                   "John is absent"                          │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    TELEGRAM SERVER                          │
│              (Telegram Bot receives message)                │
│                   telegram.ts file                          │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                       MASTRA AGENT                          │
│              (agent.ts - The brain)                        │
│                                                              │
│   "What should I do with this message?"                    │
│   → Thinks → Decides to call markAttendance tool            │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    TOOLS LAYER                              │
│              (tools/attendance.ts)                         │
│                                                              │
│   Executes the actual action:                              │
│   → Takes "John is absent"                                 │
│   → Converts to structured data                           │
│   → Prepares database insert                                │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                        │
│              (supabase.ts client)                          │
│                                                              │
│   Stores in attendance table:                               │
│   { name: "John", status: "absent", date: "2026-04-09" }   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    RESPONSE BACK                            │
│              "Attendance marked for John ✓"                │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                         USER                                │
│            Gets confirmation on Telegram                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Complete Flow

```
[1] USER sends message via Telegram
        ↓
[2] Telegram Bot receives message (bot/telegram.ts)
        ↓
[3] Pass to Mastra Agent (agent/agent.ts)
        ↓
[4] Agent analyzes and decides which tool to use
        ↓
[5] Tool executes the action (tools/*.ts)
        ↓
[6] Tool interacts with Supabase (db/supabase.ts)
        ↓
[7] Database stores or retrieves data
        ↓
[8] Response sent back through the chain
        ↓
[9] User receives reply in Telegram
```

---

## The 5 Tools (Capabilities)

### Tool 1: `markAttendance`
- **Purpose:** Record who is present or absent
- **User Input:** "John absent" or "Alice present"
- **Process:**
  1. Extract name and status from text
  2. Add today's date
  3. Insert into `attendance` table
  4. Return confirmation message

### Tool 2: `scheduleEvent`
- **Purpose:** Save recurring events like classes
- **User Input:** "I have class on Tuesday and Thursday at 9 AM"
- **Process:**
  1. Parse days (Tuesday, Thursday) and time (9 AM)
  2. Insert into `events` table
  3. Set up scheduled reminder
  4. Return confirmation

### Tool 3: `setReminder`
- **Purpose:** One-time reminder for a task
- **User Input:** "Remind me to submit project at 6 PM"
- **Process:**
  1. Store task and time in `reminders` table
  2. Scheduler checks every minute
  3. When time matches, send Telegram message
  4. Return confirmation

### Tool 4: `getMemory`
- **Purpose:** Retrieve stored information
- **User Input:** "What are my classes?" or "Show my attendance"
- **Process:**
  1. Determine which table to query
  2. Query events or attendance table
  3. Format data nicely
  4. Return human-readable response

### Tool 5: `getReport`
- **Purpose:** Generate and send reports
- **User Input:** "Send me the attendance report"
- **Process:**
  1. Query all attendance data
  2. Create CSV file
  3. Send file via Telegram bot
  4. Return confirmation

---

## Database Design (Supabase Tables)

### Table 1: `attendance`
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Auto-increment primary key |
| name | text | Person's name |
| status | text | "present" or "absent" |
| date | date | When the attendance was recorded |

### Table 2: `events`
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Auto-increment primary key |
| title | text | Event name (e.g., "Class") |
| days | text[] | Array of days: ["tuesday", "thursday"] |
| time | text | Time in 24h format: "09:00" |

### Table 3: `reminders`
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Auto-increment primary key |
| task | text | What needs to be done |
| trigger_time | timestamp | When to send reminder |

---

## File Structure

```
club-agent/                          ← Root folder (your project)
│
├── src/                             ← All source code lives here
│   │
│   ├── index.ts                    ← FIRST file that runs (entry point)
│   │                                Why? Node starts here first
│   │
│   ├── bot/
│   │   └── telegram.ts             ← Handles incoming Telegram messages
│   │                                Why separate? Keeps bot logic isolated
│   │
│   ├── agent/
│   │   └── agent.ts               ← Mastra AI agent + all 5 tools
│   │                                Why? Brain of the application
│   │
│   ├── tools/
│   │   ├── attendance.ts           ← markAttendance tool
│   │   ├── scheduler.ts            ← scheduleEvent + setReminder tools
│   │   ├── memory.ts               ← getMemory tool
│   │   └── report.ts               ← getReport tool
│   │                                Why separate? Each tool is modular
│   │
│   ├── db/
│   │   └── supabase.ts             ← Supabase connection client
│   │                                Why? All DB access goes through here
│   │
│   ├── services/
│   │   └── llm.ts                  ← OpenAI model configuration
│   │                                Why? Centralizes LLM setup
│   │
│   └── utils/
│       └── helpers.ts              ← Shared utility functions
│   │
├── .env                            ← Environment variables (secrets)
├── package.json                    ← Project dependencies
└── tsconfig.json                   ← TypeScript settings
```

---

## Environment Variables (.env)

This file holds all your secrets - never share it publicly:

```env
OPENAI_API_KEY=sk-xxxxxxx           # Your OpenAI API key
TELEGRAM_BOT_TOKEN=123456:ABC      # Your Telegram bot token from BotFather
SUPABASE_URL=https://xxxx.supabase.co # Your Supabase project URL
SUPABASE_KEY=xxxxxx                 # Your Supabase anon key
```

---

## How Each Feature Works

### Feature 1: Attendance Tracking

**User says:** "John absent"

**What happens:**
```
Telegram receives "Mark John as absent"
        ↓
Agent sees → needs markAttendance tool
        ↓
Tool extracts → name: "John", status: "absent"
        ↓
Supabase INSERT into attendance table
        ↓
Return: "✓ Marked John as absent on April 9, 2026"
        ↓
User sees message in Telegram
```

### Feature 2: Event Scheduling

**User says:** "I have class on Tuesday at 9 AM"

**What happens:**
```
Telegram receives "I have class on Tuesday at 9 AM"
        ↓
Agent sees → needs scheduleEvent tool
        ↓
Tool extracts → title: "Class", days: ["tuesday"], time: "09:00"
        ↓
Supabase INSERT into events table
        ↓
Scheduler sets up recurring check
        ↓
Return: "✓ Class scheduled for Tuesdays at 9:00 AM"
```

### Feature 3: Reminders

**User says:** "Remind me to submit project at 6 PM"

**What happens:**
```
Message received and passed to agent
        ↓
Agent calls setReminder tool
        ↓
Tool stores task + time in reminders table
        ↓
Scheduler runs every minute, checks for due reminders
        ↓
At 6 PM → Bot sends Telegram message to user
        ↓
Return: "✓ Reminder set for 6:00 PM"
```

### Feature 4: Memory Retrieval

**User says:** "What are my classes?"

**What happens:**
```
Message received and passed to agent
        ↓
Agent calls getMemory tool
        ↓
Tool queries events table
        ↓
Tool formats results nicely
        ↓
Return: "You have Class on Tuesday at 09:00, Thursday at 09:00"
```

### Feature 5: Report Generation

**User says:** "Send me the attendance report"

**What happens:**
```
Message received and passed to agent
        ↓
Agent calls getReport tool
        ↓
Tool queries all attendance records
        ↓
Tool creates CSV file
        ↓
Tool sends file via Telegram
        ↓
Return: "✓ Report sent!"
```

---

## Why This Architecture?

1. **Modular** - Each piece can be tested separately
2. **Maintainable** - Easy to find and fix bugs
3. **Scalable** - Can add more tools easily
4. **Beginner-Friendly** - Clear separation of concerns
5. **Type-Safe** - TypeScript catches errors early

---

## Setup Requirements

1. **Node.js** installed (v18+ recommended)
2. **OpenAI API Key** from platform.openai.com
3. **Telegram Bot** created via @BotFather
4. **Supabase Project** created at supabase.com

---

## Running the Project

```bash
# Install dependencies
npm install

# Setup environment variables
# Edit .env file with your keys

# Run the bot
npm run dev

# Or build for production
npm run build
npm start
```

---

## API Keys Needed

| Service | Where to Get |
|---------|--------------|
| OpenAI | platform.openai.com/api-keys |
| Telegram | Message @BotFather on Telegram |
| Supabase | supabase.com → Project Settings → API |

---

*Document created: 2026-04-09*
*Project: Personal Productivity + Attendance Agent*