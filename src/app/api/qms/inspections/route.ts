import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsInspections, dbQmsLots } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QT = ["quality_tech", "quality_manager", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...QT]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { searchParams } = request.nextUrl;
  const filters: { lotId?: string; status?: string; inspectedById?: string } = {};
  if (searchParams.get("lotId")) filters.lotId = searchParams.get("lotId")!;
  if (searchParams.get("status")) filters.status = searchParams.get("status")!;
  // Quality techs only see their own inspections
  if (auth.payload.role === "quality_tech") {
    filters.inspectedById = auth.payload.userId;
  }

  const data = await dbQmsInspections.getAll(auth.payload.tenantId!, filters);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...QT]);
  if (!auth.ok) return auth.response;
  await initDb();

  const body = await request.json();
  const { lotId, templateId } = body;
  if (!lotId || !templateId) {
    return NextResponse.json({ error: "lotId and templateId are required" }, { status: 400 });
  }

  // Verify lot belongs to tenant
  const lot = await dbQmsLots.getById(lotId, auth.payload.tenantId!);
  if (!lot) return NextResponse.json({ error: "Lot not found" }, { status: 404 });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await dbQmsInspections.create({ id, tenantId: auth.payload.tenantId!, lotId, templateId, inspectedById: auth.payload.userId, createdAt: now });

  // Advance lot to qc_in_progress if still pending_qc
  if (lot.status === "pending_qc") {
    await dbQmsLots.updateStatus(lotId, auth.payload.tenantId!, "qc_in_progress", now);
  }

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "qms_inspection", entityId: id, entityName: lot.lot_number }).catch(() => {});
  return NextResponse.json({ id }, { status: 201 });
}
