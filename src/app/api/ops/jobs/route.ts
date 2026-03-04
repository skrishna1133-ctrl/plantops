import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbOpsJobs, nextOpsNumber } from "@/lib/db-ops";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const MANAGER = ["owner", "admin", "engineer"] as const;
const ALL_OPS = ["owner", "admin", "engineer", "shipping", "receiving", "quality_manager", "quality_tech", "worker"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...ALL_OPS]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const jobType = searchParams.get("jobType") ?? undefined;
  const data = await dbOpsJobs.getAll(auth.payload.tenantId!, { status, jobType });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER]);
  if (!auth.ok) return auth.response;
  await initDb();

  const body = await request.json();
  const { jobType, customerId, vendorId, customerPoNumber, ourPoNumber,
          materialTypeId, description, notes, targetWeight, targetWeightUnit,
          expectedStartDate, expectedEndDate } = body;

  if (!jobType || !["toll", "purchase"].includes(jobType)) {
    return NextResponse.json({ error: "jobType must be 'toll' or 'purchase'" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const jobNumber = await nextOpsNumber(auth.payload.tenantId!, "JOB");

  await dbOpsJobs.create({
    id, tenantId: auth.payload.tenantId!, jobNumber, jobType,
    customerId, vendorId, customerPoNumber, ourPoNumber,
    materialTypeId, description, notes,
    targetWeight, targetWeightUnit: targetWeightUnit ?? "lbs",
    expectedStartDate, expectedEndDate,
    createdById: auth.payload.userId, createdAt: now, updatedAt: now,
  });

  await dbOpsJobs.addStatusHistory({
    id: crypto.randomUUID(), jobId: id,
    toStatus: "open", changedById: auth.payload.userId, changedAt: now,
  });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "ops_job", entityId: id, entityName: jobNumber }).catch(() => {});
  return NextResponse.json({ id, jobNumber }, { status: 201 });
}
