"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  ClipboardList,
  FlaskConical,
  Users,
  Package,
  Filter,
  LogOut,
  ImageIcon,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { IncidentReport } from "@/lib/schemas";
import ChecklistsTab from "@/components/admin/checklists-tab";
import QualityDocumentsTab from "@/components/admin/quality-documents-tab";
import UsersTab from "@/components/admin/users-tab";
import ShipmentsTab from "@/components/admin/shipments-tab";
import { ThemeToggle } from "@/components/theme-toggle";

const criticalityColors: Record<string, string> = {
  minor: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  major: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  in_progress: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  resolved: "bg-green-500/20 text-green-400 border-green-500/30",
};

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};

const categoryLabels: Record<string, string> = {
  safety: "Safety",
  equipment: "Equipment",
  quality: "Quality",
  environmental: "Environmental",
};

const plantLabels: Record<string, string> = {
  "plant-a": "Plant A",
  "plant-b": "Plant B",
};

type AdminTab = "incidents" | "checklists" | "quality" | "users" | "shipments";

interface Tenant {
  id: string;
  name: string;
  code: string;
}

export default function TenantDashboardPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const router = useRouter();

  const [tenantName, setTenantName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<AdminTab>("incidents");
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlant, setFilterPlant] = useState("all");
  const [filterCriticality, setFilterCriticality] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);

  // Auth check + load tenant name
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated || data.role !== "super_admin") {
          router.push("/login");
        }
      })
      .catch(() => router.push("/login"));

    fetch("/api/tenants")
      .then((r) => r.json())
      .then((data: Tenant[]) => {
        if (Array.isArray(data)) {
          const tenant = data.find((t) => t.id === tenantId);
          if (tenant) setTenantName(tenant.name);
        }
      })
      .catch(() => {});
  }, [tenantId, router]);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/incidents?viewAs=${tenantId}`);
      const data = await res.json();
      if (Array.isArray(data)) setIncidents(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  };

  const filtered = incidents.filter((inc) => {
    if (filterPlant !== "all" && inc.plant !== filterPlant) return false;
    if (filterCriticality !== "all" && inc.criticality !== filterCriticality) return false;
    if (filterStatus !== "all" && inc.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: incidents.length,
    open: incidents.filter((i) => i.status === "open").length,
    inProgress: incidents.filter((i) => i.status === "in_progress").length,
    resolved: incidents.filter((i) => i.status === "resolved").length,
    critical: incidents.filter((i) => i.criticality === "critical").length,
  };

  const tabs = [
    { id: "incidents" as AdminTab, label: "Incidents", icon: AlertTriangle },
    { id: "checklists" as AdminTab, label: "Checklists", icon: ClipboardList },
    { id: "quality" as AdminTab, label: "Quality", icon: FlaskConical },
    { id: "users" as AdminTab, label: "Users", icon: Users },
    { id: "shipments" as AdminTab, label: "Shipments", icon: Package },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/platform")}>
              <ArrowLeft size={20} />
            </Button>
            <div className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center">
              <Globe className="text-white" size={18} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                {tenantName || "Tenant"} Dashboard
              </h1>
              <p className="text-xs text-muted-foreground">
                Viewing as Platform Admin
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-red-400"
            >
              <LogOut size={14} className="mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-violet-500 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {activeTab === "checklists" && <ChecklistsTab viewAs={tenantId} />}
        {activeTab === "quality" && <QualityDocumentsTab viewAs={tenantId} />}
        {activeTab === "users" && <UsersTab viewAs={tenantId} />}
        {activeTab === "shipments" && <ShipmentsTab viewAs={tenantId} />}

        {activeTab === "incidents" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Total", value: stats.total, color: "" },
                { label: "Open", value: stats.open, color: "text-blue-400" },
                { label: "In Progress", value: stats.inProgress, color: "text-amber-400" },
                { label: "Resolved", value: stats.resolved, color: "text-green-400" },
                { label: "Critical", value: stats.critical, color: "text-red-400" },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="p-4 text-center">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Filter size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Filters</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Select value={filterPlant} onValueChange={setFilterPlant}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Plant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Plants</SelectItem>
                      <SelectItem value="plant-a">Plant A</SelectItem>
                      <SelectItem value="plant-b">Plant B</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterCriticality} onValueChange={setFilterCriticality}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Criticality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="minor">Minor</SelectItem>
                      <SelectItem value="major">Major</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Incidents ({filtered.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex justify-center py-12 text-muted-foreground text-sm">
                    Loading...
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <AlertTriangle size={40} className="mb-3 opacity-30" />
                    <p className="font-medium">No incidents found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ticket ID</TableHead>
                          <TableHead>Reporter</TableHead>
                          <TableHead>Plant</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Criticality</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Photo</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((inc) => (
                          <TableRow
                            key={inc.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedIncident(inc)}
                          >
                            <TableCell className="font-mono text-sm font-medium">
                              {inc.ticketId}
                            </TableCell>
                            <TableCell>{inc.reporterName}</TableCell>
                            <TableCell>{plantLabels[inc.plant] || inc.plant}</TableCell>
                            <TableCell>{categoryLabels[inc.category] || inc.category}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={criticalityColors[inc.criticality] || ""}>
                                {inc.criticality.charAt(0).toUpperCase() + inc.criticality.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusColors[inc.status] || ""}>
                                {statusLabels[inc.status] || inc.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {inc.photoUrl ? (
                                <ImageIcon size={16} className="text-green-400" />
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(inc.incidentDate).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>

      {/* Incident Detail Dialog */}
      <Dialog open={!!selectedIncident} onOpenChange={(open) => { if (!open) setSelectedIncident(null); }}>
        <DialogContent className="sm:max-w-lg">
          {selectedIncident && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="font-mono text-base">{selectedIncident.ticketId}</span>
                  <Badge variant="outline" className={criticalityColors[selectedIncident.criticality]}>
                    {selectedIncident.criticality.charAt(0).toUpperCase() + selectedIncident.criticality.slice(1)}
                  </Badge>
                </DialogTitle>
                <DialogDescription>Incident details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Reporter</p>
                    <p className="font-medium">{selectedIncident.reporterName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Plant</p>
                    <p className="font-medium">{plantLabels[selectedIncident.plant] || selectedIncident.plant}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Category</p>
                    <p className="font-medium">{categoryLabels[selectedIncident.category] || selectedIncident.category}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Status</p>
                    <Badge variant="outline" className={statusColors[selectedIncident.status]}>
                      {statusLabels[selectedIncident.status] || selectedIncident.status}
                    </Badge>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-sm bg-muted/50 rounded-lg p-3">{selectedIncident.description}</p>
                </div>
                {selectedIncident.photoUrl && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Photo Evidence</p>
                    <div className="rounded-lg overflow-hidden border">
                      <img
                        src={selectedIncident.photoUrl}
                        alt="Incident photo"
                        className="w-full max-h-48 object-cover"
                      />
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Reported: {new Date(selectedIncident.createdAt).toLocaleString()}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
