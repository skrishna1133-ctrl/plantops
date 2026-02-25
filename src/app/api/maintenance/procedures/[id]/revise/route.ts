import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { logActivity } from "@/lib/db-activity";
import { dbCmmsProcedures } from "@/lib/db-cmms";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER_ROLES]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  if (!body.content && !body.pdfUrl) return NextResponse.json({ error: "content or pdfUrl is required" }, { status: 400 });
  const revision = await dbCmmsProcedures.addRevision(id, tenantId, body.content || null, body.safetyWarnings || null, auth.payload.userId, body.pdfUrl || null, body.pdfFilename || null);
  if (!revision) return NextResponse.json({ error: "Procedure not found" }, { status: 404 });
  logActivity({ tenantId, userId: auth.payload.userId, role: auth.payload.role,
    action: "added_revision", entityType: "procedure", entityId: id, entityName: id }).catch(() => {});
  return NextResponse.json(revision, { status: 201 });
}
