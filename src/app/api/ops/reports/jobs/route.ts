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

  const [recent, byType, byCustomer] = await Promise.all([
    // Recent jobs with lot + run counts
    sql`
      SELECT j.*,
        c.name AS customer_name, v.name AS vendor_name, mt.name AS material_type_name,
        COUNT(DISTINCT l.id)::int AS lot_count,
        COUNT(DISTINCT r.id)::int AS run_count,
        COALESCE(SUM(r.output_weight) FILTER (WHERE r.status = 'completed'), 0)::float AS total_output
      FROM ops_jobs j
      LEFT JOIN ops_customers c ON c.id = j.customer_id
      LEFT JOIN ops_vendors v ON v.id = j.vendor_id
      LEFT JOIN qms_material_types mt ON mt.id = j.material_type_id
      LEFT JOIN ops_lots l ON l.job_id = j.id
      LEFT JOIN ops_production_runs r ON r.job_id = j.id
      WHERE j.tenant_id = ${tid} AND j.created_at >= ${since}
      GROUP BY j.id, c.name, v.name, mt.name
      ORDER BY j.created_at DESC
      LIMIT 50
    `,
    // By job type
    sql`
      SELECT job_type, status, COUNT(*)::int AS count
      FROM ops_jobs WHERE tenant_id = ${tid} AND created_at >= ${since}
      GROUP BY job_type, status
      ORDER BY job_type, status
    `,
    // Top customers by job count (toll jobs)
    sql`
      SELECT c.name AS customer_name, COUNT(j.id)::int AS job_count,
        COUNT(j.id) FILTER (WHERE j.status = 'completed')::int AS completed
      FROM ops_jobs j
      JOIN ops_customers c ON c.id = j.customer_id
      WHERE j.tenant_id = ${tid} AND j.job_type = 'toll' AND j.created_at >= ${since}
      GROUP BY c.name ORDER BY job_count DESC LIMIT 10
    `,
  ]);

  return NextResponse.json({ recent: recent.rows, byType: byType.rows, byCustomer: byCustomer.rows });
}
