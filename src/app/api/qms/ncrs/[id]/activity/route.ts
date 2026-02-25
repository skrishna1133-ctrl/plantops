import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsNcrs } from "@/lib/db-qms";
import { initDb } from "@/lib/db";

const QT = ["quality_tech", "quality_manager", "admin", "owner"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QT]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json();
  const { action, notes } = body;
  if (!action) return NextResponse.json({ error: "action is required" }, { status: 400 });

  const ncr = await dbQmsNcrs.getById(id, auth.payload.tenantId!);
  if (!ncr) return NextResponse.json({ error: "NCR not found" }, { status: 404 });

  const now = new Date().toISOString();
  await dbQmsNcrs.addActivity({
    id: crypto.randomUUID(), ncrId: id, userId: auth.payload.userId, action, notes, createdAt: now,
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
