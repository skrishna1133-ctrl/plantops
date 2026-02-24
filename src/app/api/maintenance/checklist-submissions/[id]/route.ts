import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsChecklistSubmissions } from "@/lib/db-cmms";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER_ROLES, "maintenance_tech", "super_admin"]);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const sub = await dbCmmsChecklistSubmissions.getById(id);
  if (!sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  return NextResponse.json(sub);
}
