import { NextRequest, NextResponse } from "next/server";
import { dbTemplates } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

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
      const updated = await dbTemplates.update(id, { active: body.active });
      if (!updated) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
    }

    if (body.title !== undefined) {
      const updated = await dbTemplates.update(id, { title: body.title });
      if (!updated) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
    }

    const template = await dbTemplates.getById(id);
    return NextResponse.json(template);
  } catch (error) {
    console.error("Error updating template:", error);
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
    const deleted = await dbTemplates.delete(id);

    if (!deleted) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
