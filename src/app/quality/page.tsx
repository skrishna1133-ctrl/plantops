"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2, LogOut, Package, ClipboardList, AlertTriangle, MessageSquareWarning,
  FileCheck2, Settings, ChevronRight, ArrowRight, Bell, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { CompanyBadge } from "@/components/company-badge";

interface DashboardData {
  pendingQc: number;
  pendingReview: number;
  openNcrsCritical: number;
  openNcrsMajor: number;
  openNcrsMinor: number;
  openComplaints: number;
  lotsNeedCoa: number;
}

export default function QualityPage() {
  const router = useRouter();
  const [role, setRole] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [pendingInspections, setPendingInspections] = useState<Array<{ id: string; lot_number: string; created_at: string }>>([]);
  const [assignedNcrs, setAssignedNcrs] = useState<Array<{ id: string; ncr_number: string; severity: string; due_date?: string; title: string }>>([]);
  const [myNcrs, setMyNcrs] = useState<Array<{ id: string; ncr_number: string; status: string; title: string; created_at: string }>>([]);

  useEffect(() => {
    fetch("/api/auth")
      .then(r => r.json())
      .then(async data => {
        if (!data.authenticated) { router.push("/login?from=/quality"); return; }
        setRole(data.role);
        setUserName(data.fullName || "");
        setTenantName(data.tenantName ?? null);
        setTenantLogoUrl(data.tenantLogoUrl ?? null);

        if (data.role === "quality_manager" || data.role === "admin" || data.role === "owner") {
          // Load manager dashboard — catch individually so one failure doesn't blank the page
          const [lots, pending, ncrs, complaints] = await Promise.all([
            fetch("/api/qms/lots").then(r => r.json()).catch(() => []),
            fetch("/api/qms/inspections/pending-review").then(r => r.json()).catch(() => []),
            fetch("/api/qms/ncrs").then(r => r.json()).catch(() => []),
            fetch("/api/qms/complaints").then(r => r.json()).catch(() => []),
          ]);
          const pendingQc = Array.isArray(lots) ? lots.filter((l: { status: string }) => l.status === "pending_qc" || l.status === "qc_in_progress").length : 0;
          const openNcrs = Array.isArray(ncrs) ? ncrs.filter((n: { status: string }) => !["closed", "cancelled"].includes(n.status)) : [];
          const openComplaints = Array.isArray(complaints) ? complaints.filter((c: { status: string }) => !["resolved", "closed"].includes(c.status)).length : 0;
          const lotsNeedCoa = Array.isArray(lots) ? lots.filter((l: { status: string }) => l.status === "approved").length : 0;
          setDashboard({
            pendingQc,
            pendingReview: Array.isArray(pending) ? pending.length : 0,
            openNcrsCritical: openNcrs.filter((n: { severity: string }) => n.severity === "critical").length,
            openNcrsMajor: openNcrs.filter((n: { severity: string }) => n.severity === "major").length,
            openNcrsMinor: openNcrs.filter((n: { severity: string }) => n.severity === "minor").length,
            openComplaints,
            lotsNeedCoa,
          });
        } else if (data.role === "quality_tech") {
          const [inspections, ncrs] = await Promise.all([
            fetch("/api/qms/inspections?status=draft").then(r => r.json()).catch(() => []),
            fetch("/api/qms/ncrs").then(r => r.json()).catch(() => []),
          ]);
          setPendingInspections(Array.isArray(inspections) ? inspections.slice(0, 5) : []);
          setAssignedNcrs(Array.isArray(ncrs) ? ncrs.filter((n: { status: string }) => !["closed", "cancelled"].includes(n.status)).slice(0, 5) : []);
        } else if (data.role === "worker") {
          const ncrs = await fetch("/api/qms/ncrs").then(r => r.json()).catch(() => []);
          setMyNcrs(Array.isArray(ncrs) ? ncrs : []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  const isManager = role === "quality_manager" || role === "admin" || role === "owner";
  const isTech = role === "quality_tech";
  const isWorker = role === "worker";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-600 flex items-center justify-center">
              <FileCheck2 size={18} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Quality Management</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                {tenantName && <><CompanyBadge name={tenantName} logoUrl={tenantLogoUrl} className="w-4 h-4 text-[8px]" />{tenantName} · </>}{userName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-muted-foreground">Home</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-red-400">
              <LogOut size={14} className="mr-1" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* ─── QUALITY MANAGER VIEW ─── */}
        {isManager && dashboard && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-1">QMS Dashboard</h2>
              <p className="text-muted-foreground text-sm">Quality Management System overview</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/quality/lots?status=pending_qc">
                <Card className="hover:border-purple-500/50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Package size={16} className="text-purple-500" />
                      <span className="text-xs text-muted-foreground">Lots Pending QC</span>
                    </div>
                    <p className="text-3xl font-bold">{dashboard.pendingQc}</p>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/quality/inspections/pending-review">
                <Card className="hover:border-blue-500/50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <ClipboardList size={16} className="text-blue-500" />
                      <span className="text-xs text-muted-foreground">Pending Review</span>
                    </div>
                    <p className="text-3xl font-bold">{dashboard.pendingReview}</p>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/quality/ncr">
                <Card className={`hover:border-red-500/50 transition-colors cursor-pointer ${dashboard.openNcrsCritical > 0 ? "border-red-500/30" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={16} className="text-red-500" />
                      <span className="text-xs text-muted-foreground">Open NCRs</span>
                    </div>
                    <p className="text-3xl font-bold">{dashboard.openNcrsCritical + dashboard.openNcrsMajor + dashboard.openNcrsMinor}</p>
                    <div className="flex gap-1 mt-1">
                      {dashboard.openNcrsCritical > 0 && <Badge variant="destructive" className="text-xs px-1">{dashboard.openNcrsCritical} critical</Badge>}
                      {dashboard.openNcrsMajor > 0 && <Badge className="text-xs px-1 bg-orange-500">{dashboard.openNcrsMajor} major</Badge>}
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/quality/complaints">
                <Card className="hover:border-amber-500/50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquareWarning size={16} className="text-amber-500" />
                      <span className="text-xs text-muted-foreground">Open Complaints</span>
                    </div>
                    <p className="text-3xl font-bold">{dashboard.openComplaints}</p>
                  </CardContent>
                </Card>
              </Link>
            </div>

            {/* COA Alert */}
            {dashboard.lotsNeedCoa > 0 && (
              <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck2 size={16} className="text-green-500" />
                    <span className="text-sm"><strong>{dashboard.lotsNeedCoa}</strong> approved lot{dashboard.lotsNeedCoa !== 1 ? "s" : ""} ready for COA generation</span>
                  </div>
                  <Link href="/quality/coa">
                    <Button size="sm" variant="outline" className="border-green-500/50 text-green-600">
                      Generate COAs <ArrowRight size={14} className="ml-1" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Quick Navigation */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">QUICK NAVIGATION</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { href: "/quality/lots", label: "Lot Registry", icon: Package, color: "text-purple-500" },
                  { href: "/quality/ncr", label: "NCR Board", icon: AlertTriangle, color: "text-red-500" },
                  { href: "/quality/complaints", label: "Complaints", icon: MessageSquareWarning, color: "text-amber-500" },
                  { href: "/quality/coa", label: "COAs", icon: FileCheck2, color: "text-green-500" },
                  { href: "/quality/reports", label: "Reports", icon: ClipboardList, color: "text-blue-500" },
                  { href: "/quality/config", label: "Configuration", icon: Settings, color: "text-gray-500" },
                ].map(({ href, label, icon: Icon, color }) => (
                  <Link key={href} href={href}>
                    <Card className="hover:border-border/80 cursor-pointer transition-colors">
                      <CardContent className="p-4 flex items-center gap-3">
                        <Icon size={18} className={color} />
                        <span className="font-medium text-sm">{label}</span>
                        <ChevronRight size={14} className="ml-auto text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── QUALITY TECH VIEW ─── */}
        {isTech && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold mb-1">My Work Queue</h2>
                <p className="text-muted-foreground text-sm">Inspections and NCRs assigned to you</p>
              </div>
              <Link href="/quality/lots">
                <Button size="sm">
                  <Plus size={14} className="mr-1" /> New Inspection
                </Button>
              </Link>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Pending Inspections */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList size={16} className="text-blue-500" />
                    Pending Inspections
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingInspections.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No pending inspections</p>
                  ) : (
                    <div className="space-y-2">
                      {pendingInspections.map(i => (
                        <Link key={i.id} href={`/quality/inspections/${i.id}`}>
                          <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                            <span className="font-mono text-sm font-medium">{i.lot_number}</span>
                            <ChevronRight size={14} className="text-muted-foreground" />
                          </div>
                        </Link>
                      ))}
                      <Link href="/quality/lots">
                        <Button variant="ghost" size="sm" className="w-full text-xs mt-1">
                          View all lots <ArrowRight size={12} className="ml-1" />
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Assigned NCRs */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-500" />
                    My NCRs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {assignedNcrs.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No assigned NCRs</p>
                  ) : (
                    <div className="space-y-2">
                      {assignedNcrs.map(n => (
                        <Link key={n.id} href={`/quality/ncr/${n.id}`}>
                          <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                            <div>
                              <div className="font-mono text-sm font-medium">{n.ncr_number}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[180px]">{n.title}</div>
                            </div>
                            <Badge variant={n.severity === "critical" ? "destructive" : "outline"} className="text-xs">
                              {n.severity}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ─── WORKER VIEW ─── */}
        {isWorker && (
          <div className="space-y-6 max-w-md mx-auto">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-1">Quality Issues</h2>
              <p className="text-muted-foreground text-sm">Report quality problems you observe on the floor</p>
            </div>

            <Link href="/quality/ncr/new">
              <Card className="cursor-pointer hover:border-red-500/50 transition-colors border-2 border-dashed">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={28} className="text-red-500" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Report Quality Issue</h3>
                  <p className="text-sm text-muted-foreground">Tap to submit a quality concern or defect report</p>
                </CardContent>
              </Card>
            </Link>

            {myNcrs.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">MY SUBMITTED REPORTS</h3>
                <div className="space-y-2">
                  {myNcrs.slice(0, 5).map(n => (
                    <Card key={n.id}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <div className="font-mono text-sm font-medium">{n.ncr_number}</div>
                          <div className="text-xs text-muted-foreground">{n.title}</div>
                        </div>
                        <Badge variant="outline" className="text-xs capitalize">{n.status.replace(/_/g, " ")}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
