/**
 * PlantOps — Add Missing Screens to Miro Board
 * Adds: Incident Report, Checklists, Documents, Admin, Platform Admin,
 *       QMS Config, OPS Settings, OPS/QMS/CMMS Reports
 * Run: node scripts/miro-add-missing.mjs
 */

const BOARD_ID = "uXjVGzJ_7XM=";
const TOKEN    = "eyJtaXJvLm9yaWdpbiI6ImV1MDEifQ_2fagmTC3t0D_uixhhgCawAOOKSk";
const BASE     = `https://api.miro.com/v2/boards/${encodeURIComponent(BOARD_ID)}`;

const C = {
  incidents : "#DC2626",  // red
  checklists: "#0891B2",  // cyan
  docs      : "#475569",  // slate
  admin     : "#4F46E5",  // indigo
  platform  : "#6D28D9",  // dark purple
  qms       : "#16A34A",  // green (reuse)
  ops       : "#2563EB",  // blue (reuse)
  cmms      : "#C2410C",  // orange (reuse)
  reports   : "#64748B",  // gray
  card      : "#F8FAFC",
  border    : "#E2E8F0",
  text      : "#1E293B",
  muted     : "#64748B",
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

// ─── Primitives ────────────────────────────────────────────────────────────

async function mkFrame(title, cx, cy, w = 300, h = 530) {
  const r = await post("/frames", {
    data:     { title, format: "custom" },
    style:    { fillColor: "#FFFFFF" },
    geometry: { width: w, height: h },
    position: { x: cx, y: cy, origin: "center" },
  });
  return r.id;
}

async function mkRect(cx, cy, w, h, fill, content = "", opts = {}) {
  const { color = "#FFFFFF", fontSize = "12", align = "left", alignV = "middle", border = fill } = opts;
  const r = await post("/shapes", {
    data: { shape: "rectangle", content: content ? `<p>${content}</p>` : "" },
    style: { fillColor: fill, borderColor: border, color, fontSize, textAlign: align, textAlignVertical: alignV },
    geometry: { width: w, height: h },
    position: { x: cx, y: cy, origin: "center" },
  });
  return r.id;
}

async function mkBody(cx, cy, w, h, lines) {
  const html = lines.map(l => `<p style="margin:0;line-height:1.55">${l}</p>`).join("");
  const r = await post("/shapes", {
    data:  { shape: "rectangle", content: html },
    style: { fillColor: C.card, borderColor: C.border, color: C.text, fontSize: "11", textAlign: "left", textAlignVertical: "top" },
    geometry: { width: w, height: h },
    position: { x: cx, y: cy, origin: "center" },
  });
  return r.id;
}

async function mkConn(fromId, toId, label = "", color = "#94A3B8", snapFrom = "right", snapTo = "left") {
  await post("/connectors", {
    startItem: { id: fromId, snapTo: snapFrom },
    endItem:   { id: toId,   snapTo },
    style: { strokeColor: color, strokeWidth: "2", endStrokeCap: "stealth", startStrokeCap: "none", strokeStyle: "normal" },
    captions: label ? [{ content: `<p>${label}</p>`, position: "50%" }] : [],
  });
}

async function mkLabel(cx, cy, label, color) {
  await post("/shapes", {
    data:  { shape: "round_rectangle", content: `<p><strong>${label}</strong></p>` },
    style: { fillColor: color, borderColor: color, color: "#FFFFFF", fontSize: "13", textAlign: "center", textAlignVertical: "middle" },
    geometry: { width: 230, height: 40 },
    position: { x: cx, y: cy, origin: "center" },
  });
}

async function mkScreen(name, subtitle, cx, cy, color, lines, btnLabel = null) {
  const FW = 300, FH = 530;
  const top = cy - FH / 2;

  process.stdout.write(`  → ${name} ... `);
  await mkFrame(name, cx, cy, FW, FH);
  await mkRect(cx, top + 4,  FW, 8,  color);
  await mkRect(cx, top + 33, FW, 52, color, `<strong>${name}</strong>`, { color: "#FFFFFF", fontSize: "14", alignV: "middle" });
  await mkRect(cx, top + 72, FW, 26, "#F1F5F9", subtitle, { color: C.muted, fontSize: "10", alignV: "middle", border: C.border });
  await mkBody(cx, top + 266, 278, 348, lines);
  if (btnLabel) {
    await mkRect(cx, top + 488, 262, 40, color, `<strong>${btnLabel}</strong>`,
      { color: "#FFFFFF", fontSize: "12", align: "center", alignV: "middle" });
  }
  // Anchor shape for connectors
  const anchor = await post("/shapes", {
    data:  { shape: "circle", content: "" },
    style: { fillColor: color, borderColor: color, color: "#FFFFFF", fontSize: "12" },
    geometry: { width: 14, height: 14 },
    position: { x: cx, y: cy, origin: "center" },
  });
  console.log("✅");
  return anchor.id;
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  PlantOps — Add Missing Screens");
  console.log("═══════════════════════════════════════════════\n");

  process.stdout.write("Connecting to board ... ");
  const board = await api("GET", "");
  console.log(`✅  "${board.name}"\n`);

  const IDs = {};

  // Layout — rows below existing CMMS row (y=1040)
  const X = [-800, -380, 40, 460, 880];
  const Y = { worker: 1770, admin: 2500, reports: 3230 };
  const HOME_X = -380, HOME_Y = -1150;

  // Home Hub anchor (for connecting down to new rows)
  process.stdout.write("  anchor(home) ... ");
  IDs.home = (await post("/shapes", {
    data:  { shape: "circle", content: "" },
    style: { fillColor: "#1E293B", borderColor: "#1E293B", color: "#FFFFFF", fontSize: "12" },
    geometry: { width: 14, height: 14 },
    position: { x: HOME_X, y: HOME_Y, origin: "center" },
  })).id;
  console.log("✅\n");

  // ─── Row 5: Worker Tools ─────────────────────────────────────────────────
  console.log("── Row 5: Worker Tools ────────────────────────");
  await mkLabel(-1060, Y.worker, "05 — Worker Tools", C.incidents);

  IDs.incident = await mkScreen("Incident Report", "No login required — open access",
    X[0], Y.worker, C.incidents,
    [
      "<strong>Anyone can submit — no login needed</strong>",
      "─────────────────────",
      "Reporter Name",
      "┌─────────────────┐",
      "│  Jane Smith     │",
      "└─────────────────┘",
      "Plant:  [ Plant A ▼ ]",
      "Category: [ Equipment ▼ ]",
      "Criticality: [ Major ▼ ]",
      "─────────────────────",
      "Description:",
      "┌─────────────────┐",
      "│  Conveyor belt  │",
      "│  stopped at     │",
      "│  08:30...       │",
      "└─────────────────┘",
      "📷 Photo (optional)",
    ],
    "Submit Report"
  );

  IDs.checklists = await mkScreen("Checklist Submission", "Worker — Shift Start",
    X[1], Y.worker, C.checklists,
    [
      "Template: Shift Start Checklist",
      "Shift: [ Day ▼ ]",
      "─────────────────────",
      "✅ PPE in place",
      "   [ Pass ] [ Fail ]",
      "",
      "✅ Emergency stops tested",
      "   [ Pass ] [ Fail ]",
      "",
      "✅ Line pressure reading",
      "   Value: [ 42.5 psi ]",
      "",
      "✅ Conveyor belt tension",
      "   [ Pass ] [ Fail ]",
      "",
      "⚠️  1 item flagged as issue",
    ],
    "Submit Checklist"
  );

  IDs.docs = await mkScreen("Documents Library", "SOPs, Manuals & Safety Docs",
    X[2], Y.worker, C.docs,
    [
      "🔍 [ Search documents... ]",
      "─────────────────────",
      "📁 Safety Procedures",
      "  📄 Emergency Evacuation SOP",
      "  📄 Chemical Handling Guide",
      "  📄 PPE Requirements",
      "",
      "📁 Machine Manuals",
      "  📄 Granulator #2 Manual",
      "  📄 Conveyor Belt Specs",
      "",
      "📁 Quality SOPs",
      "  📄 Inspection Procedure v3",
      "  📄 Sampling Guidelines",
      "",
      "📁 HR & Training",
      "  📄 Onboarding Checklist",
    ],
    "View Document"
  );

  // ─── Row 6: Admin & Config ───────────────────────────────────────────────
  console.log("\n── Row 6: Admin & Config ──────────────────────");
  await mkLabel(-1060, Y.admin, "06 — Admin & Config", C.admin);

  IDs.adminPanel = await mkScreen("Admin Panel", "Tenant Administration",
    X[0], Y.admin, C.admin,
    [
      "👤 User Management",
      "─────────────────────",
      "  John T.   admin    Active",
      "  Sarah L.  qual_mgr Active",
      "  Mike R.   maint_tech Active",
      "  Tom K.    worker   Active",
      "─────────────────────",
      "Actions per user:",
      "  Edit Role | Reset Password",
      "  Deactivate",
      "─────────────────────",
      "📋 Activity Logs",
      "  Recent: John logged in",
      "  LOT-2026-0003 approved",
      "  WO-2026-0001 completed",
    ],
    "+ Invite User"
  );

  IDs.platform = await mkScreen("Platform Admin", "super_admin — All Tenants",
    X[1], Y.admin, C.platform,
    [
      "🌐 Tenant Registry",
      "─────────────────────",
      "  FPI              Active ✅",
      "  Frankfort Plastics",
      "  (FPFI)           Active ✅",
      "─────────────────────",
      "Per-Tenant Actions:",
      "  → View Users",
      "  → View Incidents",
      "  → Activity Logs",
      "  → Manage Settings",
      "─────────────────────",
      "Super Admin bypasses",
      "all role restrictions",
      "across every tenant.",
    ],
    "+ Create Tenant"
  );

  IDs.qmsConfig = await mkScreen("QMS Config", "Material Types, Templates, Specs",
    X[2], Y.admin, C.qms,
    [
      "📦 Material Types",
      "  HDPE · PET · PP · LDPE",
      "─────────────────────",
      "📏 Parameters",
      "  Bulk Density     numeric",
      "  Metal Contam.    percentage",
      "  Moisture Content percentage",
      "  Color Rating     visual",
      "─────────────────────",
      "📋 Inspection Templates",
      "  HDPE Standard v3 (current)",
      "  PET Standard v2  (current)",
      "─────────────────────",
      "👥 Customer Specs",
      "  XYZ Plastics — HDPE limits",
      "  ABC Corp — PET limits",
    ],
    "Edit Template"
  );

  IDs.opsSettings = await mkScreen("OPS Settings", "Master Data Management",
    X[3], Y.admin, C.ops,
    [
      "👥 Customers",
      "  XYZ Plastics  · xyz@co.com",
      "  ABC Corp      · abc@co.com",
      "─────────────────────",
      "🏭 Vendors / Suppliers",
      "  ABC Recycling · abc@rec.com",
      "  DEF Supply    · def@sup.com",
      "─────────────────────",
      "🚛 Carriers",
      "  FastFreight LLC",
      "  QuickShip Co.",
      "─────────────────────",
      "📍 Locations / Warehouses",
      "  Warehouse A — 5,000 kg cap",
      "  Line A Storage — 2,000 kg",
      "  Staging Area",
    ],
    "+ Add Record"
  );

  // ─── Row 7: Reports ──────────────────────────────────────────────────────
  console.log("\n── Row 7: Reports ─────────────────────────────");
  await mkLabel(-1060, Y.reports, "07 — Reports", C.reports);

  IDs.opsReports = await mkScreen("OPS Reports", "Operations Analytics",
    X[0], Y.reports, C.ops,
    [
      "[ Overview ] [ Jobs ] [ Prod ] [ Ship ]",
      "─────────────────────",
      "📊 Overview KPIs",
      "  Active Jobs:       3",
      "  Avg Yield:         86.4%",
      "  On-time Delivery:  92%",
      "  Total Downtime:    4.5 hrs",
      "─────────────────────",
      "📈 Jobs Tab",
      "  Open: 2  In Progress: 3",
      "  Completed: 12  Cancelled: 1",
      "─────────────────────",
      "📈 Production Tab",
      "  Yield by processing type",
      "  Downtime trend chart",
    ]
  );

  IDs.qmsReports = await mkScreen("QMS Reports", "Quality Analytics",
    X[1], Y.reports, C.qms,
    [
      "[ Lot Results ] [ NCR ] [ Yield ] [ CC ]",
      "─────────────────────",
      "📊 Lot Results",
      "  Pass rate:   78%  (14 lots)",
      "  Fail rate:   22%  (4 lots)",
      "─────────────────────",
      "📈 NCR Trends",
      "  Critical: 1  Major: 3",
      "  Minor: 5  (Last 30 days)",
      "  Top category: Process (4)",
      "─────────────────────",
      "📈 Yield Analysis",
      "  HDPE avg yield: 87.3%",
      "  PET avg yield:  84.1%",
      "─────────────────────",
      "📈 Complaints: 2 open",
    ]
  );

  IDs.cmmsReports = await mkScreen("CMMS Reports", "Maintenance Analytics",
    X[2], Y.reports, C.cmms,
    [
      "[ Downtime ] [ History ] [ Issues ] [ PM ]",
      "─────────────────────",
      "📊 Downtime Analysis",
      "  Total downtime: 18.5 hrs",
      "  Top cause: Equipment (42%)",
      "  Worst machine: Granulator #2",
      "─────────────────────",
      "📈 Maintenance History",
      "  WOs completed: 8",
      "  Avg resolution: 3.2 hrs",
      "─────────────────────",
      "📈 PM Compliance",
      "  On-time: 85%",
      "  Overdue: 2 schedules",
      "─────────────────────",
      "📈 Issue Frequency trends",
    ]
  );

  // ─── Connectors ──────────────────────────────────────────────────────────
  console.log("\n── Creating connectors ────────────────────────");

  process.stdout.write("  Home → Worker Tools ... ");
  await mkConn(IDs.home, IDs.incident,   "Incidents",   C.incidents, "bottom", "top");
  await mkConn(IDs.home, IDs.checklists, "Checklists",  C.checklists,"bottom", "top");
  await mkConn(IDs.home, IDs.docs,       "Documents",   C.docs,      "bottom", "top");
  console.log("✅");

  process.stdout.write("  Home → Admin ... ");
  await mkConn(IDs.home, IDs.adminPanel, "Admin Panel",    C.admin,    "bottom", "top");
  await mkConn(IDs.home, IDs.platform,   "Platform Admin", C.platform, "bottom", "top");
  console.log("✅");

  process.stdout.write("  Module → Reports ... ");
  await mkConn(IDs.home, IDs.opsReports,  "OPS Reports",  C.ops,  "bottom", "top");
  await mkConn(IDs.home, IDs.qmsReports,  "QMS Reports",  C.qms,  "bottom", "top");
  await mkConn(IDs.home, IDs.cmmsReports, "CMMS Reports", C.cmms, "bottom", "top");
  console.log("✅");

  process.stdout.write("  Admin → Config ... ");
  await mkConn(IDs.adminPanel, IDs.qmsConfig,   "QMS Config",  C.qms, "right", "left");
  await mkConn(IDs.adminPanel, IDs.opsSettings, "OPS Settings", C.ops, "right", "left");
  console.log("✅");

  console.log(`
═══════════════════════════════════════════════
  ✅ Done! 10 new screens + connectors added.
  🔗 https://miro.com/app/board/${BOARD_ID}/
═══════════════════════════════════════════════
`);
}

main().catch(err => {
  console.error("\n❌ Fatal:", err.message);
  process.exit(1);
});
