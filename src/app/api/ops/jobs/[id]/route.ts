import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbOpsJobs } from "@/lib/db-ops";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const MANAGER = ["owner", "admin", "engineer"] as const;
const ALL_OPS = ["owner", "admin", "engineer", "shipping", "receiving", "quality_manager", "quality_tech", "worker"] as const;

const VALID_STATUSES = ["open", "in_progress", "on_hold", "completed", "cancelled"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request, [...ALL_OPS]);
    if (!auth.ok) return auth.response;
    await initDb();

    const { id } = await params;
    const job = await dbOpsJobs.getById(id, auth.payload.tenantId!);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const history = await dbOpsJobs.getStatusHistory(id);
    return NextResponse.json({ ...job, statusHistory: history });
  } catch (err) {
    console.error("GET /api/ops/jobs/[id]:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json();

  const job = await dbOpsJobs.getById(id, auth.payload.tenantId!);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await dbOpsJobs.update(id, auth.payload.tenantId!, { ...body, updatedAt: now });

  if (body.status && body.status !== job.status) {
    await dbOpsJobs.addStatusHistory({
      id: crypto.randomUUID(), jobId: id,
      fromStatus: job.status, toStatus: body.status,
      notes: body.statusNotes, changedById: auth.payload.userId, changedAt: now,
    });
  }

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "updated", entityType: "ops_job", entityId: id, entityName: job.job_number }).catch(() => {});
  const updatedJob = await dbOpsJobs.getById(id, auth.payload.tenantId!);
  return NextResponse.json(updatedJob);
}
