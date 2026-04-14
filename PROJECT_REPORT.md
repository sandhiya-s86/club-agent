# Club Agent - Project Report

**Version:** 1.0.0
**Date:** April 12, 2026
**Status:** Fully Functional

---

## 1. Project Overview

### Project Name
**Club Agent** - Personal Productivity + Attendance Management Bot

### Description
A Telegram bot powered by AI (MiniMax-M2.7) that helps manage club operations including attendance tracking, event scheduling, reminders with Google Calendar integration, and attendance reporting.

### Target Users
- Club administrators
- Group managers
- Anyone managing attendance and schedules for small groups

---

## 2. Features & Functions

### 2.1 Mark Attendance
- Mark a person as **present** or **absent**
- Automatically stores date with record
- Example commands:
  - "Mark Sandhiya present"
  - "John absent"

### 2.2 View Attendance
- Retrieve all attendance records from database
- Grouped by date for easy viewing
- Shows visual indicators (✓ for present, ✗ for absent)

### 2.3 Schedule Recurring Events
- Schedule events that repeat on specific days
- Requires: title, days array, time (24h format)
- Example: "Schedule yoga class every Monday and Wednesday at 9am"

### 2.4 Set Reminders
- One-time reminders for tasks/meetings
- Smart time parsing - understands natural language
- Automatically generates Google Calendar link for each reminder
- Time formats supported:
  - "tomorrow at 4pm"
  - "11:30am"
  - "in 2 hours"
  - "monday at 9am"
- Auto-suggests tomorrow if time already passed today
- Example: "Remind me meeting with Nithin tomorrow at 3pm"

### 2.5 View Events
- Display all scheduled recurring events
- Shows day and time for each event

### 2.6 Generate Reports
- Creates CSV export of all attendance data
- Calculates statistics per person:
  - Total present count
  - Total absent count
  - Attendance percentage
- Summary view with formatted output

### 2.7 Search Memory
- Natural language search across all stored data
- Can search for:
  - Events and schedules
  - Attendance records
  - Combined data view

---

## 3. Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Language** | TypeScript | Type-safe JavaScript |
| **Runtime** | Node.js | Server-side execution |
| **Bot Platform** | Telegram Bot API | User interface |
| **AI/LLM** | MiniMax-M2.7 | Natural language processing |
| **Database** | Supabase | Data persistence |
| **Task Scheduling** | node-cron | Reminder scheduler |
| **Validation** | Zod | Runtime type checking |
| **Environment** | dotenv | Configuration management |

---

## 4. Project Structure

```
club-agent/
├── src/
│   ├── index.ts              # Main entry point - initializes all services
│   ├── agent/
│   │   └── agent.ts         # LLM agent with tool calling capabilities
│   ├── bot/
│   │   └── telegram.ts      # Telegram bot setup and message handling
│   ├── db/
│   │   └── supabase.ts      # Database client and CRUD operations
│   ├── services/
│   │   ├── llm.ts           # LLM configuration (MiniMax)
│   │   └── scheduler.ts     # Cron-based reminder checker
│   └── tools/
│       ├── attendance.ts     # markAttendance, getAttendance tools
│       ├── scheduler.ts      # scheduleEvent, setReminder, getEvents tools
│       ├── memory.ts         # getMemory tool for searching data
│       └── report.ts        # generateReport tool
├── .env                      # Environment variables (API keys)
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── PROJECT_REPORT.md         # This document
```

---

## 5. Database Schema (Supabase)

### Table: attendance
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| name | TEXT | NOT NULL |
| status | TEXT | 'present' or 'absent' |
| date | TEXT | ISO date format |

### Table: events
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| title | TEXT | NOT NULL |
| days | TEXT[] | Array of day names |
| time | TEXT | 24h time format |

### Table: reminders
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| task | TEXT | NOT NULL |
| trigger_time | TIMESTAMP | NOT NULL |

---

## 6. API Integration

### MiniMax API (Token Plan)
- **Endpoint:** `https://api.minimax.io/anthropic/v1`
- **Model:** MiniMax-M2.7
- **Protocol:** Anthropic-compatible API
- **Authentication:** Bearer token (TOKEN_PLAN_KEY)

### Telegram Bot API
- **Token Source:** @BotFather
- **Updates:** Polling mode (long polling)

### Google Calendar
- **Integration:** URL-based event creation
- **No OAuth required**
- **User clicks link to add event to calendar**

---

## 7. Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| TOKEN_PLAN_KEY | MiniMax API key (Token Plan) | Yes |
| TELEGRAM_BOT_TOKEN | Telegram bot token | Yes |
| SUPABASE_URL | Supabase project URL | Yes |
| SUPABASE_KEY | Supabase publishable key | Yes |

---

## 8. Installation & Running

### Prerequisites
- Node.js 18+
- npm or yarn
- Telegram account
- MiniMax Token Plan subscription
- Supabase project

### Installation
```bash
# Clone or navigate to project
cd club-agent

# Install dependencies
npm install

# Configure environment
# Edit .env with your API keys

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

---

## 9. Bot Commands Reference

| Command | Description | Example |
|---------|-------------|---------|
| "Mark [name] present/absent" | Record attendance | "Mark Sandhiya present" |
| "show attendance" | View all records | "show attendance" |
| "schedule [event] on [days] at [time]" | Create recurring event | "schedule yoga on monday,wednesday at 9am" |
| "remind me [task] at [time]" | Set reminder | "remind me meeting tomorrow at 3pm" |
| "show events" | List scheduled events | "show events" |
| "generate report" | Create attendance report | "generate report" |
| "search [query]" | Search stored data | "search attendance" |

---

## 10. Known Limitations

1. **Reminders require bot to be running**
   - Bot must be hosted 24/7 for reminders to fire
   - Recommend: Railway, Render, or VPS hosting

2. **Google Calendar notifications**
   - User must click calendar link and save event
   - No automatic push notification without OAuth

3. **Timezone**
   - Currently uses server timezone
   - All times stored in ISO format

---

## 11. Future Improvements Possible

1. **Full Google Calendar OAuth** - automatic event creation
2. **Multiple timezone support** - per-user timezone settings
3. **Telegram group support** - handle multiple groups
4. **SMS reminders** - via Twilio or similar
5. **Email notifications** - via SendGrid or similar
6. **Admin dashboard** - web UI for management
7. **Export to Excel** - better report formatting

---

## 12. Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid API key" error | Check TOKEN_PLAN_KEY in .env |
| Bot not responding | Verify TELEGRAM_BOT_TOKEN |
| Database errors | Check SUPABASE_URL and SUPABASE_KEY |
| Reminders not firing | Ensure bot is running 24/7 |

---

## 13. Support & Contact

For issues or questions about this project:
1. Check the error logs in console
2. Verify all environment variables are set
3. Ensure dependencies are installed: `npm install`

---

**Document Generated:** April 12, 2026
**Project Status:** ✅ Fully Functional
