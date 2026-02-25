import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { initDb } from "@/lib/db";
import { sql } from "@vercel/postgres";

const QM = ["quality_manager", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { searchParams } = request.nextUrl;
  const days = parseInt(searchParams.get("days") || "30");
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const tenantId = auth.payload.tenantId!;

  const r = await sql`
    SELECT
      DATE(i.submitted_at) AS date,
      COUNT(*) FILTER (WHERE i.overall_result = 'PASS') AS pass_count,
      COUNT(*) FILTER (WHERE i.overall_result = 'FAIL') AS fail_count,
      COUNT(*) AS total
    FROM qms_inspections i
    WHERE i.tenant_id = ${tenantId}
      AND i.submitted_at >= ${since}
      AND i.status IN ('submitted', 'approved', 'rejected')
    GROUP BY DATE(i.submitted_at)
    ORDER BY date ASC
  `;

  const summary = await sql`
    SELECT
      COUNT(*) FILTER (WHERE i.overall_result = 'PASS') AS total_pass,
      COUNT(*) FILTER (WHERE i.overall_result = 'FAIL') AS total_fail,
      COUNT(*) AS total
    FROM qms_inspections i
    WHERE i.tenant_id = ${tenantId}
      AND i.submitted_at >= ${since}
      AND i.status IN ('submitted', 'approved', 'rejected')
  `;

  return NextResponse.json({ byDay: r.rows, summary: summary.rows[0] });
}
