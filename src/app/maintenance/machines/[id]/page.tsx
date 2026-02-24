"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wrench, RefreshCw, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Machine {
  id: string; machineId: string; name: string;
  machineTypeName?: string; currentLineName?: string;
  status: string; runtimeHours: number; runtimeCycles: number;
  createdAt: string;
}

interface WorkOrder {
  id: string; workOrderNumber: string; status: string;
  description: string; createdAt: string; closedAt?: string;
  downtimeStart?: string; downtimeEnd?: string;
}

interface Line { id: string; lineId: string; name: string; }

const statusColors: Record<string, string> = {
  running: "text-green-500 border-green-500/30",
  under_maintenance: "text-yellow-500 border-yellow-500/30",
  down: "text-red-500 border-red-500/30",
};

export default function MachineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [machine, setMachine] = useState<Machine | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRuntime, setShowRuntime] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [runtimeHours, setRuntimeHours] = useState("");
  const [runtimeCycles, setRuntimeCycles] = useState("");
  const [reassignForm, setReassignForm] = useState({ toLineId: "", reason: "", permanent: false });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const [mRes, woRes, lRes] = await Promise.all([
      fetch(`/api/maintenance/machines/${id}`),
      fetch(`/api/maintenance/work-orders?machineId=${id}`),
      fetch("/api/maintenance/lines"),
    ]);
    if (mRes.ok) {
      const m = await mRes.json();
      setMachine(m);
      setRuntimeHours(String(m.runtimeHours || 0));
      setRuntimeCycles(String(m.runtimeCycles || 0));
    }
    if (woRes.ok) setWorkOrders(await woRes.json());
    if (lRes.ok) setLines(await lRes.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetch("/api/auth").then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.authenticated) { router.push("/login"); return; }
      fetchData();
    });
  }, [router, fetchData]);

  const updateRuntime = async () => {
    setSaving(true);
    await fetch(`/api/maintenance/machines/${id}/runtime`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runtimeHours: Number(runtimeHours), runtimeCycles: Number(runtimeCycles) }),
    });
    setShowRuntime(false);
    fetchData();
    setSaving(false);
  };

  const reassignLine = async () => {
    if (!reassignForm.reason) return;
    setSaving(true);
    await fetch(`/api/maintenance/machines/${id}/reassign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reassignForm),
    });
    setShowReassign(false);
    fetchData();
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!machine) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Machine not found</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/maintenance/machines"><Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button></Link>
            <div>
              <h1 className="text-lg font-bold">{machine.name}</h1>
              <p className="text-xs text-muted-foreground font-mono">{machine.machineId}</p>
            </div>
          </div>
          <Badge variant="outline" className={statusColors[machine.status] || ""}>{machine.status.replace("_", " ")}</Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Machine Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Machine Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-muted-foreground">Type</p><p className="font-medium">{machine.machineTypeName || "—"}</p></div>
              <div><p className="text-muted-foreground">Current Line</p><p className="font-medium">{machine.currentLineName || "Not assigned"}</p></div>
              <div><p className="text-muted-foreground">Runtime Hours</p><p className="font-medium">{machine.runtimeHours.toFixed(1)} hrs</p></div>
              <div><p className="text-muted-foreground">Runtime Cycles</p><p className="font-medium">{machine.runtimeCycles.toLocaleString()}</p></div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowRuntime(true)}>
                <RefreshCw size={14} className="mr-1" />Update Runtime
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowReassign(true)}>
                <ArrowRightLeft size={14} className="mr-1" />Reassign Line
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Work Order History */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Work Order History</CardTitle>
              <Link href={`/maintenance/work-orders?machineId=${id}`}>
                <Button variant="ghost" size="sm" className="text-xs">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {workOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No work orders for this machine</p>
            ) : (
              <div className="space-y-2">
                {workOrders.slice(0, 10).map(wo => (
                  <Link key={wo.id} href={`/maintenance/work-orders/${wo.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer">
                      <div>
                        <p className="text-sm font-medium font-mono">{wo.workOrderNumber}</p>
                        <p className="text-xs text-muted-foreground">{wo.description.slice(0, 60)}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(wo.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={wo.status === "closed" ? "secondary" : "outline"} className="capitalize">{wo.status.replace("_", " ")}</Badge>
                        {wo.downtimeStart && wo.downtimeEnd && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {((new Date(wo.downtimeEnd).getTime() - new Date(wo.downtimeStart).getTime()) / 3600000).toFixed(1)}h downtime
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Update Runtime Dialog */}
      <Dialog open={showRuntime} onOpenChange={setShowRuntime}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Runtime</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Runtime Hours</Label>
              <Input className="mt-1.5" type="number" value={runtimeHours} onChange={e => setRuntimeHours(e.target.value)} />
            </div>
            <div>
              <Label>Runtime Cycles</Label>
              <Input className="mt-1.5" type="number" value={runtimeCycles} onChange={e => setRuntimeCycles(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRuntime(false)}>Cancel</Button>
              <Button onClick={updateRuntime} disabled={saving}>{saving ? "Saving..." : "Update"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reassign Line Dialog */}
      <Dialog open={showReassign} onOpenChange={setShowReassign}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reassign to Line</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Line</Label>
              <Select value={reassignForm.toLineId || "__none__"} onValueChange={v => setReassignForm(f => ({ ...f, toLineId: v === "__none__" ? "" : v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select line..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Remove from line</SelectItem>
                  {lines.map(l => <SelectItem key={l.id} value={l.id}>{l.lineId} — {l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea className="mt-1.5" value={reassignForm.reason} onChange={e => setReassignForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason for reassignment..." rows={3} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="permanent" checked={reassignForm.permanent} onChange={e => setReassignForm(f => ({ ...f, permanent: e.target.checked }))} />
              <Label htmlFor="permanent">Make permanent (update default line)</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowReassign(false)}>Cancel</Button>
              <Button onClick={reassignLine} disabled={saving || !reassignForm.reason}>{saving ? "Saving..." : "Reassign"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
