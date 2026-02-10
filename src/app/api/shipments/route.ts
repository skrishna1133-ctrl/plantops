import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { dbShipments } from "@/lib/db";
import type { Shipment, ShipmentType, ShipmentStatus } from "@/lib/schemas";

const shipmentRoles = ["shipping", "admin", "owner"];

async function requireShipmentAccess(request: NextRequest) {
  const session = request.cookies.get("plantops_session")?.value;
  if (!session) return null;
  const payload = await verifySessionToken(session);
  if (!payload || !shipmentRoles.includes(payload.role)) return null;
  return payload;
}

function generateShipmentId(): string {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SHP-${date}-${random}`;
}

export async function GET(request: NextRequest) {
  const auth = await requireShipmentAccess(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || undefined;
  const status = searchParams.get("status") || undefined;

  const shipments = await dbShipments.getAll({ type, status });
  return NextResponse.json(shipments);
}

export async function POST(request: NextRequest) {
  const auth = await requireShipmentAccess(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const body = await request.json();
    const { type, poNumber, materialCode, supplierName, customerName, carrier, shipmentDate, notes } = body;

    if (!type || !poNumber || !materialCode || !carrier || !shipmentDate) {
      return NextResponse.json({ error: "Required fields missing" }, { status: 400 });
    }

    if (!["incoming", "outgoing"].includes(type)) {
      return NextResponse.json({ error: "Invalid shipment type" }, { status: 400 });
    }

    if (type === "incoming" && !supplierName) {
      return NextResponse.json({ error: "Supplier name required for incoming shipments" }, { status: 400 });
    }
    if (type === "outgoing" && !customerName) {
      return NextResponse.json({ error: "Customer name required for outgoing shipments" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const shipment: Shipment = {
      id: crypto.randomUUID(),
      shipmentId: generateShipmentId(),
      type: type as ShipmentType,
      poNumber,
      materialCode,
      supplierName: supplierName || undefined,
      customerName: customerName || undefined,
      carrier,
      shipmentDate,
      notes: notes || undefined,
      status: "pending" as ShipmentStatus,
      createdAt: now,
      updatedAt: now,
    };

    await dbShipments.create(shipment);
    return NextResponse.json({ shipmentId: shipment.shipmentId, id: shipment.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating shipment:", error);
    return NextResponse.json({ error: "Failed to create shipment" }, { status: 500 });
  }
}
