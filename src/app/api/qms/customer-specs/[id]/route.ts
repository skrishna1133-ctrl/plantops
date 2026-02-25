import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsCustomerSpecs } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QM = ["quality_manager", "admin", "owner"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json();
  await dbQmsCustomerSpecs.update(id, auth.payload.tenantId!, body);

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "updated", entityType: "qms_customer_spec", entityId: id, entityName: id }).catch(() => {});
  return NextResponse.json({ success: true });
}
