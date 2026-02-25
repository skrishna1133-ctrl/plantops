import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsInspections } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { put } from "@vercel/blob";

const QT = ["quality_tech", "quality_manager", "admin", "owner"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QT]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const inspection = await dbQmsInspections.getById(id, auth.payload.tenantId!);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("photo") as File | null;
  const caption = formData.get("caption") as string | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  }

  const blob = await put(`qms/inspections/${id}/${crypto.randomUUID()}-${file.name}`, file, { access: "public" });
  const now = new Date().toISOString();

  await dbQmsInspections.addPhoto({
    id: crypto.randomUUID(),
    inspectionId: id,
    url: blob.url,
    caption: caption ?? undefined,
    uploadedAt: now,
  });

  return NextResponse.json({ url: blob.url }, { status: 201 });
}
