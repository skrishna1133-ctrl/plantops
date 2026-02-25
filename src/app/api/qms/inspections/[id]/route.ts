import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsInspections } from "@/lib/db-qms";
import { initDb } from "@/lib/db";

const QT = ["quality_tech", "quality_manager", "admin", "owner"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QT]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const inspection = await dbQmsInspections.getById(id, auth.payload.tenantId!);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  return NextResponse.json(inspection);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QT]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const inspection = await dbQmsInspections.getById(id, auth.payload.tenantId!);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  if (inspection.status !== "draft") {
    return NextResponse.json({ error: "Can only edit draft inspections" }, { status: 400 });
  }

  const body = await request.json();
  // Upsert individual results
  if (Array.isArray(body.results)) {
    for (const r of body.results) {
      await dbQmsInspections.upsertResult({
        id: r.id || crypto.randomUUID(),
        inspectionId: id,
        parameterId: r.parameterId,
        value: r.value,
        numericValue: r.numericValue,
        notes: r.notes,
      });
    }
  }
  return NextResponse.json({ success: true });
}
