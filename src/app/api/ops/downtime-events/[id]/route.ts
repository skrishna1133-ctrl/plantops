import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbOpsDowntimeEvents } from "@/lib/db-ops";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const ALL_OPS = ["owner", "admin", "engineer", "shipping", "receiving", "quality_manager", "quality_tech", "worker"] as const;
const MANAGER = ["owner", "admin", "engineer"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...ALL_OPS]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const event = await dbOpsDowntimeEvents.getById(id, auth.payload.tenantId!);
  if (!event) return NextResponse.json({ error: "Downtime event not found" }, { status: 404 });

  const body = await request.json();
  const { reason, category, endTime, durationMinutes, notes, cmmsWorkOrderId } = body;

  // Auto-calculate duration if end time updated
  let duration = durationMinutes;
  if (!duration && endTime && event.start_time) {
    const diff = new Date(endTime).getTime() - new Date(event.start_time).getTime();
    if (diff > 0) duration = Math.round(diff / 60000);
  }

  await dbOpsDowntimeEvents.update(id, auth.payload.tenantId!, {
    reason, category, endTime, durationMinutes: duration, notes, cmmsWorkOrderId,
  });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "updated", entityType: "ops_downtime_event", entityId: id, entityName: event.reason }).catch(() => {});
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const event = await dbOpsDowntimeEvents.getById(id, auth.payload.tenantId!);
  if (!event) return NextResponse.json({ error: "Downtime event not found" }, { status: 404 });

  await dbOpsDowntimeEvents.delete(id, auth.payload.tenantId!);

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "deleted", entityType: "ops_downtime_event", entityId: id, entityName: event.reason }).catch(() => {});
  return NextResponse.json({ ok: true });
}
