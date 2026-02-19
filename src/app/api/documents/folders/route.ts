import { NextRequest, NextResponse } from "next/server";
import { dbDocumentFolders } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["worker", "quality_tech", "engineer", "shipping", "admin", "owner"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;

  try {
    const folders = await dbDocumentFolders.getAll(tenantId);
    return NextResponse.json(folders);
  } catch (error) {
    console.error("Error fetching document folders:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["admin", "owner", "engineer"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;

  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Folder name must be at least 2 characters" }, { status: 400 });
    }

    const folder = {
      id: crypto.randomUUID(),
      name,
      description: description || undefined,
      createdAt: new Date().toISOString(),
    };

    await dbDocumentFolders.create(folder, tenantId);
    return NextResponse.json(folder, { status: 201 });
  } catch (error) {
    console.error("Error creating document folder:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
