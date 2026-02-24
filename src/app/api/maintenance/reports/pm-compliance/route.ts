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

  // Schedules due in period vs submissions in period
  const schedules = await sql`
    SELECT s.id, s.name, mt.name AS machine_type_name,
           COUNT(cs.id) AS submission_count
    FROM cmms_maintenance_schedules s
    LEFT JOIN cmms_machine_types mt ON s.machine_type_id = mt.id
    LEFT JOIN cmms_checklist_submissions cs ON cs.template_id = s.checklist_template_id
      AND cs.submitted_at >= ${from} AND cs.submitted_at <= ${to}
    WHERE s.tenant_id = ${tenantId} AND s.is_active = true
    GROUP BY s.id, s.name, mt.name`;

  return NextResponse.json(schedules.rows);
}
