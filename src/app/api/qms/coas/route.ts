import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsCoas, dbQmsLots, dbQmsInspections, dbQmsCustomerSpecs, nextQmsNumber } from "@/lib/db-qms";
import { initDb, dbUsers } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QM = ["quality_manager", "admin", "owner"] as const;
const QT = ["quality_tech", "quality_manager", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...QT]);
  if (!auth.ok) return auth.response;
  await initDb();
  const data = await dbQmsCoas.getAll(auth.payload.tenantId!);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const body = await request.json();
  const { lotId } = body;
  if (!lotId) return NextResponse.json({ error: "lotId is required" }, { status: 400 });

  const lot = await dbQmsLots.getById(lotId, auth.payload.tenantId!);
  if (!lot) return NextResponse.json({ error: "Lot not found" }, { status: 404 });
  if (lot.status !== "approved") {
    return NextResponse.json({ error: "Lot must be approved before generating COA" }, { status: 400 });
  }

  const existing = await dbQmsCoas.getByLotId(lotId, auth.payload.tenantId!);
  if (existing) return NextResponse.json({ error: "COA already exists for this lot" }, { status: 409 });

  // Fetch approved inspection for this lot
  const inspections = await dbQmsInspections.getAll(auth.payload.tenantId!, { lotId, status: "approved" });
  const inspection = inspections[0];
  if (!inspection) return NextResponse.json({ error: "No approved inspection found for this lot" }, { status: 400 });

  const inspDetail = await dbQmsInspections.getById(inspection.id, auth.payload.tenantId!);

  // Fetch customer specs if customer name available
  let customerSpecs: Array<{ parameter_id: string; min_value: number; max_value: number }> = [];
  if (lot.customer_po_number) {
    customerSpecs = (await dbQmsCustomerSpecs.getAll(auth.payload.tenantId!)) as typeof customerSpecs;
  }

  // Build inspection summary
  type InspResult = { parameter_name: string; unit?: string; value: string; numeric_value?: number; is_within_spec?: boolean; is_flagged?: boolean; parameter_id: string };
  const results = ((inspDetail?.results ?? []) as InspResult[]).map((r) => {
    const custSpec = customerSpecs.find((cs) => cs.parameter_id === r.parameter_id);
    return {
      parameterName: r.parameter_name,
      unit: r.unit,
      value: r.value,
      numericValue: r.numeric_value,
      isWithinSpec: r.is_within_spec,
      isFlagged: r.is_flagged,
      customerMinValue: custSpec?.min_value,
      customerMaxValue: custSpec?.max_value,
    };
  });

  const inspectionSummary = {
    inspectionId: inspection.id,
    overallResult: inspection.overall_result,
    submittedAt: inspection.submitted_at,
    results,
  };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const coaNumber = await nextQmsNumber(auth.payload.tenantId!, "COA");
  const generatedBy = await dbUsers.getById(auth.payload.userId);

  await dbQmsCoas.create({
    id, tenantId: auth.payload.tenantId!, coaNumber, lotId,
    shipmentId: lot.shipment_id ?? undefined,
    customerName: body.customerName || lot.customer_po_number,
    customerPoNumber: lot.customer_po_number,
    materialType: lot.material_type_name,
    inspectionSummary,
    generatedById: auth.payload.userId,
    issuedAt: now,
  });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "qms_coa", entityId: id, entityName: coaNumber }).catch(() => {});

  return NextResponse.json({ id, coaNumber, generatedByName: generatedBy?.fullName }, { status: 201 });
}
