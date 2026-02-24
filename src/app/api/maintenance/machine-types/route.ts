import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsMachineTypes } from "@/lib/db-cmms";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES, "maintenance_tech", "worker", "super_admin"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.role === "super_admin"
    ? (request.nextUrl.searchParams.get("viewAs") || auth.payload.tenantId)
    : auth.payload.tenantId;
  const types = await dbCmmsMachineTypes.getAll(tenantId);
  return NextResponse.json(types);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  if (!body.name || typeof body.name !== "string" || body.name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }
  const type = await dbCmmsMachineTypes.create(tenantId, body.name.trim());
  return NextResponse.json(type, { status: 201 });
}
