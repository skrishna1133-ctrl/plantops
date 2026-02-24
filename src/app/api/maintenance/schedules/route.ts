import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsSchedules } from "@/lib/db-cmms";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES, "maintenance_tech", "super_admin"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.role === "super_admin"
    ? (request.nextUrl.searchParams.get("viewAs") || auth.payload.tenantId)
    : auth.payload.tenantId;
  const schedules = await dbCmmsSchedules.getAll(tenantId);
  return NextResponse.json(schedules);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  if (!body.machineTypeId || !body.name || !body.frequency) {
    return NextResponse.json({ error: "machineTypeId, name, and frequency are required" }, { status: 400 });
  }
  const schedule = await dbCmmsSchedules.create(tenantId, body);
  return NextResponse.json(schedule, { status: 201 });
}
