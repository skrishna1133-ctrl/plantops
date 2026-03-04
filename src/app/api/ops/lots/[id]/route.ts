import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbOpsLots } from "@/lib/db-ops";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const MANAGER = ["owner", "admin", "engineer"] as const;
const ALL_OPS = ["owner", "admin", "engineer", "shipping", "receiving", "quality_manager", "quality_tech", "worker"] as const;

const VALID_STATUSES = ["pending", "in_storage", "in_production", "qc_hold", "approved", "shipped", "rejected"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...ALL_OPS]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const lot = await dbOpsLots.getById(id, auth.payload.tenantId!);
  if (!lot) return NextResponse.json({ error: "Lot not found" }, { status: 404 });
  return NextResponse.json(lot);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json();

  const lot = await dbOpsLots.getById(id, auth.payload.tenantId!);
  if (!lot) return NextResponse.json({ error: "Lot not found" }, { status: 404 });

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await dbOpsLots.update(id, auth.payload.tenantId!, { ...body, updatedAt: now });

  if (body.status && body.status !== lot.status) {
    await dbOpsLots.addStatusHistory({
      id: crypto.randomUUID(), lotId: id,
      fromStatus: lot.status, toStatus: body.status,
      notes: body.statusNotes, changedById: auth.payload.userId, changedAt: now,
    });
  }

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "updated", entityType: "ops_lot", entityId: id, entityName: lot.lot_number }).catch(() => {});
  return NextResponse.json({ ok: true });
}
