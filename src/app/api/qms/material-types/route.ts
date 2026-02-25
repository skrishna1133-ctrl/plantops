import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsMaterialTypes } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QM = ["quality_manager", "admin", "owner"] as const;
const QT = ["quality_tech", "quality_manager", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...QT]);
  if (!auth.ok) return auth.response;
  await initDb();
  const data = await dbQmsMaterialTypes.getAll(auth.payload.tenantId!);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const body = await request.json();
  const { name, code, description } = body;
  if (!name || !code) return NextResponse.json({ error: "name and code are required" }, { status: 400 });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await dbQmsMaterialTypes.create({ id, tenantId: auth.payload.tenantId!, name, code, description, createdAt: now });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "qms_material_type", entityId: id, entityName: name }).catch(() => {});
  return NextResponse.json({ id, name, code }, { status: 201 });
}
