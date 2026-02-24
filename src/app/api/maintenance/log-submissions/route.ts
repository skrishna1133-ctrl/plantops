import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsLogSubmissions, dbCmmsNotifications } from "@/lib/db-cmms";
import { dbUsers } from "@/lib/db";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES, "maintenance_tech", "super_admin"]);
  if (!auth.ok) return auth.response;
  const { searchParams } = request.nextUrl;
  const tenantId = auth.payload.role === "super_admin"
    ? (searchParams.get("viewAs") || auth.payload.tenantId)
    : auth.payload.tenantId;
  const filters: { machineId?: string; pendingSignOff?: boolean } = {};
  if (searchParams.get("machineId")) filters.machineId = searchParams.get("machineId")!;
  const subs = await dbCmmsLogSubmissions.getAll(tenantId, filters);
  if (auth.payload.role === "maintenance_tech") {
    return NextResponse.json(subs.filter(s => s.submittedById === auth.payload.userId));
  }
  return NextResponse.json(subs);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES, "maintenance_tech"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  if (!body.templateId || !body.machineId || !body.responses?.length) {
    return NextResponse.json({ error: "templateId, machineId, and responses are required" }, { status: 400 });
  }
  const sub = await dbCmmsLogSubmissions.create(tenantId, {
    templateId: body.templateId,
    machineId: body.machineId,
    submittedById: auth.payload.userId,
    notes: body.notes,
    responses: body.responses,
  });

  // Notify managers that a log sheet is pending sign-off
  const allUsers = await dbUsers.getAll(tenantId);
  const managers = allUsers.filter(u =>
    ["maintenance_manager", "engineer", "admin", "owner"].includes(u.role) && u.active
  );
  if (managers.length > 0) {
    await dbCmmsNotifications.createForMany(
      tenantId,
      managers.map(m => m.id),
      "Log Sheet Pending Sign-Off",
      "A new log sheet submission is awaiting your sign-off.",
      `/maintenance/log-sheets/${sub.id}`
    );
  }

  return NextResponse.json(sub, { status: 201 });
}
