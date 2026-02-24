import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsSchedules } from "@/lib/db-cmms";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["maintenance_manager", "maintenance_tech", "engineer", "admin", "owner", "super_admin"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.role === "super_admin"
    ? (request.nextUrl.searchParams.get("viewAs") || auth.payload.tenantId)
    : auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const schedules = await dbCmmsSchedules.getDueToday(tenantId);
  return NextResponse.json(schedules);
}
