import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbOpsVendors } from "@/lib/db-ops";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";

const MANAGER = ["owner", "admin", "engineer"] as const;
const ALL_OPS = ["owner", "admin", "engineer", "shipping", "receiving", "quality_manager", "quality_tech", "worker"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...ALL_OPS]);
  if (!auth.ok) return auth.response;
  await initDb();
  const data = await dbOpsVendors.getAll(auth.payload.tenantId!);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER]);
  if (!auth.ok) return auth.response;
  await initDb();

  const body = await request.json();
  const { name, code, contactName, contactEmail, contactPhone, address, notes } = body;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await dbOpsVendors.create({ id, tenantId: auth.payload.tenantId!, name, code, contactName, contactEmail, contactPhone, address, notes, createdAt: now });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "created", entityType: "ops_vendor", entityId: id, entityName: name }).catch(() => {});
  return NextResponse.json({ id, name }, { status: 201 });
}
