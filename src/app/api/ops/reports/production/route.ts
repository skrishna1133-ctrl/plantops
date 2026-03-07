import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { initDb } from "@/lib/db";
import { sql } from "@vercel/postgres";

const MANAGER = ["owner", "admin", "engineer"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER]);
  if (!auth.ok) return auth.response;
  await initDb();

  const tid = auth.payload.tenantId!;
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") ?? "90");
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [runs, byLine, yieldBuckets] = await Promise.all([
    // All completed runs in period
    sql`
      SELECT r.*,
        j.job_number, j.job_type,
        mt.name AS material_type_name,
        pt.name AS processing_type_name
      FROM ops_production_runs r
      LEFT JOIN ops_jobs j ON j.id = r.job_id
      LEFT JOIN qms_material_types mt ON mt.id = j.material_type_id
      LEFT JOIN ops_processing_types pt ON pt.id = r.processing_type_id
      WHERE r.tenant_id = ${tid}
        AND r.status = 'completed'
        AND r.actual_end >= ${since}
      ORDER BY r.actual_end DESC
      LIMIT 100
    `,
    // Summary by production line
    sql`
      SELECT
        COALESCE(r.production_line_id, 'unassigned') AS line_id,
        COUNT(*)::int AS run_count,
        ROUND(AVG(r.yield_percentage)::numeric, 1) AS avg_yield,
        COALESCE(SUM(r.input_weight), 0)::float AS total_input,
        COALESCE(SUM(r.output_weight), 0)::float AS total_output
      FROM ops_production_runs r
      WHERE r.tenant_id = ${tid}
        AND r.status = 'completed'
        AND r.actual_end >= ${since}
      GROUP BY r.production_line_id
      ORDER BY run_count DESC
    `,
    // Yield distribution (buckets: <70, 70-80, 80-90, 90-100, >100)
    sql`
      SELECT
        COUNT(*) FILTER (WHERE yield_percentage < 70)::int AS below_70,
        COUNT(*) FILTER (WHERE yield_percentage >= 70 AND yield_percentage < 80)::int AS p70_80,
        COUNT(*) FILTER (WHERE yield_percentage >= 80 AND yield_percentage < 90)::int AS p80_90,
        COUNT(*) FILTER (WHERE yield_percentage >= 90 AND yield_percentage < 100)::int AS p90_100,
        COUNT(*) FILTER (WHERE yield_percentage >= 100)::int AS above_100,
        COUNT(*) FILTER (WHERE yield_percentage IS NULL)::int AS no_data
      FROM ops_production_runs
      WHERE tenant_id = ${tid} AND status = 'completed' AND actual_end >= ${since}
    `,
  ]);

  return NextResponse.json({ runs: runs.rows, byLine: byLine.rows, yieldBuckets: yieldBuckets.rows[0] });
}
