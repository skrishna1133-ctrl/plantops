"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3, Clock, AlertCircle, CheckSquare, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DowntimeRow {
  machine_name: string; machine_id_code: string;
  event_count: number; total_hours: number;
}
interface IssueRow {
  description_short: string; count: number;
}
interface ComplianceRow {
  schedule_name: string; machine_type_name: string;
  total: number; completed: number; compliance_pct: number;
}
interface HistoryRow {
  work_order_number: string; type: string; status: string;
  machine_name: string; description: string;
  created_at: string; completed_at: string | null;
}

const toDate = (d: Date) => d.toISOString().slice(0, 10);

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"downtime" | "issues" | "compliance" | "history">("downtime");
  const [from, setFrom] = useState(toDate(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(toDate(new Date()));

  const [downtime, setDowntime] = useState<DowntimeRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [compliance, setCompliance] = useState<ComplianceRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const params = `?from=${from}T00:00:00Z&to=${to}T23:59:59Z`;
    if (tab === "downtime") {
      const res = await fetch(`/api/maintenance/reports/downtime${params}`);
      if (res.ok) setDowntime(await res.json());
    } else if (tab === "issues") {
      const res = await fetch(`/api/maintenance/reports/issue-frequency${params}`);
      if (res.ok) setIssues(await res.json());
    } else if (tab === "compliance") {
      const res = await fetch(`/api/maintenance/reports/pm-compliance${params}`);
      if (res.ok) setCompliance(await res.json());
    } else if (tab === "history") {
      const res = await fetch(`/api/maintenance/reports/history${params}`);
      if (res.ok) setHistory(await res.json());
    }
    setLoading(false);
  }, [tab, from, to]);

  useEffect(() => {
    fetch("/api/auth").then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.authenticated) { router.push("/login"); return; }
      const isManager = ["maintenance_manager", "engineer", "admin", "owner"].includes(d.role);
      if (!isManager) { router.push("/maintenance"); return; }
      fetchReport();
    });
  }, [router, fetchReport]);

  const tabs = [
    { key: "downtime", label: "Downtime", icon: Clock },
    { key: "issues", label: "Issue Frequency", icon: AlertCircle },
    { key: "compliance", label: "PM Compliance", icon: CheckSquare },
    { key: "history", label: "WO History", icon: BarChart3 },
  ] as const;

  const totalDowntimeHours = downtime.reduce((sum, r) => sum + Number(r.total_hours), 0);
  const totalEvents = downtime.reduce((sum, r) => sum + Number(r.event_count), 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/maintenance"><Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button></Link>
            <h1 className="text-lg font-bold">Maintenance Reports</h1>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pb-0 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <t.icon size={14} />{t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Date range filter */}
        <div className="flex items-end gap-3 mb-6">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 w-36" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 w-36" />
          </div>
          <Button size="sm" onClick={fetchReport} disabled={loading}>
            {loading ? "Loading..." : "Apply"}
          </Button>
          <div className="flex gap-2">
            {[
              { label: "7d", days: 7 },
              { label: "30d", days: 30 },
              { label: "90d", days: 90 },
            ].map(p => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                onClick={() => { setFrom(toDate(new Date(Date.now() - p.days * 86400000))); setTo(toDate(new Date())); }}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Downtime Report */}
        {tab === "downtime" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total Downtime</p>
                  <p className="text-2xl font-bold">{totalDowntimeHours.toFixed(1)}h</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total Events</p>
                  <p className="text-2xl font-bold">{totalEvents}</p>
                </CardContent>
              </Card>
            </div>

            {downtime.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingDown size={40} className="mx-auto mb-3 opacity-40" />
                <p>No downtime data for selected period.</p>
              </div>
            ) : (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Downtime by Machine</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {downtime.map((row, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <p className="font-medium text-sm">{row.machine_name}</p>
                          <p className="text-xs text-muted-foreground">{row.machine_id_code}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">{Number(row.total_hours).toFixed(1)}h</p>
                          <p className="text-xs text-muted-foreground">{row.event_count} event{Number(row.event_count) !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Issue Frequency */}
        {tab === "issues" && (
          <div className="space-y-3">
            {issues.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle size={40} className="mx-auto mb-3 opacity-40" />
                <p>No issue data for selected period.</p>
              </div>
            ) : (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Most Common Issues</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {issues.map((row, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <p className="text-sm">{row.description_short || "No description"}</p>
                        <span className="text-sm font-semibold">{row.count}×</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* PM Compliance */}
        {tab === "compliance" && (
          <div className="space-y-3">
            {compliance.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckSquare size={40} className="mx-auto mb-3 opacity-40" />
                <p>No PM compliance data for selected period.</p>
              </div>
            ) : (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">PM Schedule Compliance</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {compliance.map((row, i) => {
                      const pct = Math.round(Number(row.compliance_pct) || 0);
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{row.schedule_name}</p>
                              <p className="text-xs text-muted-foreground">{row.machine_type_name}</p>
                            </div>
                            <span className={`text-sm font-bold ${pct >= 80 ? "text-green-600" : pct >= 60 ? "text-yellow-600" : "text-red-600"}`}>
                              {pct}%
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">{row.completed}/{row.total} completed</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Work Order History */}
        {tab === "history" && (
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 size={40} className="mx-auto mb-3 opacity-40" />
                <p>No work orders in selected period.</p>
              </div>
            ) : (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Work Order History</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-0 divide-y divide-border">
                    {history.map((row, i) => (
                      <div key={i} className="py-3 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{row.work_order_number}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                              row.status === "closed" || row.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                              row.status === "in_progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                              "bg-muted text-muted-foreground"
                            }`}>{row.status.replace("_", " ")}</span>
                            <span className="text-xs text-muted-foreground capitalize">{row.type.replace("_", " ")}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {row.machine_name} • {row.description?.slice(0, 60)}{row.description?.length > 60 ? "..." : ""}
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{new Date(row.created_at).toLocaleDateString()}</p>
                          {row.completed_at && <p className="text-green-600">Done {new Date(row.completed_at).toLocaleDateString()}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
