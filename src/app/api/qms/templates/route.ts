import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsTemplates } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QM = ["quality_manager", "admin", "owner"] as const;
const QT = ["quality_tech", "quality_manager", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...QT]);
  if (!auth.ok) return auth.response;
  await initDb();
  const data = await dbQmsTemplates.getAll(auth.payload.tenantId!);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const body = await request.json();
  const { name, materialTypeId, items } = body;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await dbQmsTemplates.create({
    id,
    tenantId: auth.payload.tenantId!,
    materialTypeId,
    name,
    revisionNumber: 1,
    createdById: auth.payload.userId,
    createdAt: now,
  });

  // Add items if provided
  if (Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await dbQmsTemplates.addItem({
        id: crypto.randomUUID(),
        templateId: id,
        parameterId: item.parameterId,
        orderNum: i,
        minValue: item.minValue,
        maxValue: item.maxValue,
        targetValue: item.targetValue,
        isRequired: item.isRequired !== false,
        instructions: item.instructions,
        readingCount: item.readingCount ?? 1,
        statistic: item.statistic ?? "average",
      });
    }
  }

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "qms_template", entityId: id, entityName: name }).catch(() => {});
  return NextResponse.json({ id, name }, { status: 201 });
}
