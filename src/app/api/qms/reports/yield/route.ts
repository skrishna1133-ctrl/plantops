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
      DATE(created_at) AS date,
      AVG(yield_percentage) AS avg_yield,
      MIN(yield_percentage) AS min_yield,
      MAX(yield_percentage) AS max_yield,
      COUNT(*) AS lot_count
    FROM qms_lots
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${since}
      AND yield_percentage IS NOT NULL
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  return NextResponse.json(r.rows);
}
