import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsInspections, dbQmsLots, dbQmsNcrs } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QM = ["quality_manager", "admin", "owner"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json();
  const { reviewNotes } = body;

  const inspection = await dbQmsInspections.getById(id, auth.payload.tenantId!);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  if (inspection.status !== "submitted") {
    return NextResponse.json({ error: "Only submitted inspections can be approved" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await dbQmsInspections.approve(id, auth.payload.tenantId!, auth.payload.userId, reviewNotes, now);

  // Check for open NCRs on this lot
  const openNcrs = await dbQmsNcrs.getAll(auth.payload.tenantId!, {
    status: "open",
  });
  const lotOpenNcrs = openNcrs.filter((n) => n.lot_id === inspection.lot_id);

  let newLotStatus: string;
  if (lotOpenNcrs.length > 0) {
    newLotStatus = "on_hold";
  } else {
    newLotStatus = "approved";
  }
  await dbQmsLots.updateStatus(inspection.lot_id, auth.payload.tenantId!, newLotStatus, now);

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "approved", entityType: "qms_inspection", entityId: id, entityName: inspection.lot_number }).catch(() => {});
  return NextResponse.json({ success: true, lotStatus: newLotStatus });
}
