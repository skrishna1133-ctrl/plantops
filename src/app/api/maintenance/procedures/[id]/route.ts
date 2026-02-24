import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsProcedures } from "@/lib/db-cmms";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, ["maintenance_manager", "maintenance_tech", "engineer", "admin", "owner", "super_admin"]);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const procedure = await dbCmmsProcedures.getById(id);
  if (!procedure) return NextResponse.json({ error: "Procedure not found" }, { status: 404 });
  return NextResponse.json(procedure);
}
