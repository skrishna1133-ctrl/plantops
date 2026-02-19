import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { dbUsers } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import type { UserRole } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["admin", "owner"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;

  // super_admin with ?all=true returns all users with tenant names
  const { searchParams } = new URL(request.url);
  if (searchParams.get("all") === "true" && auth.payload.role === "super_admin") {
    const users = await dbUsers.getAllWithTenantName();
    return NextResponse.json(users);
  }

  const users = await dbUsers.getAll(tenantId);
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["admin", "owner"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;

  try {
    const body = await request.json();
    const { username, password, fullName, role } = body;

    if (!username || !password || !fullName || !role) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
    }

    // Prevent creating super_admin unless caller is super_admin
    if (role === "super_admin" && auth.payload.role !== "super_admin") {
      return NextResponse.json({ error: "Cannot create super_admin user" }, { status: 403 });
    }

    const validRoles: UserRole[] = ["worker", "quality_tech", "engineer", "shipping", "admin", "owner"];
    if (auth.payload.role !== "super_admin" && !validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // super_admin can pass body.tenantId to create user in a specific tenant
    const targetTenantId = auth.payload.role === "super_admin" && body.tenantId
      ? body.tenantId
      : tenantId;

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
      tenantId: targetTenantId,
      createdAt: now,
      updatedAt: now,
    }, targetTenantId);

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
