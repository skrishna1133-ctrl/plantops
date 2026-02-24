"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface WorkOrder {
  id: string; workOrderNumber: string; type: string; status: string;
  machineName?: string; machineIdCode?: string;
  assignedToId?: string; assignedToName?: string;
  breakdownReportId?: string; description: string;
  resolution?: string; partsUsed?: string;
  downtimeStart?: string; downtimeEnd?: string;
  completedAt?: string; closedAt?: string;
  createdAt: string; createdByName?: string;
  procedureUpdatedFlag: boolean;
}

interface User { id: string; fullName: string; role: string; }

const statusColors: Record<string, string> = {
  open: "text-red-500 border-red-500/30",
  in_progress: "text-yellow-500 border-yellow-500/30",
  completed: "text-blue-500 border-blue-500/30",
  closed: "text-green-500 border-green-500/30",
};

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resolution, setResolution] = useState("");
  const [partsUsed, setPartsUsed] = useState("");
  const [assignToId, setAssignToId] = useState("");

  const isManager = ["maintenance_manager", "engineer", "admin", "owner"].includes(role);
  const isTech = role === "maintenance_tech";

  const fetchData = useCallback(async () => {
    const [woRes, uRes] = await Promise.all([
      fetch(`/api/maintenance/work-orders/${id}`),
      fetch("/api/users"),
    ]);
    if (woRes.ok) {
      const data = await woRes.json();
      setWo(data);
      setResolution(data.resolution || "");
      setPartsUsed(data.partsUsed || "");
      setAssignToId(data.assignedToId || "");
    }
    if (uRes.ok) {
      const u = await uRes.json();
      setUsers(u.filter((x: User) => ["maintenance_tech", "engineer"].includes(x.role)));
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetch("/api/auth").then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.authenticated) { router.push("/login"); return; }
      setRole(d.role);
      setUserId(d.userId || "");
      fetchData();
    });
  }, [router, fetchData]);

  const updateStatus = async (status: string) => {
    setSaving(true);
    await fetch(`/api/maintenance/work-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolution, partsUsed }),
    });
    fetchData();
    setSaving(false);
  };

  const assignWO = async () => {
    setSaving(true);
    await fetch(`/api/maintenance/work-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId: assignToId }),
    });
    fetchData();
    setSaving(false);
  };

  const closeWO = async () => {
    setSaving(true);
    await fetch(`/api/maintenance/work-orders/${id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ downtimeEnd: new Date().toISOString() }),
    });
    fetchData();
    setSaving(false);
  };

  const formatDuration = (start?: string, end?: string) => {
    if (!start || !end) return null;
    const hours = (new Date(end).getTime() - new Date(start).getTime()) / 3600000;
    return `${hours.toFixed(1)}h`;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!wo) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Work order not found</div>;

  const canEdit = isManager || (isTech && wo.assignedToId === userId);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/maintenance/work-orders"><Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button></Link>
            <div>
              <h1 className="text-lg font-bold font-mono">{wo.workOrderNumber}</h1>
              <p className="text-xs text-muted-foreground capitalize">{wo.type} • {wo.machineIdCode} {wo.machineName}</p>
            </div>
          </div>
          <Badge variant="outline" className={`${statusColors[wo.status] || ""} capitalize`}>{wo.status.replace("_", " ")}</Badge>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Procedure updated flag */}
        {wo.procedureUpdatedFlag && (
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <AlertTriangle size={16} className="text-yellow-500 shrink-0" />
            <p className="text-sm text-yellow-600 dark:text-yellow-400">Procedure updated since this WO was created — review the latest procedure before continuing.</p>
          </div>
        )}

        {/* Description */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Issue Description</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm">{wo.description}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div><span className="font-medium">Created by:</span> {wo.createdByName || "—"}</div>
              <div><span className="font-medium">Date:</span> {new Date(wo.createdAt).toLocaleDateString()}</div>
              {wo.downtimeStart && <div><span className="font-medium">Downtime start:</span> {new Date(wo.downtimeStart).toLocaleString()}</div>}
              {wo.downtimeEnd && <div className="text-green-500"><span className="font-medium text-muted-foreground">Downtime end:</span> {new Date(wo.downtimeEnd).toLocaleString()} ({formatDuration(wo.downtimeStart, wo.downtimeEnd)} total)</div>}
            </div>
          </CardContent>
        </Card>

        {/* Assignment (manager only) */}
        {isManager && wo.status !== "closed" && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Assignment</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Select value={assignToId || "__none__"} onValueChange={v => setAssignToId(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Assign to technician..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={assignWO} disabled={saving} size="sm">Assign</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resolution (tech or manager) */}
        {canEdit && wo.status !== "closed" && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Work Notes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Resolution / Work Done</Label>
                <Textarea className="mt-1.5" rows={4} value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Describe what was done to resolve the issue..." />
              </div>
              <div>
                <Label>Parts Used <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Textarea className="mt-1.5" rows={2} value={partsUsed} onChange={e => setPartsUsed(e.target.value)} placeholder="List parts replaced or consumed..." />
              </div>
              <div className="flex gap-2 flex-wrap">
                {wo.status === "open" && (
                  <Button variant="outline" onClick={() => updateStatus("in_progress")} disabled={saving}>
                    <Clock size={14} className="mr-1" />Start Work
                  </Button>
                )}
                {(wo.status === "open" || wo.status === "in_progress") && (
                  <Button onClick={() => updateStatus("completed")} disabled={saving || !resolution}>
                    <CheckCircle size={14} className="mr-1" />Mark Completed
                  </Button>
                )}
                {isManager && wo.status === "completed" && (
                  <Button onClick={closeWO} disabled={saving} className="bg-green-600 hover:bg-green-700">
                    <XCircle size={14} className="mr-1" />Close Work Order
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resolution summary (if closed) */}
        {(wo.resolution || wo.partsUsed) && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Resolution Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {wo.resolution && <p>{wo.resolution}</p>}
              {wo.partsUsed && <p className="text-muted-foreground"><span className="font-medium">Parts used:</span> {wo.partsUsed}</p>}
              {wo.completedAt && <p className="text-xs text-muted-foreground">Completed: {new Date(wo.completedAt).toLocaleString()}</p>}
              {wo.closedAt && <p className="text-xs text-muted-foreground">Closed: {new Date(wo.closedAt).toLocaleString()}</p>}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
