import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { dbUsers } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import type { UserRole } from "@/lib/schemas";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, ["admin", "owner"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json();

  const updateData: { fullName?: string; role?: UserRole; active?: boolean; passwordHash?: string } = {};
  if (body.fullName !== undefined) updateData.fullName = body.fullName;
  if (body.role !== undefined) updateData.role = body.role;
  if (body.active !== undefined) updateData.active = body.active;
  if (body.password) {
    updateData.passwordHash = await hashPassword(body.password);
  }

  const updated = await dbUsers.update(id, updateData);
  if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, ["admin", "owner"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const deleted = await dbUsers.delete(id);
  if (!deleted) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
