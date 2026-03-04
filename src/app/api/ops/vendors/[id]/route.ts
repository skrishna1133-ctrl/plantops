import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbOpsVendors } from "@/lib/db-ops";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const MANAGER = ["owner", "admin", "engineer"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json();
  await dbOpsVendors.update(id, auth.payload.tenantId!, body);

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "updated", entityType: "ops_vendor", entityId: id, entityName: body.name ?? id }).catch(() => {});
  return NextResponse.json({ ok: true });
}
