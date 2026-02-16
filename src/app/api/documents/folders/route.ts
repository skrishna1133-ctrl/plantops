import { NextRequest, NextResponse } from "next/server";
import { dbDocumentFolders } from "@/lib/db";
import { verifySessionToken } from "@/lib/auth";
import crypto from "crypto";

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

    const folders = await dbDocumentFolders.getAll();
    return NextResponse.json(folders);
  } catch (error) {
    console.error("Error fetching document folders:", error);
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

    await dbDocumentFolders.create(folder);
    return NextResponse.json(folder, { status: 201 });
  } catch (error) {
    console.error("Error creating document folder:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
