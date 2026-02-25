import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { logActivity } from "@/lib/db-activity";
import { dbCmmsBreakdownReports, dbCmmsNotifications } from "@/lib/db-cmms";
import { dbUsers } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["maintenance_manager", "maintenance_tech", "engineer", "admin", "owner", "worker", "super_admin"]);
  if (!auth.ok) return auth.response;
  const { searchParams } = request.nextUrl;
  const tenantId = auth.payload.role === "super_admin"
    ? (searchParams.get("viewAs") || auth.payload.tenantId)
    : auth.payload.tenantId;

  // Workers only see their own reports
  const reportedById = auth.payload.role === "worker" ? auth.payload.userId : undefined;
  const reports = await dbCmmsBreakdownReports.getAll(tenantId, reportedById);
  return NextResponse.json(reports);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["maintenance_manager", "maintenance_tech", "engineer", "admin", "owner", "worker"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  if (!body.machineId || !body.description) {
    return NextResponse.json({ error: "machineId and description are required" }, { status: 400 });
  }
  const report = await dbCmmsBreakdownReports.create(tenantId, {
    machineId: body.machineId,
    reportedById: auth.payload.userId,
    description: body.description,
    photoUrl: body.photoUrl,
  });

  // Notify managers
  const allUsers = await dbUsers.getAll(tenantId);
  const managers = allUsers.filter(u =>
    ["maintenance_manager", "engineer", "admin", "owner"].includes(u.role) && u.active
  );
  if (managers.length > 0) {
    await dbCmmsNotifications.createForMany(
      tenantId,
      managers.map(m => m.id),
      "Breakdown Report Submitted",
      `A breakdown report has been submitted and requires your attention.`,
      `/maintenance/breakdown`
    );
  }

  logActivity({ tenantId, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "breakdown_report", entityId: report.id, entityName: report.machineId }).catch(() => {});
  return NextResponse.json(report, { status: 201 });
}
