import { db } from '../db/supabase';

// Generate attendance report
export async function generateReport(userId?: number) {
  try {
    const records = await db.getAttendance(userId);

    if (records.length === 0) {
      return {
        success: true,
        message: '📊 No attendance data available for report.\n\n💡 Start marking attendance first!',
        csv: '',
      };
    }

    // Collect all dates
    const allDates = new Set<string>();
    for (const record of records) {
      if (record.attendance_data) {
        Object.keys(record.attendance_data).forEach(d => allDates.add(d));
      }
    }
    const sortedDates = Array.from(allDates).sort();
    const recentDates = sortedDates.slice(-30); // Last 30 days

    // Create CSV content
    const headers = ['Name', ...recentDates];
    const rows = records.map(r => {
      const row = [r.name];
      for (const d of recentDates) {
        row.push(r.attendance_data?.[d] || '');
      }
      return row;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    // Summary statistics per person
    let summary = '📊 Attendance Report\n\n';
    summary += '─────────────────────────────────────\n';

    for (const record of records) {
      const data = record.attendance_data || {};
      const dates = Object.keys(data);
      const present = dates.filter(d => data[d] === 'present').length;
      const absent = dates.filter(d => data[d] === 'absent').length;
      const total = present + absent;
      const presentPct = total > 0 ? Math.round((present / total) * 100) : 0;
      const bar = '█'.repeat(Math.floor(presentPct / 10)) + '░'.repeat(10 - Math.floor(presentPct / 10));

      summary += `${record.name}\n`;
      summary += `  ${bar} ${presentPct}%\n`;
      summary += `  Present: ${present} | Absent: ${absent}\n\n`;
    }

    summary += '─────────────────────────────────────\n';
    summary += `Total People: ${records.length}\n`;
    summary += `Dates Tracked: ${recentDates.length}\n`;
    summary += `Report Generated: ${new Date().toLocaleString()}\n`;

    return {
      success: true,
      message: summary,
      csv: csvContent,
      records,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to generate report: ${error instanceof Error ? error.message : 'Unknown error'}`,
      csv: '',
      records: [],
    };
  }
}