import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsMachines } from "@/lib/db-cmms";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES, "maintenance_tech", "worker", "super_admin"]);
  if (!auth.ok) return auth.response;
  const { searchParams } = request.nextUrl;
  const tenantId = auth.payload.role === "super_admin"
    ? (searchParams.get("viewAs") || auth.payload.tenantId)
    : auth.payload.tenantId;
  const machines = await dbCmmsMachines.getAll(tenantId, {
    status: searchParams.get("status") || undefined,
    machineTypeId: searchParams.get("machineTypeId") || undefined,
  });
  return NextResponse.json(machines);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  if (!body.machineId || !body.name || !body.machineTypeId) {
    return NextResponse.json({ error: "machineId, name, and machineTypeId are required" }, { status: 400 });
  }
  try {
    const machine = await dbCmmsMachines.create(tenantId, {
      machineId: body.machineId.trim(),
      name: body.name.trim(),
      machineTypeId: body.machineTypeId,
      defaultLineId: body.defaultLineId,
      currentLineId: body.currentLineId || body.defaultLineId,
    });
    if (body.assignedTechIds?.length) {
      await dbCmmsMachines.setTechnicians(machine.id, body.assignedTechIds);
    }
    return NextResponse.json(machine, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Machine ID already exists or DB error" }, { status: 400 });
  }
}
