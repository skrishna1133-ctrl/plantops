import { NextRequest, NextResponse } from "next/server";
import { dbShipments } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { logActivity } from "@/lib/db-activity";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, ["shipping", "admin", "owner"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json();

  const updated = await dbShipments.update(id, body, auth.payload.tenantId);
  if (!updated) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  logActivity({ tenantId: auth.payload.tenantId, userId: auth.payload.userId, role: auth.payload.role,
    action: "updated", entityType: "shipment", entityId: id, entityName: id }).catch(() => {});
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, ["admin", "owner"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const deleted = await dbShipments.delete(id, auth.payload.tenantId);
  if (!deleted) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  logActivity({ tenantId: auth.payload.tenantId, userId: auth.payload.userId, role: auth.payload.role,
    action: "deleted", entityType: "shipment", entityId: id, entityName: id }).catch(() => {});
  return NextResponse.json({ success: true });
}
