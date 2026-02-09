import { NextRequest, NextResponse } from "next/server";
import { checklistSubmissions } from "@/lib/store";
import type { ChecklistSubmission, ItemResponse } from "@/lib/schemas";

function getFlags(sub: ChecklistSubmission): string[] {
  const flags: string[] = [];
  for (const r of sub.responses) {
    if (r.itemType === "checkbox" && r.checkboxValue === false) {
      flags.push(`${r.itemTitle}: Not checked`);
    }
    if (r.itemType === "pass_fail" && r.passFail === "fail") {
      flags.push(`${r.itemTitle}: Failed`);
    }
    if (r.itemType === "numeric" && r.numericValue !== undefined) {
      if (r.numericMin !== undefined && r.numericValue < r.numericMin) {
        flags.push(`${r.itemTitle}: ${r.numericValue} below min ${r.numericMin}${r.numericUnit ? " " + r.numericUnit : ""}`);
      }
      if (r.numericMax !== undefined && r.numericValue > r.numericMax) {
        flags.push(`${r.itemTitle}: ${r.numericValue} above max ${r.numericMax}${r.numericUnit ? " " + r.numericUnit : ""}`);
      }
    }
  }
  return flags;
}

// GET /api/checklists/reports?mode=daily&date=2026-02-09
// GET /api/checklists/reports?mode=weekly&weekOf=2026-02-03
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "daily";
  const dateParam = searchParams.get("date");
  const weekOfParam = searchParams.get("weekOf");

  if (mode === "daily") {
    const targetDate = dateParam || new Date().toISOString().slice(0, 10);
    const daySubmissions = checklistSubmissions.filter((s) => {
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
    // weekOf = Monday of the week (ISO format)
    const monday = weekOfParam
      ? new Date(weekOfParam)
      : getMonday(new Date());
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    const mondayStr = monday.toISOString().slice(0, 10);
    const sundayStr = sunday.toISOString().slice(0, 10);

    const weekSubmissions = checklistSubmissions.filter((s) => {
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

    // Sort common issues by frequency
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
}

// POST /api/checklists/reports - cleanup non-flagged submissions older than a week
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  if (action === "cleanup") {
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const cutoff = oneWeekAgo.toISOString();

    let removed = 0;
    for (let i = checklistSubmissions.length - 1; i >= 0; i--) {
      const s = checklistSubmissions[i];
      if (s.submittedAt < cutoff && getFlags(s).length === 0) {
        checklistSubmissions.splice(i, 1);
        removed++;
      }
    }

    return NextResponse.json({
      success: true,
      removedCount: removed,
      remainingCount: checklistSubmissions.length,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
