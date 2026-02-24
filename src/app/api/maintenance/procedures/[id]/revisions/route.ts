import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsProcedures } from "@/lib/db-cmms";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER_ROLES, "super_admin"]);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const revisions = await dbCmmsProcedures.getRevisions(id);
  return NextResponse.json(revisions);
}
