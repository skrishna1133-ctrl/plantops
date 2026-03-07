import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbOpsDowntimeEvents } from "@/lib/db-ops";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const ALL_OPS = ["owner", "admin", "engineer", "shipping", "receiving", "quality_manager", "quality_tech", "worker"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...ALL_OPS]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId") ?? undefined;
  const jobId = searchParams.get("jobId") ?? undefined;
  const data = await dbOpsDowntimeEvents.getAll(auth.payload.tenantId!, runId, jobId);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...ALL_OPS]);
  if (!auth.ok) return auth.response;
  await initDb();

  const body = await request.json();
  const { runId, productionLineId, reason, category, startTime, endTime, durationMinutes, notes } = body;

  if (!reason) return NextResponse.json({ error: "reason is required" }, { status: 400 });
  if (!startTime) return NextResponse.json({ error: "startTime is required" }, { status: 400 });

  // Auto-calculate duration if both times provided
  let duration = durationMinutes;
  if (!duration && startTime && endTime) {
    const diff = new Date(endTime).getTime() - new Date(startTime).getTime();
    if (diff > 0) duration = Math.round(diff / 60000);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await dbOpsDowntimeEvents.create({
    id, tenantId: auth.payload.tenantId!,
    runId, productionLineId, reason, category,
    startTime, endTime, durationMinutes: duration,
    notes, reportedById: auth.payload.userId, createdAt: now,
  });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "ops_downtime_event", entityId: id, entityName: reason }).catch(() => {});
  return NextResponse.json({ id }, { status: 201 });
}
