import { NextRequest, NextResponse } from "next/server";
import { dbSubmissions } from "@/lib/db";
import { getFlags } from "@/lib/flags";
import { verifySessionToken } from "@/lib/auth";

// GET /api/checklists/reports?mode=daily&date=2026-02-09
// GET /api/checklists/reports?mode=weekly&weekOf=2026-02-03
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const sessionCookie = request.cookies.get("plantops_session");
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifySessionToken(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check role - only admin or owner can view reports
    if (!["admin", "owner"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "daily";
    const dateParam = searchParams.get("date");
    const weekOfParam = searchParams.get("weekOf");

    // Fetch all submissions (filtered by date range in app logic)
    const allSubmissions = await dbSubmissions.getAll();

    if (mode === "daily") {
      const targetDate = dateParam || new Date().toISOString().slice(0, 10);
      const daySubmissions = allSubmissions.filter((s) => {
        return s.submittedAt.slice(0, 10) === targetDate;
      });

      const flagged = daySubmissions
        .map((s) => ({ ...s, flags: getFlags(s) }))
        .filter((s) => s.flags.length > 0);

      return NextResponse.json({
        mode: "daily",
        date: targetDate,
        totalSubmissions: daySubmissions.length,
        flaggedCount: flagged.length,
        cleanCount: daySubmissions.length - flagged.length,
        flaggedSubmissions: flagged,
      });
    }

    if (mode === "weekly") {
      const monday = weekOfParam
        ? new Date(weekOfParam)
        : getMonday(new Date());
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);

      const mondayStr = monday.toISOString().slice(0, 10);
      const sundayStr = sunday.toISOString().slice(0, 10);

      const weekSubmissions = allSubmissions.filter((s) => {
        const d = s.submittedAt.slice(0, 10);
        return d >= mondayStr && d <= sundayStr;
      });

      const flaggedByDay: Record<string, number> = {};
      const totalByDay: Record<string, number> = {};
      const flaggedByType: Record<string, number> = {};
      const commonIssues: Record<string, number> = {};

      for (const s of weekSubmissions) {
        const day = s.submittedAt.slice(0, 10);
        totalByDay[day] = (totalByDay[day] || 0) + 1;

        const flags = getFlags(s);
        if (flags.length > 0) {
          flaggedByDay[day] = (flaggedByDay[day] || 0) + 1;
          flaggedByType[s.templateType] = (flaggedByType[s.templateType] || 0) + 1;
          for (const f of flags) {
            commonIssues[f] = (commonIssues[f] || 0) + 1;
          }
        }
      }

      const topIssues = Object.entries(commonIssues)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([issue, count]) => ({ issue, count }));

      const totalFlagged = Object.values(flaggedByDay).reduce((a, b) => a + b, 0);

      return NextResponse.json({
        mode: "weekly",
        weekOf: mondayStr,
        weekEnd: sundayStr,
        totalSubmissions: weekSubmissions.length,
        totalFlagged,
        totalClean: weekSubmissions.length - totalFlagged,
        flaggedByDay,
        totalByDay,
        flaggedByType,
        topIssues,
      });
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/checklists/reports - cleanup non-flagged submissions older than a week
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const sessionCookie = request.cookies.get("plantops_session");
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifySessionToken(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check role - only admin or owner can trigger cleanup
    if (!["admin", "owner"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === "cleanup") {
      const now = new Date();
      const oneWeekAgo = new Date(now);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const cutoff = oneWeekAgo.toISOString();

      const removed = await dbSubmissions.deleteCleanBefore(cutoff);
      const allRemaining = await dbSubmissions.getAll();

      return NextResponse.json({
        success: true,
        removedCount: removed,
        remainingCount: allRemaining.length,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in cleanup:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
