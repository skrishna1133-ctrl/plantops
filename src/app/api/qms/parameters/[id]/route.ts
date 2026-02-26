import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsParameters } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QM = ["quality_manager", "admin", "owner"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json();
  const { name, unit, description, formula } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  await dbQmsParameters.update(id, auth.payload.tenantId!, { name, unit, description, formula: formula || null });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "updated", entityType: "qms_parameter", entityId: id, entityName: name }).catch(() => {});
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  // dependentIds: IDs of calculated parameters whose formulas reference this parameter
  const dependentIds: string[] = Array.isArray(body.dependentIds) ? body.dependentIds : [];

  const toDelete = [id, ...dependentIds];
  await dbQmsParameters.deleteByIds(toDelete, auth.payload.tenantId!);

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "deleted", entityType: "qms_parameter", entityId: id, entityName: id }).catch(() => {});
  return NextResponse.json({ success: true, deletedCount: toDelete.length });
}
