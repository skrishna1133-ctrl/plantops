import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsLots, nextQmsNumber } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QT = ["quality_tech", "quality_manager", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...QT]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { searchParams } = request.nextUrl;
  const filters: { status?: string; materialTypeId?: string } = {};
  if (searchParams.get("status")) filters.status = searchParams.get("status")!;
  if (searchParams.get("materialTypeId")) filters.materialTypeId = searchParams.get("materialTypeId")!;

  const data = await dbQmsLots.getAll(auth.payload.tenantId!, filters);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...QT]);
  if (!auth.ok) return auth.response;
  await initDb();

  const body = await request.json();
  const { customerPoNumber, materialTypeId, productionLineId, inputWeightKg, notes } = body;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const lotNumber = await nextQmsNumber(auth.payload.tenantId!, "LOT");

  await dbQmsLots.create({
    id, tenantId: auth.payload.tenantId!, lotNumber, customerPoNumber,
    materialTypeId, productionLineId, inputWeightKg, notes,
    createdById: auth.payload.userId, createdAt: now,
  });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "qms_lot", entityId: id, entityName: lotNumber }).catch(() => {});
  return NextResponse.json({ id, lotNumber }, { status: 201 });
}
