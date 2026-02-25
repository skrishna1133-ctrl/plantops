import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsComplaints } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QM = ["quality_manager", "admin", "owner"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json();
  const { resolution } = body;
  if (!resolution) return NextResponse.json({ error: "resolution is required" }, { status: 400 });

  const complaint = await dbQmsComplaints.getById(id, auth.payload.tenantId!);
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });

  const now = new Date().toISOString();
  await dbQmsComplaints.update(id, auth.payload.tenantId!, { status: "resolved", resolution, resolvedAt: now });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "resolved", entityType: "qms_complaint", entityId: id, entityName: complaint.complaint_number }).catch(() => {});
  return NextResponse.json({ success: true });
}
