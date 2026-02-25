import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { logActivity } from "@/lib/db-activity";
import { dbCmmsWorkOrders, dbCmmsNotifications, dbCmmsMachines } from "@/lib/db-cmms";
import { dbUsers } from "@/lib/db";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES, "maintenance_tech", "super_admin"]);
  if (!auth.ok) return auth.response;
  const { searchParams } = request.nextUrl;
  const tenantId = auth.payload.role === "super_admin"
    ? (searchParams.get("viewAs") || auth.payload.tenantId)
    : auth.payload.tenantId;
  const filters: { status?: string; assignedToId?: string } = {};
  if (searchParams.get("status")) filters.status = searchParams.get("status")!;
  // Techs only see their own work orders
  if (auth.payload.role === "maintenance_tech") {
    filters.assignedToId = auth.payload.userId;
  }
  const workOrders = await dbCmmsWorkOrders.getAll(tenantId, filters);
  return NextResponse.json(workOrders);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  if (!body.machineId || !body.description || !body.type) {
    return NextResponse.json({ error: "machineId, description, and type are required" }, { status: 400 });
  }
  const wo = await dbCmmsWorkOrders.create(tenantId, {
    type: body.type,
    machineId: body.machineId,
    assignedToId: body.assignedToId,
    breakdownReportId: body.breakdownReportId,
    description: body.description,
    downtimeStart: body.downtimeStart || new Date().toISOString(),
    createdById: auth.payload.userId,
    procedureRevisionId: body.procedureRevisionId,
  });

  // Set machine status to down
  await dbCmmsMachines.updateStatus(body.machineId, tenantId, "down");

  // Notify assigned technician
  if (body.assignedToId) {
    await dbCmmsNotifications.create(tenantId, {
      userId: body.assignedToId,
      title: "New Work Order Assigned",
      message: `Work order ${wo.workOrderNumber} has been assigned to you.`,
      link: `/maintenance/work-orders/${wo.id}`,
    });
  }

  logActivity({ tenantId, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "work_order", entityId: wo.id, entityName: wo.workOrderNumber }).catch(() => {});
  return NextResponse.json(wo, { status: 201 });
}
