import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsBreakdownReports } from "@/lib/db-cmms";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, ["maintenance_manager", "maintenance_tech", "engineer", "admin", "owner", "worker", "super_admin"]);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const report = await dbCmmsBreakdownReports.getById(id);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  return NextResponse.json(report);
}
