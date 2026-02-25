import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsCustomerSpecs } from "@/lib/db-qms";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const QM = ["quality_manager", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();
  const { searchParams } = request.nextUrl;
  const customerName = searchParams.get("customer") ?? undefined;
  const data = await dbQmsCustomerSpecs.getAll(auth.payload.tenantId!, customerName);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const body = await request.json();
  const { customerName, materialTypeId, parameterId, minValue, maxValue, notes, requiresCoa } = body;
  if (!customerName) return NextResponse.json({ error: "customerName is required" }, { status: 400 });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await dbQmsCustomerSpecs.create({
    id, tenantId: auth.payload.tenantId!, customerName, materialTypeId, parameterId,
    minValue, maxValue, notes, requiresCoa: !!requiresCoa, createdAt: now,
  });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "qms_customer_spec", entityId: id, entityName: customerName }).catch(() => {});
  return NextResponse.json({ id }, { status: 201 });
}
