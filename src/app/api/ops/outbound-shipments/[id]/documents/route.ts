import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbOpsShipmentDocuments, dbOpsOutboundShipments } from "@/lib/db-ops";
import { initDb } from "@/lib/db";
import { put } from "@vercel/blob";
import { logActivity } from "@/lib/db-activity";

const SHIPPING = ["owner", "admin", "engineer", "shipping"] as const;
const ALL_OPS = ["owner", "admin", "engineer", "shipping", "receiving", "quality_manager", "quality_tech", "worker"] as const;

const ALLOWED_TYPES = ["BOL", "COA", "weight_ticket", "customs", "invoice", "packing_list", "other"];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...ALL_OPS]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const docs = await dbOpsShipmentDocuments.getAll(auth.payload.tenantId!, id);
  return NextResponse.json(docs);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...SHIPPING]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const shipment = await dbOpsOutboundShipments.getById(id, auth.payload.tenantId!);
  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const documentType = (formData.get("documentType") as string | null) ?? "other";

  if (!file || file.size === 0) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });

  const safeType = ALLOWED_TYPES.includes(documentType) ? documentType : "other";
  const blob = await put(
    `ops/shipments/outbound/${id}/${safeType}/${crypto.randomUUID()}-${file.name}`,
    file,
    { access: "public" }
  );

  const docId = crypto.randomUUID();
  const now = new Date().toISOString();
  await dbOpsShipmentDocuments.create({
    id: docId,
    tenantId: auth.payload.tenantId!,
    outboundShipmentId: id,
    documentType: safeType,
    fileName: file.name,
    fileUrl: blob.url,
    uploadedById: auth.payload.userId,
    uploadedAt: now,
  });

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "uploaded", entityType: "ops_shipment_document", entityId: docId, entityName: file.name }).catch(() => {});
  return NextResponse.json({ id: docId, url: blob.url, fileName: file.name, documentType: safeType }, { status: 201 });
}
