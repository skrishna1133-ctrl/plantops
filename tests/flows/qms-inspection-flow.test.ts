/**
 * End-to-end flow test: QMS Inspection lifecycle.
 *
 * Flow:
 *  1. Create a Lot (pending_qc)
 *  2. Start an Inspection (draft)
 *  3. Submit the Inspection → lot moves to qc_in_progress
 *  4. Quality Manager approves inspection → lot moves to approved
 *  5. Create NCR from a flagged result
 */
import { describe, it, expect, beforeAll } from "vitest";
import { IDS, seedTestData, cleanTestData } from "../helpers/seed-ids";
import { reqAs, expectStatus } from "../helpers/request";

const { POST: CREATE_LOT }    = await import("@/app/api/qms/lots/route");
const { POST: CREATE_INSP }   = await import("@/app/api/qms/inspections/route");
const { POST: SUBMIT_INSP }   = await import("@/app/api/qms/inspections/[id]/submit/route");
const { POST: APPROVE_INSP }  = await import("@/app/api/qms/inspections/[id]/approve/route");
const { GET: GET_LOT_ID }     = await import("@/app/api/qms/lots/[id]/route");
const { POST: CREATE_NCR }    = await import("@/app/api/qms/ncrs/route");

let lotId: string;
let lotNumber: string;
let inspectionId: string;

beforeAll(async () => {
  await cleanTestData();
  await seedTestData();
}, 60_000);

describe("Full QMS inspection flow", () => {
  it("Step 1: Create a lot (pending_qc)", async () => {
    const req = await reqAs("quality_tech", "/api/qms/lots", {
      method: "POST",
      body: {
        materialTypeId: IDS.QMS_MATERIAL_TYPE,
        inputWeightKg: 500,
        notes: "Flow test lot",
      },
    });
    const res = await CREATE_LOT(req);
    const body = await expectStatus<{ id: string; lotNumber: string }>(res, 201);
    lotId = body.id;
    lotNumber = body.lotNumber;
    expect(lotId).toBeTruthy();
  });

  it("Step 2: Create an inspection for the lot (draft)", async () => {
    const req = await reqAs("quality_tech", "/api/qms/inspections", {
      method: "POST",
      body: {
        lotId,
        templateId: IDS.QMS_TEMPLATE,
      },
    });
    const res = await CREATE_INSP(req);
    const body = await expectStatus<{ id: string }>(res, 201);
    inspectionId = body.id;
    expect(inspectionId).toBeTruthy();
  });

  it("Step 3: Submit the inspection with passing results", async () => {
    const req = await reqAs("quality_tech", `/api/qms/inspections/${inspectionId}/submit`, {
      method: "POST",
      body: {
        results: [
          {
            parameterId: IDS.QMS_PARAM_DENSITY,
            value: "0.45",          // within spec [0.3, 0.6]
            notes: "",
          },
          {
            parameterId: IDS.QMS_PARAM_METAL,
            value: "0.1",           // within spec [0, 0.5]
            notes: "",
          },
        ],
      },
    });
    const res = await SUBMIT_INSP(req, { params: Promise.resolve({ id: inspectionId }) });
    const body = await expectStatus<{ overallResult: string }>(res, 200);
    expect(body.overallResult).toBe("PASS");
  });

  it("Step 4: Quality manager approves the inspection", async () => {
    const req = await reqAs("quality_manager", `/api/qms/inspections/${inspectionId}/approve`, {
      method: "POST",
      body: { reviewNotes: "All parameters within spec." },
    });
    const res = await APPROVE_INSP(req, { params: Promise.resolve({ id: inspectionId }) });
    expect(res.status).toBe(200);
  });

  it("Step 5: Lot is now approved after inspection approved", async () => {
    const req = await reqAs("quality_tech", `/api/qms/lots/${lotId}`);
    const res = await GET_LOT_ID(req, { params: Promise.resolve({ id: lotId }) });
    const body = await expectStatus<{ status: string }>(res, 200);
    expect(body.status).toBe("approved");
  });

  it("Step 6: Create NCR for failing inspection (seeded)", async () => {
    const req = await reqAs("quality_manager", "/api/qms/ncrs", {
      method: "POST",
      body: {
        lotId: IDS.QMS_LOT_IN_PROGRESS,
        source: "internal_inspection",
        severity: "major",
        title: "Flow test NCR: Density out of range",
        description: "Density reading was below minimum specification.",
        affectedMaterialType: "Polypropylene",
        affectedQuantityKg: 500,
      },
    });
    const res = await CREATE_NCR(req);
    const body = await expectStatus<{ id: string; ncrNumber: string }>(res, 201);
    expect(body.id).toBeTruthy();
    expect(body.ncrNumber).toMatch(/^NCR-\d{4}-\d{4}$/);
  });
});
