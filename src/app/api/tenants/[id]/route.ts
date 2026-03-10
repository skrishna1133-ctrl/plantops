import { NextRequest, NextResponse } from "next/server";
import { dbTenants } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, []);
  if (!auth.ok) return auth.response;

  if (auth.payload.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { name, logoUrl } = body;

    await dbTenants.update(id, { name: name?.trim() || undefined, logoUrl });

    const tenant = await dbTenants.getById(id);
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Error updating tenant:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
