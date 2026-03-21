/**
 * PlantOps — State Machine & UI Flow Diagrams
 * Adds below the screen library:
 *   Section A: Role-Based Login Redirect (who goes where)
 *   Section B: 6 State Machine flowcharts (status flows)
 *   Section C: Cross-Module Data Flow diagram
 *
 * Run: node scripts/miro-state-flows.mjs
 */

const BOARD_ID = "uXjVGzJ_7XM=";
const TOKEN    = "eyJtaXJvLm9yaWdpbiI6ImV1MDEifQ_2fagmTC3t0D_uixhhgCawAOOKSk";
const BASE     = `https://api.miro.com/v2/boards/${encodeURIComponent(BOARD_ID)}`;

const C = {
  auth  : "#7C3AED",
  home  : "#1E293B",
  ops   : "#2563EB",
  qms   : "#16A34A",
  cmms  : "#C2410C",
  cross : "#8B5CF6",
  worker: "#0891B2",
  admin : "#4F46E5",
  gray  : "#64748B",
  red   : "#DC2626",
  amber : "#D97706",
  green : "#16A34A",
  card  : "#F8FAFC",
  border: "#E2E8F0",
  text  : "#1E293B",
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(method, path, body) {
  await sleep(350);
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type" : "application/json",
      "Accept"       : "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.message || JSON.stringify(data).slice(0, 300);
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return data;
}

const post = (path, body) => api("POST", path, body);

// ─── Node (rounded rect state box) ────────────────────────────────────────
async function mkNode(cx, cy, label, fill, w = 180, h = 52) {
  const r = await post("/shapes", {
    data: { shape: "round_rectangle", content: `<p><strong>${label}</strong></p>` },
    style: {
      fillColor: fill, borderColor: fill,
      color: "#FFFFFF", fontSize: "12",
      textAlign: "center", textAlignVertical: "middle",
    },
    geometry: { width: w, height: h },
    position: { x: cx, y: cy, origin: "center" },
  });
  return r.id;
}

// ─── Diamond (decision node) ──────────────────────────────────────────────
async function mkDiamond(cx, cy, label, fill = C.gray) {
  const r = await post("/shapes", {
    data: { shape: "rhombus", content: `<p><strong>${label}</strong></p>` },
    style: {
      fillColor: fill, borderColor: fill,
      color: "#FFFFFF", fontSize: "11",
      textAlign: "center", textAlignVertical: "middle",
    },
    geometry: { width: 160, height: 70 },
    position: { x: cx, y: cy, origin: "center" },
  });
  return r.id;
}

// ─── Connector ────────────────────────────────────────────────────────────
async function mkConn(fromId, toId, label = "", color = "#94A3B8", snapFrom = "right", snapTo = "left") {
  await post("/connectors", {
    startItem: { id: fromId, snapTo: snapFrom },
    endItem:   { id: toId,   snapTo },
    style: { strokeColor: color, strokeWidth: "2", endStrokeCap: "stealth", startStrokeCap: "none", strokeStyle: "normal" },
    captions: label ? [{ content: `<p>${label}</p>`, position: "50%" }] : [],
  });
}

// ─── Section header frame ─────────────────────────────────────────────────
async function mkSection(title, cx, cy, w, h, color) {
  // background frame
  await post("/frames", {
    data:  { title, format: "custom" },
    style: { fillColor: "#FAFAFA" },
    geometry: { width: w, height: h },
    position: { x: cx, y: cy, origin: "center" },
  });
  // header bar inside
  await post("/shapes", {
    data: { shape: "rectangle", content: `<p><strong>${title}</strong></p>` },
    style: { fillColor: color, borderColor: color, color: "#FFFFFF", fontSize: "16", textAlign: "left", textAlignVertical: "middle" },
    geometry: { width: w, height: 52 },
    position: { x: cx, y: cy - h / 2 + 26, origin: "center" },
  });
}

// ─── Text label ───────────────────────────────────────────────────────────
async function mkText(cx, cy, content, color = C.text, fontSize = "12", w = 200) {
  const r = await post("/shapes", {
    data: { shape: "rectangle", content: `<p>${content}</p>` },
    style: { fillColor: "#FAFAFA", borderColor: "#FAFAFA", color, fontSize, textAlign: "center", textAlignVertical: "middle" },
    geometry: { width: w, height: 30 },
    position: { x: cx, y: cy, origin: "center" },
  });
  return r.id;
}

// ─── Small role badge ─────────────────────────────────────────────────────
async function mkBadge(cx, cy, label, color) {
  const r = await post("/shapes", {
    data: { shape: "round_rectangle", content: `<p>${label}</p>` },
    style: { fillColor: color, borderColor: color, color: "#FFFFFF", fontSize: "10", textAlign: "center", textAlignVertical: "middle" },
    geometry: { width: 150, height: 36 },
    position: { x: cx, y: cy, origin: "center" },
  });
  return r.id;
}

// ──────────────────────────────────────────────────────────────────────────
// SECTION A: Role-Based Login Redirect
// ──────────────────────────────────────────────────────────────────────────
async function buildRoleFlow(startY) {
  const CX = 200;  // center x of this section
  console.log("\n── Section A: Role Redirect Flow ──────────────");

  await mkSection("A — Role-Based Login Redirect", CX, startY, 1100, 600, C.auth);

  const top = startY - 300 + 52 + 20; // below section header

  // Login node
  process.stdout.write("  Nodes ... ");
  const nLogin    = await mkNode(CX - 420, top + 40, "Login Screen", C.auth, 160, 52);
  const nCode     = await mkNode(CX - 220, top + 40, "Enter Company Code", C.auth, 190, 52);
  const nDecision = await mkDiamond(CX + 10, top + 40, "Role?", C.gray);

  // Role destination nodes — 2 rows
  const roles = [
    { label: "worker",             dest: "Quality Hub",      color: C.qms,    col: 0 },
    { label: "quality_tech",       dest: "Quality Hub",      color: C.qms,    col: 1 },
    { label: "quality_manager",    dest: "Quality Hub",      color: C.qms,    col: 2 },
    { label: "maintenance_tech",   dest: "Maintenance Hub",  color: C.cmms,   col: 3 },
    { label: "maintenance_manager",dest: "Maintenance Hub",  color: C.cmms,   col: 4 },
    { label: "receiving",          dest: "Operations Hub",   color: C.ops,    col: 0 },
    { label: "shipping",           dest: "Shipments",        color: C.ops,    col: 1 },
    { label: "engineer",           dest: "View Dashboard",   color: C.gray,   col: 2 },
    { label: "admin / owner",      dest: "Admin Panel",      color: C.admin,  col: 3 },
    { label: "super_admin",        dest: "Platform Admin",   color: C.cross,  col: 4 },
  ];

  const roleIds = [];
  for (let i = 0; i < roles.length; i++) {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const rx = CX + 220 + col * 170;
    const ry = top + (row === 0 ? 10 : 100);
    const id = await mkNode(rx, ry, `${roles[i].label}\n→ ${roles[i].dest}`, roles[i].color, 155, 60);
    roleIds.push(id);
  }
  console.log("✅");

  process.stdout.write("  Connectors ... ");
  await mkConn(nLogin, nCode,     "submit", C.auth);
  await mkConn(nCode,  nDecision, "auth ok", C.auth);
  for (const id of roleIds) await mkConn(nDecision, id, "", C.gray, "right", "left");
  console.log("✅");

  return startY + 650;
}

// ──────────────────────────────────────────────────────────────────────────
// SECTION B: State Machine Flows
// ──────────────────────────────────────────────────────────────────────────

// Generic horizontal state chain builder
async function buildStateChain(nodes, startX, y, color, gap = 220) {
  const ids = [];
  for (let i = 0; i < nodes.length; i++) {
    const id = await mkNode(startX + i * gap, y, nodes[i], color, 180, 52);
    ids.push(id);
  }
  for (let i = 0; i < ids.length - 1; i++) {
    await mkConn(ids[i], ids[i + 1], "", color);
  }
  return ids;
}

async function buildStateMachines(startY) {
  const W = 2800, H = 1200;
  const CX = 600;
  console.log("\n── Section B: State Machine Flows ─────────────");

  await mkSection("B — Status / State Machine Flows", CX, startY, W, H, C.gray);

  const top = startY - H / 2 + 52 + 30;

  // ── 1. OPS Lot ──────────────────────────────────────────────────────────
  process.stdout.write("  OPS Lot states ... ");
  await mkText(-580, top + 10, "<strong>1. OPS Lot</strong>", C.ops, "13", 180);
  const opsLotNodes = ["pending", "in_storage", "in_production", "qc_hold", "approved", "shipped"];
  const opsLotIds = await buildStateChain(opsLotNodes, -680, top + 50, C.ops, 210);
  // rejected branch
  const rejId = await mkNode(opsLotIds[3] + 0, top + 130, "rejected", C.red, 140, 44);
  await mkConn(opsLotIds[3], rejId, "fail", C.red, "bottom", "top");
  console.log("✅");

  // ── 2. QMS Lot ──────────────────────────────────────────────────────────
  process.stdout.write("  QMS Lot states ... ");
  await mkText(-580, top + 210, "<strong>2. QMS Lot</strong>", C.qms, "13", 180);
  const qmsLotNodes = ["pending_qc", "qc_in_progress", "approved", "shipped"];
  const qmsLotIds = await buildStateChain(qmsLotNodes, -680, top + 250, C.qms, 230);
  const qmsRej    = await mkNode(qmsLotIds[1] + 0, top + 330, "rejected", C.red, 140, 44);
  const qmsHold   = await mkNode(qmsLotIds[2] + 0, top + 330, "on_hold", C.amber, 140, 44);
  await mkConn(qmsLotIds[1], qmsRej,  "fail",      C.red,   "bottom", "top");
  await mkConn(qmsLotIds[2], qmsHold, "open NCR",  C.amber, "bottom", "top");
  console.log("✅");

  // ── 3. NCR ──────────────────────────────────────────────────────────────
  process.stdout.write("  NCR states ... ");
  await mkText(800, top + 10, "<strong>3. NCR Status</strong>", C.qms, "13", 200);
  const ncrNodes = ["open", "under_investigation", "corrective_action pending", "corrective_action taken", "closed"];
  const ncrIds = await buildStateChain(ncrNodes, 700, top + 60, C.qms, 240);
  const ncrCancelled = await mkNode(ncrIds[0] + 0, top + 150, "cancelled", C.red, 150, 44);
  const ncrReopen    = await mkNode(ncrIds[3] + 0, top + 150, "↩ reopen", C.amber, 150, 44);
  await mkConn(ncrIds[0], ncrCancelled, "manager only", C.red, "bottom", "top");
  await mkConn(ncrIds[3], ncrReopen, "send back", C.amber, "bottom", "top");
  await mkConn(ncrReopen, ncrIds[1], "", C.amber, "top", "bottom");
  console.log("✅");

  // ── 4. Outbound Shipment ────────────────────────────────────────────────
  process.stdout.write("  Outbound Shipment states ... ");
  await mkText(-580, top + 430, "<strong>4. Outbound Shipment</strong>", C.ops, "13", 260);
  await buildStateChain(["pending", "staged", "shipped", "delivered"], -680, top + 470, C.ops, 230);
  console.log("✅");

  // ── 5. Work Order ───────────────────────────────────────────────────────
  process.stdout.write("  Work Order states ... ");
  await mkText(-580, top + 590, "<strong>5. Work Order</strong>", C.cmms, "13", 200);
  const woIds = await buildStateChain(["open", "in_progress", "completed"], -680, top + 630, C.cmms, 230);
  const woCancelled = await mkNode(woIds[1] + 0, top + 710, "cancelled", C.red, 150, 44);
  await mkConn(woIds[1], woCancelled, "cancel", C.red, "bottom", "top");
  console.log("✅");

  // ── 6. QMS Inspection ───────────────────────────────────────────────────
  process.stdout.write("  Inspection states ... ");
  await mkText(-580, top + 770, "<strong>6. QMS Inspection</strong>", C.qms, "13", 210);
  const insIds = await buildStateChain(["draft", "submitted", "approved"], -680, top + 810, C.qms, 230);
  const insRej = await mkNode(insIds[2] + 0, top + 890, "rejected", C.red, 150, 44);
  await mkConn(insIds[2], insRej, "fail", C.red, "bottom", "top");
  console.log("✅");

  // ── 7. Inbound Shipment ─────────────────────────────────────────────────
  process.stdout.write("  Inbound Shipment states ... ");
  await mkText(800, top + 430, "<strong>7. Inbound Shipment</strong>", C.ops, "13", 230);
  await buildStateChain(["scheduled", "partial", "received"], 700, top + 470, C.ops, 240);
  console.log("✅");

  // ── 8. Customer Complaint ───────────────────────────────────────────────
  process.stdout.write("  Complaint states ... ");
  await mkText(800, top + 590, "<strong>8. Customer Complaint</strong>", C.qms, "13", 240);
  await buildStateChain(["open", "investigating", "ncr_created", "resolved", "closed"], 700, top + 630, C.qms, 220);
  console.log("✅");

  return startY + H / 2 + 80;
}

// ──────────────────────────────────────────────────────────────────────────
// SECTION C: Cross-Module Data Flow
// ──────────────────────────────────────────────────────────────────────────
async function buildDataFlow(startY) {
  const W = 2000, H = 700;
  const CX = 400;
  console.log("\n── Section C: Cross-Module Data Flow ───────────");

  await mkSection("C — Cross-Module Data Flow", CX, startY, W, H, C.cross);

  const top = startY - H / 2 + 52 + 40;

  process.stdout.write("  Nodes ... ");

  // OPS column
  const nInbound     = await mkNode(-580, top + 0,   "Inbound Shipment",    C.ops, 200, 52);
  const nOpsLot      = await mkNode(-580, top + 100, "OPS Lot Created",     C.ops, 200, 52);
  const nProdRun     = await mkNode(-580, top + 200, "Production Run",      C.ops, 200, 52);
  const nDowntime    = await mkNode(-580, top + 300, "Downtime Event",      C.ops, 200, 52);
  const nOutbound    = await mkNode(-580, top + 400, "Outbound Shipment",   C.ops, 200, 52);

  // QMS column
  const nQmsLot      = await mkNode(0,    top + 100, "QMS Lot (Send to QC)",C.qms, 210, 52);
  const nInspection  = await mkNode(0,    top + 200, "Inspection Created",  C.qms, 210, 52);
  const nNcr         = await mkNode(0,    top + 300, "NCR Created",         C.qms, 210, 52);
  const nCoa         = await mkNode(0,    top + 400, "COA Generated",       C.qms, 210, 52);
  const nComplaint   = await mkNode(0,    top + 500, "Customer Complaint",  C.qms, 210, 52);

  // CMMS column
  const nWorkOrder   = await mkNode(600,  top + 200, "Work Order Created",  C.cmms, 210, 52);
  const nBreakdown   = await mkNode(600,  top + 300, "Breakdown Report",    C.cmms, 210, 52);
  const nPmAlert     = await mkNode(600,  top + 400, "PM Due Alert",        C.cmms, 210, 52);

  console.log("✅");
  process.stdout.write("  Flow arrows ... ");

  // OPS internal
  await mkConn(nInbound, nOpsLot, "material received", C.ops, "bottom", "top");
  await mkConn(nOpsLot, nProdRun, "start production", C.ops, "bottom", "top");
  await mkConn(nProdRun, nDowntime, "downtime occurs", C.ops, "bottom", "top");
  await mkConn(nOpsLot, nOutbound, "approved → ship", C.ops, "bottom", "top");

  // OPS → QMS
  await mkConn(nOpsLot, nQmsLot, "Send to QC", C.cross);
  await mkConn(nQmsLot, nInspection, "create inspection", C.qms, "bottom", "top");
  await mkConn(nInspection, nNcr, "FAIL → create NCR", C.qms, "bottom", "top");
  await mkConn(nInspection, nCoa, "PASS → generate COA", C.qms, "bottom", "top");
  await mkConn(nComplaint, nNcr, "escalate → NCR", C.qms, "top", "bottom");
  await mkConn(nCoa, nOutbound, "attach to shipment", C.cross, "bottom", "top");

  // QMS lot status → OPS lot
  await mkConn(nQmsLot, nOpsLot, "approved/rejected", C.cross, "left", "right");

  // Downtime → CMMS
  await mkConn(nDowntime, nWorkOrder, "create WO", C.cross);
  await mkConn(nBreakdown, nWorkOrder, "convert to WO", C.cmms, "bottom", "top");
  await mkConn(nPmAlert, nWorkOrder, "schedule WO", C.cmms, "bottom", "top");

  console.log("✅");
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  PlantOps — State Flows & UI Flow Diagrams");
  console.log("═══════════════════════════════════════════════\n");

  process.stdout.write("Connecting to board ... ");
  const board = await api("GET", "");
  console.log(`✅  "${board.name}"\n`);

  // Start below the Reports row (y≈3230 + 530/2 + 200 gap = 3695 → round to 3800)
  let y = 3800;

  // Add a divider label
  await post("/shapes", {
    data: { shape: "rectangle", content: "<p><strong>─────  UI FLOWS & STATE MACHINES  ─────</strong></p>" },
    style: { fillColor: C.home, borderColor: C.home, color: "#FFFFFF", fontSize: "18", textAlign: "center", textAlignVertical: "middle" },
    geometry: { width: 1800, height: 56 },
    position: { x: 200, y: y, origin: "center" },
  });
  y += 100;

  y = await buildRoleFlow(y);
  y = await buildStateMachines(y + 50);
  await buildDataFlow(y + 50);

  console.log(`
═══════════════════════════════════════════════
  ✅ UI & State flow diagrams complete!
  🔗 https://miro.com/app/board/${BOARD_ID}/
═══════════════════════════════════════════════
`);
}

main().catch(err => {
  console.error("\n❌ Fatal:", err.message);
  process.exit(1);
});
