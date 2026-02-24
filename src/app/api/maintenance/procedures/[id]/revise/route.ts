import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsProcedures } from "@/lib/db-cmms";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER_ROLES]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  if (!body.content) return NextResponse.json({ error: "content is required" }, { status: 400 });
  const revision = await dbCmmsProcedures.addRevision(id, tenantId, body.content, body.safetyWarnings || null, auth.payload.userId);
  if (!revision) return NextResponse.json({ error: "Procedure not found" }, { status: 404 });
  return NextResponse.json(revision, { status: 201 });
}
