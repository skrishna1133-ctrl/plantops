import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsInspections, dbQmsTemplates, dbQmsLots } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QT = ["quality_tech", "quality_manager", "admin", "owner"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QT]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json();
  const { results: rawResults } = body; // Array of { parameterId, value, notes }

  const inspection = await dbQmsInspections.getById(id, auth.payload.tenantId!);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  if (inspection.status !== "draft") {
    return NextResponse.json({ error: "Only draft inspections can be submitted" }, { status: 400 });
  }

  // Load template items for min/max spec checking
  const template = await dbQmsTemplates.getById(inspection.template_id, auth.payload.tenantId!);
  const itemMap: Record<string, { min_value: number | null; max_value: number | null; parameter_type: string }> = {};
  for (const item of template?.items ?? []) {
    itemMap[item.parameter_id] = {
      min_value: item.min_value,
      max_value: item.max_value,
      parameter_type: item.parameter_type,
    };
  }

  // Evaluate each result
  const evaluatedResults = (rawResults ?? []).map((r: { parameterId: string; value: string; notes?: string }) => {
    const spec = itemMap[r.parameterId];
    const paramType = spec?.parameter_type ?? "text";
    let numericValue: number | undefined;
    let isWithinSpec: boolean | undefined;
    let isFlagged = false;

    if (paramType === "numeric" || paramType === "percentage" || paramType === "visual_rating") {
      numericValue = parseFloat(r.value);
      if (!isNaN(numericValue)) {
        const belowMin = spec?.min_value != null && numericValue < spec.min_value;
        const aboveMax = spec?.max_value != null && numericValue > spec.max_value;
        isWithinSpec = !belowMin && !aboveMax;
        isFlagged = !isWithinSpec;
      }
    } else if (paramType === "pass_fail") {
      const v = r.value?.toUpperCase();
      isWithinSpec = v === "PASS";
      isFlagged = v === "FAIL";
    }

    return {
      id: crypto.randomUUID(),
      parameterId: r.parameterId,
      value: r.value,
      numericValue,
      isWithinSpec,
      isFlagged,
      notes: r.notes,
    };
  });

  const anyFlagged = evaluatedResults.some((r: { isFlagged: boolean }) => r.isFlagged);
  const overallResult = anyFlagged ? "FAIL" : "PASS";
  const now = new Date().toISOString();

  await dbQmsInspections.submit(id, auth.payload.tenantId!, evaluatedResults, overallResult, now);

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "submitted", entityType: "qms_inspection", entityId: id, entityName: inspection.lot_number }).catch(() => {});
  return NextResponse.json({ overallResult, flaggedCount: evaluatedResults.filter((r: { isFlagged: boolean }) => r.isFlagged).length });
}
