import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsSchedules } from "@/lib/db-cmms";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER_ROLES]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  await dbCmmsSchedules.update(id, tenantId, {
    isActive: body.isActive,
    assignedTechId: body.assignedTechId,
    nextDueAt: body.nextDueAt,
    lastTriggeredAt: body.lastTriggeredAt,
  });
  return NextResponse.json({ success: true });
}
