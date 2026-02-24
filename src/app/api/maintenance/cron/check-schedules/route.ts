import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { initDb } from "@/lib/db";
import { dbCmmsNotifications } from "@/lib/db-cmms";

// Called by Vercel Cron or manually from manager dashboard
// Authorization: Bearer token from CRON_SECRET env var
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Also allow admin/owner session calls
    const { requireAuth } = await import("@/lib/api-auth");
    const auth = await requireAuth(request, ["maintenance_manager", "engineer", "admin", "owner", "super_admin"]);
    if (!auth.ok) return auth.response;
  }

  await initDb();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  // Get all active schedules with next_due_at <= today
  const dueSchedules = await sql`
    SELECT s.*, s.tenant_id,
           s.assigned_tech_id,
           s.warning_days_before_due,
           s.next_due_at
    FROM cmms_maintenance_schedules s
    WHERE s.is_active = true AND s.next_due_at IS NOT NULL`;

  let notified = 0;
  for (const schedule of dueSchedules.rows) {
    const tenantId = schedule.tenant_id as string;
    const nextDue = schedule.next_due_at as string;
    const warningDays = Number(schedule.warning_days_before_due) || 1;
    const dueDate = new Date(nextDue);
    const warnDate = new Date(dueDate);
    warnDate.setDate(warnDate.getDate() - warningDays);
    const todayDate = new Date(today);

    if (todayDate >= dueDate) {
      // Overdue or due today
      const recipients: string[] = [];
      if (schedule.assigned_tech_id) recipients.push(schedule.assigned_tech_id as string);
      if (recipients.length > 0) {
        await dbCmmsNotifications.createForMany(
          tenantId, recipients,
          `Maintenance Due: ${schedule.name}`,
          `Scheduled maintenance "${schedule.name}" is due today.`,
          `/maintenance/schedules`
        );
        notified++;
      }
    } else if (todayDate >= warnDate) {
      // Warning window
      const recipients: string[] = [];
      if (schedule.assigned_tech_id) recipients.push(schedule.assigned_tech_id as string);
      if (recipients.length > 0) {
        await dbCmmsNotifications.createForMany(
          tenantId, recipients,
          `Upcoming Maintenance: ${schedule.name}`,
          `Scheduled maintenance "${schedule.name}" is due on ${nextDue.slice(0, 10)}.`,
          `/maintenance/schedules`
        );
        notified++;
      }
    }
  }

  return NextResponse.json({ checked: dueSchedules.rows.length, notified, checkedAt: now });
}
