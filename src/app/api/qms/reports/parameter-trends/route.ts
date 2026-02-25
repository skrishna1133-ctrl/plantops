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
  const parameterId = searchParams.get("parameterId");
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const tenantId = auth.payload.tenantId!;

  if (!parameterId) {
    // Return list of parameters that have data
    const r = await sql`
      SELECT DISTINCT p.id, p.name, p.unit, p.parameter_type
      FROM qms_inspection_results ir
      JOIN qms_parameters p ON p.id = ir.parameter_id
      JOIN qms_inspections i ON i.id = ir.inspection_id
      WHERE i.tenant_id = ${tenantId} AND i.submitted_at >= ${since}
        AND ir.numeric_value IS NOT NULL
    `;
    return NextResponse.json(r.rows);
  }

  const r = await sql`
    SELECT
      DATE(i.submitted_at) AS date,
      AVG(ir.numeric_value) AS avg_value,
      MIN(ir.numeric_value) AS min_value,
      MAX(ir.numeric_value) AS max_value,
      COUNT(*) AS sample_count
    FROM qms_inspection_results ir
    JOIN qms_inspections i ON i.id = ir.inspection_id
    WHERE i.tenant_id = ${tenantId}
      AND ir.parameter_id = ${parameterId}
      AND i.submitted_at >= ${since}
      AND ir.numeric_value IS NOT NULL
    GROUP BY DATE(i.submitted_at)
    ORDER BY date ASC
  `;

  return NextResponse.json(r.rows);
}
