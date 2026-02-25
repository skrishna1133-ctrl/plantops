import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsComplaints, nextQmsNumber } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QM = ["quality_manager", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();
  const data = await dbQmsComplaints.getAll(auth.payload.tenantId!);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const body = await request.json();
  const { customerName, customerPoNumber, lotId, materialTypeId, description, claimedIssue, receivedDate } = body;
  if (!customerName || !description || !receivedDate) {
    return NextResponse.json({ error: "customerName, description, and receivedDate are required" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const complaintNumber = await nextQmsNumber(auth.payload.tenantId!, "CC");

  await dbQmsComplaints.create({
    id, tenantId: auth.payload.tenantId!, complaintNumber, customerName, customerPoNumber,
    lotId, materialTypeId, description, claimedIssue, receivedDate,
    createdById: auth.payload.userId, createdAt: now,
  });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "qms_complaint", entityId: id, entityName: complaintNumber }).catch(() => {});
  return NextResponse.json({ id, complaintNumber }, { status: 201 });
}
