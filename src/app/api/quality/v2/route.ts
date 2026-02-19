import { NextRequest, NextResponse } from "next/server";
import { dbQualityDocsV2, dbQualityTemplates } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { v4 as uuidv4 } from "uuid";
import type { QualityDocumentV2, QualityFieldValue, QualityDocRowV2 } from "@/lib/schemas";

function generateDocId(): string {
  const prefix = "QD";
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${date}-${random}`;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["worker", "quality_tech", "admin", "owner"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const templateId = searchParams.get("templateId") || undefined;

    const docs = await dbQualityDocsV2.getAll(tenantId, { status, templateId });
    return NextResponse.json(docs);
  } catch (error) {
    console.error("Error fetching quality docs v2:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["quality_tech", "admin", "owner"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;

  try {
    const body = await request.json();
    const { templateId, rowCount, headerValues } = body;

    if (!templateId) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }

    const template = await dbQualityTemplates.getById(templateId);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    if (!template.active) {
      return NextResponse.json({ error: "Template is inactive" }, { status: 400 });
    }

    // Validate template belongs to same tenant
    if (tenantId !== null && template.tenantId && template.tenantId !== tenantId) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const count = rowCount || template.defaultRowCount;
    if (template.minRowCount && count < template.minRowCount) {
      return NextResponse.json({ error: `Minimum ${template.minRowCount} rows required` }, { status: 400 });
    }
    if (template.maxRowCount && count > template.maxRowCount) {
      return NextResponse.json({ error: `Maximum ${template.maxRowCount} rows allowed` }, { status: 400 });
    }

    const initialHeaderValues: QualityFieldValue[] = template.headerFields.map((field) => {
      const provided = headerValues?.find((v: QualityFieldValue) => v.fieldId === field.id);
      return {
        fieldId: field.id,
        fieldLabel: field.label,
        fieldType: field.type,
        textValue: provided?.textValue ?? (typeof field.defaultValue === "string" ? field.defaultValue : undefined),
        numericValue: provided?.numericValue ?? (typeof field.defaultValue === "number" ? field.defaultValue : undefined),
        booleanValue: provided?.booleanValue ?? (typeof field.defaultValue === "boolean" ? field.defaultValue : undefined),
        unit: field.unit,
      };
    });

    const rows: QualityDocRowV2[] = Array.from({ length: count }, (_, i) => ({
      serialNumber: i + 1,
      values: template.rowFields.map((field) => ({
        fieldId: field.id,
        fieldLabel: field.label,
        fieldType: field.type,
        unit: field.unit,
      })),
    }));

    const now = new Date().toISOString();
    const doc: QualityDocumentV2 = {
      id: uuidv4(),
      docId: generateDocId(),
      templateId: template.id,
      templateTitle: template.title,
      headerValues: initialHeaderValues,
      rows,
      rowCount: count,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };

    await dbQualityDocsV2.create(doc, tenantId);

    return NextResponse.json({ docId: doc.docId, id: doc.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating quality doc v2:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
