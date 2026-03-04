import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbOpsInboundShipments } from "@/lib/db-ops";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const RECEIVING = ["owner", "admin", "engineer", "receiving", "shipping", "worker"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...RECEIVING]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id: inboundShipmentId } = await params;
  const body = await request.json();
  const { grossWeight, tareWeight, weightUnit, containerLabel, notes } = body;

  if (grossWeight == null || isNaN(parseFloat(grossWeight))) {
    return NextResponse.json({ error: "grossWeight is required" }, { status: 400 });
  }

  // Calculate net weight
  const gross = parseFloat(grossWeight);
  const tare = tareWeight != null ? parseFloat(tareWeight) : null;
  const net = tare != null ? gross - tare : null;

  // Get next entry number
  const existing = await dbOpsInboundShipments.getWeightEntries(inboundShipmentId);
  const entryNumber = existing.length + 1;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await dbOpsInboundShipments.addWeightEntry({
    id, tenantId: auth.payload.tenantId!, inboundShipmentId, entryNumber,
    grossWeight: gross, tareWeight: tare ?? undefined, netWeight: net ?? undefined,
    weightUnit: weightUnit ?? "lbs", containerLabel, notes,
    enteredById: auth.payload.userId, enteredAt: now,
  });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "added_weight", entityType: "ops_inbound_shipment", entityId: inboundShipmentId,
    entityName: `Entry #${entryNumber}` }).catch(() => {});
  return NextResponse.json({ id, entryNumber, gross, tare, net, weightUnit: weightUnit ?? "lbs" }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, ["owner", "admin", "engineer"] as const);
  if (!auth.ok) return auth.response;
  await initDb();

  const { searchParams } = new URL(request.url);
  const entryId = searchParams.get("entryId");
  if (!entryId) return NextResponse.json({ error: "entryId query param required" }, { status: 400 });

  await dbOpsInboundShipments.deleteWeightEntry(entryId, auth.payload.tenantId!);
  return NextResponse.json({ ok: true });
}
