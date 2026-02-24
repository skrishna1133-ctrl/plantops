import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsWorkOrders, dbCmmsMachines } from "@/lib/db-cmms";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER_ROLES]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await request.json();

  const wo = await dbCmmsWorkOrders.getById(id);
  if (!wo) return NextResponse.json({ error: "Work order not found" }, { status: 404 });

  const downtimeEnd = body.downtimeEnd || new Date().toISOString();
  const ok = await dbCmmsWorkOrders.close(id, tenantId, auth.payload.userId, downtimeEnd);
  if (!ok) return NextResponse.json({ error: "Failed to close work order" }, { status: 400 });

  // Restore machine status to running
  await dbCmmsMachines.updateStatus(wo.machineId, tenantId, "running");

  return NextResponse.json({ success: true });
}
