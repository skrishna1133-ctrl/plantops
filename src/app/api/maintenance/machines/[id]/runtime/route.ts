import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsMachines } from "@/lib/db-cmms";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, ["maintenance_tech", "maintenance_manager", "engineer", "admin", "owner"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const ok = await dbCmmsMachines.updateRuntime(
    id, tenantId,
    body.runtimeHours !== undefined ? Number(body.runtimeHours) : undefined,
    body.runtimeCycles !== undefined ? Number(body.runtimeCycles) : undefined,
  );
  if (!ok) return NextResponse.json({ error: "Machine not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
