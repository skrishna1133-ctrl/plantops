import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsBreakdownReports, dbCmmsWorkOrders, dbCmmsMachines, dbCmmsNotifications } from "@/lib/db-cmms";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER_ROLES]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const report = await dbCmmsBreakdownReports.getById(id);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const body = await request.json();
  const wo = await dbCmmsWorkOrders.create(tenantId, {
    type: "corrective",
    machineId: report.machineId,
    assignedToId: body.assignedToId,
    breakdownReportId: report.id,
    description: report.description,
    downtimeStart: report.createdAt,
    createdById: auth.payload.userId,
  });

  // Set machine to down
  await dbCmmsMachines.updateStatus(report.machineId, tenantId, "down");

  // Notify assigned tech
  if (body.assignedToId) {
    await dbCmmsNotifications.create(tenantId, {
      userId: body.assignedToId,
      title: "New Work Order Assigned",
      message: `Work order ${wo.workOrderNumber} has been assigned to you.`,
      link: `/maintenance/work-orders/${wo.id}`,
    });
  }

  return NextResponse.json(wo, { status: 201 });
}
