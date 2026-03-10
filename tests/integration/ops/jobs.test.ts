/**
 * Integration tests for OPS Jobs API.
 * Route: /api/ops/jobs
 */
import { describe, it, expect, beforeAll } from "vitest";
import { IDS, seedTestData, cleanTestData } from "../../helpers/seed-ids";
import { reqAs, expectStatus } from "../../helpers/request";

const { GET, POST } = await import("@/app/api/ops/jobs/route");
const { GET: GET_ID, PATCH } = await import("@/app/api/ops/jobs/[id]/route");

beforeAll(async () => {
  await cleanTestData();
  await seedTestData();
}, 60_000);

describe("GET /api/ops/jobs", () => {
  it("returns seeded job for admin", async () => {
    const req = await reqAs("admin", "/api/ops/jobs");
    const res = await GET(req);
    const body = await expectStatus<{ id: string }[]>(res, 200);
    expect(Array.isArray(body)).toBe(true);
    const ids = body.map(j => j.id);
    expect(ids).toContain(IDS.OPS_JOB);
  });

  it("filters by status=open", async () => {
    const req = await reqAs("admin", "/api/ops/jobs", {
      searchParams: { status: "open" },
    });
    const res = await GET(req);
    const body = await expectStatus<{ status: string }[]>(res, 200);
    expect(body.every(j => j.status === "open")).toBe(true);
  });

  it("filters by jobType", async () => {
    const req = await reqAs("admin", "/api/ops/jobs", {
      searchParams: { jobType: "toll" },
    });
    const res = await GET(req);
    const body = await expectStatus<{ job_type: string }[]>(res, 200);
    expect(body.every(j => j.job_type === "toll")).toBe(true);
  });

  it("is accessible to worker role", async () => {
    const req = await reqAs("worker", "/api/ops/jobs");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("returns 403 for maintenance_tech (no ops access)", async () => {
    const req = await reqAs("maintenance_tech", "/api/ops/jobs");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns 401 for unauthenticated request", async () => {
    const req = await reqAs(null, "/api/ops/jobs");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/ops/jobs", () => {
  it("creates a toll job as admin", async () => {
    const req = await reqAs("admin", "/api/ops/jobs", {
      method: "POST",
      body: {
        jobType: "toll",
        customerId: IDS.OPS_CUSTOMER,
        materialTypeId: IDS.QMS_MATERIAL_TYPE,
        description: "Test job created in integration test",
      },
    });
    const res = await POST(req);
    const body = await expectStatus<{ id: string; jobNumber: string }>(res, 201);
    expect(body.id).toBeTruthy();
    expect(body.jobNumber).toMatch(/^JOB-\d{4}-\d{4}$/);
  });

  it("creates a purchase job as engineer", async () => {
    const req = await reqAs("engineer", "/api/ops/jobs", {
      method: "POST",
      body: {
        jobType: "purchase",
        vendorId: IDS.OPS_VENDOR,
        description: "Purchase job test",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("returns 400 for invalid jobType", async () => {
    const req = await reqAs("admin", "/api/ops/jobs", {
      method: "POST",
      body: { jobType: "invalid_type", description: "Bad type" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 for worker role (cannot create jobs)", async () => {
    const req = await reqAs("worker", "/api/ops/jobs", {
      method: "POST",
      body: { jobType: "toll", description: "Should fail" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/ops/jobs/[id]", () => {
  it("returns job details with inbound shipments and lots", async () => {
    const req = await reqAs("admin", `/api/ops/jobs/${IDS.OPS_JOB}`);
    const res = await GET_ID(req, { params: Promise.resolve({ id: IDS.OPS_JOB }) });
    const body = await expectStatus<{
      id: string; job_number: string; job_type: string; status: string
    }>(res, 200);
    expect(body.id).toBe(IDS.OPS_JOB);
    expect(body.job_number).toBe("JOB-2026-9001");
    expect(body.job_type).toBe("toll");
    expect(body.status).toBe("open");
  });

  it("returns 404 for non-existent job", async () => {
    const fakeId = "00000000-0000-0000-0000-eeeeeeeeeeee";
    const req = await reqAs("admin", `/api/ops/jobs/${fakeId}`);
    const res = await GET_ID(req, { params: Promise.resolve({ id: fakeId }) });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/ops/jobs/[id]", () => {
  it("updates job notes as admin", async () => {
    const req = await reqAs("admin", `/api/ops/jobs/${IDS.OPS_JOB}`, {
      method: "PATCH",
      body: { notes: "Updated via integration test" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: IDS.OPS_JOB }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notes).toBe("Updated via integration test");
  });

  it("returns 403 for shipping role (read-only)", async () => {
    const req = await reqAs("shipping", `/api/ops/jobs/${IDS.OPS_JOB}`, {
      method: "PATCH",
      body: { notes: "Should fail" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: IDS.OPS_JOB }) });
    expect(res.status).toBe(403);
  });
});
