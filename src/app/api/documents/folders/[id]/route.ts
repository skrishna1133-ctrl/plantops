import { NextRequest, NextResponse } from "next/server";
import { dbDocumentFolders, dbInstructionDocuments } from "@/lib/db";
import { verifySessionToken } from "@/lib/auth";

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

    if (!["admin", "owner", "engineer"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

    // Check if folder has documents
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
