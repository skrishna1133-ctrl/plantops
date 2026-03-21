/**
 * PlantOps — Miro Board Generator
 * Creates a visual prototype flow diagram with screen mockups + connectors
 * Run: node scripts/miro-board.mjs
 */

const BOARD_ID = "uXjVGzJ_7XM=";
const TOKEN    = "eyJtaXJvLm9yaWdpbiI6ImV1MDEifQ_2fagmTC3t0D_uixhhgCawAOOKSk";
const BASE     = `https://api.miro.com/v2/boards/${encodeURIComponent(BOARD_ID)}`;

const C = {
  auth   : "#7C3AED",
  home   : "#1E293B",
  ops    : "#2563EB",
  qms    : "#16A34A",
  cmms   : "#C2410C",
  cross  : "#8B5CF6",
  card   : "#F8FAFC",
  border : "#E2E8F0",
  text   : "#1E293B",
  muted  : "#64748B",
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

// ─── Frame ────────────────────────────────────────────────────────────────
async function mkFrame(title, cx, cy, w = 300, h = 530) {
  const r = await post("/frames", {
    data:     { title, format: "custom" },
    style:    { fillColor: "#FFFFFF" },
    geometry: { width: w, height: h },
    position: { x: cx, y: cy, origin: "center" },
  });
  return r.id;
}

// ─── Rectangle shape ──────────────────────────────────────────────────────
// color = text color (Miro v2 uses "color", NOT "textColor")
async function mkRect(cx, cy, w, h, fill, content = "", opts = {}) {
  const {
    color  = "#FFFFFF",
    fontSize = "12",
    align    = "left",
    alignV   = "middle",
    border   = fill,      // default = same as fill → invisible border
  } = opts;
  const r = await post("/shapes", {
    data: {
      shape  : "rectangle",
      content: content ? `<p>${content}</p>` : "",
    },
    style: {
      fillColor        : fill,
      borderColor      : border,
      color,
      fontSize,
      textAlign        : align,
      textAlignVertical: alignV,
    },
    geometry: { width: w, height: h },
    position: { x: cx, y: cy, origin: "center" },
  });
  return r.id;
}

// ─── Body card (multi-line HTML content) ──────────────────────────────────
async function mkBody(cx, cy, w, h, lines) {
  const html = lines
    .map(l => `<p style="margin:0;line-height:1.55">${l}</p>`)
    .join("");
  const r = await post("/shapes", {
    data: {
      shape  : "rectangle",
      content: html,
    },
    style: {
      fillColor        : C.card,
      borderColor      : C.border,
      color            : C.text,
      fontSize         : "11",
      textAlign        : "left",
      textAlignVertical: "top",
    },
    geometry: { width: w, height: h },
    position: { x: cx, y: cy, origin: "center" },
  });
  return r.id;
}

// ─── Connector ────────────────────────────────────────────────────────────
async function mkConn(fromId, toId, label = "", color = "#94A3B8", snapFrom = "right", snapTo = "left") {
  await post("/connectors", {
    startItem: { id: fromId, snapTo: snapFrom },
    endItem:   { id: toId,   snapTo },
    style: {
      strokeColor    : color,
      strokeWidth    : "2",
      endStrokeCap   : "stealth",
      startStrokeCap : "none",
      strokeStyle    : "normal",
    },
    captions: label ? [{ content: `<p>${label}</p>`, position: "50%" }] : [],
  });
}

// ─── Fetch existing frame IDs by title ────────────────────────────────────
async function getFramesByTitle() {
  const map = {};
  let cursor = null;
  do {
    const qs = cursor ? `?cursor=${cursor}&limit=50` : "?limit=50";
    const res = await api("GET", `/frames${qs}`);
    for (const f of (res.data || [])) {
      if (f.data?.title) map[f.data.title] = f.id;
    }
    cursor = res.cursor;
    if (cursor) await sleep(350);
  } while (cursor);
  return map;
}

// ─── Complete screen builder ───────────────────────────────────────────────
// Frame (300×530) with:
//   - thin accent stripe at top
//   - colored header bar with screen name
//   - muted subtitle strip
//   - body card with content lines
//   - optional action button at bottom
async function mkScreen(name, subtitle, cx, cy, color, lines, btnLabel = null) {
  const FW = 300, FH = 530;
  const top = cy - FH / 2;   // y of top edge

  process.stdout.write(`  → ${name} ... `);
  const fId = await mkFrame(name, cx, cy, FW, FH);

  // Thin accent stripe (8 px min allowed by Miro)
  await mkRect(cx, top + 4, FW, 8, color);

  // Header bar (52 px)
  await mkRect(cx, top + 33, FW, 52, color,
    `<strong>${name}</strong>`,
    { color: "#FFFFFF", fontSize: "14", alignV: "middle" }
  );

  // Subtitle strip (26 px)
  await mkRect(cx, top + 72, FW, 26, "#F1F5F9",
    subtitle,
    { color: C.muted, fontSize: "10", alignV: "middle", border: C.border }
  );

  // Body card (340 px tall)
  await mkBody(cx, top + 266, 278, 348, lines);

  // Action button (40 px)
  if (btnLabel) {
    await mkRect(cx, top + 488, 262, 40, color,
      `<strong>${btnLabel}</strong>`,
      { color: "#FFFFFF", fontSize: "12", align: "center", alignV: "middle" }
    );
  }

  // Invisible anchor shape at center of frame — used as connector endpoint
  // (Miro connectors cannot attach to frames directly, only to items/shapes)
  const anchor = await post("/shapes", {
    data:  { shape: "circle", content: "" },
    style: { fillColor: color, borderColor: color, color: "#FFFFFF", fontSize: "12" },
    geometry: { width: 14, height: 14 },
    position: { x: cx, y: cy, origin: "center" },
  });

  console.log("✅");
  return anchor.id;  // return anchor ID (not frame ID) for connectors
}

// ─── Section label (shape, not frame — frames have a min-size restriction) ─
async function mkLabel(cx, cy, label, color) {
  await post("/shapes", {
    data:  { shape: "round_rectangle", content: `<p><strong>${label}</strong></p>` },
    style: { fillColor: color, borderColor: color, color: "#FFFFFF", fontSize: "13", textAlign: "center", textAlignVertical: "middle" },
    geometry: { width: 210, height: 40 },
    position: { x: cx, y: cy, origin: "center" },
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const connectorsOnly = process.argv.includes("--connectors-only");

  console.log("═══════════════════════════════════════════════");
  console.log("  PlantOps — Miro Board Generator");
  if (connectorsOnly) console.log("  Mode: CONNECTORS ONLY (reusing existing screens)");
  console.log("═══════════════════════════════════════════════\n");

  process.stdout.write("Connecting to board ... ");
  const board = await api("GET", "");
  console.log(`✅  "${board.name}"\n`);

  const IDs = {};

  if (connectorsOnly) {
    // Miro connectors can't attach to frames — create small anchor shapes
    // at the center of each known screen position, then connect those.
    console.log("🔍 Creating anchor shapes at screen centers ...\n");
    const X = [-800, -380, 40, 460, 880];
    const Y = { auth: -1150, ops: -420, qms: 310, cmms: 1040 };

    async function anchor(cx, cy, color, name) {
      process.stdout.write(`  anchor(${name}) ... `);
      const r = await post("/shapes", {
        data:  { shape: "circle", content: "" },
        style: { fillColor: color, borderColor: color, color: "#FFFFFF", fontSize: "12" },
        geometry: { width: 14, height: 14 },
        position: { x: cx, y: cy, origin: "center" },
      });
      console.log("✅");
      return r.id;
    }

    IDs.login      = await anchor(X[0], Y.auth,  C.auth,  "login");
    IDs.home       = await anchor(X[1], Y.auth,  C.home,  "home");
    IDs.opsHub     = await anchor(X[0], Y.ops,   C.ops,   "opsHub");
    IDs.jobsList   = await anchor(X[1], Y.ops,   C.ops,   "jobsList");
    IDs.jobDetail  = await anchor(X[2], Y.ops,   C.ops,   "jobDetail");
    IDs.production = await anchor(X[3], Y.ops,   C.ops,   "production");
    IDs.outbound   = await anchor(X[4], Y.ops,   C.ops,   "outbound");
    IDs.qmsHub     = await anchor(X[0], Y.qms,   C.qms,   "qmsHub");
    IDs.lots       = await anchor(X[1], Y.qms,   C.qms,   "lots");
    IDs.inspection = await anchor(X[2], Y.qms,   C.qms,   "inspection");
    IDs.ncr        = await anchor(X[3], Y.qms,   C.qms,   "ncr");
    IDs.coa        = await anchor(X[4], Y.qms,   C.qms,   "coa");
    IDs.maintHub   = await anchor(X[0], Y.cmms,  C.cmms,  "maintHub");
    IDs.workOrders = await anchor(X[1], Y.cmms,  C.cmms,  "workOrders");
    IDs.woDetail   = await anchor(X[2], Y.cmms,  C.cmms,  "woDetail");
    IDs.breakdown  = await anchor(X[3], Y.cmms,  C.cmms,  "breakdown");
    IDs.pmSchedule = await anchor(X[4], Y.cmms,  C.cmms,  "pmSchedule");

    await buildConnectors(IDs);
    return;
  }

  // Layout
  const X = [-800, -380, 40, 460, 880];
  const Y = { auth: -1150, ops: -420, qms: 310, cmms: 1040 };

  // ─── Title banner ───────────────────────────────────────────────────────
  console.log("📌 Title + Legend");
  await post("/frames", {
    data:  { title: "PlantOps — App Flow Diagram", format: "custom" },
    style: { fillColor: C.home },
    geometry: { width: 1800, height: 160 },
    position: { x: 40, y: -1610, origin: "center" },
  });
  // subtitle inside banner
  await post("/shapes", {
    data: { shape: "rectangle", content: "<p><strong>PlantOps Manufacturing Operations Suite — Screen Flow Diagram</strong></p><p>Login → Home Hub → Operations · Quality (QMS) · Maintenance (CMMS)</p>" },
    style: { fillColor: C.home, borderColor: C.home, color: "#FFFFFF", fontSize: "16", textAlign: "center", textAlignVertical: "middle" },
    geometry: { width: 1760, height: 80 },
    position: { x: 40, y: -1640, origin: "center" },
  });
  // legend chips
  const chips = [
    ["AUTH", C.auth], ["Home Hub", C.home], ["OPS", C.ops],
    ["QMS", C.qms], ["CMMS", C.cmms], ["Cross-Module", C.cross],
  ];
  let chipX = -740;
  for (const [lbl, col] of chips) {
    await mkRect(chipX, -1578, 210, 30, col,
      `<strong>${lbl}</strong>`,
      { color: "#FFFFFF", fontSize: "12", align: "center", alignV: "middle" }
    );
    chipX += 230;
  }
  console.log("  ✅\n");

  // ─── Row 0: Auth ────────────────────────────────────────────────────────
  console.log("── Auth & Home ─────────────────────────────");
  await mkLabel(-1060, Y.auth, "01 — Auth", C.auth);

  IDs.login = await mkScreen("Login Screen", "Enter your company credentials",
    X[0], Y.auth, C.auth,
    [
      "<strong>🏭 PlantOps</strong>",
      "<em>Manufacturing Operations Suite</em>",
      "─────────────────────",
      "Company Code",
      "┌─────────────────┐",
      "│  FPI            │",
      "└─────────────────┘",
      "Username",
      "┌─────────────────┐",
      "│  johndoe        │",
      "└─────────────────┘",
      "Password",
      "┌─────────────────┐",
      "│  ●●●●●●●●       │",
      "└─────────────────┘",
    ],
    "Sign In →"
  );

  IDs.home = await mkScreen("Home Hub", "Hi John — FPI · Admin",
    X[1], Y.auth, C.home,
    [
      "Module Access",
      "─────────────────────",
      "🏭  Operations",
      "🔬  Quality (QMS)",
      "🔧  Maintenance (CMMS)",
      "📋  Checklists",
      "📦  Shipments",
      "📁  Documents Library",
      "🚨  Report an Incident",
      "─────────────────────",
      "<em>⏱ Downtime Tracker — Soon</em>",
      "<em>📝 Shift Handover — Soon</em>",
    ]
  );

  // ─── Row 1: OPS ─────────────────────────────────────────────────────────
  console.log("\n── Operations ──────────────────────────────");
  await mkLabel(-1060, Y.ops, "02 — Operations", C.ops);

  IDs.opsHub = await mkScreen("Operations Hub", "OPS Dashboard",
    X[0], Y.ops, C.ops,
    [
      "📊 KPIs",
      "─────────────────────",
      "Active Jobs:       3",
      "Lots in QC:        2",
      "Staged Shipments:  1",
      "Downtime Today:    1.5 hrs",
      "─────────────────────",
      "📦 Recent Jobs",
      "─────────────────────",
      "JOB-2026-0001 HDPE Grind",
      "  → In Progress",
      "JOB-2026-0002 PET Sort",
      "  → Open",
      "JOB-2026-0003 PP Mix",
      "  → Completed",
    ],
    "+ Create Job"
  );

  IDs.jobsList = await mkScreen("Jobs List", "All Jobs",
    X[1], Y.ops, C.ops,
    [
      "🔍 [ Search... ]     [+ New]",
      "─────────────────────",
      "<strong>JOB-2026-0001</strong>",
      "  HDPE Grind · 5,000 kg",
      "  Status: In Progress",
      "",
      "<strong>JOB-2026-0002</strong>",
      "  PET Sort · 3,000 kg",
      "  Status: Open",
      "",
      "<strong>JOB-2026-0003</strong>",
      "  PP Mix · 2,000 kg",
      "  Status: Completed",
    ],
    "Open Job →"
  );

  IDs.jobDetail = await mkScreen("Job Detail", "JOB-2026-0001 — Inbound Tab",
    X[2], Y.ops, C.ops,
    [
      "[ Inbound ][ Lots ][ Prod ][ Outbound ]",
      "─────────────────────",
      "SHP-IN-2026-03-0001",
      "  Vendor: ABC Recycling",
      "  Carrier: FastFreight LLC",
      "  Status: Received ✅",
      "─────────────────────",
      "Weight Entries:",
      "  Container A  2,450 / 450 tare",
      "  Container B  2,200 / 400 tare",
      "─────────────────────",
      "Net Total: <strong>3,800 kg</strong>",
      "",
      "→ Lots Tab: create inventory lots",
      "→ Send Lot to QC (QMS bridge)",
    ],
    "Add Weight Entry"
  );

  IDs.production = await mkScreen("Production Run", "RUN-2026-03-0001 — Line A",
    X[3], Y.ops, C.ops,
    [
      "Line A  ·  Granulation",
      "Status: <strong>In Progress</strong>",
      "─────────────────────",
      "Scheduled:  Mar 10, 07:00",
      "Actual:     Mar 10, 07:15",
      "Input:      1,200 kg",
      "Output:     1,047 kg",
      "Yield:      <strong>87.3%</strong>",
      "─────────────────────",
      "⏱ Downtime Events",
      "─────────────────────",
      "08:30  Belt slip (Equip)  22 min",
      "10:15  Material jam        8 min",
      "<strong>Total: 30 min downtime</strong>",
    ],
    "Log Downtime"
  );

  IDs.outbound = await mkScreen("Outbound Shipment", "SHP-OUT-2026-03-0001",
    X[4], Y.ops, C.ops,
    [
      "Customer:  XYZ Plastics",
      "Carrier:   FastFreight LLC",
      "BOL #:     BOL-2026-0042",
      "Status:    <strong>Staged</strong>",
      "─────────────────────",
      "📦 Lots:",
      "  LOT-2026-03-0001  1,047 kg",
      "  LOT-2026-03-0002    892 kg",
      "  <strong>Total: 1,939 kg</strong>",
      "─────────────────────",
      "📎 Documents:",
      "  ✓ Bill of Lading",
      "  ✓ COA · LOT-2026-03-0001",
      "  ✓ Weight Ticket",
    ],
    "Mark as Shipped →"
  );

  // ─── Row 2: QMS ─────────────────────────────────────────────────────────
  console.log("\n── Quality Management (QMS) ────────────────");
  await mkLabel(-1060, Y.qms, "03 — Quality (QMS)", C.qms);

  IDs.qmsHub = await mkScreen("Quality Hub", "QMS Dashboard",
    X[0], Y.qms, C.qms,
    [
      "📊 KPIs",
      "─────────────────────",
      "Pending QC:        3 lots",
      "Pending Review:    1 inspection",
      "Open NCRs Critical: 1",
      "Open NCRs Major:    2",
      "Open Complaints:    2",
      "Lots Need COA:      4",
      "─────────────────────",
      "→ Lot Registry",
      "→ Inspections Queue",
      "→ NCR Board",
      "→ Customer Complaints",
      "→ COA Generator",
    ]
  );

  IDs.lots = await mkScreen("Lot Registry", "QMS Lots",
    X[1], Y.qms, C.qms,
    [
      "🔍 [ Filter ]        [+ New]",
      "─────────────────────",
      "<strong>LOT-2026-0001</strong>  HDPE  1,047 kg",
      "  Status: Pending QC",
      "  From OPS: LOT-2026-03-0001",
      "",
      "<strong>LOT-2026-0002</strong>  PET  892 kg",
      "  Status: QC In Progress",
      "  Inspection pending review",
      "",
      "<strong>LOT-2026-0003</strong>  PP  745 kg",
      "  Status: Approved ✅",
      "",
      "<strong>LOT-2026-0004</strong>  HDPE  320 kg",
      "  Status: On Hold (NCR Open)",
    ],
    "Start Inspection →"
  );

  IDs.inspection = await mkScreen("Inspection Form", "LOT-2026-0002 — PET Standard v2",
    X[2], Y.qms, C.qms,
    [
      "Inspector: Sarah L.",
      "Template: PET Standard v2",
      "─────────────────────",
      "Bulk Density",
      "  Readings: 0.91 / 0.93  Avg: 0.92",
      "  Spec: 0.85–1.05 g/cm³   ✅",
      "",
      "Metal Contamination",
      "  0.008%  Spec: &lt;0.01%   ✅",
      "",
      "Moisture Content",
      "  1.2%  Spec: &lt;0.5%   ⚠️ FAIL",
      "",
      "Color  4/5  Spec: ≥3   ✅",
      "─────────────────────",
      "<strong>Overall: FAIL</strong>",
    ],
    "Submit Inspection"
  );

  IDs.ncr = await mkScreen("NCR Detail", "NCR-2026-0001 — Major",
    X[3], Y.qms, C.qms,
    [
      "Source:   Internal Inspection",
      "Severity: <strong>Major</strong>",
      "Status:   Under Investigation",
      "Assigned: John T.  Due: Mar 15",
      "─────────────────────",
      "Linked: LOT-2026-0002 (PET)",
      "",
      "Root Cause: Process",
      "  Dryer temp calibration drift",
      "  on Line B.",
      "",
      "Corrective Action:",
      "  Recalibrate dryer, run test",
      "  batch before resuming.",
      "─────────────────────",
      "Flow: open → under investigation",
    ],
    "Update Status →"
  );

  IDs.coa = await mkScreen("Certificate of Analysis", "COA-2026-0001 — LOT-2026-0003",
    X[4], Y.qms, C.qms,
    [
      "LOT-2026-0003  PP Material",
      "Customer: XYZ Plastics",
      "Sarah L.  ·  Mar 10, 2026",
      "─────────────────────",
      "Parameter      Result  Spec",
      "─────────────────────",
      "Bulk Density   0.91    0.85–1.05  ✅",
      "Metal Contam.  0.007%  &lt;0.01%    ✅",
      "Moisture       0.4%    &lt;0.5%     ✅",
      "Melt Flow Idx  12.3    10–15      ✅",
      "Color Rating   5/5     ≥3         ✅",
      "─────────────────────",
      "<strong>CONFORMS TO SPEC ✅</strong>",
      "PDF: Generated ✓",
    ],
    "⬇ Download PDF"
  );

  // ─── Row 3: CMMS ────────────────────────────────────────────────────────
  console.log("\n── Maintenance (CMMS) ──────────────────────");
  await mkLabel(-1060, Y.cmms, "04 — Maintenance", C.cmms);

  IDs.maintHub = await mkScreen("Maintenance Hub", "CMMS Dashboard",
    X[0], Y.cmms, C.cmms,
    [
      "📊 KPIs",
      "─────────────────────",
      "Machines Down:    1",
      "Open Work Orders: 4  (1 Urgent)",
      "PM Due Today:     2",
      "Flagged Checklists: 3",
      "🔔 Notifications: 3 unread",
      "─────────────────────",
      "→ Work Orders",
      "→ PM Schedules",
      "→ Machine Registry",
      "→ Checklists",
      "→ Log Sheets",
      "→ Breakdown Reports",
      "→ Procedures",
    ]
  );

  IDs.workOrders = await mkScreen("Work Orders", "Open Work Orders",
    X[1], Y.cmms, C.cmms,
    [
      "🔍 [ Filter ]        [+ New]",
      "─────────────────────",
      "<strong>WO-2026-0001</strong>  🔴 Urgent",
      "  Granulator #2 — Belt Replace",
      "  Assigned: Mike R.  |  Open",
      "",
      "<strong>WO-2026-0002</strong>  🟠 High",
      "  Conveyor B — Motor Bearing",
      "  Assigned: Tom K.  |  In Progress",
      "",
      "<strong>WO-2026-0003</strong>  🟡 Medium",
      "  Compactor #1 — Hydraulic",
      "  Assigned: Mike R.  |  Open",
      "",
      "<strong>WO-2026-0004</strong>  🟢 Low",
      "  Sorter A  |  Unassigned",
    ],
    "+ Create Work Order"
  );

  IDs.woDetail = await mkScreen("Work Order Detail", "WO-2026-0001 — Urgent",
    X[2], Y.cmms, C.cmms,
    [
      "Machine:  <strong>Granulator #2</strong>",
      "Priority: 🔴 Urgent",
      "Status:   In Progress",
      "─────────────────────",
      "Main drive belt showing wear.",
      "Immediate replacement needed",
      "to prevent production stop.",
      "─────────────────────",
      "Assigned to: Mike R.",
      "Est: 4h   Actual: 2.5h",
      "Created: Mar 10, 2026  08:00",
      "",
      "Linked Breakdown: BR-2026-0003",
      "",
      "Notes: Belt ordered, arriving",
      "today.",
    ],
    "Mark Complete ✓"
  );

  IDs.breakdown = await mkScreen("Breakdown Report", "BR-2026-0003",
    X[3], Y.cmms, C.cmms,
    [
      "Machine: <strong>Granulator #2</strong>",
      "Status:  Open",
      "Reported: Mike R.  Mar 10, 2026",
      "─────────────────────",
      "Downtime Start: 06:45",
      "Downtime End:   08:00 (est.)",
      "Duration: <strong>1 hr 15 min</strong>",
      "─────────────────────",
      "Root Cause:",
      "  Main drive belt worn/failed.",
      "  Machine auto-halted.",
      "",
      "Impact: Line A stopped.",
      "",
      "Corrective Action:",
      "  Belt replacement ordered.",
    ],
    "Convert to Work Order →"
  );

  IDs.pmSchedule = await mkScreen("PM Schedules", "Preventive Maintenance",
    X[4], Y.cmms, C.cmms,
    [
      "[ All ] [ Due Soon ]     [+ New]",
      "─────────────────────",
      "<strong>Granulator #2</strong> — Weekly",
      "  Lubrication &amp; belt check",
      "  Next Due: TODAY ⚠️",
      "",
      "<strong>Conveyor Belt B</strong> — Monthly",
      "  Tension &amp; alignment",
      "  Next Due: Mar 15, 2026",
      "",
      "<strong>Compactor #1</strong> — Quarterly",
      "  Hydraulic fluid &amp; seals",
      "  Next Due: Apr 1, 2026 ✅",
      "",
      "<strong>Sorter A</strong> — Annual",
      "  Next Due: Jun 1, 2026 ✅",
    ],
    "Mark as Completed"
  );

  await buildConnectors(IDs);
}

async function buildConnectors(IDs) {
  console.log("\n── Creating connectors ─────────────────────");

  process.stdout.write("  Auth flow ... ");
  await mkConn(IDs.login, IDs.home, "Sign In", C.auth);
  console.log("✅");

  process.stdout.write("  Home → Modules ... ");
  await mkConn(IDs.home, IDs.opsHub,   "Operations",  C.ops,  "bottom", "top");
  await mkConn(IDs.home, IDs.qmsHub,   "Quality",     C.qms,  "bottom", "top");
  await mkConn(IDs.home, IDs.maintHub, "Maintenance", C.cmms, "bottom", "top");
  console.log("✅");

  process.stdout.write("  OPS flow ... ");
  await mkConn(IDs.opsHub,     IDs.jobsList,   "",                C.ops);
  await mkConn(IDs.jobsList,   IDs.jobDetail,  "Open Job",        C.ops);
  await mkConn(IDs.jobDetail,  IDs.production, "Production Tab",  C.ops);
  await mkConn(IDs.production, IDs.outbound,   "Outbound Tab",    C.ops);
  console.log("✅");

  process.stdout.write("  QMS flow ... ");
  await mkConn(IDs.qmsHub,     IDs.lots,       "",                  C.qms);
  await mkConn(IDs.lots,       IDs.inspection, "Start Inspection",  C.qms);
  await mkConn(IDs.inspection, IDs.ncr,        "FAIL → NCR",        C.qms);
  await mkConn(IDs.lots,       IDs.coa,        "Approved → COA",    C.qms);
  console.log("✅");

  process.stdout.write("  CMMS flow ... ");
  await mkConn(IDs.maintHub,   IDs.workOrders, "",              C.cmms);
  await mkConn(IDs.workOrders, IDs.woDetail,   "Open WO",       C.cmms);
  await mkConn(IDs.maintHub,   IDs.breakdown,  "Breakdowns",    C.cmms);
  await mkConn(IDs.breakdown,  IDs.woDetail,   "Convert to WO", C.cmms);
  await mkConn(IDs.maintHub,   IDs.pmSchedule, "PM Schedules",  C.cmms);
  console.log("✅");

  process.stdout.write("  Cross-module ... ");
  await mkConn(IDs.jobDetail,  IDs.lots,       "Send Lot to QC", C.cross, "bottom", "top");
  await mkConn(IDs.production, IDs.breakdown,  "Downtime → WO",  C.cross, "bottom", "top");
  await mkConn(IDs.coa,        IDs.outbound,   "Attach COA",     C.cross, "bottom", "top");
  console.log("✅");

  console.log(`
═══════════════════════════════════════════════
  ✅ Done! 17 screens + all connectors built.
  🔗 https://miro.com/app/board/${BOARD_ID}/
═══════════════════════════════════════════════
`);
}

main().catch(err => {
  console.error("\n❌ Fatal:", err.message);
  process.exit(1);
});
