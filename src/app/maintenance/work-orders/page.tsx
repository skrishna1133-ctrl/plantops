"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface WorkOrder {
  id: string; workOrderNumber: string; type: string; status: string;
  machineName?: string; machineIdCode?: string;
  assignedToName?: string; description: string;
  createdAt: string; downtimeStart?: string; downtimeEnd?: string;
}

interface Machine { id: string; machineId: string; name: string; }
interface User { id: string; fullName: string; role: string; }

const statusColors: Record<string, string> = {
  open: "bg-red-500/10 text-red-500 border-red-500/30",
  in_progress: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  completed: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  closed: "bg-green-500/10 text-green-500 border-green-500/30",
};

export default function WorkOrdersPage() {
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ machineId: "", description: "", type: "corrective", assignedToId: "" });
  const [saving, setSaving] = useState(false);

  const isManager = ["maintenance_manager", "engineer", "admin", "owner"].includes(role);

  const fetchData = useCallback(async () => {
    const url = statusFilter !== "all" ? `/api/maintenance/work-orders?status=${statusFilter}` : "/api/maintenance/work-orders";
    const [woRes, mRes, uRes] = await Promise.all([
      fetch(url),
      fetch("/api/maintenance/machines"),
      fetch("/api/users"),
    ]);
    if (woRes.ok) setWorkOrders(await woRes.json());
    if (mRes.ok) setMachines(await mRes.json());
    if (uRes.ok) {
      const u = await uRes.json();
      setUsers(u.filter((x: User) => ["maintenance_tech", "engineer"].includes(x.role)));
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetch("/api/auth").then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.authenticated) { router.push("/login"); return; }
      setRole(d.role);
      fetchData();
    });
  }, [router, fetchData]);

  const createWO = async () => {
    if (!form.machineId || !form.description) return;
    setSaving(true);
    const res = await fetch("/api/maintenance/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { setShowCreate(false); setForm({ machineId: "", description: "", type: "corrective", assignedToId: "" }); fetchData(); }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/maintenance"><Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button></Link>
            <h1 className="text-lg font-bold">Work Orders</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-9">
                <Filter size={14} className="mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            {isManager && <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} className="mr-1" />New WO</Button>}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {workOrders.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>No work orders{statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {workOrders.map(wo => (
              <Link key={wo.id} href={`/maintenance/work-orders/${wo.id}`}>
                <Card className="hover:bg-muted/30 cursor-pointer transition-colors">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-semibold">{wo.workOrderNumber}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{wo.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{wo.description}</p>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        {wo.machineName && <span>{wo.machineIdCode} — {wo.machineName}</span>}
                        {wo.assignedToName && <span>→ {wo.assignedToName}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge className={`${statusColors[wo.status] || ""} border text-xs capitalize`}>{wo.status.replace("_", " ")}</Badge>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(wo.createdAt).toLocaleDateString()}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Work Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrective">Corrective</SelectItem>
                  <SelectItem value="unplanned">Unplanned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Machine</Label>
              <Select value={form.machineId} onValueChange={v => setForm(f => ({ ...f, machineId: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select machine..." /></SelectTrigger>
                <SelectContent>{machines.map(m => <SelectItem key={m.id} value={m.id}>{m.machineId} — {m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="mt-1.5" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the issue..." />
            </div>
            <div>
              <Label>Assign To <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={form.assignedToId} onValueChange={v => setForm(f => ({ ...f, assignedToId: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={createWO} disabled={saving || !form.machineId || !form.description}>{saving ? "Creating..." : "Create"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
