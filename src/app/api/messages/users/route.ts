import { NextRequest, NextResponse } from "next/server";
import { dbUsers } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["worker", "quality_tech", "engineer", "shipping", "admin", "owner"]);
  if (!auth.ok) return auth.response;

  const { tenantId, userId } = auth.payload;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const allUsers = await dbUsers.getAll(tenantId);
  const others = allUsers
    .filter((u) => u.id !== userId && u.active)
    .map((u) => ({ id: u.id, fullName: u.fullName, role: u.role }));

  return NextResponse.json(others);
}
