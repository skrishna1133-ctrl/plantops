import { NextRequest, NextResponse } from "next/server";
import { dbMessageGroups } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { randomUUID } from "crypto";
import type { MessageGroup } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["worker", "quality_tech", "engineer", "shipping", "admin", "owner"]);
  if (!auth.ok) return auth.response;

  const { tenantId, userId, role } = auth.payload;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Admins/owners see all groups; others see only groups they belong to
  const groups =
    role === "admin" || role === "owner"
      ? await dbMessageGroups.getAll(tenantId)
      : await dbMessageGroups.getForUser(tenantId, userId);

  return NextResponse.json(groups);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["admin", "owner"]);
  if (!auth.ok) return auth.response;

  const { tenantId, userId } = auth.payload;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { name, memberIds } = body;

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Group name must be at least 2 characters" }, { status: 400 });
  }

  const group: MessageGroup = {
    id: randomUUID(),
    tenantId,
    name: name.trim(),
    createdBy: userId,
    createdAt: new Date().toISOString(),
  };

  await dbMessageGroups.create(group);

  // Add creator as a member
  const now = new Date().toISOString();
  await dbMessageGroups.addMember(group.id, userId, now);

  // Add any additional members
  if (Array.isArray(memberIds)) {
    for (const memberId of memberIds) {
      if (memberId !== userId) {
        await dbMessageGroups.addMember(group.id, memberId, now);
      }
    }
  }

  return NextResponse.json(group, { status: 201 });
}
