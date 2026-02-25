"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, TrendingUp, AlertTriangle, Package, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

type Period = "7" | "30" | "90";

export default function ReportsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("30");
  const [loading, setLoading] = useState(false);
  const [lotResults, setLotResults] = useState<{ summary: Record<string, number>; byDay: Array<Record<string, unknown>> } | null>(null);
  const [ncrTrends, setNcrTrends] = useState<{ bySeverity: Array<{ severity: string; count: string }>; byStatus: Array<{ status: string; count: string }> } | null>(null);
  const [yieldData, setYieldData] = useState<Array<{ date: string; avg_yield: number; lot_count: string }>>([]);
  const [complaintData, setComplaintData] = useState<{ byStatus: Array<{ status: string; count: string }> } | null>(null);

  const fetchData = async (p: Period) => {
    setLoading(true);
    try {
      const [lr, nt, yd, cd] = await Promise.all([
        fetch(`/api/qms/reports/lot-results?days=${p}`).then(r => r.json()),
        fetch(`/api/qms/reports/ncr-trends?days=${p}`).then(r => r.json()),
        fetch(`/api/qms/reports/yield?days=${p}`).then(r => r.json()),
        fetch(`/api/qms/reports/complaints?days=${p}`).then(r => r.json()),
      ]);
      setLotResults(lr);
      setNcrTrends(nt);
      setYieldData(Array.isArray(yd) ? yd : []);
      setComplaintData(cd);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(data => {
      if (!data.authenticated) { router.push("/login"); return; }
      fetchData(period);
    });
  }, []);

  const changePeriod = (p: Period) => {
    setPeriod(p);
    fetchData(p);
  };

  const totalPass = Number(lotResults?.summary?.total_pass || 0);
  const totalFail = Number(lotResults?.summary?.total_fail || 0);
  const totalInsp = Number(lotResults?.summary?.total || 0);
  const passRate = totalInsp > 0 ? ((totalPass / totalInsp) * 100).toFixed(1) : "—";

  const avgYield = yieldData.length > 0
    ? (yieldData.reduce((s, d) => s + Number(d.avg_yield), 0) / yieldData.length).toFixed(1)
    : "—";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/quality"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div className="flex-1"><h1 className="font-bold">QMS Reports</h1></div>
          <div className="flex gap-1">
            {(["7", "30", "90"] as Period[]).map(p => (
              <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => changePeriod(p)}>
                {p}d
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : (
          <Tabs defaultValue="lot-results">
            <TabsList className="mb-6">
              <TabsTrigger value="lot-results"><Package size={14} className="mr-1" /> Lot Results</TabsTrigger>
              <TabsTrigger value="ncr"><AlertTriangle size={14} className="mr-1" /> NCR Trends</TabsTrigger>
              <TabsTrigger value="yield"><TrendingUp size={14} className="mr-1" /> Yield</TabsTrigger>
              <TabsTrigger value="complaints"><MessageSquareWarning size={14} className="mr-1" /> Complaints</TabsTrigger>
            </TabsList>

            {/* Lot Results Tab */}
            <TabsContent value="lot-results">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-green-400">{passRate}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Pass Rate</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-green-400">{totalPass}</p>
                    <p className="text-xs text-muted-foreground mt-1">Passed</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-red-400">{totalFail}</p>
                    <p className="text-xs text-muted-foreground mt-1">Failed</p>
                  </CardContent>
                </Card>
              </div>

              {/* Daily breakdown table */}
              {(lotResults?.byDay || []).length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Daily Breakdown</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border bg-muted/50">
                        <tr>
                          <th className="text-left px-4 py-2">Date</th>
                          <th className="text-right px-4 py-2">Pass</th>
                          <th className="text-right px-4 py-2">Fail</th>
                          <th className="text-right px-4 py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(lotResults?.byDay || []).map((d, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="px-4 py-2">{new Date(d.date as string).toLocaleDateString()}</td>
                            <td className="px-4 py-2 text-right text-green-400">{d.pass_count as number}</td>
                            <td className="px-4 py-2 text-right text-red-400">{d.fail_count as number}</td>
                            <td className="px-4 py-2 text-right">{d.total as number}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* NCR Trends Tab */}
            <TabsContent value="ncr">
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">By Severity</CardTitle></CardHeader>
                  <CardContent>
                    {(ncrTrends?.bySeverity || []).map(r => (
                      <div key={r.severity} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                        <span className="capitalize text-sm">{r.severity}</span>
                        <Badge variant="outline">{r.count}</Badge>
                      </div>
                    ))}
                    {(ncrTrends?.bySeverity || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data</p>}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">By Status</CardTitle></CardHeader>
                  <CardContent>
                    {(ncrTrends?.byStatus || []).map(r => (
                      <div key={r.status} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                        <span className="text-sm capitalize">{r.status.replace(/_/g, " ")}</span>
                        <Badge variant="outline">{r.count}</Badge>
                      </div>
                    ))}
                    {(ncrTrends?.byStatus || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data</p>}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Yield Tab */}
            <TabsContent value="yield">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold">{avgYield}{avgYield !== "—" ? "%" : ""}</p>
                    <p className="text-xs text-muted-foreground mt-1">Average Yield ({period}d)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold">{yieldData.reduce((s, d) => s + Number(d.lot_count), 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Lots with yield data</p>
                  </CardContent>
                </Card>
              </div>
              {yieldData.length > 0 && (
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border bg-muted/50">
                        <tr>
                          <th className="text-left px-4 py-2">Date</th>
                          <th className="text-right px-4 py-2">Avg Yield</th>
                          <th className="text-right px-4 py-2">Min</th>
                          <th className="text-right px-4 py-2">Max</th>
                          <th className="text-right px-4 py-2">Lots</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yieldData.map((d, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="px-4 py-2">{new Date(d.date).toLocaleDateString()}</td>
                            <td className="px-4 py-2 text-right font-mono">{Number(d.avg_yield).toFixed(1)}%</td>
                            <td className="px-4 py-2 text-right text-muted-foreground">{Number((d as { min_yield?: number }).min_yield || 0).toFixed(1)}%</td>
                            <td className="px-4 py-2 text-right text-muted-foreground">{Number((d as { max_yield?: number }).max_yield || 0).toFixed(1)}%</td>
                            <td className="px-4 py-2 text-right">{d.lot_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Complaints Tab */}
            <TabsContent value="complaints">
              <Card className="max-w-md">
                <CardHeader><CardTitle className="text-base">By Status</CardTitle></CardHeader>
                <CardContent>
                  {(complaintData?.byStatus || []).map(r => (
                    <div key={r.status} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                      <span className="text-sm capitalize">{r.status.replace(/_/g, " ")}</span>
                      <Badge variant="outline">{r.count}</Badge>
                    </div>
                  ))}
                  {(complaintData?.byStatus || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data</p>}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
