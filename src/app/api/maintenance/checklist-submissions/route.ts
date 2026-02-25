import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { logActivity } from "@/lib/db-activity";
import { dbCmmsChecklistSubmissions, dbCmmsNotifications } from "@/lib/db-cmms";
import { dbUsers } from "@/lib/db";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES, "maintenance_tech", "super_admin"]);
  if (!auth.ok) return auth.response;
  const { searchParams } = request.nextUrl;
  const tenantId = auth.payload.role === "super_admin"
    ? (searchParams.get("viewAs") || auth.payload.tenantId)
    : auth.payload.tenantId;

  const filters: { machineId?: string; hasFlags?: boolean } = {};
  if (searchParams.get("machineId")) filters.machineId = searchParams.get("machineId")!;
  if (searchParams.get("hasFlags") === "true") filters.hasFlags = true;

  const subs = await dbCmmsChecklistSubmissions.getAll(tenantId, filters);
  // Techs only see their own submissions
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
  const sub = await dbCmmsChecklistSubmissions.create(tenantId, {
    templateId: body.templateId,
    machineId: body.machineId,
    submittedById: auth.payload.userId,
    notes: body.notes,
    responses: body.responses,
  });

  // Notify managers if there are flagged items
  if (sub.hasFlags) {
    const allUsers = await dbUsers.getAll(tenantId);
    const managers = allUsers.filter(u =>
      ["maintenance_manager", "engineer", "admin", "owner"].includes(u.role) && u.active
    );
    if (managers.length > 0) {
      await dbCmmsNotifications.createForMany(
        tenantId,
        managers.map(m => m.id),
        "Checklist Flagged",
        "A checklist submission has flagged items that require review.",
        `/maintenance/checklists/${sub.id}`
      );
    }
  }

  logActivity({ tenantId, userId: auth.payload.userId, role: auth.payload.role,
    action: "submitted", entityType: "checklist", entityId: sub.id, entityName: sub.templateId }).catch(() => {});
  return NextResponse.json(sub, { status: 201 });
}
