import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { initDb } from "@/lib/db";

// ─── Weight conversion helper ────────────────────────────────────────────────
function toLbs(weight: number | null, unit: string | null): number {
  if (weight == null) return 0;
  if (unit === "kg") return weight * 2.20462;
  return weight; // already lbs (default)
}

// ─── Snapshot one tenant ──────────────────────────────────────────────────────
async function snapshotTenant(tenantId: string) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Get all in_storage + approved lots with their effective weight
  const { rows } = await sql`
    SELECT
      COALESCE(mt.code, 'UNKNOWN')       AS material_type,
      COALESCE(mt.name, 'Unknown Material') AS material_name,
      ol.status,
      ol.inbound_weight,
      ol.inbound_weight_unit,
      pr.output_weight                   AS run_output_weight,
      pr.output_weight_unit              AS run_output_weight_unit
    FROM ops_lots ol
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
    WHERE ol.tenant_id = ${tenantId}
      AND ol.status IN ('in_storage', 'approved')
  `;

  // Aggregate by material type
  const byMaterial: Record<string, { name: string; weightLbs: number; lotCount: number }> = {};

  for (const row of rows) {
    const key = row.material_type as string;
    if (!byMaterial[key]) {
      byMaterial[key] = { name: row.material_name as string, weightLbs: 0, lotCount: 0 };
    }

    // Weight logic: approved + has run output → use run output; otherwise inbound
    let w = 0;
    if (row.status === "approved" && row.run_output_weight != null) {
      w = toLbs(Number(row.run_output_weight), row.run_output_weight_unit as string);
    } else {
      w = toLbs(Number(row.inbound_weight), row.inbound_weight_unit as string);
    }

    byMaterial[key].weightLbs += w;
    byMaterial[key].lotCount += 1;
  }

  // Upsert one row per material type
  const results: Array<{ materialType: string; weightLbs: number; lotCount: number }> = [];

  for (const [materialType, data] of Object.entries(byMaterial)) {
    const weightLbs = Math.round(data.weightLbs * 1000) / 1000; // 3 decimal places
    await sql`
      INSERT INTO ops_inventory_snapshots
        (tenant_id, snapshot_date, material_type, material_name, weight_lbs, lot_count)
      VALUES
        (${tenantId}, ${today}::date, ${materialType}, ${data.name}, ${weightLbs}, ${data.lotCount})
      ON CONFLICT (tenant_id, snapshot_date, material_type)
      DO UPDATE SET
        material_name = EXCLUDED.material_name,
        weight_lbs    = EXCLUDED.weight_lbs,
        lot_count     = EXCLUDED.lot_count,
        created_at    = now()
    `;
    results.push({ materialType, weightLbs, lotCount: data.lotCount });
  }

  return results;
}

// ─── GET /api/ops/inventory/snapshot ──────────────────────────────────────────
// Called by Vercel Cron at 23:00 daily, or manually to seed today's snapshot.
// No user session required — protected by CRON_SECRET header in production.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  await initDb();

  const { rows: tenants } = await sql`
    SELECT id FROM tenants WHERE active = true
  `;

  const summary: Array<{ tenantId: string; snapshots: ReturnType<typeof snapshotTenant> extends Promise<infer T> ? T : never }> = [];

  for (const tenant of tenants) {
    const snapshots = await snapshotTenant(tenant.id as string);
    summary.push({ tenantId: tenant.id as string, snapshots } as never);
  }

  return NextResponse.json({
    date: new Date().toISOString().slice(0, 10),
    tenantsProcessed: tenants.length,
    summary,
  });
}
