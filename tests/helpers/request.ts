/**
 * Helpers to construct NextRequest objects for testing route handlers directly.
 * This avoids spinning up a real HTTP server.
 */
import { NextRequest } from "next/server";
import { cookieFor } from "./auth";
import type { UserRole } from "@/lib/schemas";

const BASE = "http://localhost";

export interface RequestOptions {
  method?: string;
  body?: unknown;
  cookie?: string;         // raw Set-Cookie header value
  searchParams?: Record<string, string>;
}

/** Build a NextRequest for a given path. */
export function makeRequest(path: string, opts: RequestOptions = {}): NextRequest {
  const { method = "GET", body, cookie, searchParams } = opts;
  const url = new URL(path, BASE);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v);
    }
  }

  const headers = new Headers();
  if (cookie) headers.set("Cookie", cookie);
  if (body !== undefined) headers.set("Content-Type", "application/json");

  return new NextRequest(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** Shorthand: make an authenticated request for a role. */
export async function reqAs(
  role: UserRole | "inactive" | null,
  path: string,
  opts: Omit<RequestOptions, "cookie"> = {}
): Promise<NextRequest> {
  const cookie = role ? await cookieFor(role) : undefined;
  return makeRequest(path, { ...opts, cookie });
}

/** Read JSON body from a Response. */
export async function json<T = unknown>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

/** Assert response status and return body. */
export async function expectStatus<T = unknown>(
  res: Response,
  status: number
): Promise<T> {
  if (res.status !== status) {
    let body = "";
    try { body = await res.text(); } catch { /* ignore */ }
    throw new Error(
      `Expected HTTP ${status}, got ${res.status}.\nBody: ${body}`
    );
  }
  if (res.headers.get("content-type")?.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return undefined as T;
}
