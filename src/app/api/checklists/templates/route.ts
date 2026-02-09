import { NextRequest, NextResponse } from "next/server";
import { checklistTemplates } from "@/lib/store";
import { v4 as uuidv4 } from "uuid";
import type { ChecklistTemplate, TemplateItem } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const activeOnly = searchParams.get("active") !== "false";

  let filtered = [...checklistTemplates];
  if (activeOnly) {
    filtered = filtered.filter((t) => t.active);
  }
  if (type) {
    filtered = filtered.filter((t) => t.type === type);
  }

  return NextResponse.json(filtered.reverse());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, type, description, items } = body;

    if (!title || title.length < 3) {
      return NextResponse.json({ error: "Title must be at least 3 characters" }, { status: 400 });
    }
    if (!type) {
      return NextResponse.json({ error: "Type is required" }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    const template: ChecklistTemplate = {
      id: uuidv4(),
      title,
      type,
      description: description || undefined,
      items: items.map((item: Omit<TemplateItem, "id">) => ({
        ...item,
        id: uuidv4(),
      })),
      active: true,
      createdAt: new Date().toISOString(),
    };

    checklistTemplates.push(template);

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
