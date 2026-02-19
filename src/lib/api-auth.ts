import { type NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import type { SessionPayload } from "@/lib/auth";
import type { UserRole } from "@/lib/schemas";

export type AuthResult =
  | { ok: true; payload: SessionPayload }
  | { ok: false; response: NextResponse };

export async function requireAuth(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<AuthResult> {
  const sessionCookie = request.cookies.get("plantops_session");
  if (!sessionCookie) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const payload = await verifySessionToken(sessionCookie.value);
  if (!payload) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  // super_admin bypasses all role checks
  if (payload.role === "super_admin") {
    return { ok: true, payload };
  }

  if (!allowedRoles.includes(payload.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, payload };
}
