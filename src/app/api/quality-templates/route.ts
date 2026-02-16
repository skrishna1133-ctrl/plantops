import { NextRequest, NextResponse } from "next/server";
import { dbQualityTemplates } from "@/lib/db";
import { verifySessionToken } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import type { QualityTemplate, QualityTemplateField } from "@/lib/schemas";
import { validateFormula } from "@/lib/formula";

function generateTemplateId(): string {
  const prefix = "QT";
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${date}-${random}`;
}

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("plantops_session");
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifySessionToken(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["quality_tech", "admin", "owner"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const active = searchParams.get("active");

    const templates = await dbQualityTemplates.getAll({
      active: active !== null ? active === "true" : undefined,
    });
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching quality templates:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("plantops_session");
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifySessionToken(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["admin", "owner"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, headerFields, rowFields, defaultRowCount, minRowCount, maxRowCount } = body;

    if (!title || title.length < 3) {
      return NextResponse.json({ error: "Title must be at least 3 characters" }, { status: 400 });
    }

    if ((!headerFields || headerFields.length === 0) && (!rowFields || rowFields.length === 0)) {
      return NextResponse.json({ error: "At least one header or row field is required" }, { status: 400 });
    }

    // Validate fields
    const allFields = [...(headerFields || []), ...(rowFields || [])];
    const allFieldIds = allFields.map((f: QualityTemplateField) => f.id);

    // Check unique IDs
    if (new Set(allFieldIds).size !== allFieldIds.length) {
      return NextResponse.json({ error: "Field IDs must be unique" }, { status: 400 });
    }

    // Validate field labels
    for (const field of allFields) {
      if (!field.label || field.label.length < 1) {
        return NextResponse.json({ error: "All fields must have a label" }, { status: 400 });
      }
    }

    // Validate calculated field formulas
    const headerFieldIds = (headerFields || []).map((f: QualityTemplateField) => f.id);
    const rowFieldIds = (rowFields || []).map((f: QualityTemplateField) => f.id);

    for (const field of allFields) {
      if (field.type === "calculated" && field.formula) {
        const result = validateFormula(field.formula, rowFieldIds, headerFieldIds);
        if (!result.valid) {
          return NextResponse.json({ error: `Formula error in "${field.label}": ${result.error}` }, { status: 400 });
        }
      }
    }

    const now = new Date().toISOString();
    const template: QualityTemplate = {
      id: uuidv4(),
      templateId: generateTemplateId(),
      title,
      description: description || undefined,
      headerFields: (headerFields || []).map((f: QualityTemplateField) => ({
        ...f,
        id: f.id || uuidv4(),
        context: "header" as const,
      })),
      rowFields: (rowFields || []).map((f: QualityTemplateField) => ({
        ...f,
        id: f.id || uuidv4(),
        context: "row" as const,
      })),
      active: true,
      defaultRowCount: defaultRowCount || 1,
      minRowCount: minRowCount || undefined,
      maxRowCount: maxRowCount || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await dbQualityTemplates.create(template);

    return NextResponse.json({ templateId: template.templateId, id: template.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating quality template:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
