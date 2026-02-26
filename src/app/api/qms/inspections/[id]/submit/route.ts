import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsInspections, dbQmsTemplates, dbQmsLots } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";
import { evaluateFormula } from "@/lib/formula-eval";
import { computeStatistic } from "@/lib/qms-statistics";

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
  const itemMap: Record<string, { min_value: number | null; max_value: number | null; parameter_type: string; parameter_code: string; formula: string | null; parameter_name: string; reading_count: number; statistic: string }> = {};
  for (const item of template?.items ?? []) {
    itemMap[item.parameter_id] = {
      min_value: item.min_value,
      max_value: item.max_value,
      parameter_type: item.parameter_type,
      parameter_code: item.parameter_code,
      formula: item.formula ?? null,
      parameter_name: item.parameter_name,
      reading_count: item.reading_count ?? 1,
      statistic: item.statistic ?? "average",
    };
  }

  function evaluateResult(paramType: string, value: string, spec: { min_value: number | null; max_value: number | null }) {
    let numericValue: number | undefined;
    let isWithinSpec: boolean | undefined;
    let isFlagged = false;

    if (paramType === "numeric" || paramType === "percentage" || paramType === "visual_rating" || paramType === "calculated") {
      numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        const belowMin = spec.min_value != null && numericValue < spec.min_value;
        const aboveMax = spec.max_value != null && numericValue > spec.max_value;
        isWithinSpec = !belowMin && !aboveMax;
        isFlagged = !isWithinSpec;
      }
    } else if (paramType === "pass_fail") {
      const v = value?.toUpperCase();
      isWithinSpec = v === "PASS";
      isFlagged = v === "FAIL";
    } else if (paramType === "photo") {
      isWithinSpec = !!value;
      isFlagged = false;
    }

    return { numericValue, isWithinSpec, isFlagged };
  }

  // Evaluate manually-entered results
  const evaluatedResults = (rawResults ?? []).map((r: { parameterId: string; value: string; notes?: string }) => {
    const spec = itemMap[r.parameterId];
    const paramType = spec?.parameter_type ?? "text";

    // Handle multi-reading: value is a JSON array — compute chosen statistic for spec check
    let valueForEval = r.value;
    if ((spec?.reading_count ?? 1) > 1 && (paramType === "numeric" || paramType === "percentage" || paramType === "visual_rating")) {
      try {
        const readings = JSON.parse(r.value) as number[];
        if (Array.isArray(readings) && readings.length > 0) {
          const computed = computeStatistic(readings, spec?.statistic ?? "average");
          if (computed !== null) valueForEval = computed.toFixed(6).replace(/\.?0+$/, "");
        }
      } catch { /* not JSON, use as-is */ }
    }

    const { numericValue, isWithinSpec, isFlagged } = evaluateResult(paramType, valueForEval, spec ?? { min_value: null, max_value: null });
    return {
      id: crypto.randomUUID(),
      parameterId: r.parameterId,
      value: r.value,      // keep original (JSON array string for multi-reading)
      numericValue,        // average for multi-reading, single value otherwise
      isWithinSpec,
      isFlagged,
      notes: r.notes,
    };
  });

  // Build a code→numericValue map for formula evaluation
  const codeValues: Record<string, number> = {};
  for (const r of evaluatedResults) {
    const code = itemMap[r.parameterId]?.parameter_code;
    if (code && r.numericValue != null) codeValues[code] = r.numericValue;
  }

  // Evaluate calculated parameters (those not in rawResults)
  const submittedIds = new Set((rawResults ?? []).map((r: { parameterId: string }) => r.parameterId));
  for (const [parameterId, spec] of Object.entries(itemMap)) {
    if (spec.parameter_type !== "calculated" || submittedIds.has(parameterId)) continue;
    if (!spec.formula) continue;

    try {
      const computed = evaluateFormula(spec.formula, codeValues);
      const value = computed.toFixed(4).replace(/\.?0+$/, "");
      const { numericValue, isWithinSpec, isFlagged } = evaluateResult("calculated", value, spec);
      evaluatedResults.push({
        id: crypto.randomUUID(),
        parameterId,
        value,
        numericValue,
        isWithinSpec,
        isFlagged,
        notes: undefined,
      });
      // Make this value available to downstream formulas
      if (spec.parameter_code) codeValues[spec.parameter_code] = computed;
    } catch {
      // If formula cannot be evaluated (e.g. missing source), skip silently
    }
  }

  const anyFlagged = evaluatedResults.some((r: { isFlagged: boolean }) => r.isFlagged);
  const overallResult = anyFlagged ? "FAIL" : "PASS";
  const now = new Date().toISOString();

  await dbQmsInspections.submit(id, auth.payload.tenantId!, evaluatedResults, overallResult, now);

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "submitted", entityType: "qms_inspection", entityId: id, entityName: inspection.lot_number }).catch(() => {});
  return NextResponse.json({ overallResult, flaggedCount: evaluatedResults.filter((r: { isFlagged: boolean }) => r.isFlagged).length });
}
