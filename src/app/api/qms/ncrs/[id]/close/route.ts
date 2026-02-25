import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsNcrs } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QM = ["quality_manager", "admin", "owner"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json();
  const ncr = await dbQmsNcrs.getById(id, auth.payload.tenantId!);
  if (!ncr) return NextResponse.json({ error: "NCR not found" }, { status: 404 });
  if (ncr.status === "closed") return NextResponse.json({ error: "NCR already closed" }, { status: 400 });

  const now = new Date().toISOString();
  await dbQmsNcrs.close(id, auth.payload.tenantId!, auth.payload.userId, now);
  await dbQmsNcrs.addActivity({
    id: crypto.randomUUID(), ncrId: id, userId: auth.payload.userId,
    action: "NCR closed", notes: body.notes, createdAt: now,
  });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "closed", entityType: "qms_ncr", entityId: id, entityName: ncr.ncr_number }).catch(() => {});
  return NextResponse.json({ success: true });
}
