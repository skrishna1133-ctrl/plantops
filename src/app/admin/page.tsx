"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Filter,
  Trash2,
  LogOut,
  ImageIcon,
  X,
  ClipboardList,
  FileCheck,
  BarChart3,
  FlaskConical,
  Users,
  Package,
  LayoutList,
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
import ChecklistTemplatesTab from "@/components/admin/checklist-templates-tab";
import ChecklistSubmissionsTab from "@/components/admin/checklist-submissions-tab";
import ChecklistReportsTab from "@/components/admin/checklist-reports-tab";
import QualityDocumentsTab from "@/components/admin/quality-documents-tab";

import UsersTab from "@/components/admin/users-tab";
import ShipmentsTab from "@/components/admin/shipments-tab";
import QualityTemplatesTab from "@/components/admin/quality-templates-tab";
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

type AdminTab = "incidents" | "templates" | "submissions" | "reports" | "quality" | "quality-templates" | "users" | "shipments";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("incidents");
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlant, setFilterPlant] = useState<string>("all");
  const [filterCriticality, setFilterCriticality] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedIncident, setSelectedIncident] =
    useState<IncidentReport | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  };

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/incidents");
      const data = await res.json();
      setIncidents(data);
    } catch (error) {
      console.error("Failed to fetch incidents:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/incidents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setIncidents((prev) =>
          prev.map((inc) =>
            inc.id === id
              ? { ...inc, status: status as IncidentReport["status"] }
              : inc
          )
        );
        if (selectedIncident?.id === id) {
          setSelectedIncident((prev) =>
            prev
              ? { ...prev, status: status as IncidentReport["status"] }
              : null
          );
        }
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const deleteIncident = async (id: string) => {
    if (!confirm("Are you sure you want to delete this incident?")) return;
    try {
      const res = await fetch(`/api/incidents/${id}`, { method: "DELETE" });
      if (res.ok) {
        setIncidents((prev) => prev.filter((inc) => inc.id !== id));
        setSelectedIncident(null);
      }
    } catch (error) {
      console.error("Failed to delete incident:", error);
    }
  };

  const filtered = incidents.filter((inc) => {
    if (filterPlant !== "all" && inc.plant !== filterPlant) return false;
    if (filterCriticality !== "all" && inc.criticality !== filterCriticality)
      return false;
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft size={20} />
              </Button>
            </Link>
            <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Admin Dashboard
              </h1>
              <p className="text-xs text-muted-foreground">
                Plant Operations Management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "incidents" && (
              <Button
                variant="outline"
                size="sm"
                onClick={fetchIncidents}
                disabled={loading}
              >
                <RefreshCw
                  size={14}
                  className={`mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            )}
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
            {([
              { id: "incidents" as AdminTab, label: "Incidents", icon: AlertTriangle },
              { id: "templates" as AdminTab, label: "Templates", icon: ClipboardList },
              { id: "submissions" as AdminTab, label: "Submissions", icon: FileCheck },
              { id: "reports" as AdminTab, label: "Reports", icon: BarChart3 },
              { id: "quality" as AdminTab, label: "Quality", icon: FlaskConical },
              { id: "quality-templates" as AdminTab, label: "Q. Templates", icon: LayoutList },
              { id: "users" as AdminTab, label: "Users", icon: Users },
              { id: "shipments" as AdminTab, label: "Shipments", icon: Package },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-orange-500 text-foreground"
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
        {/* Templates Tab */}
        {activeTab === "templates" && <ChecklistTemplatesTab />}

        {/* Submissions Tab */}
        {activeTab === "submissions" && <ChecklistSubmissionsTab />}

        {/* Reports Tab */}
        {activeTab === "reports" && <ChecklistReportsTab />}

        {/* Quality Tab */}
        {activeTab === "quality" && <QualityDocumentsTab />}

        {/* Quality Templates Tab */}
        {activeTab === "quality-templates" && <QualityTemplatesTab />}

        {/* Users Tab */}
        {activeTab === "users" && <UsersTab />}

        {/* Shipments Tab */}
        {activeTab === "shipments" && <ShipmentsTab />}

        {/* Incidents Tab */}
        {activeTab === "incidents" && <>
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="border-blue-500/30">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{stats.open}</p>
              <p className="text-xs text-muted-foreground">Open</p>
            </CardContent>
          </Card>
          <Card className="border-amber-500/30">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">
                {stats.inProgress}
              </p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/30">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-400">
                {stats.resolved}
              </p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </CardContent>
          </Card>
          <Card className="border-red-500/30">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-400">
                {stats.critical}
              </p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </CardContent>
          </Card>
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

              <Select
                value={filterCriticality}
                onValueChange={setFilterCriticality}
              >
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

        {/* Incidents Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              Incidents ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertTriangle size={48} className="mb-4 opacity-30" />
                <p className="text-lg font-medium">No incidents found</p>
                <p className="text-sm">
                  {incidents.length === 0
                    ? "No incidents have been reported yet."
                    : "No incidents match the current filters."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[130px]">Ticket ID</TableHead>
                      <TableHead>Reporter</TableHead>
                      <TableHead>Plant</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Criticality</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Photo</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((incident) => (
                      <TableRow
                        key={incident.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedIncident(incident)}
                      >
                        <TableCell className="font-mono text-sm font-medium">
                          {incident.ticketId}
                        </TableCell>
                        <TableCell>{incident.reporterName}</TableCell>
                        <TableCell>
                          {plantLabels[incident.plant] || incident.plant}
                        </TableCell>
                        <TableCell>
                          {categoryLabels[incident.category] ||
                            incident.category}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              criticalityColors[incident.criticality] || ""
                            }
                          >
                            {incident.criticality.charAt(0).toUpperCase() +
                              incident.criticality.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusColors[incident.status] || ""}
                          >
                            {statusLabels[incident.status] || incident.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {incident.photoUrl ? (
                            <ImageIcon size={16} className="text-green-400" />
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(incident.incidentDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteIncident(incident.id);
                            }}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        </>}
      </main>

      {/* Photo Preview Popup */}
      {photoPreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPhotoPreview(null)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
            onClick={() => setPhotoPreview(null)}
          >
            <X size={24} />
          </button>
          <img
            src={photoPreview}
            alt="Incident photo enlarged"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Incident Detail Dialog */}
      <Dialog
        open={!!selectedIncident}
        onOpenChange={(open) => {
          if (!open && photoPreview) {
            setPhotoPreview(null);
            return;
          }
          if (!open) setSelectedIncident(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {selectedIncident && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="font-mono text-base">
                    {selectedIncident.ticketId}
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      criticalityColors[selectedIncident.criticality] || ""
                    }
                  >
                    {selectedIncident.criticality.charAt(0).toUpperCase() +
                      selectedIncident.criticality.slice(1)}
                  </Badge>
                </DialogTitle>
                <DialogDescription>Incident details and management</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Reporter</p>
                    <p className="font-medium">
                      {selectedIncident.reporterName}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Plant</p>
                    <p className="font-medium">
                      {plantLabels[selectedIncident.plant] ||
                        selectedIncident.plant}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Category</p>
                    <p className="font-medium">
                      {categoryLabels[selectedIncident.category] ||
                        selectedIncident.category}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Incident Date</p>
                    <p className="font-medium">
                      {new Date(
                        selectedIncident.incidentDate
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Description
                  </p>
                  <p className="text-sm bg-muted/50 rounded-lg p-3">
                    {selectedIncident.description}
                  </p>
                </div>

                {selectedIncident.photoUrl && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Photo Evidence
                    </p>
                    <div
                      className="relative cursor-pointer group rounded-lg overflow-hidden border border-border"
                      onClick={() => setPhotoPreview(selectedIncident.photoUrl!)}
                    >
                      <img
                        src={selectedIncident.photoUrl}
                        alt="Incident photo"
                        className="w-full max-h-48 object-cover transition-opacity group-hover:opacity-80"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                        <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                          <ImageIcon size={12} />
                          Click to enlarge
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Update Status
                  </p>
                  <div className="flex gap-2">
                    {(["open", "in_progress", "resolved"] as const).map(
                      (status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant={
                            selectedIncident.status === status
                              ? "default"
                              : "outline"
                          }
                          onClick={() =>
                            updateStatus(selectedIncident.id, status)
                          }
                          className={
                            selectedIncident.status === status
                              ? ""
                              : "opacity-60"
                          }
                        >
                          {statusLabels[status]}
                        </Button>
                      )
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <p className="text-xs text-muted-foreground">
                    Reported:{" "}
                    {new Date(selectedIncident.createdAt).toLocaleString()}
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteIncident(selectedIncident.id)}
                  >
                    <Trash2 size={14} className="mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
