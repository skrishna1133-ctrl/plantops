import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { sql } from "@vercel/postgres";
import { initDb } from "@/lib/db";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES, "super_admin"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.role === "super_admin"
    ? (request.nextUrl.searchParams.get("viewAs") || auth.payload.tenantId)
    : auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await initDb();
  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from") || new Date(Date.now() - 30 * 86400000).toISOString();
  const to = searchParams.get("to") || new Date().toISOString();

  const result = await sql`
    SELECT
      m.name AS machine_name,
      m.machine_id AS machine_id_code,
      COUNT(br.id) AS breakdown_count
    FROM cmms_breakdown_reports br
    JOIN cmms_machines m ON br.machine_id = m.id
    WHERE br.tenant_id = ${tenantId}
      AND br.created_at >= ${from}
      AND br.created_at <= ${to}
    GROUP BY m.id, m.name, m.machine_id
    ORDER BY breakdown_count DESC`;

  return NextResponse.json(result.rows);
}
