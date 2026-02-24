import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsMachines } from "@/lib/db-cmms";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER_ROLES, "maintenance_tech", "super_admin"]);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const machine = await dbCmmsMachines.getById(id);
  if (!machine) return NextResponse.json({ error: "Machine not found" }, { status: 404 });
  return NextResponse.json(machine);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER_ROLES]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  if (body.assignedTechIds !== undefined) {
    await dbCmmsMachines.setTechnicians(id, body.assignedTechIds);
  }
  if (body.name !== undefined || body.status !== undefined) {
    await dbCmmsMachines.update(id, tenantId, { name: body.name, status: body.status });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER_ROLES]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const deleted = await dbCmmsMachines.delete(id, tenantId);
  if (!deleted) return NextResponse.json({ error: "Machine not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
