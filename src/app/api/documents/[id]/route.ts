import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { dbInstructionDocuments, dbUsers } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import crypto from "crypto";
import type { UserRole } from "@/lib/schemas";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, ["worker", "quality_tech", "engineer", "shipping", "admin", "owner"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const doc = await dbInstructionDocuments.getById(id);
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isAdmin = ["admin", "owner", "super_admin"].includes(auth.payload.role);
    if (!isAdmin && !doc.allowedRoles.includes(auth.payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(doc);
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, ["admin", "owner", "engineer"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const existing = await dbInstructionDocuments.getById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const title = formData.get("title") as string | null;
      const description = formData.get("description") as string | null;
      const allowedRolesStr = formData.get("allowedRoles") as string | null;

      const updates: Record<string, unknown> = {};

      if (file) {
        if (file.type !== "application/pdf") {
          return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
        }
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json({ error: "File size must be under 50MB" }, { status: 400 });
        }

        if (existing.previousFileUrl) {
          try {
            await del(existing.previousFileUrl);
          } catch {
            // Ignore deletion errors for previous version
          }
        }

        const blob = await put(`documents/${crypto.randomUUID()}_${file.name}`, file, {
          access: "public",
        });

        updates.previousFileUrl = existing.fileUrl;
        updates.previousFileName = existing.fileName;
        updates.fileUrl = blob.url;
        updates.fileName = file.name;
        updates.fileSize = file.size;
      }

      if (title && title.length >= 2) updates.title = title;
      if (description !== null) updates.description = description || undefined;
      if (allowedRolesStr) {
        try {
          updates.allowedRoles = JSON.parse(allowedRolesStr) as UserRole[];
        } catch {
          return NextResponse.json({ error: "Invalid allowedRoles format" }, { status: 400 });
        }
      }

      updates.updatedAt = new Date().toISOString();
      const updated = await dbInstructionDocuments.update(id, updates);
      return NextResponse.json(updated);
    } else {
      const body = await request.json();
      const updates: Record<string, unknown> = {};

      if (body.title && body.title.length >= 2) updates.title = body.title;
      if (body.description !== undefined) updates.description = body.description || undefined;
      if (body.allowedRoles) updates.allowedRoles = body.allowedRoles;

      updates.updatedAt = new Date().toISOString();
      const updated = await dbInstructionDocuments.update(id, updates);
      return NextResponse.json(updated);
    }
  } catch (error) {
    console.error("Error updating document:", error);
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
    const doc = await dbInstructionDocuments.getById(id);
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    try {
      await del(doc.fileUrl);
    } catch {
      // Ignore blob deletion errors
    }
    if (doc.previousFileUrl) {
      try {
        await del(doc.previousFileUrl);
      } catch {
        // Ignore blob deletion errors
      }
    }

    await dbInstructionDocuments.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
