import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getActivityLog } from "@/lib/db-activity";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["admin", "owner"]);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);

  let tenantId = auth.payload.tenantId;
  if (auth.payload.role === "super_admin") {
    const viewAs = searchParams.get("viewAs");
    if (viewAs) tenantId = viewAs;
  }

  if (!tenantId) {
    return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  }

  const entityType = searchParams.get("entityType") || undefined;
  const userId = searchParams.get("userId") || undefined;

  try {
    const entries = await getActivityLog(tenantId, { entityType, userId });
    return NextResponse.json(entries);
  } catch (error) {
    console.error("Error fetching activity log:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
