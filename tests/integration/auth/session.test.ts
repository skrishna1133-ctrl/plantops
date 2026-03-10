/**
 * Integration tests for GET /api/auth and session verification.
 * Tests use the seeded test users.
 *
 * Note: POST /api/auth uses next/headers cookies() which requires mocking.
 * We test login success/failure via the mock, and verify session via GET.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { IDS, seedTestData, cleanTestData } from "../../helpers/seed-ids";
import { reqAs, makeRequest, expectStatus } from "../../helpers/request";
import { cookieFor } from "../../helpers/auth";

// Mock next/headers so the auth POST route can set cookies in test context
vi.mock("next/headers", () => ({
  cookies: () => ({
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  }),
}));

// Import route handlers after mock is set up
const { GET, POST } = await import("@/app/api/auth/route");

beforeAll(async () => {
  await cleanTestData();
  await seedTestData();
}, 60_000);

describe("GET /api/auth — session check", () => {
  it("returns 401 with no cookie", async () => {
    const req = makeRequest("/api/auth");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });

  it("returns 401 with invalid/tampered cookie", async () => {
    const req = makeRequest("/api/auth", { cookie: "plantops_session=garbage.token" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns authenticated user info for a valid session cookie", async () => {
    const req = await reqAs("admin", "/api/auth");
    const res = await GET(req);
    const body = await expectStatus<{ authenticated: boolean; role: string; userId: string; tenantId: string }>(res, 200);
    expect(body.authenticated).toBe(true);
    expect(body.role).toBe("admin");
    expect(body.userId).toBe(IDS.USER_ADMIN);
  });

  it("returns 401 for inactive user cookie", async () => {
    // The cookie is valid but the user is inactive — route checks user.active
    const cookie = await cookieFor("inactive");
    const req = makeRequest("/api/auth", { cookie });
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });

  it("returns correct role for each seeded role", async () => {
    const roles = [
      "worker", "quality_tech", "quality_manager", "engineer",
      "shipping", "receiving", "maintenance_tech", "maintenance_manager",
      "admin", "owner",
    ] as const;

    for (const role of roles) {
      const req = await reqAs(role, "/api/auth");
      const res = await GET(req);
      const body = await expectStatus<{ role: string }>(res, 200);
      expect(body.role).toBe(role);
    }
  });
});

describe("POST /api/auth — login", () => {
  it("logs in with valid credentials and company code", async () => {
    const req = makeRequest("/api/auth", {
      method: "POST",
      body: { username: "test.admin", password: "password123", companyCode: "TC" },
    });
    const res = await POST(req);
    const body = await expectStatus<{ success: boolean; role: string }>(res, 200);
    expect(body.success).toBe(true);
    expect(body.role).toBe("admin");
  });

  it("rejects wrong password", async () => {
    const req = makeRequest("/api/auth", {
      method: "POST",
      body: { username: "test.admin", password: "wrongpassword", companyCode: "TC" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects unknown company code", async () => {
    const req = makeRequest("/api/auth", {
      method: "POST",
      body: { username: "test.admin", password: "password123", companyCode: "ZZZZ" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects missing company code", async () => {
    const req = makeRequest("/api/auth", {
      method: "POST",
      body: { username: "test.admin", password: "password123" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects inactive user login", async () => {
    const req = makeRequest("/api/auth", {
      method: "POST",
      body: { username: "test.inactive", password: "password123", companyCode: "TC" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
