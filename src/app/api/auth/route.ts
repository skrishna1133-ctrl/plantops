import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionToken, verifySessionToken, verifyPassword } from "@/lib/auth";
import { dbUsers, dbTenants } from "@/lib/db";

const ADMIN_ID = process.env.ADMIN_ID || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

export async function GET(request: NextRequest) {
  try {
    const session = request.cookies.get("plantops_session")?.value;
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const payload = await verifySessionToken(session);
    if (!payload) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    if (payload.userId === "bootstrap") {
      return NextResponse.json({
        authenticated: true,
        userId: "bootstrap",
        role: "super_admin",
        fullName: "Platform Admin",
        tenantId: null,
        tenantName: null,
      });
    }

    const user = await dbUsers.getById(payload.userId);
    if (!user || !user.active) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    let tenantName: string | null = null;
    if (payload.tenantId) {
      const tenant = await dbTenants.getById(payload.tenantId);
      tenantName = tenant?.name ?? null;
    }

    return NextResponse.json({
      authenticated: true,
      userId: user.id,
      role: user.role,
      fullName: user.fullName,
      tenantId: payload.tenantId,
      tenantName,
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, companyCode } = body;

    if (!companyCode) {
      return NextResponse.json({ error: "Company code is required" }, { status: 400 });
    }

    const code = String(companyCode).toUpperCase().trim();

    // PLATFORM code → super_admin or bootstrap fallback
    if (code === "PLATFORM") {
      // Try DB super_admin user first (tenantId: null = look for users with no tenant)
      const dbUser = await dbUsers.getByUsername(username, null);
      if (dbUser && dbUser.role === "super_admin") {
        const valid = await verifyPassword(password, dbUser.passwordHash);
        if (valid) {
          const token = await createSessionToken({ userId: dbUser.id, role: dbUser.role, tenantId: null });
          const cookieStore = await cookies();
          cookieStore.set("plantops_session", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24,
            path: "/",
          });
          return NextResponse.json({ success: true, role: dbUser.role });
        }
      }

      // Bootstrap admin env var fallback
      if (username === ADMIN_ID && password === ADMIN_PASSWORD) {
        const token = await createSessionToken({ userId: "bootstrap", role: "super_admin", tenantId: null });
        const cookieStore = await cookies();
        cookieStore.set("plantops_session", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24,
          path: "/",
        });
        return NextResponse.json({ success: true, role: "super_admin" });
      }

      return NextResponse.json({ error: "Invalid credentials or company code" }, { status: 401 });
    }

    // Regular tenant login: look up tenant by code
    const tenant = await dbTenants.getByCode(code);
    if (!tenant) {
      return NextResponse.json({ error: "Invalid credentials or company code" }, { status: 401 });
    }

    const dbUser = await dbUsers.getByUsername(username, tenant.id);
    if (!dbUser) {
      return NextResponse.json({ error: "Invalid credentials or company code" }, { status: 401 });
    }

    const valid = await verifyPassword(password, dbUser.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials or company code" }, { status: 401 });
    }

    const token = await createSessionToken({ userId: dbUser.id, role: dbUser.role, tenantId: tenant.id });
    const cookieStore = await cookies();
    cookieStore.set("plantops_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });
    return NextResponse.json({ success: true, role: dbUser.role });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("plantops_session");
  return NextResponse.json({ success: true });
}
