import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbOpsLots, nextOpsNumber } from "@/lib/db-ops";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const MANAGER = ["owner", "admin", "engineer"] as const;
const ALL_OPS = ["owner", "admin", "engineer", "shipping", "receiving", "quality_manager", "quality_tech", "worker"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...ALL_OPS]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId") ?? undefined;
  const data = await dbOpsLots.getAll(auth.payload.tenantId!, jobId);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER]);
  if (!auth.ok) return auth.response;
  await initDb();

  const body = await request.json();
  const { jobId, materialTypeId, inboundWeight, inboundWeightUnit, locationId, notes } = body;

  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const lotNumber = await nextOpsNumber(auth.payload.tenantId!, "LOT", true);

  await dbOpsLots.create({
    id, tenantId: auth.payload.tenantId!, lotNumber, jobId,
    materialTypeId, inboundWeight, inboundWeightUnit: inboundWeightUnit ?? "lbs",
    locationId, notes,
    createdById: auth.payload.userId, createdAt: now, updatedAt: now,
  });

  await dbOpsLots.addStatusHistory({
    id: crypto.randomUUID(), lotId: id,
    toStatus: "pending", changedById: auth.payload.userId, changedAt: now,
  });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "ops_lot", entityId: id, entityName: lotNumber }).catch(() => {});
  return NextResponse.json({ id, lotNumber }, { status: 201 });
}
