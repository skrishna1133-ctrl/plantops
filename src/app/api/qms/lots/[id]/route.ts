import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsLots } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QT = ["quality_tech", "quality_manager", "admin", "owner"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QT]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const lot = await dbQmsLots.getById(id, auth.payload.tenantId!);
  if (!lot) return NextResponse.json({ error: "Lot not found" }, { status: 404 });
  return NextResponse.json(lot);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QT]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json();
  const now = new Date().toISOString();

  await dbQmsLots.update(id, auth.payload.tenantId!, { ...body, updatedAt: now });

  const lot = await dbQmsLots.getById(id, auth.payload.tenantId!);
  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "updated", entityType: "qms_lot", entityId: id, entityName: lot?.lot_number || id }).catch(() => {});
  return NextResponse.json(lot);
}
