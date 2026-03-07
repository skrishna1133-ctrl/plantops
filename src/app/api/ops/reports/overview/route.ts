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

  const [jobStats, lotStats, runStats, inboundStats, outboundStats] = await Promise.all([
    // Jobs by status
    sql`
      SELECT status, COUNT(*)::int AS count
      FROM ops_jobs WHERE tenant_id = ${tid}
      GROUP BY status
    `,
    // Lots by status
    sql`
      SELECT status, COUNT(*)::int AS count
      FROM ops_lots WHERE tenant_id = ${tid}
      GROUP BY status
    `,
    // Production run summary
    sql`
      SELECT
        COUNT(*)::int AS total_runs,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_runs,
        ROUND(AVG(yield_percentage) FILTER (WHERE status = 'completed' AND yield_percentage IS NOT NULL)::numeric, 1) AS avg_yield,
        COALESCE(SUM(output_weight) FILTER (WHERE status = 'completed'), 0)::float AS total_output
      FROM ops_production_runs WHERE tenant_id = ${tid}
    `,
    // Inbound weight (last 30 days)
    sql`
      SELECT
        COUNT(*)::int AS total_shipments,
        COUNT(*) FILTER (WHERE status = 'received')::int AS received,
        COALESCE(SUM(we.total_net), 0)::float AS total_weight
      FROM ops_inbound_shipments s
      LEFT JOIN (
        SELECT inbound_shipment_id, SUM(COALESCE(net_weight, gross_weight)) AS total_net
        FROM ops_weight_entries GROUP BY inbound_shipment_id
      ) we ON we.inbound_shipment_id = s.id
      WHERE s.tenant_id = ${tid}
        AND s.created_at >= ${new Date(Date.now() - 30 * 86400000).toISOString()}
    `,
    // Outbound (last 30 days)
    sql`
      SELECT
        COUNT(*)::int AS total_shipments,
        COUNT(*) FILTER (WHERE status = 'shipped')::int AS shipped,
        COALESCE(SUM(total_weight) FILTER (WHERE status = 'shipped'), 0)::float AS total_weight
      FROM ops_outbound_shipments WHERE tenant_id = ${tid}
        AND created_at >= ${new Date(Date.now() - 30 * 86400000).toISOString()}
    `,
  ]);

  return NextResponse.json({
    jobs: jobStats.rows,
    lots: lotStats.rows,
    runs: runStats.rows[0],
    inbound30d: inboundStats.rows[0],
    outbound30d: outboundStats.rows[0],
  });
}
