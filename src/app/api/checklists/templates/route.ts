import { NextRequest, NextResponse } from "next/server";
import { dbTemplates } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import type { ChecklistTemplate, TemplateItem } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const sessionCookie = request.cookies.get("plantops_session");
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifySession(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check role - must be worker, admin, or owner
    if (!["worker", "admin", "owner"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || undefined;
    const activeParam = searchParams.get("active");
    const active = activeParam === "false" ? undefined : true;

    const templates = await dbTemplates.getAll({ type, active });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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

    await dbTemplates.create(template);

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
