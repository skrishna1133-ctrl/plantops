import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsNotifications } from "@/lib/db-cmms";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, ["maintenance_manager", "maintenance_tech", "engineer", "admin", "owner", "worker", "super_admin"]);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  await dbCmmsNotifications.markRead(id, auth.payload.userId);
  return NextResponse.json({ success: true });
}
