import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { dbShipments } from "@/lib/db";

const shipmentRoles = ["shipping", "admin", "owner"];

async function requireShipmentAccess(request: NextRequest) {
  const session = request.cookies.get("plantops_session")?.value;
  if (!session) return null;
  const payload = await verifySessionToken(session);
  if (!payload || !shipmentRoles.includes(payload.role)) return null;
  return payload;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireShipmentAccess(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const updated = await dbShipments.update(id, body);
  if (!updated) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = request.cookies.get("plantops_session")?.value;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const payload = await verifySessionToken(session);
  if (!payload || (payload.role !== "admin" && payload.role !== "owner")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const deleted = await dbShipments.delete(id);
  if (!deleted) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
