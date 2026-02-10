import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionToken, verifySessionToken, verifyPassword } from "@/lib/auth";
import { dbUsers } from "@/lib/db";

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
        role: payload.role,
        fullName: "Admin",
      });
    }

    const user = await dbUsers.getById(payload.userId);
    if (!user || !user.active) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      userId: user.id,
      role: user.role,
      fullName: user.fullName,
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // Try DB user first
    const dbUser = await dbUsers.getByUsername(username);
    if (dbUser) {
      const valid = await verifyPassword(password, dbUser.passwordHash);
      if (valid) {
        const token = await createSessionToken({ userId: dbUser.id, role: dbUser.role });
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

    // Fall back to env var bootstrap admin
    if (username === ADMIN_ID && password === ADMIN_PASSWORD) {
      const token = await createSessionToken({ userId: "bootstrap", role: "admin" });
      const cookieStore = await cookies();
      cookieStore.set("plantops_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24,
        path: "/",
      });
      return NextResponse.json({ success: true, role: "admin" });
    }

    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
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
