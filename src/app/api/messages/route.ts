import { NextRequest, NextResponse } from "next/server";
import { dbMessages, dbMessageGroups, dbUsers } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { randomUUID } from "crypto";
import type { Message } from "@/lib/schemas";

const ALLOWED_ROLES = ["worker", "quality_tech", "engineer", "shipping", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...ALLOWED_ROLES]);
  if (!auth.ok) return auth.response;

  const { tenantId, userId } = auth.payload;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const after = searchParams.get("after") ?? undefined;

  if (type === "group") {
    const groupId = searchParams.get("groupId");
    if (!groupId) return NextResponse.json({ error: "groupId required" }, { status: 400 });

    const membership = await dbMessageGroups.getMembership(groupId, userId);
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const messages = await dbMessages.getForGroup(groupId, after);
    return NextResponse.json(messages);
  }

  if (type === "dm") {
    const withId = searchParams.get("with");
    if (!withId) return NextResponse.json({ error: "with param required" }, { status: 400 });
    const messages = await dbMessages.getDM(tenantId, userId, withId, after);
    return NextResponse.json(messages);
  }

  return NextResponse.json({ error: "type must be group or dm" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...ALLOWED_ROLES]);
  if (!auth.ok) return auth.response;

  const { tenantId, userId } = auth.payload;
  if (!tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = await dbUsers.getById(userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json();
  const { content, groupId, recipientId } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  if (content.length > 500) {
    return NextResponse.json({ error: "Message too long (max 500 chars)" }, { status: 400 });
  }

  if (groupId) {
    const membership = await dbMessageGroups.getMembership(groupId, userId);
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (membership.muted) return NextResponse.json({ error: "You are muted in this group" }, { status: 403 });

    const msg: Message = {
      id: randomUUID(),
      tenantId,
      senderId: userId,
      senderName: user.fullName,
      groupId,
      recipientId: null,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    await dbMessages.create(msg);
    return NextResponse.json(msg);
  }

  if (recipientId) {
    const msg: Message = {
      id: randomUUID(),
      tenantId,
      senderId: userId,
      senderName: user.fullName,
      groupId: null,
      recipientId,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    await dbMessages.create(msg);
    return NextResponse.json(msg);
  }

  return NextResponse.json({ error: "groupId or recipientId required" }, { status: 400 });
}
