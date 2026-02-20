import { NextRequest, NextResponse } from "next/server";
import { dbShipments } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import type { Shipment, ShipmentType, ShipmentStatus } from "@/lib/schemas";

function generateShipmentId(): string {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SHP-${date}-${random}`;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["shipping", "engineer", "admin", "owner"]);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || undefined;
  const status = searchParams.get("status") || undefined;

  let effectiveTenantId = auth.payload.tenantId;
  if (auth.payload.role === "super_admin") {
    const viewAs = searchParams.get("viewAs");
    if (viewAs) effectiveTenantId = viewAs;
  }

  const shipments = await dbShipments.getAll(effectiveTenantId, { type, status });
  return NextResponse.json(shipments);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["shipping", "admin", "owner"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;

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

    await dbShipments.create(shipment, tenantId);
    return NextResponse.json({ shipmentId: shipment.shipmentId, id: shipment.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating shipment:", error);
    return NextResponse.json({ error: "Failed to create shipment" }, { status: 500 });
  }
}
