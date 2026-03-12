import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { initDb } from "@/lib/db";
import { sql } from "@vercel/postgres";

const ALLOWED = [
  "receiving", "shipping", "quality_tech", "quality_manager",
  "engineer", "admin", "owner",
] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...ALLOWED]);
  if (!auth.ok) return auth.response;
  await initDb();

  const tid = auth.payload.tenantId!;
  const { searchParams } = new URL(request.url);

  const daysParam = Math.min(Number(searchParams.get("days") ?? "30"), 365);
  const materialFilter = searchParams.get("material") ?? null;

  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysParam);

  const from = fromDate.toISOString().slice(0, 10);
  const to   = toDate.toISOString().slice(0, 10);

  const { rows } = materialFilter
    ? await sql`
        SELECT
          snapshot_date::text AS date,
          material_type,
          material_name,
          weight_lbs::float   AS weight_lbs,
          lot_count
        FROM ops_inventory_snapshots
        WHERE tenant_id = ${tid}
          AND snapshot_date >= ${from}::date
          AND snapshot_date <= ${to}::date
          AND material_type = ${materialFilter}
        ORDER BY snapshot_date ASC, material_type ASC
      `
    : await sql`
        SELECT
          snapshot_date::text AS date,
          material_type,
          material_name,
          weight_lbs::float   AS weight_lbs,
          lot_count
        FROM ops_inventory_snapshots
        WHERE tenant_id = ${tid}
          AND snapshot_date >= ${from}::date
          AND snapshot_date <= ${to}::date
        ORDER BY snapshot_date ASC, material_type ASC
      `;

  // Collect all material codes seen
  const materialsSet = new Set<string>();
  for (const r of rows) materialsSet.add(r.material_type as string);
  const materials = Array.from(materialsSet).sort();

  // Pivot into per-date objects: { date, HDPE: { lbs, lot_count }, PP: { ... }, ... }
  const dateMap = new Map<string, Record<string, { lbs: number; lotCount: number }>>();

  for (const r of rows) {
    const date = r.date as string;
    if (!dateMap.has(date)) dateMap.set(date, {});
    const entry = dateMap.get(date)!;
    entry[r.material_type as string] = {
      lbs: Math.round(Number(r.weight_lbs)),
      lotCount: Number(r.lot_count),
    };
  }

  // Fill missing materials per date with zeros for consistent chart rendering
  const snapshots = Array.from(dateMap.entries()).map(([date, byMaterial]) => {
    const row: Record<string, unknown> = { date };
    for (const mat of materials) {
      row[mat] = byMaterial[mat] ?? { lbs: 0, lotCount: 0 };
    }
    return row;
  });

  return NextResponse.json({
    range: { from, to },
    materials,
    snapshots,
  });
}
