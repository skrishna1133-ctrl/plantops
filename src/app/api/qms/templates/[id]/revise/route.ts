import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsTemplates } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QM = ["quality_manager", "admin", "owner"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json();
  const { items } = body;

  const existing = await dbQmsTemplates.getById(id, auth.payload.tenantId!);
  if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const newId = crypto.randomUUID();
  const now = new Date().toISOString();
  const newRevision = (existing.revision_number || 1) + 1;

  await dbQmsTemplates.revise(id, newId, auth.payload.tenantId!, newRevision, auth.payload.userId, now);

  // Add items to new revision
  if (Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await dbQmsTemplates.addItem({
        id: crypto.randomUUID(),
        templateId: newId,
        parameterId: item.parameterId,
        orderNum: i,
        minValue: item.minValue,
        maxValue: item.maxValue,
        targetValue: item.targetValue,
        isRequired: item.isRequired !== false,
        instructions: item.instructions,
        readingCount: item.readingCount ?? 1,
      });
    }
  }

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "revised", entityType: "qms_template", entityId: newId, entityName: existing.name }).catch(() => {});
  return NextResponse.json({ id: newId, revision: newRevision }, { status: 201 });
}
