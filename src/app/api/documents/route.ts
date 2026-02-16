import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { dbInstructionDocuments, dbDocumentFolders, dbUsers } from "@/lib/db";
import { verifySessionToken } from "@/lib/auth";
import crypto from "crypto";
import type { UserRole } from "@/lib/schemas";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("plantops_session");
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifySessionToken(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId") || undefined;

    // Admin/owner see all documents, others see only allowed ones
    const isAdmin = ["admin", "owner"].includes(payload.role);
    const docs = await dbInstructionDocuments.getAll({
      folderId,
      role: isAdmin ? undefined : payload.role,
    });

    return NextResponse.json(docs);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size must be under 10MB" }, { status: 400 });
    }

    // Validate folder exists
    const folder = await dbDocumentFolders.getById(folderId);
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Parse allowed roles
    let allowedRoles: UserRole[];
    try {
      allowedRoles = JSON.parse(allowedRolesStr);
    } catch {
      return NextResponse.json({ error: "Invalid allowedRoles format" }, { status: 400 });
    }

    // Upload to Vercel Blob
    const blob = await put(`documents/${crypto.randomUUID()}_${file.name}`, file, {
      access: "public",
    });

    // Get uploader name
    const user = await dbUsers.getById(payload.userId);
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
      uploadedByUserId: payload.userId,
      createdAt: now,
      updatedAt: now,
    };

    await dbInstructionDocuments.create(doc);
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
