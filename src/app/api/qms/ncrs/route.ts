import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsNcrs, nextQmsNumber } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const ALL = ["worker", "quality_tech", "quality_manager", "admin", "owner"] as const;
const QT = ["quality_tech", "quality_manager", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...QT]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { searchParams } = request.nextUrl;
  const filters: { status?: string; assignedToId?: string; severity?: string } = {};
  if (searchParams.get("status")) filters.status = searchParams.get("status")!;
  if (searchParams.get("severity")) filters.severity = searchParams.get("severity")!;
  // Techs only see their assigned NCRs
  if (auth.payload.role === "quality_tech") {
    filters.assignedToId = auth.payload.userId;
  }

  const data = await dbQmsNcrs.getAll(auth.payload.tenantId!, filters);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...ALL]);
  if (!auth.ok) return auth.response;
  await initDb();

  const body = await request.json();
  let { source, severity, title, description, lotId, inspectionId, complaintId,
        affectedMaterialType, affectedQuantityKg, assignedToId, dueDate } = body;

  // Workers can only create operator_report NCRs
  if (auth.payload.role === "worker") {
    source = "operator_report";
    severity = body.severity || "minor";
  }

  if (!title || !source || !severity) {
    return NextResponse.json({ error: "title, source, and severity are required" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const ncrNumber = await nextQmsNumber(auth.payload.tenantId!, "NCR");

  await dbQmsNcrs.create({
    id, tenantId: auth.payload.tenantId!, ncrNumber, lotId, inspectionId, complaintId,
    source, severity, title, description, affectedMaterialType, affectedQuantityKg,
    assignedToId, createdById: auth.payload.userId, dueDate, createdAt: now,
  });

  // Auto-create opening activity
  await dbQmsNcrs.addActivity({
    id: crypto.randomUUID(), ncrId: id, userId: auth.payload.userId,
    action: "NCR opened", notes: `Source: ${source}, Severity: ${severity}`, createdAt: now,
  });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "qms_ncr", entityId: id, entityName: ncrNumber }).catch(() => {});
  return NextResponse.json({ id, ncrNumber }, { status: 201 });
}
