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

  const byStatus = await sql`
    SELECT status, COUNT(*) AS count
    FROM qms_complaints WHERE tenant_id = ${tenantId} AND created_at >= ${since}
    GROUP BY status
  `;

  const byCustomer = await sql`
    SELECT customer_name, COUNT(*) AS count
    FROM qms_complaints WHERE tenant_id = ${tenantId} AND created_at >= ${since}
    GROUP BY customer_name ORDER BY count DESC LIMIT 10
  `;

  return NextResponse.json({ byStatus: byStatus.rows, byCustomer: byCustomer.rows });
}
