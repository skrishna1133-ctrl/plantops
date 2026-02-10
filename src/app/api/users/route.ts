import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, hashPassword } from "@/lib/auth";
import { dbUsers } from "@/lib/db";
import type { UserRole } from "@/lib/schemas";

async function requireAdmin(request: NextRequest) {
  const session = request.cookies.get("plantops_session")?.value;
  if (!session) return null;
  const payload = await verifySessionToken(session);
  if (!payload || (payload.role !== "admin" && payload.role !== "owner")) return null;
  return payload;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const users = await dbUsers.getAll();
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const body = await request.json();
    const { username, password, fullName, role } = body;

    if (!username || !password || !fullName || !role) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
    }

    const validRoles: UserRole[] = ["worker", "lab_tech", "engineer", "admin", "owner"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await dbUsers.create({
      id,
      username,
      passwordHash,
      fullName,
      role,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ id, username, fullName, role });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
