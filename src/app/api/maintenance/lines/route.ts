import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsLines } from "@/lib/db-cmms";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES, "maintenance_tech", "worker", "super_admin"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.role === "super_admin"
    ? (request.nextUrl.searchParams.get("viewAs") || auth.payload.tenantId)
    : auth.payload.tenantId;
  const lines = await dbCmmsLines.getAll(tenantId);
  return NextResponse.json(lines);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  if (!body.lineId || !body.name) return NextResponse.json({ error: "lineId and name required" }, { status: 400 });
  const line = await dbCmmsLines.create(tenantId, body.lineId.trim(), body.name.trim());
  return NextResponse.json(line, { status: 201 });
}
