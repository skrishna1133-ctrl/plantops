import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbCmmsWorkOrders } from "@/lib/db-cmms";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES, "super_admin"]);
  if (!auth.ok) return auth.response;
  const { searchParams } = request.nextUrl;
  const tenantId = auth.payload.role === "super_admin"
    ? (searchParams.get("viewAs") || auth.payload.tenantId)
    : auth.payload.tenantId;
  const workOrders = await dbCmmsWorkOrders.getAll(tenantId, {
    status: searchParams.get("status") || undefined,
  });
  return NextResponse.json(workOrders);
}
