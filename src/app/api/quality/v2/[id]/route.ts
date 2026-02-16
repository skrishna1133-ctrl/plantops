import { NextRequest, NextResponse } from "next/server";
import { dbQualityDocsV2, dbQualityTemplates, dbUsers } from "@/lib/db";
import { verifySessionToken } from "@/lib/auth";
import { evaluateFormula } from "@/lib/formula";
import type { QualityFieldValue, QualityDocRowV2, QualityTemplateField } from "@/lib/schemas";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionCookie = request.cookies.get("plantops_session");
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifySessionToken(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["worker", "quality_tech", "admin", "owner"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const doc = await dbQualityDocsV2.getById(id);
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Also return the template for field definitions
    const template = await dbQualityTemplates.getById(doc.templateId);

    return NextResponse.json({ doc, template });
  } catch (error) {
    console.error("Error fetching quality doc v2:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionCookie = request.cookies.get("plantops_session");
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifySessionToken(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["worker", "quality_tech", "admin", "owner"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const doc = await dbQualityDocsV2.getById(id);
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const body = await request.json();
    const { headerValues, rows, status } = body;

    // Validate status transitions
    if (status) {
      if (doc.status === "draft" && status === "worker_filled") {
        if (!["worker", "admin", "owner"].includes(payload.role)) {
          return NextResponse.json({ error: "Only workers can submit draft documents" }, { status: 403 });
        }
      } else if (doc.status === "worker_filled" && status === "complete") {
        if (!["quality_tech", "admin", "owner"].includes(payload.role)) {
          return NextResponse.json({ error: "Only quality techs can complete documents" }, { status: 403 });
        }
      } else if (status !== doc.status && !["admin", "owner"].includes(payload.role)) {
        return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
      }
    }

    // Get template for field definitions and formula evaluation
    const template = await dbQualityTemplates.getById(doc.templateId);

    // Compute calculated fields if we have rows/headerValues and template
    let finalHeaderValues = headerValues || doc.headerValues;
    let finalRows: QualityDocRowV2[] = rows || doc.rows;

    if (template) {
      // Build header lookup for formulas
      const headerLookup: Record<string, number> = {};
      for (const val of finalHeaderValues) {
        if (val.numericValue !== undefined) {
          headerLookup[val.fieldId] = val.numericValue;
        }
        if (val.calculatedValue !== undefined) {
          headerLookup[val.fieldId] = val.calculatedValue;
        }
      }

      // Compute calculated header fields
      for (const field of template.headerFields) {
        if (field.type === "calculated" && field.formula) {
          const val = finalHeaderValues.find((v: QualityFieldValue) => v.fieldId === field.id);
          if (val) {
            const result = evaluateFormula(field.formula, {
              headerValues: headerLookup,
              rowValues: {},
            });
            val.calculatedValue = result ?? undefined;
            if (result !== null) {
              headerLookup[field.id] = result;
            }
          }
        }
      }

      // Compute calculated row fields
      finalRows = finalRows.map((row: QualityDocRowV2) => {
        const rowLookup: Record<string, number> = {};
        for (const val of row.values) {
          if (val.numericValue !== undefined) {
            rowLookup[val.fieldId] = val.numericValue;
          }
          if (val.calculatedValue !== undefined) {
            rowLookup[val.fieldId] = val.calculatedValue;
          }
        }

        // Multi-pass to resolve dependent calculations
        for (let pass = 0; pass < 3; pass++) {
          for (const field of template.rowFields) {
            if (field.type === "calculated" && field.formula) {
              const val = row.values.find((v: QualityFieldValue) => v.fieldId === field.id);
              if (val) {
                const result = evaluateFormula(field.formula, {
                  headerValues: headerLookup,
                  rowValues: rowLookup,
                });
                val.calculatedValue = result ?? undefined;
                if (result !== null) {
                  rowLookup[field.id] = result;
                }
              }
            }
          }
        }

        return row;
      });
    }

    // Get user name for audit trail
    const user = await dbUsers.getById(payload.userId);
    const userName = user?.fullName || "Unknown";

    const updateData: Record<string, unknown> = {
      headerValues: finalHeaderValues,
      rows: finalRows,
    };

    if (status) {
      updateData.status = status;
    }

    if (status === "worker_filled") {
      updateData.workerName = userName;
      updateData.workerFilledAt = new Date().toISOString();
    } else if (status === "complete") {
      updateData.qualityTechName = userName;
      updateData.completedAt = new Date().toISOString();
    }

    const updated = await dbQualityDocsV2.update(id, updateData);
    if (!updated) {
      return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating quality doc v2:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const deleted = await dbQualityDocsV2.delete(id);
    if (!deleted) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quality doc v2:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
