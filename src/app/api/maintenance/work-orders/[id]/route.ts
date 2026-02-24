import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsWorkOrders, dbCmmsNotifications } from "@/lib/db-cmms";
import { dbUsers } from "@/lib/db";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER_ROLES, "maintenance_tech", "super_admin"]);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const wo = await dbCmmsWorkOrders.getById(id);
  if (!wo) return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  return NextResponse.json(wo);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER_ROLES, "maintenance_tech"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await request.json();

  // Techs can only update status/resolution/parts on their own WOs
  if (auth.payload.role === "maintenance_tech") {
    const wo = await dbCmmsWorkOrders.getById(id);
    if (!wo || wo.assignedToId !== auth.payload.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const ok = await dbCmmsWorkOrders.update(id, tenantId, {
    status: body.status,
    assignedToId: body.assignedToId,
    resolution: body.resolution,
    partsUsed: body.partsUsed,
    downtimeStart: body.downtimeStart,
    procedureUpdatedFlag: body.procedureUpdatedFlag,
  });

  // If marking completed, notify managers
  if (body.status === "completed") {
    const allUsers = await dbUsers.getAll(tenantId);
    const managers = allUsers.filter(u =>
      ["maintenance_manager", "engineer", "admin", "owner"].includes(u.role) && u.active
    );
    const wo = await dbCmmsWorkOrders.getById(id);
    if (managers.length > 0 && wo) {
      await dbCmmsNotifications.createForMany(
        tenantId,
        managers.map(m => m.id),
        "Work Order Completed",
        `Work order ${wo.workOrderNumber} has been marked as completed and is awaiting closure.`,
        `/maintenance/work-orders/${id}`
      );
    }
  }

  if (!ok) return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
