import { db } from '../db/supabase';

// Add an internship application
export async function addInternship(
  args: {
    companyName: string;
    position: string;
    applicationUrl?: string;
    notes?: string;
  },
  userId?: number
) {
  try {
    const result = await db.addInternship(
      args.companyName,
      args.position,
      args.applicationUrl || '',
      userId,
      args.notes
    );

    let message = `✅ Application added!\n\n`;
    message += `🏢 Company: ${args.companyName}\n`;
    message += `💼 Position: ${args.position}\n`;
    message += `📊 Status: Applied\n`;
    if (args.applicationUrl) message += `🔗 ${args.applicationUrl}\n`;

    return { success: true, message, internship: result };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to add internship: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Get all internships
export async function getInternships(userId?: number) {
  try {
    const internships = await db.getInternships(userId);

    if (internships.length === 0) {
      return {
        success: true,
        message: '📋 No internship applications yet.\n\n💡 Say "I applied for [company] as [position]" to add one.',
        internships: [],
      };
    }

    let message = '📋 Your Internship Applications:\n\n';

    const statusEmoji: Record<string, string> = {
      applied: '📤',
      pending: '⏳',
      processing: '🔄',
      interview: '👔',
      rejected: '❌',
      offer: '🎉',
      withdrawn: '🚫',
    };

    const statusColor: Record<string, string> = {
      applied: '🟢',
      pending: '🟡',
      processing: '🔵',
      interview: '🟣',
      rejected: '🔴',
      offer: '🎊',
      withdrawn: '⚪',
    };

    for (const internship of internships) {
      const emoji = statusEmoji[internship.status] || '❓';
      const color = statusColor[internship.status] || '';
      message += `${emoji} ${color} ${internship.company_name}\n`;
      message += `   Position: ${internship.position}\n`;
      message += `   Status: ${internship.status.charAt(0).toUpperCase() + internship.status.slice(1)}\n`;

      if (internship.last_checked) {
        const checked = new Date(internship.last_checked).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        message += `   Last checked: ${checked}\n`;
      }

      message += '\n';
    }

    // Summary
    const counts = {
      applied: internships.filter(i => i.status === 'applied').length,
      pending: internships.filter(i => i.status === 'pending').length,
      processing: internships.filter(i => i.status === 'processing').length,
      interview: internships.filter(i => i.status === 'interview').length,
      rejected: internships.filter(i => i.status === 'rejected').length,
      offer: internships.filter(i => i.status === 'offer').length,
    };

    message += '📊 Summary:\n';
    if (counts.offer > 0) message += `  🎉 Offers: ${counts.offer}\n`;
    if (counts.interview > 0) message += `  👔 Interview: ${counts.interview}\n`;
    if (counts.processing > 0) message += `  🔄 Processing: ${counts.processing}\n`;
    if (counts.pending > 0) message += `  ⏳ Pending: ${counts.pending}\n`;
    if (counts.applied > 0) message += `  📤 Applied: ${counts.applied}\n`;
    if (counts.rejected > 0) message += `  ❌ Rejected: ${counts.rejected}\n`;

    return { success: true, message, internships };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to get internships: ${error instanceof Error ? error.message : 'Unknown error'}`,
      internships: [],
    };
  }
}

// Update internship status
export async function updateInternshipStatus(
  args: {
    companyName?: string;
    id?: number;
    status: 'applied' | 'pending' | 'processing' | 'interview' | 'rejected' | 'offer' | 'withdrawn';
  },
  userId?: number
) {
  try {
    const internships = await db.getInternships(userId);
    let internship;

    if (args.id) {
      internship = internships.find(i => i.id === args.id);
    } else if (args.companyName) {
      internship = internships.find(i =>
        i.company_name.toLowerCase().includes(args.companyName!.toLowerCase())
      );
    }

    if (!internship) {
      return {
        success: false,
        message: `❌ Application not found. Use "show internships" to see your applications.`,
      };
    }

    if (internship.id) {
      await db.updateInternshipStatus(internship.id, args.status);
    }

    const statusEmoji: Record<string, string> = {
      applied: '📤', pending: '⏳', processing: '🔄',
      interview: '👔', rejected: '❌', offer: '🎉', withdrawn: '🚫',
    };

    const emoji = statusEmoji[args.status] || '❓';
    return {
      success: true,
      message: `${emoji} Updated ${internship.company_name} to "${args.status}"`,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to update internship: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Delete internship
export async function deleteInternship(args: { companyName?: string; id?: number }, userId?: number) {
  try {
    const internships = await db.getInternships(userId);
    let internship;

    if (args.id) {
      internship = internships.find(i => i.id === args.id);
    } else if (args.companyName) {
      internship = internships.find(i =>
        i.company_name.toLowerCase().includes(args.companyName!.toLowerCase())
      );
    }

    if (!internship) {
      return {
        success: false,
        message: `❌ Application not found.`,
      };
    }

    if (internship.id) {
      await db.deleteInternship(internship.id);
    }

    return {
      success: true,
      message: `🗑️ Deleted ${internship.company_name} application`,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to delete internship: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Check internship status (would integrate with web scraping in future)
export async function checkInternshipStatus(args: { companyName?: string; id?: number }, userId?: number) {
  try {
    const internships = await db.getInternships(userId);
    let internship;

    if (args.id) {
      internship = internships.find(i => i.id === args.id);
    } else if (args.companyName) {
      internship = internships.find(i =>
        i.company_name.toLowerCase().includes(args.companyName!.toLowerCase())
      );
    }

    if (!internship) {
      return {
        success: false,
        message: `❌ Application not found.`,
      };
    }

    // Update last_checked time
    if (internship.id) {
      await db.updateInternshipStatus(internship.id, internship.status);
    }

    const lastChecked = internship.last_checked
      ? new Date(internship.last_checked).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : 'Never';

    let message = `🔍 Status Check for ${internship.company_name}:\n\n`;
    message += `💼 Position: ${internship.position}\n`;
    message += `📊 Current Status: ${internship.status}\n`;
    message += `⏰ Last Checked: ${lastChecked}\n`;

    if (internship.application_url) {
      message += `\n🔗 ${internship.application_url}`;
    }

    message += `\n\n💡 Note: To update the status manually, say "update ${internship.company_name} status to [pending/processing/interview/rejected/offer]"`;

    return { success: true, message, internship };
  } catch (error) {
    return {
      success: false,
      message: `❌ Failed to check internship: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}