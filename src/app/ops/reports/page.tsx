"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, BarChart3, TrendingUp, Truck, Package, Factory
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types ───────────────────────────────────────────────────────────────────

interface OverviewData {
  jobs: { status: string; count: number }[];
  lots: { status: string; count: number }[];
  runs: { total_runs: number; completed_runs: number; avg_yield: string | null; total_output: number };
  inbound30d: { total_shipments: number; received: number; total_weight: number };
  outbound30d: { total_shipments: number; shipped: number; total_weight: number };
}

interface JobsData {
  recent: Array<{
    id: string; job_number: string; job_type: string; status: string;
    customer_name?: string; vendor_name?: string; material_type_name?: string;
    lot_count: number; run_count: number; total_output: number; created_at: string;
  }>;
  byType: { job_type: string; status: string; count: number }[];
  byCustomer: { customer_name: string; job_count: number; completed: number }[];
}

interface ProductionData {
  runs: Array<{
    id: string; run_number: string; status: string; job_number: string;
    material_type_name?: string; processing_type_name?: string; production_line_id?: string;
    input_weight?: number; output_weight?: number; yield_percentage?: number;
    actual_start?: string; actual_end?: string; input_weight_unit?: string;
  }>;
  byLine: { line_id: string; run_count: number; avg_yield: string | null; total_input: number; total_output: number }[];
  yieldBuckets: { below_70: number; p70_80: number; p80_90: number; p90_100: number; above_100: number; no_data: number };
}

interface ShipmentsData {
  inbound: Array<{
    id: string; shipment_number: string; status: string;
    vendor_name?: string; carrier_name_resolved?: string;
    total_weight: number; weight_unit?: string; entry_count: number;
    received_date?: string; scheduled_date?: string; created_at: string;
  }>;
  outbound: Array<{
    id: string; shipment_number: string; status: string;
    customer_name_resolved?: string; carrier_name_resolved?: string;
    total_weight?: number; total_weight_unit?: string; lot_count: number;
    shipped_date?: string; created_at: string;
  }>;
  byVendor: { vendor_name: string; shipment_count: number; total_weight: number }[];
  byCustomer: { customer_name: string; shipment_count: number; total_weight: number }[];
}

const DAYS_OPTIONS = [
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "180 days", value: 180 },
  { label: "1 year", value: 365 },
];

const JOB_STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-600",
  in_progress: "bg-amber-500/10 text-amber-600",
  on_hold: "bg-orange-500/10 text-orange-600",
  completed: "bg-green-500/10 text-green-600",
  cancelled: "bg-red-500/10 text-red-400",
};

const SHIP_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-600",
  received: "bg-green-500/10 text-green-600",
  partial: "bg-amber-500/10 text-amber-600",
  cancelled: "bg-red-500/10 text-red-400",
  pending: "bg-slate-500/10 text-slate-500",
  shipped: "bg-teal-500/10 text-teal-600",
};

// ─── Helper ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 0) {
  if (n == null) return "—";
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(s?: string) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OpsReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [jobsData, setJobsData] = useState<JobsData | null>(null);
  const [prodData, setProdData] = useState<ProductionData | null>(null);
  const [shipData, setShipData] = useState<ShipmentsData | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const loadOverview = async () => {
    const d = await fetch("/api/ops/reports/overview").then(r => r.ok ? r.json() : null).catch(() => null);
    setOverview(d);
  };

  const loadJobs = async (d: number) => {
    const data = await fetch(`/api/ops/reports/jobs?days=${d}`).then(r => r.ok ? r.json() : null).catch(() => null);
    setJobsData(data);
  };

  const loadProduction = async (d: number) => {
    const data = await fetch(`/api/ops/reports/production?days=${d}`).then(r => r.ok ? r.json() : null).catch(() => null);
    setProdData(data);
  };

  const loadShipments = async (d: number) => {
    const data = await fetch(`/api/ops/reports/shipments?days=${d}`).then(r => r.ok ? r.json() : null).catch(() => null);
    setShipData(data);
  };

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(async auth => {
      if (!auth.authenticated) { router.push("/login"); return; }
      await Promise.all([loadOverview(), loadJobs(days), loadProduction(days), loadShipments(days)]);
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDaysChange = async (d: number) => {
    setDays(d);
    await Promise.all([loadJobs(d), loadProduction(d), loadShipments(d)]);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-muted-foreground" size={28} />
    </div>
  );

  // ── Overview helpers ──
  const jobTotal = overview?.jobs.reduce((s, j) => s + Number(j.count), 0) ?? 0;
  const jobByStatus = Object.fromEntries((overview?.jobs ?? []).map(j => [j.status, Number(j.count)]));
  const lotByStatus = Object.fromEntries((overview?.lots ?? []).map(l => [l.status, Number(l.count)]));

  // ── Production helpers ──
  const totalRuns = prodData?.runs.length ?? 0;
  const avgYield = totalRuns > 0
    ? (prodData!.runs.reduce((s, r) => s + (r.yield_percentage ?? 0), 0) / totalRuns).toFixed(1)
    : null;
  const totalOutput = prodData?.runs.reduce((s, r) => s + (r.output_weight ?? 0), 0) ?? 0;

  // ── Yield bucket bar ──
  const buckets = prodData?.yieldBuckets;
  const totalBuckets = buckets
    ? (buckets.below_70 + buckets.p70_80 + buckets.p80_90 + buckets.p90_100 + buckets.above_100 + buckets.no_data) || 1
    : 1;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/ops"><Button variant="ghost" size="sm"><ArrowLeft size={16} className="mr-1" />Operations</Button></Link>
          <div className="flex items-center gap-2 flex-1">
            <BarChart3 size={18} className="text-orange-500" />
            <h1 className="text-lg font-semibold">Ops Reports</h1>
          </div>
          {/* Date range filter (not on overview tab) */}
          {activeTab !== "overview" && (
            <div className="flex gap-1">
              {DAYS_OPTIONS.map(opt => (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={days === opt.value ? "default" : "outline"}
                  className="text-xs h-7 px-2"
                  onClick={() => handleDaysChange(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap gap-1 h-auto mb-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="shipments">Shipments</TabsTrigger>
          </TabsList>

          {/* ── Overview Tab ── */}
          <TabsContent value="overview" className="space-y-5">
            {/* Jobs summary */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Jobs (All Time)</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {["open","in_progress","on_hold","completed","cancelled"].map(s => (
                  <Card key={s}>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold">{jobByStatus[s] ?? 0}</p>
                      <Badge className={`mt-1 text-xs ${JOB_STATUS_COLORS[s] ?? ""}`} variant="outline">
                        {s.replace("_", " ")}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Lots summary */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Lots (All Time)</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: "pending", label: "Pending", color: "text-slate-500" },
                  { key: "in_storage", label: "In Storage", color: "text-blue-500" },
                  { key: "in_production", label: "In Production", color: "text-amber-600" },
                  { key: "approved", label: "Approved", color: "text-green-600" },
                ].map(({ key, label, color }) => (
                  <Card key={key}>
                    <CardContent className="p-4">
                      <p className={`text-2xl font-bold ${color}`}>{lotByStatus[key] ?? 0}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* 30-day activity */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Last 30 Days</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck size={16} className="text-green-500" />
                      <span className="text-sm font-medium">Inbound</span>
                    </div>
                    <p className="text-2xl font-bold">{overview?.inbound30d.total_shipments ?? 0} <span className="text-sm text-muted-foreground font-normal">shipments</span></p>
                    <p className="text-sm text-muted-foreground mt-0.5">{fmt(overview?.inbound30d.total_weight)} lbs received</p>
                    <p className="text-xs text-muted-foreground">{overview?.inbound30d.received ?? 0} marked received</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Factory size={16} className="text-amber-500" />
                      <span className="text-sm font-medium">Production</span>
                    </div>
                    <p className="text-2xl font-bold">{overview?.runs.total_runs ?? 0} <span className="text-sm text-muted-foreground font-normal">total runs</span></p>
                    <p className="text-sm text-muted-foreground mt-0.5">{overview?.runs.completed_runs ?? 0} completed</p>
                    <p className="text-xs text-muted-foreground">Avg yield: {overview?.runs.avg_yield ? `${overview.runs.avg_yield}%` : "—"}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Package size={16} className="text-teal-500" />
                      <span className="text-sm font-medium">Outbound</span>
                    </div>
                    <p className="text-2xl font-bold">{overview?.outbound30d.total_shipments ?? 0} <span className="text-sm text-muted-foreground font-normal">shipments</span></p>
                    <p className="text-sm text-muted-foreground mt-0.5">{fmt(overview?.outbound30d.total_weight)} lbs shipped</p>
                    <p className="text-xs text-muted-foreground">{overview?.outbound30d.shipped ?? 0} confirmed shipped</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Total jobs */}
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total jobs created: <span className="font-bold text-foreground">{jobTotal}</span></p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Jobs Tab ── */}
          <TabsContent value="jobs" className="space-y-5">
            {/* Type breakdown */}
            {jobsData && jobsData.byType.length > 0 && (
              <div className="grid md:grid-cols-2 gap-5">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Jobs by Type & Status</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-xs text-muted-foreground"><th className="px-4 py-2 text-left">Type</th><th className="px-4 py-2 text-left">Status</th><th className="px-4 py-2 text-right">Count</th></tr></thead>
                      <tbody className="divide-y">
                        {jobsData.byType.map((r, i) => (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="px-4 py-2 capitalize font-medium">{r.job_type}</td>
                            <td className="px-4 py-2">
                              <Badge className={`text-xs ${JOB_STATUS_COLORS[r.status] ?? ""}`} variant="outline">{r.status.replace("_"," ")}</Badge>
                            </td>
                            <td className="px-4 py-2 text-right font-bold">{r.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                {jobsData.byCustomer.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base">Top Customers (Toll Jobs)</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b text-xs text-muted-foreground"><th className="px-4 py-2 text-left">Customer</th><th className="px-4 py-2 text-right">Jobs</th><th className="px-4 py-2 text-right">Completed</th></tr></thead>
                        <tbody className="divide-y">
                          {jobsData.byCustomer.map((r, i) => (
                            <tr key={i} className="hover:bg-muted/20">
                              <td className="px-4 py-2 font-medium">{r.customer_name}</td>
                              <td className="px-4 py-2 text-right font-bold">{r.job_count}</td>
                              <td className="px-4 py-2 text-right text-green-600">{r.completed}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Recent jobs table */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Recent Jobs</CardTitle></CardHeader>
              <CardContent className="p-0">
                {!jobsData || jobsData.recent.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No jobs in this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-xs text-muted-foreground">
                        <th className="px-4 py-2 text-left">Job</th>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-left">Customer/Vendor</th>
                        <th className="px-4 py-2 text-left">Material</th>
                        <th className="px-4 py-2 text-right">Lots</th>
                        <th className="px-4 py-2 text-right">Output (lbs)</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Created</th>
                      </tr></thead>
                      <tbody className="divide-y">
                        {jobsData.recent.map(j => (
                          <tr key={j.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => router.push(`/ops/jobs/${j.id}`)}>
                            <td className="px-4 py-2 font-medium text-blue-600">{j.job_number}</td>
                            <td className="px-4 py-2 capitalize">{j.job_type}</td>
                            <td className="px-4 py-2 text-muted-foreground">{j.customer_name ?? j.vendor_name ?? "—"}</td>
                            <td className="px-4 py-2 text-muted-foreground">{j.material_type_name ?? "—"}</td>
                            <td className="px-4 py-2 text-right">{j.lot_count}</td>
                            <td className="px-4 py-2 text-right">{j.total_output > 0 ? fmt(j.total_output) : "—"}</td>
                            <td className="px-4 py-2">
                              <Badge className={`text-xs ${JOB_STATUS_COLORS[j.status] ?? ""}`} variant="outline">{j.status.replace("_"," ")}</Badge>
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">{fmtDate(j.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Production Tab ── */}
          <TabsContent value="production" className="space-y-5">
            {/* Summary row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="p-4">
                <p className="text-2xl font-bold text-amber-500">{totalRuns}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Completed Runs</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-2xl font-bold text-green-500">{avgYield ? `${avgYield}%` : "—"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Avg Yield</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xl font-bold text-blue-500">{fmt(totalOutput)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total Output (lbs)</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-2xl font-bold text-purple-500">{prodData?.byLine.length ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Lines Used</p>
              </CardContent></Card>
            </div>

            {/* Yield distribution */}
            {buckets && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><TrendingUp size={16} />Yield Distribution</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: "< 70%", key: "below_70", color: "bg-red-500" },
                    { label: "70–80%", key: "p70_80", color: "bg-orange-400" },
                    { label: "80–90%", key: "p80_90", color: "bg-amber-400" },
                    { label: "90–100%", key: "p90_100", color: "bg-green-400" },
                    { label: "> 100%", key: "above_100", color: "bg-blue-400" },
                    { label: "No data", key: "no_data", color: "bg-slate-300" },
                  ].map(({ label, key, color }) => {
                    const val = buckets[key as keyof typeof buckets] as number;
                    const pct = Math.round((val / totalBuckets) * 100);
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-xs w-16 text-right text-muted-foreground shrink-0">{label}</span>
                        <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
                          <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs w-8 text-right font-medium shrink-0">{val}</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* By line */}
            {prodData && prodData.byLine.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">By Production Line</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-xs text-muted-foreground">
                      <th className="px-4 py-2 text-left">Line</th>
                      <th className="px-4 py-2 text-right">Runs</th>
                      <th className="px-4 py-2 text-right">Avg Yield</th>
                      <th className="px-4 py-2 text-right">Total Input (lbs)</th>
                      <th className="px-4 py-2 text-right">Total Output (lbs)</th>
                    </tr></thead>
                    <tbody className="divide-y">
                      {prodData.byLine.map((r, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-4 py-2 font-medium">{r.line_id === "unassigned" ? <span className="text-muted-foreground italic">Unassigned</span> : r.line_id}</td>
                          <td className="px-4 py-2 text-right">{r.run_count}</td>
                          <td className="px-4 py-2 text-right">{r.avg_yield ? `${r.avg_yield}%` : "—"}</td>
                          <td className="px-4 py-2 text-right">{fmt(r.total_input)}</td>
                          <td className="px-4 py-2 text-right font-medium text-green-600">{fmt(r.total_output)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* Recent runs */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Completed Runs</CardTitle></CardHeader>
              <CardContent className="p-0">
                {!prodData || prodData.runs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No completed runs in this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-xs text-muted-foreground">
                        <th className="px-4 py-2 text-left">Run</th>
                        <th className="px-4 py-2 text-left">Job</th>
                        <th className="px-4 py-2 text-left">Material</th>
                        <th className="px-4 py-2 text-right">Input (lbs)</th>
                        <th className="px-4 py-2 text-right">Output (lbs)</th>
                        <th className="px-4 py-2 text-right">Yield</th>
                        <th className="px-4 py-2 text-left">Completed</th>
                      </tr></thead>
                      <tbody className="divide-y">
                        {prodData.runs.map(r => (
                          <tr key={r.id} className="hover:bg-muted/20">
                            <td className="px-4 py-2 font-medium">{r.run_number}</td>
                            <td className="px-4 py-2 text-blue-600">{r.job_number}</td>
                            <td className="px-4 py-2 text-muted-foreground">{r.material_type_name ?? "—"}</td>
                            <td className="px-4 py-2 text-right">{fmt(r.input_weight)}</td>
                            <td className="px-4 py-2 text-right">{fmt(r.output_weight)}</td>
                            <td className="px-4 py-2 text-right">
                              {r.yield_percentage != null ? (
                                <span className={r.yield_percentage >= 90 ? "text-green-600 font-medium" : r.yield_percentage < 75 ? "text-red-500 font-medium" : ""}>
                                  {Number(r.yield_percentage).toFixed(1)}%
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">{fmtDate(r.actual_end)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Shipments Tab ── */}
          <TabsContent value="shipments" className="space-y-5">
            <div className="grid md:grid-cols-2 gap-5">
              {/* Top vendors */}
              {shipData && shipData.byVendor.length > 0 && (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Top Vendors (Inbound)</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-xs text-muted-foreground">
                        <th className="px-4 py-2 text-left">Vendor</th>
                        <th className="px-4 py-2 text-right">Shipments</th>
                        <th className="px-4 py-2 text-right">Total (lbs)</th>
                      </tr></thead>
                      <tbody className="divide-y">
                        {shipData.byVendor.map((r, i) => (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="px-4 py-2 font-medium">{r.vendor_name}</td>
                            <td className="px-4 py-2 text-right">{r.shipment_count}</td>
                            <td className="px-4 py-2 text-right font-medium">{fmt(r.total_weight)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* Top customers */}
              {shipData && shipData.byCustomer.length > 0 && (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Top Customers (Outbound)</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-xs text-muted-foreground">
                        <th className="px-4 py-2 text-left">Customer</th>
                        <th className="px-4 py-2 text-right">Shipments</th>
                        <th className="px-4 py-2 text-right">Total (lbs)</th>
                      </tr></thead>
                      <tbody className="divide-y">
                        {shipData.byCustomer.map((r, i) => (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="px-4 py-2 font-medium">{r.customer_name}</td>
                            <td className="px-4 py-2 text-right">{r.shipment_count}</td>
                            <td className="px-4 py-2 text-right font-medium">{fmt(r.total_weight)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Inbound list */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Inbound Shipments</CardTitle></CardHeader>
              <CardContent className="p-0">
                {!shipData || shipData.inbound.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No inbound shipments in this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-xs text-muted-foreground">
                        <th className="px-4 py-2 text-left">Shipment</th>
                        <th className="px-4 py-2 text-left">Vendor</th>
                        <th className="px-4 py-2 text-left">Carrier</th>
                        <th className="px-4 py-2 text-right">Weight (lbs)</th>
                        <th className="px-4 py-2 text-right">Entries</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Received</th>
                      </tr></thead>
                      <tbody className="divide-y">
                        {shipData.inbound.map(s => (
                          <tr key={s.id} className="hover:bg-muted/20">
                            <td className="px-4 py-2 font-medium">{s.shipment_number}</td>
                            <td className="px-4 py-2 text-muted-foreground">{s.vendor_name ?? "—"}</td>
                            <td className="px-4 py-2 text-muted-foreground">{s.carrier_name_resolved ?? "—"}</td>
                            <td className="px-4 py-2 text-right">{s.total_weight > 0 ? fmt(s.total_weight) : "—"}</td>
                            <td className="px-4 py-2 text-right">{s.entry_count}</td>
                            <td className="px-4 py-2">
                              <Badge className={`text-xs ${SHIP_STATUS_COLORS[s.status] ?? ""}`} variant="outline">{s.status}</Badge>
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">{fmtDate(s.received_date ?? s.scheduled_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Outbound list */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Outbound Shipments</CardTitle></CardHeader>
              <CardContent className="p-0">
                {!shipData || shipData.outbound.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No outbound shipments in this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-xs text-muted-foreground">
                        <th className="px-4 py-2 text-left">Shipment</th>
                        <th className="px-4 py-2 text-left">Customer</th>
                        <th className="px-4 py-2 text-left">Carrier</th>
                        <th className="px-4 py-2 text-right">Weight (lbs)</th>
                        <th className="px-4 py-2 text-right">Lots</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Shipped</th>
                      </tr></thead>
                      <tbody className="divide-y">
                        {shipData.outbound.map(s => (
                          <tr key={s.id} className="hover:bg-muted/20">
                            <td className="px-4 py-2 font-medium">{s.shipment_number}</td>
                            <td className="px-4 py-2 text-muted-foreground">{s.customer_name_resolved ?? "—"}</td>
                            <td className="px-4 py-2 text-muted-foreground">{s.carrier_name_resolved ?? "—"}</td>
                            <td className="px-4 py-2 text-right">{s.total_weight ? fmt(s.total_weight) : "—"}</td>
                            <td className="px-4 py-2 text-right">{s.lot_count}</td>
                            <td className="px-4 py-2">
                              <Badge className={`text-xs ${SHIP_STATUS_COLORS[s.status] ?? ""}`} variant="outline">{s.status}</Badge>
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">{fmtDate(s.shipped_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
