/**
 * PlantOps — Visual Board v2 (Presentation-grade)
 * Cards: colored header band + light body + anchor dot (3 items/screen)
 * Flow: Landing → Login → Home → all modules
 * Run: node scripts/miro-lean.mjs
 */

const BOARD_ID = "uXjVGzJ_7XM=";
const TOKEN    = "eyJtaXJvLm9yaWdpbiI6ImV1MDEifQ_2fagmTC3t0D_uixhhgCawAOOKSk";
const BASE     = `https://api.miro.com/v2/boards/${encodeURIComponent(BOARD_ID)}`;

const C = {
  landing:    "#0EA5E9",
  auth:       "#7C3AED",
  home:       "#1E293B",
  ops:        "#2563EB",
  qms:        "#16A34A",
  cmms:       "#EA580C",
  incidents:  "#DC2626",
  checklists: "#0891B2",
  docs:       "#475569",
  admin:      "#4F46E5",
  platform:   "#6D28D9",
  reports:    "#64748B",
  cross:      "#8B5CF6",
  red:        "#DC2626",
  amber:      "#D97706",
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(method, path, body) {
  await sleep(300);
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
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${data?.message} | ${JSON.stringify(data)}`);
  return data;
}

const post = (path, b) => api("POST", path, b);

// ── Card dimensions ───────────────────────────────────────────────────────
const FW = 340, FH = 530, HH = 80;  // total width/height, header height

async function mkScreen(name, subtitle, content, cx, cy, color) {
  const headerY = cy - FH / 2 + HH / 2;          // center of header band
  const bodyH   = FH - HH;                         // 450
  const bodyY   = cy - FH / 2 + HH + bodyH / 2;   // center of body

  // 1. Colored header: name + subtitle
  await post("/shapes", {
    data: { shape: "rectangle", content: `<p><strong>${name}</strong></p><p>${subtitle}</p>` },
    style: { fillColor: color, borderColor: color, color: "#FFFFFF",
             fontSize: "12", textAlign: "center", textAlignVertical: "middle" },
    geometry: { width: FW, height: HH },
    position: { x: cx, y: headerY, origin: "center" },
  });

  // 2. Light body: content lines
  await post("/shapes", {
    data: { shape: "rectangle", content: content.map(l => `<p>${l}</p>`).join("") },
    style: { fillColor: "#F8FAFC", borderColor: "#E2E8F0", color: "#1E293B",
             fontSize: "11", textAlign: "left", textAlignVertical: "middle" },
    geometry: { width: FW, height: bodyH },
    position: { x: cx, y: bodyY, origin: "center" },
  });

  // 3. Anchor dot (for connectors — frames can't be endpoints)
  const anchor = await post("/shapes", {
    data:  { shape: "circle", content: "" },
    style: { fillColor: color, borderColor: color, color: "#FFFFFF", fontSize: "12" },
    geometry: { width: 14, height: 14 },
    position: { x: cx, y: cy, origin: "center" },
  });

  process.stdout.write("✅ ");
  return anchor.id;
}

async function mkConn(fromId, toId, label = "", color = "#94A3B8", sf = "right", st = "left") {
  await post("/connectors", {
    startItem: { id: fromId, snapTo: sf },
    endItem:   { id: toId,   snapTo: st },
    style: { strokeColor: color, strokeWidth: "2", endStrokeCap: "stealth", startStrokeCap: "none" },
    captions: label ? [{ content: `<p>${label}</p>`, position: "50%" }] : [],
  });
}

async function mkDivider(label, color, cx, y, width = 1900) {
  await post("/shapes", {
    data:  { shape: "round_rectangle", content: `<p><strong>${label}</strong></p>` },
    style: { fillColor: color, borderColor: color, color: "#FFFFFF",
             fontSize: "16", textAlign: "center", textAlignVertical: "middle" },
    geometry: { width, height: 48 },
    position: { x: cx, y, origin: "center" },
  });
}

async function mkNode(cx, cy, label, color, w = 170, h = 48) {
  const r = await post("/shapes", {
    data:  { shape: "round_rectangle", content: `<p><strong>${label}</strong></p>` },
    style: { fillColor: color, borderColor: color, color: "#FFFFFF",
             fontSize: "11", textAlign: "center", textAlignVertical: "middle" },
    geometry: { width: w, height: h },
    position: { x: cx, y: cy, origin: "center" },
  });
  return r.id;
}

async function mkStateChain(nodes, startX, y, color, gap = 210) {
  const ids = [];
  for (let i = 0; i < nodes.length; i++) {
    ids.push(await mkNode(startX + i * gap, y, nodes[i], color));
  }
  for (let i = 0; i < ids.length - 1; i++) await mkConn(ids[i], ids[i + 1], "", color);
  return ids;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  PlantOps — Visual Board v2");
  console.log("═══════════════════════════════════════════════\n");

  process.stdout.write("Connecting ... ");
  const board = await api("GET", "");
  console.log(`✅ "${board.name}"\n`);

  const IDs = {};

  // ── Layout ────────────────────────────────────────────────────────────────
  const LNDX = -1200;  // Landing page (auth row only, extra-left)
  const X = [-840, -480, -120, 240, 600];    // 5 columns for all other rows
  const Y = { auth: -500, ops: 300, qms: 1100, cmms: 1900, worker: 2700, admin: 3500, reports: 4300 };

  // Center / width helpers
  const authCX  = (LNDX + X[2]) / 2;   // center across landing + 3 auth screens = -840
  const authW   = (X[2] + FW/2) - (LNDX - FW/2);  // ~1720
  const mainCX  = X[2];                 // -120
  const mainW   = (X[4] + FW/2) - (X[0] - FW/2);  // ~1610

  // ── LEGEND ──────────────────────────────────────────────────────────────
  console.log("📌 Legend");
  await post("/shapes", {
    data: { shape: "rectangle", content:
      `<p><strong>PlantOps — Full Application Flow</strong></p>` +
      `<p>LANDING (sky)  |  AUTH (violet)  |  HOME (dark)  |  OPS (blue)  |  QMS (green)  |  CMMS (orange)  |  Incidents (red)  |  Admin (indigo)  |  Cross-module (purple)</p>`,
    },
    style: { fillColor: "#0F172A", borderColor: "#0F172A", color: "#F1F5F9",
             fontSize: "14", textAlign: "center", textAlignVertical: "middle" },
    geometry: { width: 2400, height: 80 },
    position: { x: authCX, y: Y.auth - FH/2 - 110, origin: "center" },
  });
  console.log("  ✅\n");

  // ── ROW 0: ENTRY & AUTH ──────────────────────────────────────────────────
  console.log("── Entry & Auth ──");
  await mkDivider("Entry Flow  →  Authentication  →  Home Hub", C.auth, authCX, Y.auth - FH/2 - 35, authW + 60);
  process.stdout.write("  ");

  IDs.landing = await mkScreen("Landing Page", "plantops.vercel.app", [
    "PlantOps",
    "Smart Manufacturing Operations",
    "",
    "Manage operations, quality,",
    "maintenance and compliance",
    "from one unified platform.",
    "",
    "Serving: FPI · Frankfort Plastics",
    "",
    "→  Sign In to Your Account",
  ], LNDX, Y.auth, C.landing);

  IDs.login = await mkScreen("Login", "Secure company sign-in", [
    "Company Code:  [ FPI       ]",
    "Username:      [ johndoe   ]",
    "Password:      [ ........  ]",
    "",
    "[ Sign In ]",
    "",
    "Roles recognized:",
    "admin | qual_mgr | maint_mgr",
    "maint_tech | quality | worker",
    "viewer | super_admin",
  ], X[0], Y.auth, C.auth);

  IDs.home = await mkScreen("Home Hub", "Hi John — FPI | Admin", [
    "🏭  Operations",
    "🔬  Quality Management (QMS)",
    "🔧  Maintenance (CMMS)",
    "📋  Checklists",
    "📦  Inbound / Outbound Shipments",
    "📁  Documents Library",
    "🚨  Incident Reports",
    "📊  Reports and Analytics",
    "⚙️  Admin Panel",
  ], X[1], Y.auth, C.home);
  console.log();

  // ── ROW 1: OPERATIONS ────────────────────────────────────────────────────
  console.log("── Operations ──");
  await mkDivider("Operations Module  (OPS)", C.ops, mainCX, Y.ops - FH/2 - 35, mainW);
  process.stdout.write("  ");

  IDs.opsHub = await mkScreen("Operations Hub", "OPS Dashboard", [
    "Active Jobs: 3  |  Lots in QC: 2",
    "Staged Shipments: 1  |  Downtime: 1.5h",
    "────────────────────",
    "JOB-2026-0001  HDPE Grind  In Progress",
    "JOB-2026-0002  PET Sort    Open",
    "JOB-2026-0003  PP Mix      Completed",
    "",
    "→ Jobs  → Lots  → Reports",
  ], X[0], Y.ops, C.ops);

  IDs.jobsList = await mkScreen("Jobs List", "All production jobs", [
    "JOB-2026-0001  HDPE  5,000 kg",
    "  Status: In Progress",
    "JOB-2026-0002  PET   3,000 kg",
    "  Status: Open",
    "JOB-2026-0003  PP    2,000 kg",
    "  Status: Completed",
    "",
    "[ + New Job ]",
  ], X[1], Y.ops, C.ops);

  IDs.jobDetail = await mkScreen("Job Detail", "JOB-2026-0001 — 4 Tabs", [
    "[ Inbound ][ Lots ][ Prod ][ Outbound ]",
    "────────────────────",
    "Inbound: SHP-IN-2026-03-0001  Received",
    "Vendor: ABC Recycling  3,800 kg",
    "",
    "Lots: LOT-03-0001, LOT-03-0002",
    "",
    "→ Send Lot to QC",
    "  (creates QMS lot automatically)",
  ], X[2], Y.ops, C.ops);

  IDs.production = await mkScreen("Production Run", "RUN-2026-03-0001 — Line A", [
    "Process: Granulation  |  In Progress",
    "Input:  1,200 kg",
    "Output: 1,047 kg  |  Yield: 87.3%",
    "────────────────────",
    "Downtime Events:",
    "  08:30  Belt slip (Equip)   22 min",
    "  10:15  Material jam         8 min",
    "Total downtime: 30 min",
  ], X[3], Y.ops, C.ops);

  IDs.outbound = await mkScreen("Outbound Shipment", "SHP-OUT-2026-03-0001", [
    "Customer: XYZ Plastics",
    "Status: Staged  |  BOL: BOL-2026-0042",
    "",
    "Lots:  LOT-03-0001  1,047 kg",
    "       LOT-03-0002    892 kg",
    "Total: 1,939 kg",
    "",
    "Docs: BOL  COA  Weight Ticket",
    "[ Mark as Shipped ]",
  ], X[4], Y.ops, C.ops);
  console.log();

  // ── ROW 2: QMS ──────────────────────────────────────────────────────────
  console.log("── Quality (QMS) ──");
  await mkDivider("Quality Management System  (QMS)", C.qms, mainCX, Y.qms - FH/2 - 35, mainW);
  process.stdout.write("  ");

  IDs.qmsHub = await mkScreen("Quality Hub", "QMS Dashboard", [
    "Pending QC: 3  |  Pending Review: 1",
    "Open NCRs: Critical 1  |  Major 2",
    "Open Complaints: 2  |  Need COA: 4",
    "────────────────────",
    "→ Lot Registry    → Inspections",
    "→ NCR Board       → Complaints",
    "→ COA Generator   → Config",
    "→ Reports",
  ], X[0], Y.qms, C.qms);

  IDs.lots = await mkScreen("Lot Registry", "QMS Lot tracking", [
    "LOT-2026-0001  HDPE 1,047 kg  Pending QC",
    "LOT-2026-0002  PET    892 kg  In Progress",
    "LOT-2026-0003  PP     745 kg  Approved",
    "LOT-2026-0004  HDPE   320 kg  On Hold (NCR)",
    "",
    "Lots created from OPS Job Detail",
    "via Send Lot to QC action",
  ], X[1], Y.qms, C.qms);

  IDs.inspection = await mkScreen("Inspection Form", "LOT-2026-0002 — PET Standard v2", [
    "Inspector: Sarah L.",
    "",
    "Bulk Density   0.92    0.85-1.05   Pass",
    "Metal Contam   0.008%  less 0.01%  Pass",
    "Moisture       1.2%    less 0.5%   FAIL",
    "Color          4 of 5  min 3       Pass",
    "────────────────────",
    "Result: FAIL — 1 parameter out of spec",
    "→ Raise NCR",
  ], X[2], Y.qms, C.qms);

  IDs.ncr = await mkScreen("NCR Detail", "NCR-2026-0001 — Major", [
    "Source: Internal Inspection",
    "Severity: Major  |  Due: Mar 15",
    "Status: Under Investigation",
    "Assigned: John T.",
    "────────────────────",
    "Root Cause: Dryer calibration drift",
    "Corrective: Recalibrate thermocouple",
    "",
    "open → investigating → CA → closed",
  ], X[3], Y.qms, C.qms);

  IDs.coa = await mkScreen("Certificate of Analysis", "COA-2026-0001", [
    "LOT-2026-0003  PP  XYZ Plastics",
    "",
    "Bulk Density   0.91    0.85-1.05   Pass",
    "Metal Contam   0.007%  less 0.01%  Pass",
    "Moisture       0.4%    less 0.5%   Pass",
    "Melt Flow      12.3    10-15       Pass",
    "────────────────────",
    "CONFORMS TO SPECIFICATION",
    "[ Download PDF ]",
  ], X[4], Y.qms, C.qms);
  console.log();

  // ── ROW 3: CMMS ─────────────────────────────────────────────────────────
  console.log("── Maintenance (CMMS) ──");
  await mkDivider("Maintenance Management  (CMMS)", C.cmms, mainCX, Y.cmms - FH/2 - 35, mainW);
  process.stdout.write("  ");

  IDs.maintHub = await mkScreen("Maintenance Hub", "CMMS Dashboard", [
    "Machines Down: 1  |  Open WOs: 4 (1 Urgent)",
    "PM Due Today: 2  |  Flagged Checklists: 3",
    "Notifications: 3 unread",
    "────────────────────",
    "→ Work Orders     → PM Schedules",
    "→ Machines        → Checklists",
    "→ Log Sheets      → Breakdowns",
    "→ Procedures      → Reports",
  ], X[0], Y.cmms, C.cmms);

  IDs.workOrders = await mkScreen("Work Orders", "Open work orders list", [
    "WO-2026-0001  Urgent   Granulator #2",
    "  Belt Replacement  Assigned: Mike R.",
    "WO-2026-0002  High     Conveyor B",
    "  Motor Bearing     In Progress",
    "WO-2026-0003  Medium   Compactor #1",
    "WO-2026-0004  Low      Sorter A",
    "",
    "[ + New Work Order ]",
  ], X[1], Y.cmms, C.cmms);

  IDs.woDetail = await mkScreen("Work Order Detail", "WO-2026-0001 — Urgent", [
    "Machine: Granulator #2  Priority: Urgent",
    "Status: In Progress",
    "Assigned: Mike R.",
    "Est: 4h  |  Actual: 2.5h",
    "Linked Breakdown: BR-2026-0003",
    "────────────────────",
    "Main drive belt worn — replace now",
    "Notes: Belt ordered, arriving today",
    "[ Mark Complete ]",
  ], X[2], Y.cmms, C.cmms);

  IDs.breakdown = await mkScreen("Breakdown Report", "BR-2026-0003", [
    "Machine: Granulator #2  |  Status: Open",
    "Downtime: 06:45 - 08:00  (1h 15min)",
    "Reported: Mike R.  Mar 10 2026",
    "────────────────────",
    "Root Cause: Main drive belt worn",
    "Impact: Production Line A halted",
    "",
    "[ Convert to Work Order ]",
  ], X[3], Y.cmms, C.cmms);

  IDs.pmSchedule = await mkScreen("PM Schedules", "Preventive Maintenance", [
    "Granulator #2    Weekly    TODAY (due)",
    "Conveyor Belt B  Monthly   Mar 15 2026",
    "Compactor #1     Quarterly Apr 1  done",
    "Sorter A         Annual    Jun 1  done",
    "────────────────────",
    "Cron runs daily — checks due schedules",
    "Sends notifications to maintenance team",
    "Flags overdue items on Dashboard",
  ], X[4], Y.cmms, C.cmms);
  console.log();

  // ── ROW 4: WORKER TOOLS ─────────────────────────────────────────────────
  console.log("── Worker Tools ──");
  await mkDivider("Worker Tools  (Incidents open to all — no login required)", C.incidents, mainCX, Y.worker - FH/2 - 35, mainW);
  process.stdout.write("  ");

  IDs.incident = await mkScreen("Incident Report", "Open access — no login needed", [
    "Public URL — anyone can submit",
    "",
    "Reporter: Jane Smith",
    "Plant: Plant A  |  Category: Equipment",
    "Criticality: Major",
    "────────────────────",
    "Description: Conveyor stopped at 08:30",
    "Photo: optional upload",
    "[ Submit Report ]",
  ], X[0], Y.worker, C.incidents);

  IDs.checklists = await mkScreen("Checklist Submission", "Daily Shift Start — Line A", [
    "Template: Shift Start Checklist",
    "Shift: Day  |  Line: Line A",
    "────────────────────",
    "PPE in place             Pass",
    "Emergency stops          Pass",
    "Line pressure  42.5 psi  Pass",
    "Conveyor tension         Pass",
    "Lubrication level        FAIL",
    "[ Submit — 1 item flagged ]",
  ], X[1], Y.worker, C.checklists);

  IDs.docs = await mkScreen("Documents Library", "SOPs, Manuals, Safety Docs", [
    "Safety Procedures",
    "  Emergency Evacuation SOP",
    "  Chemical Handling Guide",
    "Machine Manuals",
    "  Granulator #2 Manual",
    "Quality SOPs",
    "  Inspection Procedure v3",
    "HR and Training",
    "[ Upload / Download / View ]",
  ], X[2], Y.worker, C.docs);
  console.log();

  // ── ROW 5: ADMIN & CONFIG ────────────────────────────────────────────────
  console.log("── Admin & Config ──");
  await mkDivider("Administration  and  Configuration", C.admin, mainCX, Y.admin - FH/2 - 35, mainW);
  process.stdout.write("  ");

  IDs.adminPanel = await mkScreen("Admin Panel", "Tenant Administration", [
    "Users:",
    "  John T.   admin",
    "  Sarah L.  qual_mgr",
    "  Mike R.   maint_tech",
    "  Tom K.    worker",
    "────────────────────",
    "Actions: Edit Role | Reset Password",
    "Activity Logs | Incidents | Documents",
    "[ + Invite User ]",
  ], X[0], Y.admin, C.admin);

  IDs.platform = await mkScreen("Platform Admin", "super_admin — All Tenants", [
    "Tenants:",
    "  FPI                Active",
    "  FPFI (Frankfort)   Active",
    "────────────────────",
    "Per-tenant:",
    "  Users | Incidents | Activity Logs",
    "",
    "super_admin bypasses all role checks",
    "[ + Create Tenant ]",
  ], X[1], Y.admin, C.platform);

  IDs.qmsConfig = await mkScreen("QMS Config", "Material Types and Templates", [
    "Material Types:",
    "  HDPE  PET  PP  LDPE",
    "",
    "Parameters: Bulk Density,",
    "  Metal Contamination, Moisture,",
    "  Melt Flow, Color Rating",
    "",
    "Templates: HDPE Standard v3",
    "           PET Standard v2",
    "Customer Specs: XYZ · ABC Corp",
  ], X[2], Y.admin, C.qms);

  IDs.opsSettings = await mkScreen("OPS Settings", "Master Data Configuration", [
    "Customers: XYZ Plastics, ABC Corp",
    "Vendors:   ABC Recycling, DEF Supply",
    "Carriers:  FastFreight LLC",
    "",
    "Locations:",
    "  Warehouse A      5,000 kg capacity",
    "  Line A Storage   2,000 kg capacity",
    "  Staging Area",
    "Processing: Grind, Sort, Pellet",
  ], X[3], Y.admin, C.ops);
  console.log();

  // ── ROW 6: REPORTS ──────────────────────────────────────────────────────
  console.log("── Reports ──");
  await mkDivider("Reports  and  Analytics", C.reports, mainCX, Y.reports - FH/2 - 35, mainW);
  process.stdout.write("  ");

  IDs.opsReports = await mkScreen("OPS Reports", "Operations Analytics", [
    "Active Jobs: 3  |  Avg Yield: 86.4%",
    "On-time Delivery: 92%",
    "Downtime this week: 4.5 h",
    "────────────────────",
    "Jobs: Open 2 | In Progress 3 | Done 12",
    "Production: yield by type + downtime",
    "Shipments: inbound/outbound volume",
    "[ Export CSV / PDF ]",
  ], X[0], Y.reports, C.ops);

  IDs.qmsReports = await mkScreen("QMS Reports", "Quality Analytics", [
    "Lot Results: Pass 78%  |  Fail 22%",
    "NCR Trends: Crit 1 | Major 3 | Minor 5",
    "  Top category: Process (4)",
    "────────────────────",
    "Yield: HDPE 87.3%  |  PET 84.1%",
    "Complaints: 2 open | avg resolve 5 days",
    "Compliance by material type",
    "[ Export CSV / PDF ]",
  ], X[1], Y.reports, C.qms);

  IDs.cmmsReports = await mkScreen("CMMS Reports", "Maintenance Analytics", [
    "Downtime: 18.5 hrs this month",
    "Top cause: Equipment failure 42%",
    "Worst machine: Granulator #2",
    "────────────────────",
    "WOs completed: 8  |  Avg resolve: 3.2 h",
    "PM Compliance: 85% on-time",
    "Overdue schedules: 2",
    "[ Export CSV / PDF ]",
  ], X[2], Y.reports, C.cmms);
  console.log();

  // ── CONNECTORS ──────────────────────────────────────────────────────────
  console.log("── Connectors ──");

  process.stdout.write("  Entry flow ... ");
  await mkConn(IDs.landing, IDs.login, "Get Started", C.landing);
  await mkConn(IDs.login,   IDs.home,  "Sign In",     C.auth);
  console.log("✅");

  process.stdout.write("  Home → all modules ... ");
  await mkConn(IDs.home, IDs.opsHub,     "Operations",  C.ops,        "bottom", "top");
  await mkConn(IDs.home, IDs.qmsHub,     "Quality",     C.qms,        "bottom", "top");
  await mkConn(IDs.home, IDs.maintHub,   "Maintenance", C.cmms,       "bottom", "top");
  await mkConn(IDs.home, IDs.incident,   "Incidents",   C.incidents,  "bottom", "top");
  await mkConn(IDs.home, IDs.checklists, "Checklists",  C.checklists, "bottom", "top");
  await mkConn(IDs.home, IDs.docs,       "Documents",   C.docs,       "bottom", "top");
  await mkConn(IDs.home, IDs.adminPanel, "Admin",       C.admin,      "bottom", "top");
  await mkConn(IDs.home, IDs.platform,   "Platform",    C.platform,   "bottom", "top");
  await mkConn(IDs.home, IDs.opsReports, "Reports",     C.reports,    "bottom", "top");
  console.log("✅");

  process.stdout.write("  OPS flow ... ");
  await mkConn(IDs.opsHub,     IDs.jobsList,   "",               C.ops);
  await mkConn(IDs.jobsList,   IDs.jobDetail,  "Open Job",       C.ops);
  await mkConn(IDs.jobDetail,  IDs.production, "Production Tab", C.ops);
  await mkConn(IDs.production, IDs.outbound,   "Outbound Tab",   C.ops);
  console.log("✅");

  process.stdout.write("  QMS flow ... ");
  await mkConn(IDs.qmsHub,     IDs.lots,       "",                C.qms);
  await mkConn(IDs.lots,       IDs.inspection, "Inspect",         C.qms);
  await mkConn(IDs.inspection, IDs.ncr,        "FAIL to NCR",     C.qms);
  await mkConn(IDs.lots,       IDs.coa,        "Approved to COA", C.qms);
  console.log("✅");

  process.stdout.write("  CMMS flow ... ");
  await mkConn(IDs.maintHub,   IDs.workOrders, "",               C.cmms);
  await mkConn(IDs.workOrders, IDs.woDetail,   "Open WO",        C.cmms);
  await mkConn(IDs.maintHub,   IDs.breakdown,  "Breakdowns",     C.cmms);
  await mkConn(IDs.breakdown,  IDs.woDetail,   "Convert to WO",  C.cmms);
  await mkConn(IDs.maintHub,   IDs.pmSchedule, "PM Schedules",   C.cmms);
  console.log("✅");

  process.stdout.write("  Admin → Config ... ");
  await mkConn(IDs.adminPanel, IDs.qmsConfig,   "QMS Config",   C.qms, "right", "left");
  await mkConn(IDs.adminPanel, IDs.opsSettings,  "OPS Settings", C.ops, "right", "left");
  console.log("✅");

  process.stdout.write("  Cross-module flows ... ");
  await mkConn(IDs.jobDetail,  IDs.lots,      "Send Lot to QC", C.cross, "bottom", "top");
  await mkConn(IDs.production, IDs.breakdown, "Downtime to WO", C.cross, "bottom", "top");
  await mkConn(IDs.coa,        IDs.outbound,  "Attach COA",     C.cross, "bottom", "top");
  console.log("✅");

  // ── STATE MACHINES ────────────────────────────────────────────────────────
  console.log("\n── State Machines ──");
  const SM_Y = Y.reports + 650;

  await mkDivider("STATUS FLOWS — State Machines", "#0F172A", mainCX, SM_Y - 60, 2000);

  process.stdout.write("  Building state chains ... ");

  // OPS Lot
  const opLot = await mkStateChain(["pending","in_storage","in_production","qc_hold","approved","shipped"], -840, SM_Y + 40, C.ops, 200);
  const opRej = await mkNode(-840 + 3*200, SM_Y + 110, "rejected", C.red, 140, 40);
  await mkConn(opLot[3], opRej, "fail", C.red, "bottom", "top");

  // QMS Lot
  const qmLot  = await mkStateChain(["pending_qc","qc_in_progress","approved","shipped"], -840, SM_Y + 210, C.qms, 230);
  const qmRej  = await mkNode(-840 + 230, SM_Y + 280, "rejected",  C.red,   140, 40);
  const qmHold = await mkNode(-840 + 460, SM_Y + 280, "on_hold",   C.amber, 140, 40);
  await mkConn(qmLot[1], qmRej,  "fail",     C.red,   "bottom", "top");
  await mkConn(qmLot[2], qmHold, "open NCR", C.amber, "bottom", "top");

  // NCR
  const ncrC = await mkStateChain(["open","under_investigation","CA pending","CA taken","closed"], 420, SM_Y + 40, C.qms, 200);
  const ncrX  = await mkNode(420, SM_Y + 110, "cancelled", C.red, 140, 40);
  await mkConn(ncrC[0], ncrX, "mgr only", C.red, "bottom", "top");

  // Work Order
  const woC = await mkStateChain(["open","in_progress","completed"], -840, SM_Y + 390, C.cmms, 230);
  const woX  = await mkNode(-840 + 230, SM_Y + 460, "cancelled", C.red, 140, 40);
  await mkConn(woC[1], woX, "cancel", C.red, "bottom", "top");

  // Outbound Shipment
  await mkStateChain(["pending","staged","shipped","delivered"], 420, SM_Y + 210, C.ops, 220);

  // Inspection
  const insC = await mkStateChain(["draft","submitted","approved"], -840, SM_Y + 570, C.qms, 230);
  const insX  = await mkNode(-840 + 460, SM_Y + 640, "rejected", C.red, 140, 40);
  await mkConn(insC[2], insX, "fail", C.red, "bottom", "top");

  // Complaint
  await mkStateChain(["open","investigating","ncr_created","resolved","closed"], 420, SM_Y + 390, C.qms, 200);

  console.log("✅");

  console.log(`
═══════════════════════════════════════════════
  Board v2 complete!
  Flow: Landing → Login → Home → 8 modules
  Screens: 28  |  Cards: header + body + dot
  Connectors + State Machines included
  https://miro.com/app/board/${BOARD_ID}/
═══════════════════════════════════════════════
`);
}

main().catch(err => {
  console.error("\n❌", err.message);
  process.exit(1);
});
