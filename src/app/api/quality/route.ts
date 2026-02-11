import { NextRequest, NextResponse } from "next/server";
import { dbQualityDocs } from "@/lib/db";
import { verifySessionToken } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import type { QualityDocument, QualityDocRow } from "@/lib/schemas";

function generateDocId(): string {
  const prefix = "QD";
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${date}-${random}`;
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const sessionCookie = request.cookies.get("plantops_session");
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifySessionToken(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check role - must be worker, lab_tech, admin, or owner
    if (!["worker", "lab_tech", "admin", "owner"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;

    const docs = await dbQualityDocs.getAll({ status });
    return NextResponse.json(docs);
  } catch (error) {
    console.error("Error fetching quality docs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { poNumber, materialCode, customerName, customerPo, tareWeight, rowCount } = body;

    if (!poNumber) {
      return NextResponse.json({ error: "PO number is required" }, { status: 400 });
    }
    if (!materialCode) {
      return NextResponse.json({ error: "Material code is required" }, { status: 400 });
    }
    if (!customerName) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }
    if (!customerPo) {
      return NextResponse.json({ error: "Customer PO is required" }, { status: 400 });
    }
    if (!rowCount || rowCount < 1 || rowCount > 100) {
      return NextResponse.json({ error: "Row count must be between 1 and 100" }, { status: 400 });
    }

    const rows: QualityDocRow[] = Array.from({ length: rowCount }, (_, i) => ({
      serialNumber: i + 1,
    }));

    const now = new Date().toISOString();
    const doc: QualityDocument = {
      id: uuidv4(),
      docId: generateDocId(),
      poNumber,
      materialCode,
      customerName,
      customerPo,
      tareWeight: tareWeight ?? 75,
      rowCount,
      rows,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };

    await dbQualityDocs.create(doc);

    return NextResponse.json({ docId: doc.docId, id: doc.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating quality doc:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
