import { NextRequest, NextResponse } from "next/server";
import { dbQualityDocs, dbUsers } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, ["worker", "quality_tech", "admin", "owner"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const doc = await dbQualityDocs.getById(id);

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json(doc);
  } catch (error) {
    console.error("Error fetching quality doc:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, ["worker", "quality_tech", "admin", "owner"]);
  if (!auth.ok) return auth.response;

  try {
    const user = await dbUsers.getById(auth.payload.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const body = await request.json();
    const { rows, status } = body;

    const updateData: Record<string, unknown> = {};
    if (rows !== undefined) updateData.rows = rows;
    if (status !== undefined) updateData.status = status;
    updateData.personName = user.fullName;

    const updated = await dbQualityDocs.update(id, updateData);
    if (!updated) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating quality doc:", error);
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
    const deleted = await dbQualityDocs.delete(id);

    if (!deleted) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quality doc:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
