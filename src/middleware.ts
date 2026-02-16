import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import type { UserRole } from "@/lib/schemas";

const routeRoles: Record<string, UserRole[]> = {
  "/admin": ["admin", "owner"],
  "/lab": ["quality_tech", "admin", "owner"],
  "/view": ["engineer", "admin", "owner"],
  "/shipments": ["shipping", "admin", "owner"],
  "/checklists": ["worker", "admin", "owner"],
  "/quality": ["worker", "admin", "owner"],
  "/documents": ["worker", "quality_tech", "engineer", "shipping", "admin", "owner"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip login pages
  if (pathname === "/admin/login" || pathname === "/login") {
    return NextResponse.next();
  }

  // Find which protected route this matches
  const matchedRoute = Object.keys(routeRoles).find((route) =>
    pathname.startsWith(route)
  );

  if (!matchedRoute) return NextResponse.next();

  const session = request.cookies.get("plantops_session")?.value;
  const payload = session ? await verifySessionToken(session) : null;

  if (!payload) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const allowedRoles = routeRoles[matchedRoute];
  if (!allowedRoles.includes(payload.role)) {
    const redirectMap: Record<string, string> = {
      worker: "/quality",
      quality_tech: "/lab",
      engineer: "/view",
      shipping: "/shipments",
      admin: "/admin",
      owner: "/admin",
    };
    const target = redirectMap[payload.role] || "/";
    return NextResponse.redirect(new URL(target, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/lab/:path*", "/view/:path*", "/shipments/:path*", "/checklists/:path*", "/quality/:path*", "/documents/:path*"],
};
