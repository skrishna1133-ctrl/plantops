import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsNotifications } from "@/lib/db-cmms";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["maintenance_manager", "maintenance_tech", "engineer", "admin", "owner", "worker", "super_admin"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;
  if (!tenantId) return NextResponse.json([]);
  const notifications = await dbCmmsNotifications.getForUser(auth.payload.userId, tenantId);
  return NextResponse.json(notifications);
}
