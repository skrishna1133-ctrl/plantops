import { NextRequest, NextResponse } from "next/server";
import { dbQualityTemplates } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, ["quality_tech", "admin", "owner"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const template = await dbQualityTemplates.getById(id);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error fetching quality template:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, ["admin", "owner"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();

    if (body.active !== undefined) {
      const updated = await dbQualityTemplates.update(id, { active: body.active });
      if (!updated) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    if (body.title) {
      if (body.title.length < 3) {
        return NextResponse.json({ error: "Title must be at least 3 characters" }, { status: 400 });
      }
      const updated = await dbQualityTemplates.update(id, { title: body.title });
      if (!updated) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  } catch (error) {
    console.error("Error updating quality template:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, ["admin", "owner"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const deleted = await dbQualityTemplates.delete(id);
    if (!deleted) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quality template:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
