import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsNcrs } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QT = ["quality_tech", "quality_manager", "admin", "owner"] as const;
const QM = ["quality_manager", "admin", "owner"] as const;

const NCR_TRANSITIONS: Record<string, string[]> = {
  open: ["under_investigation", "cancelled"],
  under_investigation: ["corrective_action_pending", "cancelled"],
  corrective_action_pending: ["corrective_action_taken"],
  corrective_action_taken: ["under_investigation", "closed"],
  closed: [],
  cancelled: [],
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QT]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const ncr = await dbQmsNcrs.getById(id, auth.payload.tenantId!);
  if (!ncr) return NextResponse.json({ error: "NCR not found" }, { status: 404 });
  return NextResponse.json(ncr);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json();
  const now = new Date().toISOString();

  const ncr = await dbQmsNcrs.getById(id, auth.payload.tenantId!);
  if (!ncr) return NextResponse.json({ error: "NCR not found" }, { status: 404 });

  // If status is changing, validate transition
  if (body.status && body.status !== ncr.status) {
    const allowed = NCR_TRANSITIONS[ncr.status] ?? [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json({ error: `Cannot transition from ${ncr.status} to ${body.status}` }, { status: 400 });
    }
    // Auto-add activity for status change
    await dbQmsNcrs.addActivity({
      id: crypto.randomUUID(), ncrId: id, userId: auth.payload.userId,
      action: `Status changed to ${body.status}`, notes: body.activityNotes, createdAt: now,
    });
  }

  await dbQmsNcrs.update(id, auth.payload.tenantId!, { ...body, updatedAt: now });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "updated", entityType: "qms_ncr", entityId: id, entityName: ncr.ncr_number }).catch(() => {});
  return NextResponse.json({ success: true });
}
