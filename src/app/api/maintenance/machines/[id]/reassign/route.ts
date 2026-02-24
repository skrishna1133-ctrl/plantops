import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsMachines } from "@/lib/db-cmms";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER_ROLES]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  if (!body.reason) return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  const ok = await dbCmmsMachines.reassignLine(
    id, tenantId, body.toLineId || null, body.reason, auth.payload.userId, body.permanent === true
  );
  if (!ok) return NextResponse.json({ error: "Machine not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
