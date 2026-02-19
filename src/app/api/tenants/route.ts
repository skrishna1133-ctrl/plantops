import { NextRequest, NextResponse } from "next/server";
import { dbTenants } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import crypto from "crypto";
import type { Tenant } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, []);
  if (!auth.ok) return auth.response;

  // Only super_admin can list all tenants
  if (auth.payload.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const tenants = await dbTenants.getAll();
    return NextResponse.json(tenants);
  } catch (error) {
    console.error("Error fetching tenants:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, []);
  if (!auth.ok) return auth.response;

  if (auth.payload.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, code } = body;

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Tenant name must be at least 2 characters" }, { status: 400 });
    }
    if (!code || code.length < 2) {
      return NextResponse.json({ error: "Company code must be at least 2 characters" }, { status: 400 });
    }

    const tenant: Tenant = {
      id: crypto.randomUUID(),
      name: name.trim(),
      code: code.toUpperCase().trim(),
      active: true,
      createdAt: new Date().toISOString(),
    };

    await dbTenants.create(tenant);
    return NextResponse.json(tenant, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "Company code already exists" }, { status: 409 });
    }
    console.error("Error creating tenant:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
