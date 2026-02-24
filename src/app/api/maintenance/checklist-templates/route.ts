import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsChecklistTemplates } from "@/lib/db-cmms";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES, "maintenance_tech", "super_admin"]);
  if (!auth.ok) return auth.response;
  const { searchParams } = request.nextUrl;
  const tenantId = auth.payload.role === "super_admin"
    ? (searchParams.get("viewAs") || auth.payload.tenantId)
    : auth.payload.tenantId;
  const templates = await dbCmmsChecklistTemplates.getAll(tenantId, searchParams.get("machineTypeId") || undefined);
  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  if (!body.machineTypeId || !body.title || !body.frequency || !body.items?.length) {
    return NextResponse.json({ error: "machineTypeId, title, frequency, and items are required" }, { status: 400 });
  }
  const template = await dbCmmsChecklistTemplates.create(tenantId, body);
  return NextResponse.json(template, { status: 201 });
}
