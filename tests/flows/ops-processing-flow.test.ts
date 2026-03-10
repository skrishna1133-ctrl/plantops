/**
 * End-to-end flow test: OPS material processing lifecycle.
 *
 * Flow:
 *  1. Create a Job
 *  2. Create an Inbound Shipment
 *  3. Add weight entries to the shipment
 *  4. Create a Lot linked to the inbound shipment
 *  5. Create a Production Run for the lot
 *  6. Log a Downtime Event on the run
 *  7. Create an Outbound Shipment
 *  8. Progress outbound: pending → staged → shipped → delivered
 */
import { describe, it, expect, beforeAll } from "vitest";
import { IDS, seedTestData, cleanTestData } from "../helpers/seed-ids";
import { reqAs, expectStatus } from "../helpers/request";

// Import handlers
const { POST: CREATE_JOB }       = await import("@/app/api/ops/jobs/route");
const { POST: CREATE_INBOUND }   = await import("@/app/api/ops/inbound-shipments/route");
const { POST: CREATE_WEIGHT }    = await import("@/app/api/ops/inbound-shipments/[id]/weights/route");
const { POST: CREATE_LOT }       = await import("@/app/api/ops/lots/route");
const { POST: CREATE_RUN }       = await import("@/app/api/ops/production-runs/route");
const { POST: CREATE_DOWNTIME }  = await import("@/app/api/ops/downtime-events/route");
const { POST: CREATE_OUTBOUND }  = await import("@/app/api/ops/outbound-shipments/route");
const { PATCH: PATCH_OUTBOUND }  = await import("@/app/api/ops/outbound-shipments/[id]/route");

// Shared state across the flow
let jobId: string;
let inboundId: string;
let lotId: string;
let runId: string;
let outboundId: string;

beforeAll(async () => {
  await cleanTestData();
  await seedTestData();
}, 60_000);

describe("Full OPS processing flow", () => {
  it("Step 1: Create a Job", async () => {
    const req = await reqAs("admin", "/api/ops/jobs", {
      method: "POST",
      body: {
        jobType: "toll",
        customerId: IDS.OPS_CUSTOMER,
        materialTypeId: IDS.QMS_MATERIAL_TYPE,
        description: "Flow test toll job",
        targetWeight: 1000,
      },
    });
    const res = await CREATE_JOB(req);
    const body = await expectStatus<{ id: string; jobNumber: string }>(res, 201);
    jobId = body.id;
    expect(jobId).toBeTruthy();
    expect(body.jobNumber).toMatch(/^JOB-\d{4}-\d{4}$/);
  });

  it("Step 2: Create an Inbound Shipment for the job", async () => {
    const req = await reqAs("receiving", "/api/ops/inbound-shipments", {
      method: "POST",
      body: {
        jobId,
        vendorId: IDS.OPS_VENDOR,
        carrierId: IDS.OPS_CARRIER,
        driverName: "Flow Driver",
        truckNumber: "TRK-FLOW",
        status: "received",
      },
    });
    const res = await CREATE_INBOUND(req);
    const body = await expectStatus<{ id: string; shipmentNumber: string }>(res, 201);
    inboundId = body.id;
    expect(inboundId).toBeTruthy();
    expect(body.shipmentNumber).toMatch(/^SHP-IN-/);
  });

  it("Step 3: Add weight entries to the inbound shipment", async () => {
    const req = await reqAs("receiving", `/api/ops/inbound-shipments/${inboundId}/weights`, {
      method: "POST",
      body: { grossWeight: 1050, tareWeight: 100, weightUnit: "lbs", containerLabel: "GAYLORD-A" },
    });
    const res = await CREATE_WEIGHT(req, { params: Promise.resolve({ id: inboundId }) });
    const body = await expectStatus<{ id: string; netWeight: number }>(res, 201);
    expect(body.netWeight).toBe(950);
  });

  it("Step 4: Create a Lot linked to the inbound shipment", async () => {
    const req = await reqAs("admin", "/api/ops/lots", {
      method: "POST",
      body: {
        jobId,
        materialTypeId: IDS.QMS_MATERIAL_TYPE,
        inboundWeight: 950,
        inboundWeightUnit: "lbs",
        inboundShipmentIds: [inboundId],
      },
    });
    const res = await CREATE_LOT(req);
    const body = await expectStatus<{ id: string; lotNumber: string }>(res, 201);
    lotId = body.id;
    expect(lotId).toBeTruthy();
    expect(body.lotNumber).toMatch(/^OPS-LOT-/);
  });

  it("Step 5: Create a Production Run for the lot", async () => {
    const req = await reqAs("admin", "/api/ops/production-runs", {
      method: "POST",
      body: {
        jobId,
        productionLineId: IDS.CMMS_LINE,
        processingTypeId: IDS.OPS_PROC_TYPE,
        inputLotIds: [lotId],
        inputWeight: 950,
        inputWeightUnit: "lbs",
        operatorId: IDS.USER_WORKER,
      },
    });
    const res = await CREATE_RUN(req);
    const body = await expectStatus<{ id: string; runNumber: string }>(res, 201);
    runId = body.id;
    expect(runId).toBeTruthy();
    expect(body.runNumber).toMatch(/^RUN-/);
  });

  it("Step 6: Log a Downtime Event on the run", async () => {
    const req = await reqAs("worker", "/api/ops/downtime-events", {
      method: "POST",
      body: {
        runId,
        reason: "Equipment jam",
        category: "mechanical",
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
    });
    const res = await CREATE_DOWNTIME(req);
    const body = await expectStatus<{ id: string; durationMinutes: number }>(res, 201);
    expect(body.id).toBeTruthy();
    expect(body.durationMinutes).toBeGreaterThan(0);
  });

  it("Step 7: Create an Outbound Shipment", async () => {
    const req = await reqAs("shipping", "/api/ops/outbound-shipments", {
      method: "POST",
      body: {
        jobId,
        customerId: IDS.OPS_CUSTOMER,
        carrierId: IDS.OPS_CARRIER,
        totalWeight: 900,
        totalWeightUnit: "lbs",
      },
    });
    const res = await CREATE_OUTBOUND(req);
    const body = await expectStatus<{ id: string; shipmentNumber: string }>(res, 201);
    outboundId = body.id;
    expect(outboundId).toBeTruthy();
    expect(body.shipmentNumber).toMatch(/^SHP-OUT-/);
  });

  it("Step 8a: Mark outbound as staged (pending → staged)", async () => {
    const req = await reqAs("shipping", `/api/ops/outbound-shipments/${outboundId}`, {
      method: "PATCH",
      body: { status: "staged" },
    });
    const res = await PATCH_OUTBOUND(req, { params: Promise.resolve({ id: outboundId }) });
    expect(res.status).toBe(200);
  });

  it("Step 8b: Mark outbound as shipped (staged → shipped)", async () => {
    const req = await reqAs("shipping", `/api/ops/outbound-shipments/${outboundId}`, {
      method: "PATCH",
      body: { status: "shipped", bolNumber: "BOL-FLOW-001" },
    });
    const res = await PATCH_OUTBOUND(req, { params: Promise.resolve({ id: outboundId }) });
    expect(res.status).toBe(200);
  });

  it("Step 8c: Mark outbound as delivered (shipped → delivered)", async () => {
    const req = await reqAs("shipping", `/api/ops/outbound-shipments/${outboundId}`, {
      method: "PATCH",
      body: { status: "delivered", deliveryNotes: "Delivered successfully" },
    });
    const res = await PATCH_OUTBOUND(req, { params: Promise.resolve({ id: outboundId }) });
    expect(res.status).toBe(200);
  });
});
