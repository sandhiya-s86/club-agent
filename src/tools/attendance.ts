import { db } from '../db/supabase';

// Mark attendance tool - spreadsheet style
export async function markAttendance(
  args: { name: string; status: 'present' | 'absent'; date?: string },
  userId?: number
) {
  try {
    const date = args.date || new Date().toISOString().split('T')[0];
    const result = await db.markAttendance(args.name, date, args.status, userId);

    const statusEmoji = args.status === 'present' ? '✓' : '✗';
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return {
      success: true,
      message: `${statusEmoji} Marked ${args.name} as ${args.status} on ${formattedDate}`,
      record: result,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to mark attendance: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Get attendance tool - spreadsheet style display
export async function getAttendance(userId?: number) {
  try {
    const records = await db.getAttendance(userId);

    if (records.length === 0) {
      return {
        success: true,
        message: '📋 No attendance records found.\n\n💡 Say "Mark [name] as present" to start!',
        records: [],
      };
    }

    // Get all unique dates
    const allDates = new Set<string>();
    for (const record of records) {
      if (record.attendance_data) {
        Object.keys(record.attendance_data).forEach(d => allDates.add(d));
      }
    }

    const sortedDates = Array.from(allDates).sort();
    const recentDates = sortedDates.slice(-7); // Last 7 days

    let message = '📋 Attendance Register\n\n';
    message += '┌─────────────────┬' + '─────────────┬'.repeat(recentDates.length) + '─────────────┐\n';
    message += '│ Name            │';
    for (const d of recentDates) {
      const shortDate = new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      message += ` ${shortDate.padEnd(10)} │`;
    }
    message += '\n├─────────────────┼' + '─────────────┼'.repeat(recentDates.length) + '─────────────┤\n';

    for (const record of records) {
      message += `│ ${record.name.padEnd(14)} │`;
      for (const d of recentDates) {
        const status = record.attendance_data?.[d] || '-';
        const emoji = status === 'present' ? '✓' : status === 'absent' ? '✗' : '·';
        message += ` ${emoji.padEnd(10)} │`;
      }
      message += '\n';
    }

    message += '└─────────────────┴' + '─────────────┴'.repeat(recentDates.length) + '─────────────┘\n';

    // Summary
    message += '\n📊 Summary:\n';
    for (const record of records) {
      const data = record.attendance_data || {};
      const present = Object.values(data).filter(s => s === 'present').length;
      const absent = Object.values(data).filter(s => s === 'absent').length;
      const total = present + absent;
      const pct = total > 0 ? Math.round((present / total) * 100) : 0;
      message += `  ${record.name}: ${present}P / ${absent}A (${pct}%)\n`;
    }

    return {
      success: true,
      message,
      records,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to get attendance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      records: [],
    };
  }
}

// Mark multiple people absent (for class)
export async function markBulkAbsent(args: { names: string[]; date?: string }, userId?: number) {
  try {
    const date = args.date || new Date().toISOString().split('T')[0];
    const results = [];

    for (const name of args.names) {
      const result = await db.markAttendance(name, date, 'absent', userId);
      results.push(result);
    }

    return {
      success: true,
      message: `✓ Marked ${args.names.length} people as absent on ${new Date(date).toLocaleDateString()}`,
      records: results,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to mark bulk attendance: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}