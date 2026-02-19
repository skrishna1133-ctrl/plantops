import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { dbInstructionDocuments, dbDocumentFolders, dbUsers } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import crypto from "crypto";
import type { UserRole } from "@/lib/schemas";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["worker", "quality_tech", "engineer", "shipping", "admin", "owner"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;

  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId") || undefined;

    const isAdmin = ["admin", "owner", "super_admin"].includes(auth.payload.role);
    const docs = await dbInstructionDocuments.getAll(tenantId, {
      folderId,
      role: isAdmin ? undefined : auth.payload.role,
    });

    return NextResponse.json(docs);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["admin", "owner", "engineer"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const folderId = formData.get("folderId") as string | null;
    const description = formData.get("description") as string | null;
    const allowedRolesStr = formData.get("allowedRoles") as string | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }
    if (!title || title.length < 2) {
      return NextResponse.json({ error: "Title must be at least 2 characters" }, { status: 400 });
    }
    if (!folderId) {
      return NextResponse.json({ error: "Folder is required" }, { status: 400 });
    }
    if (!allowedRolesStr) {
      return NextResponse.json({ error: "At least one allowed role is required" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size must be under 50MB" }, { status: 400 });
    }

    const folder = await dbDocumentFolders.getById(folderId);
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    let allowedRoles: UserRole[];
    try {
      allowedRoles = JSON.parse(allowedRolesStr);
    } catch {
      return NextResponse.json({ error: "Invalid allowedRoles format" }, { status: 400 });
    }

    const blob = await put(`documents/${crypto.randomUUID()}_${file.name}`, file, {
      access: "public",
    });

    const user = await dbUsers.getById(auth.payload.userId);
    const uploaderName = user?.fullName || "Unknown";

    const now = new Date().toISOString();
    const doc = {
      id: crypto.randomUUID(),
      folderId,
      folderName: folder.name,
      title,
      description: description || undefined,
      fileName: file.name,
      fileUrl: blob.url,
      fileSize: file.size,
      previousFileUrl: undefined,
      previousFileName: undefined,
      allowedRoles,
      uploadedBy: uploaderName,
      uploadedByUserId: auth.payload.userId,
      createdAt: now,
      updatedAt: now,
    };

    await dbInstructionDocuments.create(doc, tenantId);
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
