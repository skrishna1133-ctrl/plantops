import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsTemplates } from "@/lib/db-qms";
import { initDb } from "@/lib/db";

const QT = ["quality_tech", "quality_manager", "admin", "owner"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QT]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const template = await dbQmsTemplates.getById(id, auth.payload.tenantId!);
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  return NextResponse.json(template);
}
