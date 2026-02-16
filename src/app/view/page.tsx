"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  LogOut,
  FileCheck,
  BarChart3,
  FlaskConical,
  Filter,
  Eye,
  ImageIcon,
  X,
  Package,
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
import ChecklistSubmissionsTab from "@/components/admin/checklist-submissions-tab";
import ChecklistReportsTab from "@/components/admin/checklist-reports-tab";
import QualityDocumentsTab from "@/components/admin/quality-documents-tab";

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

type ViewTab = "incidents" | "submissions" | "reports" | "quality" | "shipments";

export default function EngineerViewPage() {
  const [activeTab, setActiveTab] = useState<ViewTab>("incidents");
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlant, setFilterPlant] = useState<string>("all");
  const [filterCriticality, setFilterCriticality] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [userName, setUserName] = useState("");

  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => setUserName(data.fullName || ""))
      .catch(() => {});
  }, []);

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

  const filtered = incidents.filter((inc) => {
    if (filterPlant !== "all" && inc.plant !== filterPlant) return false;
    if (filterCriticality !== "all" && inc.criticality !== filterCriticality) return false;
    if (filterStatus !== "all" && inc.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500 flex items-center justify-center">
              <Eye className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">View Dashboard</h1>
              <p className="text-xs text-muted-foreground">
                {userName ? `Hi, ${userName} — ` : ""}Read-only access
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

      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1">
            {([
              { id: "incidents" as ViewTab, label: "Incidents", icon: AlertTriangle },
              { id: "submissions" as ViewTab, label: "Submissions", icon: FileCheck },
              { id: "reports" as ViewTab, label: "Reports", icon: BarChart3 },
              { id: "quality" as ViewTab, label: "Quality", icon: FlaskConical },
              { id: "shipments" as ViewTab, label: "Shipments", icon: Package },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-cyan-500 text-foreground"
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
        {activeTab === "submissions" && <ChecklistSubmissionsTab readOnly />}
        {activeTab === "reports" && <ChecklistReportsTab />}
        {activeTab === "quality" && <QualityDocumentsTab readOnly />}
        {activeTab === "shipments" && <ShipmentsTab readOnly />}

        {activeTab === "incidents" && (
          <>
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
                  <Badge variant="secondary">{filtered.length} incidents</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Incidents</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <span className="animate-spin text-muted-foreground">Loading...</span>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No incidents found.</p>
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
                            <TableCell className="font-mono text-sm">{inc.ticketId}</TableCell>
                            <TableCell>{inc.reporterName}</TableCell>
                            <TableCell>{plantLabels[inc.plant]}</TableCell>
                            <TableCell>{categoryLabels[inc.category]}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={criticalityColors[inc.criticality]}>
                                {inc.criticality.charAt(0).toUpperCase() + inc.criticality.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusColors[inc.status]}>
                                {statusLabels[inc.status]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {inc.photoUrl ? <ImageIcon size={16} className="text-green-400" /> : "—"}
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

      {photoPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPhotoPreview(null)}>
          <button className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-2" onClick={() => setPhotoPreview(null)}>
            <X size={24} />
          </button>
          <img src={photoPreview} alt="Photo" className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

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
                <DialogDescription>Incident details (read-only)</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Reporter</p>
                    <p className="font-medium">{selectedIncident.reporterName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Plant</p>
                    <p className="font-medium">{plantLabels[selectedIncident.plant]}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Category</p>
                    <p className="font-medium">{categoryLabels[selectedIncident.category]}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Status</p>
                    <Badge variant="outline" className={statusColors[selectedIncident.status]}>
                      {statusLabels[selectedIncident.status]}
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
                    <div className="cursor-pointer group rounded-lg overflow-hidden border" onClick={() => setPhotoPreview(selectedIncident.photoUrl!)}>
                      <img src={selectedIncident.photoUrl} alt="Incident photo" className="w-full max-h-48 object-cover group-hover:opacity-80 transition-opacity" />
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
