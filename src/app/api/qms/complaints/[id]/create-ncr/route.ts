import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsComplaints, dbQmsNcrs, nextQmsNumber } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QM = ["quality_manager", "admin", "owner"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json();

  const complaint = await dbQmsComplaints.getById(id, auth.payload.tenantId!);
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  if (complaint.ncr_id) return NextResponse.json({ error: "NCR already created for this complaint" }, { status: 400 });

  const ncrId = crypto.randomUUID();
  const now = new Date().toISOString();
  const ncrNumber = await nextQmsNumber(auth.payload.tenantId!, "NCR");

  await dbQmsNcrs.create({
    id: ncrId, tenantId: auth.payload.tenantId!, ncrNumber,
    lotId: complaint.lot_id ?? undefined,
    complaintId: id,
    source: "customer_complaint",
    severity: body.severity || "major",
    title: body.title || `Customer complaint: ${complaint.customer_name}`,
    description: complaint.description,
    affectedMaterialType: undefined,
    affectedQuantityKg: undefined,
    assignedToId: body.assignedToId,
    createdById: auth.payload.userId,
    dueDate: body.dueDate,
    createdAt: now,
  });

  await dbQmsNcrs.addActivity({
    id: crypto.randomUUID(), ncrId, userId: auth.payload.userId,
    action: "NCR created from customer complaint", notes: `Complaint #${complaint.complaint_number}`, createdAt: now,
  });

  // Link NCR to complaint and update status
  await dbQmsComplaints.update(id, auth.payload.tenantId!, { status: "ncr_created", ncr_id: ncrId });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "qms_ncr", entityId: ncrId, entityName: ncrNumber }).catch(() => {});
  return NextResponse.json({ ncrId, ncrNumber }, { status: 201 });
}
