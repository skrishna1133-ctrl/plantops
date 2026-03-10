/**
 * Route guard tests — verifies that each API module rejects the wrong roles
 * with 401 (no auth) or 403 (wrong role).
 *
 * This is a breadth-first scan: one request per role per route family.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { seedTestData, cleanTestData } from "../helpers/seed-ids";
import { reqAs } from "../helpers/request";
import type { NextRequest } from "next/server";

// Import route handlers
const { GET: GET_QMS_LOTS }      = await import("@/app/api/qms/lots/route");
const { GET: GET_MAINTENANCE_WO } = await import("@/app/api/maintenance/work-orders/route");
const { GET: GET_OPS_JOBS }       = await import("@/app/api/ops/jobs/route");
const { GET: GET_QMS_NCRS }       = await import("@/app/api/qms/ncrs/route");

beforeAll(async () => {
  await cleanTestData();
  await seedTestData();
}, 60_000);

// ─── Helpers ────────────────────────────────────────────────────────────────

type Role = "worker" | "quality_tech" | "quality_manager" | "engineer"
  | "shipping" | "receiving" | "maintenance_tech" | "maintenance_manager"
  | "admin" | "owner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkRole(
  handler: (req: NextRequest, ...args: any[]) => Promise<Response>,
  role: Role,
  path: string,
  expectedStatus: 200 | 403
) {
  const req = await reqAs(role, path);
  const res = await handler(req);
  expect(res.status, `${role} → ${path}`).toBe(expectedStatus);
}

// ─── QMS lots: quality_tech, quality_manager, admin, owner ────────────────

describe("QMS /api/qms/lots role guards", () => {
  const allowed: Role[] = ["quality_tech", "quality_manager", "admin", "owner"];
  const denied: Role[]  = ["worker", "shipping", "receiving", "maintenance_tech", "maintenance_manager", "engineer"];

  for (const role of allowed) {
    it(`allows ${role}`, () => checkRole(GET_QMS_LOTS, role, "/api/qms/lots", 200));
  }
  for (const role of denied) {
    it(`denies ${role}`, () => checkRole(GET_QMS_LOTS, role, "/api/qms/lots", 403));
  }

  it("returns 401 for unauthenticated", async () => {
    const req = await reqAs(null, "/api/qms/lots");
    const res = await GET_QMS_LOTS(req);
    expect(res.status).toBe(401);
  });
});

// ─── CMMS work orders: maintenance roles + admin/owner/engineer ─────────────

describe("CMMS /api/maintenance/work-orders role guards", () => {
  const allowed: Role[] = ["maintenance_tech", "maintenance_manager", "admin", "owner", "engineer"];
  const denied: Role[]  = ["worker", "quality_tech", "quality_manager", "shipping", "receiving"];

  for (const role of allowed) {
    it(`allows ${role}`, () => checkRole(GET_MAINTENANCE_WO, role, "/api/maintenance/work-orders", 200));
  }
  for (const role of denied) {
    it(`denies ${role}`, () => checkRole(GET_MAINTENANCE_WO, role, "/api/maintenance/work-orders", 403));
  }

  it("returns 401 for unauthenticated", async () => {
    const req = await reqAs(null, "/api/maintenance/work-orders");
    const res = await GET_MAINTENANCE_WO(req);
    expect(res.status).toBe(401);
  });
});

// ─── OPS jobs: broad access (all ops + quality roles) ───────────────────────

describe("OPS /api/ops/jobs role guards", () => {
  const allowed: Role[] = ["worker", "quality_tech", "quality_manager", "engineer", "shipping", "receiving", "admin", "owner"];
  const denied: Role[]  = ["maintenance_tech", "maintenance_manager"];

  for (const role of allowed) {
    it(`allows ${role}`, () => checkRole(GET_OPS_JOBS, role, "/api/ops/jobs", 200));
  }
  for (const role of denied) {
    it(`denies ${role}`, () => checkRole(GET_OPS_JOBS, role, "/api/ops/jobs", 403));
  }
});
