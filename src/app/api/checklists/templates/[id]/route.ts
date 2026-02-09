import { NextRequest, NextResponse } from "next/server";
import { checklistTemplates } from "@/lib/store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const template = checklistTemplates.find((t) => t.id === id);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    if (body.title !== undefined) template.title = body.title;
    if (body.type !== undefined) template.type = body.type;
    if (body.description !== undefined) template.description = body.description;
    if (body.items !== undefined) template.items = body.items;
    if (body.active !== undefined) template.active = body.active;

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = checklistTemplates.findIndex((t) => t.id === id);

  if (index === -1) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  checklistTemplates.splice(index, 1);
  return NextResponse.json({ success: true });
}
