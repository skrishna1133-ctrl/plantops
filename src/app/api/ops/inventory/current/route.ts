import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { initDb } from "@/lib/db";
import { sql } from "@vercel/postgres";

const ALLOWED = [
  "receiving", "shipping", "quality_tech", "quality_manager",
  "engineer", "admin", "owner",
] as const;

function toLbs(weight: number | null, unit: string | null): number {
  if (weight == null) return 0;
  if (unit === "kg") return weight * 2.20462;
  return weight;
}

function toKg(weight: number | null, unit: string | null): number {
  if (weight == null) return 0;
  if (unit === "kg") return weight;
  return weight / 2.20462;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...ALLOWED]);
  if (!auth.ok) return auth.response;
  await initDb();

  const tid = auth.payload.tenantId!;

  const { rows } = await sql`
    SELECT
      COALESCE(mt.id::text, 'unknown')     AS material_type_id,
      COALESCE(mt.code,  'UNKNOWN')         AS material_type,
      COALESCE(mt.name, 'Unknown Material') AS material_name,
      loc.id::text                          AS location_id,
      loc.name                              AS location_name,
      loc.type                              AS location_type,
      loc.capacity_lbs,
      ol.id::text                           AS lot_id,
      ol.lot_number,
      ol.status                             AS lot_status,
      ol.inbound_weight,
      ol.inbound_weight_unit,
      ol.created_at                         AS lot_created_at,
      pr.output_weight                      AS run_output_weight,
      pr.output_weight_unit                 AS run_output_weight_unit
    FROM ops_lots ol
    JOIN ops_locations loc ON loc.id = ol.location_id
    LEFT JOIN qms_material_types mt ON mt.id = ol.material_type_id::text
    LEFT JOIN LATERAL (
      SELECT opr.output_weight, opr.output_weight_unit
      FROM ops_run_input_lots oril
      JOIN ops_production_runs opr ON opr.id = oril.run_id
      WHERE oril.lot_id = ol.id
        AND opr.status = 'completed'
        AND opr.output_weight IS NOT NULL
      ORDER BY opr.actual_end DESC NULLS LAST
      LIMIT 1
    ) pr ON true
    WHERE ol.tenant_id = ${tid}
      AND ol.status IN ('in_storage', 'approved')
    ORDER BY mt.name NULLS LAST, loc.name, ol.created_at
  `;

  const now = new Date();

  // ── Group by material type ──────────────────────────────────────────────────
  const materialMap = new Map<string, {
    materialTypeId: string;
    materialType: string;
    materialName: string;
    totalLbs: number;
    totalKg: number;
    lotCount: number;
    byStatus: Record<string, { lbs: number; lotCount: number }>;
    byLocation: Map<string, {
      locationId: string;
      locationName: string;
      locationType: string | null;
      capacityLbs: number | null;
      onHandLbs: number;
      lots: Array<{ lotId: string; lotNumber: string; status: string; weightLbs: number; ageDays: number }>;
    }>;
  }>();

  for (const row of rows) {
    const matKey = row.material_type as string;

    if (!materialMap.has(matKey)) {
      materialMap.set(matKey, {
        materialTypeId: row.material_type_id as string,
        materialType: matKey,
        materialName: row.material_name as string,
        totalLbs: 0,
        totalKg: 0,
        lotCount: 0,
        byStatus: {},
        byLocation: new Map(),
      });
    }
    const mat = materialMap.get(matKey)!;

    // Effective weight for this lot
    let weightLbs: number;
    if (row.lot_status === "approved" && row.run_output_weight != null) {
      weightLbs = toLbs(Number(row.run_output_weight), row.run_output_weight_unit as string);
    } else {
      weightLbs = toLbs(Number(row.inbound_weight), row.inbound_weight_unit as string);
    }
    weightLbs = Math.round(weightLbs);

    const weightKg = Math.round(toKg(weightLbs, "lbs"));

    // Age
    const createdAt = new Date(row.lot_created_at as string);
    const ageDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // Accumulate material totals
    mat.totalLbs += weightLbs;
    mat.totalKg += weightKg;
    mat.lotCount += 1;

    // By status
    const status = row.lot_status as string;
    if (!mat.byStatus[status]) mat.byStatus[status] = { lbs: 0, lotCount: 0 };
    mat.byStatus[status].lbs += weightLbs;
    mat.byStatus[status].lotCount += 1;

    // By location
    const locId = row.location_id as string;
    if (!mat.byLocation.has(locId)) {
      mat.byLocation.set(locId, {
        locationId: locId,
        locationName: row.location_name as string,
        locationType: (row.location_type as string) ?? null,
        capacityLbs: row.capacity_lbs != null ? Number(row.capacity_lbs) : null,
        onHandLbs: 0,
        lots: [],
      });
    }
    const loc = mat.byLocation.get(locId)!;
    loc.onHandLbs += weightLbs;
    loc.lots.push({
      lotId: row.lot_id as string,
      lotNumber: row.lot_number as string,
      status,
      weightLbs,
      ageDays,
    });
  }

  // ── Shape the response ──────────────────────────────────────────────────────
  const totals = Array.from(materialMap.values()).map(mat => ({
    materialTypeId: mat.materialTypeId,
    materialType: mat.materialType,
    materialName: mat.materialName,
    totalLbs: Math.round(mat.totalLbs),
    totalKg: Math.round(mat.totalKg),
    lotCount: mat.lotCount,
    byStatus: mat.byStatus,
    byLocation: Array.from(mat.byLocation.values()).map(loc => ({
      locationId: loc.locationId,
      locationName: loc.locationName,
      locationType: loc.locationType,
      capacityLbs: loc.capacityLbs != null ? Math.round(loc.capacityLbs) : null,
      onHandLbs: Math.round(loc.onHandLbs),
      utilizationPct: loc.capacityLbs
        ? Math.round((loc.onHandLbs / loc.capacityLbs) * 100)
        : null,
      lots: loc.lots,
    })),
  }));

  // ── Location summary (all locations across all materials) ───────────────────
  const locationSummaryMap = new Map<string, { locationName: string; onHandLbs: number; capacityLbs: number | null }>();
  for (const mat of materialMap.values()) {
    for (const loc of mat.byLocation.values()) {
      if (!locationSummaryMap.has(loc.locationId)) {
        locationSummaryMap.set(loc.locationId, {
          locationName: loc.locationName,
          onHandLbs: 0,
          capacityLbs: loc.capacityLbs,
        });
      }
      locationSummaryMap.get(loc.locationId)!.onHandLbs += loc.onHandLbs;
    }
  }

  const locationSummary = Array.from(locationSummaryMap.values()).map(loc => ({
    locationName: loc.locationName,
    onHandLbs: Math.round(loc.onHandLbs),
    capacityLbs: loc.capacityLbs != null ? Math.round(loc.capacityLbs) : null,
    utilizationPct: loc.capacityLbs
      ? Math.round((loc.onHandLbs / loc.capacityLbs) * 100)
      : null,
  }));

  const grandTotalLbs = totals.reduce((s, m) => s + m.totalLbs, 0);

  return NextResponse.json({
    asOf: now.toISOString(),
    totals,
    grandTotalLbs: Math.round(grandTotalLbs),
    locationSummary,
  });
}
