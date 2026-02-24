"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Wrench, AlertTriangle, ClipboardCheck, FileText, Clock,
  BarChart2, Settings, LogOut, ArrowLeft, Bell, CheckCircle,
  AlertCircle, Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import type { UserRole } from "@/lib/schemas";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"];

interface DashboardStats {
  machinesDown: number;
  openWorkOrders: number;
  pendingSignOffs: number;
  flaggedChecklists: number;
  dueToday: number;
}

interface WorkOrder {
  id: string;
  workOrderNumber: string;
  status: string;
  machineName?: string;
  description: string;
  createdAt: string;
}

interface Schedule {
  id: string;
  name: string;
  machineTypeName?: string;
  nextDueAt: string | null;
}

interface BreakdownReport {
  id: string;
  machineName?: string;
  description: string;
  createdAt: string;
  hasWorkOrder?: boolean;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

export default function MaintenancePage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({ machinesDown: 0, openWorkOrders: 0, pendingSignOffs: 0, flaggedChecklists: 0, dueToday: 0 });
  const [myWorkOrders, setMyWorkOrders] = useState<WorkOrder[]>([]);
  const [dueSchedules, setDueSchedules] = useState<Schedule[]>([]);
  const [myReports, setMyReports] = useState<BreakdownReport[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const isManager = role ? MANAGER_ROLES.includes(role) : false;
  const isTech = role === "maintenance_tech";
  const isWorker = role === "worker";

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const fetchData = useCallback(async (userRole: UserRole) => {
    try {
      const [notifRes] = await Promise.all([
        fetch("/api/maintenance/notifications"),
      ]);
      if (notifRes.ok) setNotifications(await notifRes.json());

      if (MANAGER_ROLES.includes(userRole)) {
        const [woRes, signOffRes, flaggedRes, dueTodayRes, machinesRes] = await Promise.all([
          fetch("/api/maintenance/work-orders?status=open"),
          fetch("/api/maintenance/log-submissions/pending-signoff"),
          fetch("/api/maintenance/checklist-submissions/flagged"),
          fetch("/api/maintenance/schedules/due-today"),
          fetch("/api/maintenance/machines?status=down"),
        ]);
        const openWOs = woRes.ok ? await woRes.json() : [];
        const signOffs = signOffRes.ok ? await signOffRes.json() : [];
        const flagged = flaggedRes.ok ? await flaggedRes.json() : [];
        const due = dueTodayRes.ok ? await dueTodayRes.json() : [];
        const downMachines = machinesRes.ok ? await machinesRes.json() : [];
        setStats({
          openWorkOrders: openWOs.length,
          pendingSignOffs: signOffs.length,
          flaggedChecklists: flagged.length,
          dueToday: due.length,
          machinesDown: downMachines.length,
        });
      }

      if (userRole === "maintenance_tech") {
        const [woRes, dueRes] = await Promise.all([
          fetch("/api/maintenance/work-orders"),
          fetch("/api/maintenance/schedules/due-today"),
        ]);
        if (woRes.ok) setMyWorkOrders(await woRes.json());
        if (dueRes.ok) setDueSchedules(await dueRes.json());
      }

      if (userRole === "worker") {
        const res = await fetch("/api/maintenance/breakdown-reports");
        if (res.ok) setMyReports(await res.json());
      }
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.authenticated) { router.push("/login"); return; }
        setRole(data.role as UserRole);
        setUserName(data.fullName || data.username || "");
        fetchData(data.role as UserRole);
      })
      .finally(() => setLoading(false));
  }, [router, fetchData]);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  };

  const markAllRead = async () => {
    await fetch("/api/maintenance/notifications/mark-all-read", { method: "POST" });
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button>
            </Link>
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <Wrench size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Maintenance</h1>
              <p className="text-xs text-muted-foreground">{userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <div className="relative">
              <Button variant="ghost" size="icon" onClick={() => setShowNotifications(!showNotifications)}>
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{unreadCount}</span>
                )}
              </Button>
              {showNotifications && (
                <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                  <div className="flex items-center justify-between p-3 border-b border-border">
                    <span className="font-semibold text-sm">Notifications</span>
                    {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-primary hover:underline">Mark all read</button>}
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">No notifications</p>
                  ) : notifications.map(n => (
                    <div
                      key={n.id}
                      className={`p-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 ${!n.isRead ? "bg-blue-500/5" : ""}`}
                      onClick={() => { if (n.link) router.push(n.link); setShowNotifications(false); }}
                    >
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-red-400">
              <LogOut size={14} className="mr-1" />Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* MANAGER DASHBOARD */}
        {isManager && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Dashboard</h2>
              <p className="text-muted-foreground text-sm mt-1">Maintenance operations overview</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <Card className="border-red-500/30">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-red-500">{stats.machinesDown}</p>
                  <p className="text-xs text-muted-foreground mt-1">Machines Down</p>
                </CardContent>
              </Card>
              <Card className="border-orange-500/30">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-orange-500">{stats.openWorkOrders}</p>
                  <p className="text-xs text-muted-foreground mt-1">Open Work Orders</p>
                </CardContent>
              </Card>
              <Card className="border-yellow-500/30">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-500">{stats.pendingSignOffs}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pending Sign-offs</p>
                </CardContent>
              </Card>
              <Card className="border-purple-500/30">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-purple-500">{stats.flaggedChecklists}</p>
                  <p className="text-xs text-muted-foreground mt-1">Flagged Checklists</p>
                </CardContent>
              </Card>
              <Card className="border-blue-500/30">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-blue-500">{stats.dueToday}</p>
                  <p className="text-xs text-muted-foreground mt-1">PM Due Today</p>
                </CardContent>
              </Card>
            </div>

            {/* Navigation Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { href: "/maintenance/machines", icon: Settings, label: "Machines", color: "text-blue-500", bg: "bg-blue-500/10 hover:bg-blue-500/20" },
                { href: "/maintenance/work-orders", icon: Wrench, label: "Work Orders", color: "text-orange-500", bg: "bg-orange-500/10 hover:bg-orange-500/20", badge: stats.openWorkOrders },
                { href: "/maintenance/breakdown", icon: AlertTriangle, label: "Breakdown Reports", color: "text-red-500", bg: "bg-red-500/10 hover:bg-red-500/20" },
                { href: "/maintenance/procedures", icon: FileText, label: "Procedures", color: "text-green-500", bg: "bg-green-500/10 hover:bg-green-500/20" },
                { href: "/maintenance/checklists", icon: ClipboardCheck, label: "Checklists", color: "text-purple-500", bg: "bg-purple-500/10 hover:bg-purple-500/20", badge: stats.flaggedChecklists },
                { href: "/maintenance/log-sheets", icon: FileText, label: "Log Sheets", color: "text-teal-500", bg: "bg-teal-500/10 hover:bg-teal-500/20", badge: stats.pendingSignOffs },
                { href: "/maintenance/schedules", icon: Clock, label: "PM Schedules", color: "text-indigo-500", bg: "bg-indigo-500/10 hover:bg-indigo-500/20", badge: stats.dueToday },
                { href: "/maintenance/reports", icon: BarChart2, label: "Reports", color: "text-amber-500", bg: "bg-amber-500/10 hover:bg-amber-500/20" },
              ].map(item => (
                <Link key={item.href} href={item.href}>
                  <Card className={`cursor-pointer transition-all ${item.bg} border-2 relative`}>
                    <CardContent className="p-5 flex flex-col items-center gap-2 text-center">
                      <item.icon size={28} className={item.color} />
                      <span className="text-sm font-medium">{item.label}</span>
                      {item.badge ? (
                        <Badge variant="destructive" className="absolute top-2 right-2 text-[10px] h-5 px-1.5">{item.badge}</Badge>
                      ) : null}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* TECH DASHBOARD */}
        {isTech && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">My Dashboard</h2>
              <p className="text-muted-foreground text-sm">Hello, {userName}</p>
            </div>

            {/* Due Today */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock size={16} className="text-blue-500" /> Due Today
                  {dueSchedules.length > 0 && <Badge variant="secondary">{dueSchedules.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dueSchedules.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No scheduled maintenance due today</p>
                ) : (
                  <div className="space-y-2">
                    {dueSchedules.map(s => (
                      <Link key={s.id} href="/maintenance/schedules">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer">
                          <div>
                            <p className="text-sm font-medium">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.machineTypeName}</p>
                          </div>
                          <Badge variant="outline" className="text-orange-500 border-orange-500/30">Due</Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* My Work Orders */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wrench size={16} className="text-orange-500" /> My Work Orders
                  </CardTitle>
                  <Link href="/maintenance/work-orders">
                    <Button variant="ghost" size="sm" className="text-xs">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {myWorkOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No work orders assigned to you</p>
                ) : (
                  <div className="space-y-2">
                    {myWorkOrders.slice(0, 5).map(wo => (
                      <Link key={wo.id} href={`/maintenance/work-orders/${wo.id}`}>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer">
                          <div>
                            <p className="text-sm font-medium">{wo.workOrderNumber}</p>
                            <p className="text-xs text-muted-foreground">{wo.machineName} — {wo.description.slice(0, 60)}</p>
                          </div>
                          <Badge variant={wo.status === "open" ? "secondary" : "outline"} className="capitalize">{wo.status.replace("_", " ")}</Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick links for tech */}
            <div className="grid grid-cols-2 gap-4">
              <Link href="/maintenance/checklists">
                <Card className="cursor-pointer bg-purple-500/10 hover:bg-purple-500/20 border-2">
                  <CardContent className="p-5 flex flex-col items-center gap-2 text-center">
                    <ClipboardCheck size={24} className="text-purple-500" />
                    <span className="text-sm font-medium">Checklists</span>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/maintenance/log-sheets">
                <Card className="cursor-pointer bg-teal-500/10 hover:bg-teal-500/20 border-2">
                  <CardContent className="p-5 flex flex-col items-center gap-2 text-center">
                    <FileText size={24} className="text-teal-500" />
                    <span className="text-sm font-medium">Log Sheets</span>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/maintenance/procedures">
                <Card className="cursor-pointer bg-green-500/10 hover:bg-green-500/20 border-2">
                  <CardContent className="p-5 flex flex-col items-center gap-2 text-center">
                    <FileText size={24} className="text-green-500" />
                    <span className="text-sm font-medium">Procedures</span>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/maintenance/breakdown">
                <Card className="cursor-pointer bg-red-500/10 hover:bg-red-500/20 border-2">
                  <CardContent className="p-5 flex flex-col items-center gap-2 text-center">
                    <AlertTriangle size={24} className="text-red-500" />
                    <span className="text-sm font-medium">Report Breakdown</span>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        )}

        {/* WORKER / OPERATOR DASHBOARD */}
        {isWorker && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Maintenance</h2>
              <p className="text-muted-foreground text-sm">Report equipment issues</p>
            </div>

            <Link href="/maintenance/breakdown">
              <Card className="cursor-pointer bg-red-500/10 hover:bg-red-500/20 border-2 border-red-500/30">
                <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
                  <AlertTriangle size={40} className="text-red-500" />
                  <div>
                    <p className="text-lg font-semibold">Report a Breakdown</p>
                    <p className="text-sm text-muted-foreground mt-1">Tap to report equipment issues or breakdowns</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* My Reports */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">My Reports</CardTitle>
              </CardHeader>
              <CardContent>
                {myReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">You haven&apos;t submitted any reports yet</p>
                ) : (
                  <div className="space-y-2">
                    {myReports.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{r.machineName || "Unknown Machine"}</p>
                          <p className="text-xs text-muted-foreground">{r.description.slice(0, 80)}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
                        </div>
                        {r.hasWorkOrder ? (
                          <Badge variant="outline" className="text-green-500 border-green-500/30"><CheckCircle size={10} className="mr-1" />In Progress</Badge>
                        ) : (
                          <Badge variant="secondary"><AlertCircle size={10} className="mr-1" />Pending</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
