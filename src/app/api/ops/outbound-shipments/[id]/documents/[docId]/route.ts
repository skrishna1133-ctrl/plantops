import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbOpsShipmentDocuments } from "@/lib/db-ops";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const SHIPPING = ["owner", "admin", "engineer", "shipping"] as const;

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const auth = await requireAuth(request, [...SHIPPING]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { docId } = await params;
  await dbOpsShipmentDocuments.delete(docId, auth.payload.tenantId!);

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "deleted", entityType: "ops_shipment_document", entityId: docId, entityName: docId }).catch(() => {});
  return NextResponse.json({ ok: true });
}
