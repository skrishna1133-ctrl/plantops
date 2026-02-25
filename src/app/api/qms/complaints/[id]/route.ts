import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsComplaints } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QM = ["quality_manager", "admin", "owner"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const complaint = await dbQmsComplaints.getById(id, auth.payload.tenantId!);
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  return NextResponse.json(complaint);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json();

  const complaint = await dbQmsComplaints.getById(id, auth.payload.tenantId!);
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });

  await dbQmsComplaints.update(id, auth.payload.tenantId!, body);

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "updated", entityType: "qms_complaint", entityId: id, entityName: complaint.complaint_number }).catch(() => {});
  return NextResponse.json({ success: true });
}
