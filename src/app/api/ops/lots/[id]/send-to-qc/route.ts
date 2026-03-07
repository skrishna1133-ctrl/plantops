import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbOpsLots } from "@/lib/db-ops";
import { dbQmsLots, nextQmsNumber } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const MANAGER = ["owner", "admin", "engineer"] as const;

// Convert weight to kg
function toKg(weight: number, unit: string): number {
  if (unit === "kg") return weight;
  if (unit === "tons") return weight * 907.185;
  return weight * 0.453592; // lbs (default)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request, [...MANAGER]);
    if (!auth.ok) return auth.response;
    await initDb();

    const { id: opsLotId } = await params;
    const tid = auth.payload.tenantId!;

    const opsLot = await dbOpsLots.getById(opsLotId, tid);
    if (!opsLot) return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    if (opsLot.qms_lot_id) return NextResponse.json({ error: "Lot already sent to QC", qmsLotId: opsLot.qms_lot_id }, { status: 409 });

    const now = new Date().toISOString();
    const qmsLotId = crypto.randomUUID();
    const qmsLotNumber = await nextQmsNumber(tid, "LOT");

    // Convert weight to kg for QMS
    let inputWeightKg: number | undefined;
    if (opsLot.inbound_weight != null) {
      inputWeightKg = toKg(opsLot.inbound_weight, opsLot.inbound_weight_unit ?? "lbs");
    }

    await dbQmsLots.create({
      id: qmsLotId,
      tenantId: tid,
      lotNumber: qmsLotNumber,
      materialTypeId: opsLot.material_type_id ?? undefined,
      inputWeightKg,
      notes: `Created from ops lot ${opsLot.lot_number}`,
      createdById: auth.payload.userId,
      createdAt: now,
    });

    // Link ops lot → QMS lot, set status to qc_hold
    await dbOpsLots.update(opsLotId, tid, { qmsLotId: qmsLotId, status: "qc_hold", updatedAt: now });
    await dbOpsLots.addStatusHistory({
      id: crypto.randomUUID(), lotId: opsLotId,
      fromStatus: opsLot.status, toStatus: "qc_hold",
      notes: `Sent to QC — QMS lot ${qmsLotNumber}`,
      changedById: auth.payload.userId, changedAt: now,
    });

    logActivity({ tenantId: tid, userId: auth.payload.userId, role: auth.payload.role,
      action: "updated", entityType: "ops_lot", entityId: opsLotId,
      entityName: `${opsLot.lot_number} → QC` }).catch(() => {});

    return NextResponse.json({ qmsLotId, qmsLotNumber }, { status: 201 });
  } catch (err) {
    console.error("POST /api/ops/lots/[id]/send-to-qc:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
