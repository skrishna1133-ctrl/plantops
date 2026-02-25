import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { logActivity } from "@/lib/db-activity";
import { dbCmmsProcedures } from "@/lib/db-cmms";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES, "maintenance_tech", "super_admin"]);
  if (!auth.ok) return auth.response;
  const { searchParams } = request.nextUrl;
  const tenantId = auth.payload.role === "super_admin"
    ? (searchParams.get("viewAs") || auth.payload.tenantId)
    : auth.payload.tenantId;
  const procedures = await dbCmmsProcedures.getAll(tenantId, searchParams.get("machineTypeId") || undefined);
  return NextResponse.json(procedures);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  if (!body.machineTypeId || !body.title || (!body.content && !body.pdfUrl)) {
    return NextResponse.json({ error: "machineTypeId, title, and either content or pdfUrl are required" }, { status: 400 });
  }
  const sheet = await dbCmmsProcedures.create(tenantId, body.machineTypeId, body.title.trim(), body.content || null, body.safetyWarnings || null, auth.payload.userId, body.pdfUrl || null, body.pdfFilename || null);
  logActivity({ tenantId, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "procedure", entityId: sheet.id, entityName: sheet.title }).catch(() => {});
  return NextResponse.json(sheet, { status: 201 });
}
