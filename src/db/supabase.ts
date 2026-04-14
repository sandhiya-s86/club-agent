import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

// Attendance - spreadsheet style (dates are columns per person)
export interface AttendanceRecord {
  id?: number;
  name: string;                    // Person's name (row identifier)
  user_id?: number;                // Telegram user ID
  // Dynamic date columns stored as JSON: { "2026-04-13": "present", "2026-04-14": "absent" }
  attendance_data?: Record<string, 'present' | 'absent'>;
  created_at?: string;
}

// Events - recurring schedule
export interface EventRecord {
  id?: number;
  title: string;
  days: string[];
  time: string;
  user_id?: number;
}

// Reminders - smart reminders with category
export interface ReminderRecord {
  id?: number;
  task: string;
  trigger_time: string;
  category: 'general' | 'assignment' | 'internship' | 'daily' | 'internship_check';
  user_id?: number;
  is_sent?: boolean;
  metadata?: {
    source_url?: string;
    priority?: 'high' | 'medium' | 'low';
    notes?: string;
    companyName?: string;
  };
}

// Internship applications tracking
export interface InternshipRecord {
  id?: number;
  company_name: string;
  position: string;
  application_url: string;
  status: 'applied' | 'pending' | 'processing' | 'interview' | 'rejected' | 'offer' | 'withdrawn';
  last_checked?: string;
  status_history?: Record<string, string>;  // { "2026-04-13": "applied", "2026-04-15": "processing" }
  user_id?: number;
  created_at?: string;
  notes?: string;
}

// Tasks/Assignments tracking
export interface TaskRecord {
  id?: number;
  title: string;
  description?: string;
  due_date?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  category: 'assignment' | 'personal' | 'work' | 'study' | 'other';
  user_id?: number;
  created_at?: string;
  completed_at?: string;
}

// ═══════════════════════════════════════════════════════════════
// DATABASE OPERATIONS
// ═══════════════════════════════════════════════════════════════

export const db = {

  // ════════════════════════════════════════════
  // ATTENDANCE - Spreadsheet Style
  // ════════════════════════════════════════════

  async markAttendance(
    name: string,
    date: string,
    status: 'present' | 'absent',
    userId?: number
  ): Promise<AttendanceRecord> {
    // Check if person exists for this user
    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('name', name)
      .eq('user_id', userId || 1)
      .single();

    if (existing) {
      // Update existing record with new date
      const attendanceData = existing.attendance_data || {};
      attendanceData[date] = status;

      const { data, error } = await supabase
        .from('attendance')
        .update({ attendance_data: attendanceData })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update attendance: ${error.message}`);
      return data;
    } else {
      // Create new person record
      const attendanceData: Record<string, 'present' | 'absent'> = {};
      attendanceData[date] = status;

      const { data, error } = await supabase
        .from('attendance')
        .insert({ name, attendance_data: attendanceData, user_id: userId })
        .select()
        .single();

      if (error) throw new Error(`Failed to create attendance: ${error.message}`);
      return data;
    }
  },

  async getAttendance(userId?: number): Promise<AttendanceRecord[]> {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId || 1)
      .order('name');

    if (error) throw new Error(`Failed to get attendance: ${error.message}`);
    return data || [];
  },

  async getAttendanceForPerson(name: string, userId?: number): Promise<AttendanceRecord | null> {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('name', name)
      .eq('user_id', userId || 1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get attendance: ${error.message}`);
    }
    return data || null;
  },

  // ════════════════════════════════════════════
  // EVENTS - Per User
  // ════════════════════════════════════════════

  async addEvent(title: string, days: string[], time: string, userId?: number): Promise<EventRecord> {
    const { data, error } = await supabase
      .from('events')
      .insert({ title, days, time, user_id: userId })
      .select()
      .single();

    if (error) throw new Error(`Failed to add event: ${error.message}`);
    return data;
  },

  async getEvents(userId?: number): Promise<EventRecord[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId || 1);

    if (error) throw new Error(`Failed to get events: ${error.message}`);
    return data || [];
  },

  async deleteEvent(id: number): Promise<void> {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete event: ${error.message}`);
  },

  // ════════════════════════════════════════════
  // REMINDERS - Smart Reminders
  // ════════════════════════════════════════════

  async addReminder(
    task: string,
    triggerTime: string,
    userId?: number,
    category: 'general' | 'assignment' | 'internship' | 'daily' = 'general',
    metadata?: ReminderRecord['metadata']
  ): Promise<ReminderRecord> {
    const { data, error } = await supabase
      .from('reminders')
      .insert({
        task,
        trigger_time: triggerTime,
        user_id: userId,
        category,
        is_sent: false,
        metadata
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add reminder: ${error.message}`);
    return data;
  },

  async getReminders(userId?: number): Promise<ReminderRecord[]> {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', userId || 1)
      .order('trigger_time');

    if (error) throw new Error(`Failed to get reminders: ${error.message}`);
    return data || [];
  },

  async getPendingReminders(userId?: number): Promise<ReminderRecord[]> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', userId || 1)
      .eq('is_sent', false)
      .lte('trigger_time', now);

    if (error) throw new Error(`Failed to get pending reminders: ${error.message}`);
    return data || [];
  },

  async getDailyReminders(userId?: number): Promise<ReminderRecord[]> {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', userId || 1)
      .eq('is_sent', false)
      .eq('category', 'daily');

    if (error) throw new Error(`Failed to get daily reminders: ${error.message}`);
    return data || [];
  },

  async markReminderSent(id: number): Promise<void> {
    const { error } = await supabase
      .from('reminders')
      .update({ is_sent: true })
      .eq('id', id);

    if (error) throw new Error(`Failed to mark reminder sent: ${error.message}`);
  },

  async deleteReminder(id: number): Promise<void> {
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete reminder: ${error.message}`);
  },

  async updateReminderTime(id: number, newTime: string): Promise<void> {
    const { error } = await supabase
      .from('reminders')
      .update({ trigger_time: newTime })
      .eq('id', id);

    if (error) throw new Error(`Failed to update reminder time: ${error.message}`);
  },

  async getDueReminders(): Promise<ReminderRecord[]> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('is_sent', false)
      .lte('trigger_time', now);

    if (error) throw new Error(`Failed to get due reminders: ${error.message}`);
    return data || [];
  },

  // ════════════════════════════════════════════
  // INTERNSHIP APPLICATIONS
  // ════════════════════════════════════════════

  async addInternship(
    companyName: string,
    position: string,
    applicationUrl: string,
    userId?: number,
    notes?: string
  ): Promise<InternshipRecord> {
    const { data, error } = await supabase
      .from('internships')
      .insert({
        company_name: companyName,
        position,
        application_url: applicationUrl,
        status: 'applied',
        user_id: userId,
        status_history: { [new Date().toISOString().split('T')[0]]: 'applied' },
        notes
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add internship: ${error.message}`);

    // Auto-create first check reminder in 3 days
    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() + 3);

    await supabase.from('reminders').insert({
      task: `Check ${companyName} application status`,
      trigger_time: checkDate.toISOString(),
      category: 'internship_check',
      user_id: userId,
      is_sent: false,
      metadata: {
        companyName: companyName,
        source_url: applicationUrl,
      }
    });

    console.log(`[DB] Created internship_check reminder for ${companyName} at ${checkDate.toISOString()}`);

    return data;
  },

  async getInternships(userId?: number): Promise<InternshipRecord[]> {
    const { data, error } = await supabase
      .from('internships')
      .select('*')
      .eq('user_id', userId || 1)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get internships: ${error.message}`);
    return data || [];
  },

  async updateInternshipStatus(
    id: number,
    status: InternshipRecord['status'],
    userId?: number
  ): Promise<InternshipRecord> {
    const date = new Date().toISOString().split('T')[0];

    // Get existing record to update history
    const { data: existing } = await supabase
      .from('internships')
      .select('status_history')
      .eq('id', id)
      .single();

    const statusHistory = existing?.status_history || {};
    statusHistory[date] = status;

    const { data, error } = await supabase
      .from('internships')
      .update({
        status,
        last_checked: new Date().toISOString(),
        status_history: statusHistory
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update internship: ${error.message}`);
    return data;
  },

  async deleteInternship(id: number): Promise<void> {
    const { error } = await supabase.from('internships').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete internship: ${error.message}`);
  },

  // ════════════════════════════════════════════
  // TASKS / ASSIGNMENTS / WORKS
  // ════════════════════════════════════════════

  async addTask(
    title: string,
    category: TaskRecord['category'],
    userId?: number,
    dueDate?: string,
    priority: TaskRecord['priority'] = 'medium',
    description?: string
  ): Promise<TaskRecord> {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title,
        description,
        due_date: dueDate,
        priority,
        category,
        status: 'pending',
        user_id: userId
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add task: ${error.message}`);
    return data;
  },

  async getTasks(userId?: number, includeCompleted = false): Promise<TaskRecord[]> {
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId || 1);

    if (!includeCompleted) {
      query = query.neq('status', 'completed');
    }

    const { data, error } = await query.order('due_date', { nullsFirst: false });

    if (error) throw new Error(`Failed to get tasks: ${error.message}`);
    return data || [];
  },

  async getPendingTasks(userId?: number): Promise<TaskRecord[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId || 1)
      .in('status', ['pending', 'in_progress'])
      .order('priority')
      .order('due_date', { nullsFirst: false });

    if (error) throw new Error(`Failed to get pending tasks: ${error.message}`);
    return data || [];
  },

  async getCompletedTasks(userId?: number): Promise<TaskRecord[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId || 1)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    if (error) throw new Error(`Failed to get completed tasks: ${error.message}`);
    return data || [];
  },

  async updateTaskStatus(id: number, status: TaskRecord['status']): Promise<TaskRecord> {
    const updateData: Partial<TaskRecord> = { status };
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update task: ${error.message}`);
    return data;
  },

  async deleteTask(id: number): Promise<void> {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete task: ${error.message}`);
  },

  async getOverdueTasks(userId?: number): Promise<TaskRecord[]> {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId || 1)
      .eq('status', 'pending')
      .lt('due_date', today)
      .not('due_date', 'is', null);

    if (error) throw new Error(`Failed to get overdue tasks: ${error.message}`);
    return data || [];
  },

  // ════════════════════════════════════════════
  // USER SETTINGS
  // ════════════════════════════════════════════

  async setUserChatId(chatId: number, userId?: number): Promise<void> {
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId || chatId, chat_id: chatId });

    if (error) throw new Error(`Failed to set chat ID: ${error.message}`);
  },

  async getUserChatId(userId?: number): Promise<number | null> {
    const { data, error } = await supabase
      .from('user_settings')
      .select('chat_id')
      .eq('user_id', userId || 1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get chat ID: ${error.message}`);
    }
    return data?.chat_id || null;
  },

  async setUserTimezone(timezone: string, userId?: number): Promise<void> {
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId || 1, timezone });

    if (error) throw new Error(`Failed to set timezone: ${error.message}`);
  },

  async getUserTimezone(userId?: number): Promise<string> {
    const { data, error } = await supabase
      .from('user_settings')
      .select('timezone')
      .eq('user_id', userId || 1)
      .single();

    if (error && error.code !== 'PGRST116') {
      return 'UTC';
    }
    return data?.timezone || 'UTC';
  }
};

export async function initDatabase(): Promise<void> {
  console.log('Database client initialized');
  console.log('Supabase URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
  console.log('Supabase Key:', supabaseKey ? '✓ Set' : '✗ Missing');
}