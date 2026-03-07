import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbOpsOutboundShipments } from "@/lib/db-ops";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";
import { sql } from "@vercel/postgres";

const SHIPPING = ["owner", "admin", "engineer", "shipping"] as const;
const ALL_OPS = ["owner", "admin", "engineer", "shipping", "receiving", "quality_manager", "quality_tech", "worker"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...ALL_OPS]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const shipment = await dbOpsOutboundShipments.getById(id, auth.payload.tenantId!);
  if (!shipment) return NextResponse.json({ error: "Outbound shipment not found" }, { status: 404 });

  // Get linked lots
  const lots = await sql`
    SELECT ol.*, l.lot_number, l.status AS lot_status, mt.name AS material_type_name
    FROM ops_outbound_lots ol
    JOIN ops_lots l ON l.id = ol.lot_id
    LEFT JOIN qms_material_types mt ON mt.id = l.material_type_id
    WHERE ol.outbound_shipment_id = ${id}
  `;

  return NextResponse.json({ ...shipment, lots: lots.rows });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...SHIPPING]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json();

  const shipment = await dbOpsOutboundShipments.getById(id, auth.payload.tenantId!);
  if (!shipment) return NextResponse.json({ error: "Outbound shipment not found" }, { status: 404 });

  const now = new Date().toISOString();
  const updates = { ...body, updatedAt: now };

  // Auto-set timestamps based on status transitions
  if (body.status === "staged" && !shipment.staged_date) updates.stagedDate = now;
  if (body.status === "shipped" && !shipment.shipped_date) updates.shippedDate = now;
  if (body.status === "delivered" && !shipment.delivered_date) updates.deliveredDate = now;

  await dbOpsOutboundShipments.update(id, auth.payload.tenantId!, updates);

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "updated", entityType: "ops_outbound_shipment", entityId: id, entityName: shipment.shipment_number }).catch(() => {});
  return NextResponse.json({ ok: true });
}
