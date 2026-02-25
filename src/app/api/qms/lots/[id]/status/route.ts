import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsLots } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QM = ["quality_manager", "admin", "owner"] as const;

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_qc: ["on_hold"],
  qc_in_progress: ["approved", "rejected", "on_hold"],
  on_hold: ["approved", "rejected", "qc_in_progress"],
  approved: ["shipped"],
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const { status } = await request.json();
  if (!status) return NextResponse.json({ error: "status is required" }, { status: 400 });

  const lot = await dbQmsLots.getById(id, auth.payload.tenantId!);
  if (!lot) return NextResponse.json({ error: "Lot not found" }, { status: 404 });

  const allowed = VALID_TRANSITIONS[lot.status] ?? [];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: `Cannot transition from ${lot.status} to ${status}` }, { status: 400 });
  }

  const now = new Date().toISOString();
  await dbQmsLots.updateStatus(id, auth.payload.tenantId!, status, now);

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: `lot_${status}`, entityType: "qms_lot", entityId: id, entityName: lot.lot_number }).catch(() => {});
  return NextResponse.json({ success: true, status });
}
