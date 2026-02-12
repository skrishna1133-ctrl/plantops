import { NextRequest, NextResponse } from "next/server";
import { dbQualityDocs, dbUsers } from "@/lib/db";
import { verifySessionToken } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const sessionCookie = request.cookies.get("plantops_session");
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifySessionToken(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check role - must be worker, quality_tech, admin, or owner
    if (!["worker", "quality_tech", "admin", "owner"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
  try {
    // Verify authentication
    const sessionCookie = request.cookies.get("plantops_session");
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifySessionToken(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check role - must be worker, quality_tech, admin, or owner
    if (!["worker", "quality_tech", "admin", "owner"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch user from database
    const user = await dbUsers.getById(payload.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const body = await request.json();
    const { rows, status } = body;

    const updateData: Record<string, unknown> = {};
    if (rows !== undefined) updateData.rows = rows;
    if (status !== undefined) updateData.status = status;
    updateData.personName = user.fullName; // Auto-populate from session

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
  try {
    // Verify authentication
    const sessionCookie = request.cookies.get("plantops_session");
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifySessionToken(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check role - only admin or owner can delete
    if (!["admin", "owner"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
