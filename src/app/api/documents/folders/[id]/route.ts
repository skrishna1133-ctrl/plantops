import { NextRequest, NextResponse } from "next/server";
import { dbDocumentFolders, dbInstructionDocuments } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, ["admin", "owner", "engineer"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.name || body.name.length < 2) {
      return NextResponse.json({ error: "Folder name must be at least 2 characters" }, { status: 400 });
    }

    const updated = await dbDocumentFolders.update(id, { name: body.name });
    if (!updated) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating folder:", error);
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

    const docCount = await dbInstructionDocuments.countByFolder(id);
    if (docCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete folder with ${docCount} document(s). Move or delete them first.` },
        { status: 400 }
      );
    }

    const deleted = await dbDocumentFolders.delete(id);
    if (!deleted) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting folder:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
