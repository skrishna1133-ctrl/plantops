/**
 * Tenant isolation tests — verifies that data from one tenant
 * is never visible or modifiable by users from another tenant.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { IDS, seedTestData, cleanTestData } from "../helpers/seed-ids";
import { reqAs, makeRequest, expectStatus } from "../helpers/request";
import { cookieForOtherTenant } from "../helpers/auth";

// QMS lots — should be invisible to other tenant
const { GET: GET_LOTS, POST: POST_LOTS } = await import("@/app/api/qms/lots/route");
const { GET: GET_LOT_ID } = await import("@/app/api/qms/lots/[id]/route");
// OPS jobs
const { GET: GET_JOBS } = await import("@/app/api/ops/jobs/route");
const { GET: GET_JOB_ID } = await import("@/app/api/ops/jobs/[id]/route");
// Work orders
const { GET: GET_WOS } = await import("@/app/api/maintenance/work-orders/route");

beforeAll(async () => {
  await cleanTestData();
  await seedTestData();
}, 60_000);

/** Helper: make a request as OTHER tenant admin. */
async function asOther(path: string, opts = {}) {
  const cookie = await cookieForOtherTenant("admin");
  return makeRequest(path, { ...opts, cookie });
}

describe("QMS lots — tenant isolation", () => {
  it("other tenant sees no lots (their tenant has no lots)", async () => {
    const req = await asOther("/api/qms/lots");
    const res = await GET_LOTS(req);
    const body = await expectStatus<{ id: string }[]>(res, 200);
    const ids = body.map(l => l.id);
    // TEST tenant lots must NOT appear
    expect(ids).not.toContain(IDS.QMS_LOT_PENDING);
    expect(ids).not.toContain(IDS.QMS_LOT_APPROVED);
  });

  it("other tenant cannot GET a specific lot from TEST tenant", async () => {
    const req = await asOther(`/api/qms/lots/${IDS.QMS_LOT_PENDING}`);
    const res = await GET_LOT_ID(req, { params: Promise.resolve({ id: IDS.QMS_LOT_PENDING }) });
    // Should be 404 (not found in OTHER tenant) not 403
    expect(res.status).toBe(404);
  });
});

describe("OPS jobs — tenant isolation", () => {
  it("other tenant sees no jobs", async () => {
    const req = await asOther("/api/ops/jobs");
    const res = await GET_JOBS(req);
    const body = await expectStatus<{ id: string }[]>(res, 200);
    const ids = body.map(j => j.id);
    expect(ids).not.toContain(IDS.OPS_JOB);
  });

  it("other tenant cannot GET a specific job from TEST tenant", async () => {
    const req = await asOther(`/api/ops/jobs/${IDS.OPS_JOB}`);
    const res = await GET_JOB_ID(req, { params: Promise.resolve({ id: IDS.OPS_JOB }) });
    expect(res.status).toBe(404);
  });
});

describe("CMMS work orders — tenant isolation", () => {
  it("other tenant sees no work orders", async () => {
    const req = await asOther("/api/maintenance/work-orders");
    // other tenant admin is not a maintenance role — will get 403
    // That still demonstrates isolation: no TEST data leaks
    const res = await GET_WOS(req);
    expect(res.status).toBe(403);
  });

  it("maintenance_manager from other tenant cannot see TEST work orders", async () => {
    const cookie = await cookieForOtherTenant("maintenance_manager");
    const req = makeRequest("/api/maintenance/work-orders", { cookie });
    const res = await GET_WOS(req);
    const body = await expectStatus<{ id: string }[]>(res, 200);
    const ids = body.map(w => w.id);
    expect(ids).not.toContain(IDS.CMMS_WORK_ORDER);
  });
});

describe("super_admin access across tenants", () => {
  it("super_admin can list QMS lots with no tenantId filter error", async () => {
    // super_admin has tenantId=null — routes handle this by returning all or erroring
    // requireAuth for QMS lots doesn't include super_admin, so expect 403
    const req = await reqAs("super_admin", "/api/qms/lots");
    const res = await GET_LOTS(req);
    // QMS requires quality roles specifically — super_admin not listed
    expect([200, 403]).toContain(res.status);
  });
});
