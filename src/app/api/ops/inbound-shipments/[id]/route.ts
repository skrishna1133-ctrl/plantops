import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbOpsInboundShipments } from "@/lib/db-ops";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const RECEIVING = ["owner", "admin", "engineer", "receiving", "shipping"] as const;
const ALL_OPS = ["owner", "admin", "engineer", "shipping", "receiving", "quality_manager", "quality_tech", "worker"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...ALL_OPS]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const shipment = await dbOpsInboundShipments.getById(id, auth.payload.tenantId!);
  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const weightEntries = await dbOpsInboundShipments.getWeightEntries(id);
  return NextResponse.json({ ...shipment, weightEntries });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...RECEIVING]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json();

  const shipment = await dbOpsInboundShipments.getById(id, auth.payload.tenantId!);
  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const now = new Date().toISOString();
  await dbOpsInboundShipments.update(id, auth.payload.tenantId!, { ...body, updatedAt: now });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "updated", entityType: "ops_inbound_shipment", entityId: id, entityName: shipment.shipment_number }).catch(() => {});
  return NextResponse.json({ ok: true });
}
