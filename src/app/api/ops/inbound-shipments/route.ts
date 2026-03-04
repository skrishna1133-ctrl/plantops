import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbOpsInboundShipments, nextOpsNumber } from "@/lib/db-ops";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const MANAGER = ["owner", "admin", "engineer"] as const;
const RECEIVING = ["owner", "admin", "engineer", "receiving", "shipping"] as const;
const ALL_OPS = ["owner", "admin", "engineer", "shipping", "receiving", "quality_manager", "quality_tech", "worker"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...ALL_OPS]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId") ?? undefined;
  const data = await dbOpsInboundShipments.getAll(auth.payload.tenantId!, jobId);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...RECEIVING, ...MANAGER]);
  if (!auth.ok) return auth.response;
  await initDb();

  const body = await request.json();
  const { jobId, vendorId, carrierId, carrierName, driverName, truckNumber,
          trailerNumber, scheduledDate, locationId, notes } = body;

  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const shipmentNumber = await nextOpsNumber(auth.payload.tenantId!, "SHP-IN", true);

  await dbOpsInboundShipments.create({
    id, tenantId: auth.payload.tenantId!, shipmentNumber, jobId,
    vendorId, carrierId, carrierName, driverName, truckNumber, trailerNumber,
    scheduledDate, locationId, notes,
    createdById: auth.payload.userId, createdAt: now, updatedAt: now,
  });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "ops_inbound_shipment", entityId: id, entityName: shipmentNumber }).catch(() => {});
  return NextResponse.json({ id, shipmentNumber }, { status: 201 });
}
