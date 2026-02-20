import { NextRequest, NextResponse } from "next/server";
import { dbMessageGroups } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, ["worker", "quality_tech", "engineer", "shipping", "admin", "owner"]);
  if (!auth.ok) return auth.response;

  const { tenantId } = auth.payload;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const group = await dbMessageGroups.getById(id, tenantId);
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const members = await dbMessageGroups.getMembers(id);
  return NextResponse.json({ ...group, members });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, ["admin", "owner"]);
  if (!auth.ok) return auth.response;

  const { tenantId } = auth.payload;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const now = new Date().toISOString();

  // Rename group
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length < 2) {
      return NextResponse.json({ error: "Group name must be at least 2 characters" }, { status: 400 });
    }
    const updated = await dbMessageGroups.update(id, tenantId, { name: body.name.trim() });
    if (!updated) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  // Add member
  if (body.action === "addMember" && body.userId) {
    await dbMessageGroups.addMember(id, body.userId, now);
    return NextResponse.json({ success: true });
  }

  // Remove member
  if (body.action === "removeMember" && body.userId) {
    await dbMessageGroups.removeMember(id, body.userId);
    return NextResponse.json({ success: true });
  }

  // Mute/unmute member
  if (body.action === "setMuted" && body.userId !== undefined && body.muted !== undefined) {
    const updated = await dbMessageGroups.setMuted(id, body.userId, body.muted);
    if (!updated) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "No valid action provided" }, { status: 400 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, ["admin", "owner"]);
  if (!auth.ok) return auth.response;

  const { tenantId } = auth.payload;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const deleted = await dbMessageGroups.delete(id, tenantId);
  if (!deleted) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
