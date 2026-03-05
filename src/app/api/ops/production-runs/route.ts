import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbOpsProductionRuns, nextOpsNumber } from "@/lib/db-ops";
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
  const data = await dbOpsProductionRuns.getAll(auth.payload.tenantId!, jobId);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER]);
  if (!auth.ok) return auth.response;
  await initDb();

  const body = await request.json();
  const { jobId, productionLineId, processingTypeId, operatorId, supervisorId,
          scheduledStart, inputWeight, inputWeightUnit, notes } = body;

  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const runNumber = await nextOpsNumber(auth.payload.tenantId!, "RUN", true);

  await dbOpsProductionRuns.create({
    id, tenantId: auth.payload.tenantId!, runNumber, jobId,
    productionLineId, processingTypeId, operatorId, supervisorId,
    scheduledStart, inputWeight, inputWeightUnit: inputWeightUnit ?? "lbs",
    notes, createdById: auth.payload.userId, createdAt: now, updatedAt: now,
  });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "ops_production_run", entityId: id, entityName: runNumber }).catch(() => {});
  return NextResponse.json({ id, runNumber }, { status: 201 });
}
