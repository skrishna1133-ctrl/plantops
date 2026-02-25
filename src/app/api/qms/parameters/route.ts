import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsParameters } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QM = ["quality_manager", "admin", "owner"] as const;
const QT = ["quality_tech", "quality_manager", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...QT]);
  if (!auth.ok) return auth.response;
  await initDb();
  const data = await dbQmsParameters.getAll(auth.payload.tenantId!);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const body = await request.json();
  const { name, code, parameterType, unit, description } = body;
  if (!name || !code || !parameterType) {
    return NextResponse.json({ error: "name, code, and parameterType are required" }, { status: 400 });
  }

  const validTypes = ["numeric", "percentage", "pass_fail", "text", "visual_rating"];
  if (!validTypes.includes(parameterType)) {
    return NextResponse.json({ error: "Invalid parameterType" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await dbQmsParameters.create({ id, tenantId: auth.payload.tenantId!, name, code, parameterType, unit, description, createdAt: now });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "qms_parameter", entityId: id, entityName: name }).catch(() => {});
  return NextResponse.json({ id, name, code, parameterType }, { status: 201 });
}
