import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { logActivity } from "@/lib/db-activity";
import { dbCmmsLogSubmissions } from "@/lib/db-cmms";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER_ROLES]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const ok = await dbCmmsLogSubmissions.signOff(id, tenantId, auth.payload.userId);
  if (!ok) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  logActivity({ tenantId, userId: auth.payload.userId, role: auth.payload.role,
    action: "signed_off", entityType: "log_sheet", entityId: id, entityName: id }).catch(() => {});
  return NextResponse.json({ success: true });
}
