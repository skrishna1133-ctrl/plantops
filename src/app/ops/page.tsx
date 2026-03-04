"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2, LogOut, Factory, Truck, Package,
  Settings, ChevronRight, ArrowLeft,
  ClipboardList, ArrowDownToLine, ArrowUpFromLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

interface Job {
  id: string;
  job_number: string;
  job_type: string;
  status: string;
  customer_name?: string;
  vendor_name?: string;
  material_type_name?: string;
  created_at: string;
}

interface InboundShipment {
  id: string;
  shipment_number: string;
  status: string;
  total_weight?: number;
  weight_unit?: string;
  received_date?: string;
  scheduled_date?: string;
}

const JOB_STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-600 border-blue-200",
  in_progress: "bg-amber-500/10 text-amber-600 border-amber-200",
  on_hold: "bg-orange-500/10 text-orange-600 border-orange-200",
  completed: "bg-green-500/10 text-green-600 border-green-200",
  cancelled: "bg-red-500/10 text-red-400 border-red-200",
};

const SHIP_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-600",
  in_transit: "bg-amber-500/10 text-amber-600",
  received: "bg-green-500/10 text-green-600",
  cancelled: "bg-red-500/10 text-red-400",
};

export default function OpsPage() {
  const router = useRouter();
  const [role, setRole] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [recentInbound, setRecentInbound] = useState<InboundShipment[]>([]);
  const [stats, setStats] = useState({ openJobs: 0, inProgress: 0, pendingReceiving: 0, totalLots: 0 });

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(async data => {
      if (!data.authenticated) { router.push("/login?from=/ops"); return; }
      setRole(data.role);
      setUserName(data.fullName || "");

      const [jobsData, inboundData, lotsData] = await Promise.all([
        fetch("/api/ops/jobs").then(r => r.json()).catch(() => []),
        fetch("/api/ops/inbound-shipments").then(r => r.json()).catch(() => []),
        fetch("/api/ops/lots").then(r => r.json()).catch(() => []),
      ]);

      const j = Array.isArray(jobsData) ? jobsData : [];
      const ib = Array.isArray(inboundData) ? inboundData : [];
      const lots = Array.isArray(lotsData) ? lotsData : [];

      setJobs(j.slice(0, 10));
      setRecentInbound(ib.slice(0, 5));
      setStats({
        openJobs: j.filter((x: Job) => x.status === "open").length,
        inProgress: j.filter((x: Job) => x.status === "in_progress").length,
        pendingReceiving: ib.filter((x: InboundShipment) => x.status === "scheduled").length,
        totalLots: lots.length,
      });
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  };

  const canManage = ["owner", "admin", "engineer"].includes(role);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" size={28} /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm"><ArrowLeft size={16} className="mr-1" />Home</Button>
            </Link>
            <div className="flex items-center gap-2">
              <Factory size={20} className="text-orange-500" />
              <div>
                <h1 className="text-lg font-bold leading-none">Operations</h1>
                <p className="text-xs text-muted-foreground">{userName}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {canManage && (
              <Link href="/ops/settings">
                <Button variant="outline" size="sm"><Settings size={14} className="mr-1" />Settings</Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-red-400">
              <LogOut size={14} className="mr-1" />Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Open Jobs</p>
              <p className="text-3xl font-bold text-blue-500">{stats.openJobs}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">In Progress</p>
              <p className="text-3xl font-bold text-amber-500">{stats.inProgress}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pending Receiving</p>
              <p className="text-3xl font-bold text-orange-500">{stats.pendingReceiving}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Lots</p>
              <p className="text-3xl font-bold text-green-500">{stats.totalLots}</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/ops/jobs">
            <Card className="cursor-pointer hover:bg-muted/30 transition-colors border-2">
              <CardContent className="p-4 flex items-center gap-3">
                <ClipboardList size={22} className="text-blue-500 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Jobs</p>
                  <p className="text-xs text-muted-foreground">View all jobs</p>
                </div>
                <ChevronRight size={16} className="ml-auto text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/ops/jobs?tab=inbound">
            <Card className="cursor-pointer hover:bg-muted/30 transition-colors border-2">
              <CardContent className="p-4 flex items-center gap-3">
                <ArrowDownToLine size={22} className="text-green-500 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Inbound</p>
                  <p className="text-xs text-muted-foreground">Receiving</p>
                </div>
                <ChevronRight size={16} className="ml-auto text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/ops/jobs?tab=lots">
            <Card className="cursor-pointer hover:bg-muted/30 transition-colors border-2">
              <CardContent className="p-4 flex items-center gap-3">
                <Package size={22} className="text-purple-500 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Lots</p>
                  <p className="text-xs text-muted-foreground">Material lots</p>
                </div>
                <ChevronRight size={16} className="ml-auto text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/ops/jobs?tab=production">
            <Card className="cursor-pointer hover:bg-muted/30 transition-colors border-2">
              <CardContent className="p-4 flex items-center gap-3">
                <Factory size={22} className="text-orange-500 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Production</p>
                  <p className="text-xs text-muted-foreground">Runs</p>
                </div>
                <ChevronRight size={16} className="ml-auto text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Jobs */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Jobs</CardTitle>
              <Link href="/ops/jobs">
                <Button variant="ghost" size="sm" className="text-xs">
                  View all <ChevronRight size={13} className="ml-0.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No jobs yet.</p>
              ) : (
                <div className="divide-y">
                  {jobs.map(job => (
                    <Link key={job.id} href={`/ops/jobs/${job.id}`}>
                      <div className="px-4 py-3 hover:bg-muted/30 flex items-center gap-3 cursor-pointer">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{job.job_number}</span>
                            <Badge variant="outline" className="text-xs capitalize">{job.job_type}</Badge>
                            <Badge className={`text-xs border ${JOB_STATUS_COLORS[job.status] ?? ""}`} variant="outline">
                              {job.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {job.customer_name ?? job.vendor_name ?? "—"} {job.material_type_name ? `· ${job.material_type_name}` : ""}
                          </p>
                        </div>
                        <ChevronRight size={15} className="text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Inbound */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Inbound Shipments</CardTitle>
              <Link href="/ops/jobs?tab=inbound">
                <Button variant="ghost" size="sm" className="text-xs">
                  View all <ChevronRight size={13} className="ml-0.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentInbound.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No inbound shipments yet.</p>
              ) : (
                <div className="divide-y">
                  {recentInbound.map(shp => (
                    <div key={shp.id} className="px-4 py-3 flex items-center gap-3">
                      <Truck size={16} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{shp.shipment_number}</span>
                          <Badge className={`text-xs ${SHIP_STATUS_COLORS[shp.status] ?? ""}`} variant="outline">
                            {shp.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {shp.total_weight != null
                            ? `${Number(shp.total_weight).toLocaleString()} ${shp.weight_unit ?? "lbs"}`
                            : "No weight recorded"}
                          {shp.received_date ? ` · Received ${new Date(shp.received_date).toLocaleDateString()}` : shp.scheduled_date ? ` · Scheduled ${new Date(shp.scheduled_date).toLocaleDateString()}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </main>
    </div>
  );
}
