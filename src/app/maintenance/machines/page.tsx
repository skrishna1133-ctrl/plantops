"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface MachineType { id: string; name: string; }
interface Line { id: string; lineId: string; name: string; isActive: boolean; }
interface Machine {
  id: string; machineId: string; name: string;
  machineTypeId: string; machineTypeName?: string;
  currentLineId: string | null; currentLineName?: string;
  status: string; runtimeHours: number; runtimeCycles: number;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  running: "text-green-500 border-green-500/30",
  under_maintenance: "text-yellow-500 border-yellow-500/30",
  down: "text-red-500 border-red-500/30",
};

export default function MachinesPage() {
  const router = useRouter();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineTypes, setMachineTypes] = useState<MachineType[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddType, setShowAddType] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);

  // Add machine form
  const [form, setForm] = useState({ machineId: "", name: "", machineTypeId: "", defaultLineId: "" });
  const [typeForm, setTypeForm] = useState({ name: "" });
  const [lineForm, setLineForm] = useState({ lineId: "", name: "" });
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    const [mRes, tRes, lRes] = await Promise.all([
      fetch("/api/maintenance/machines"),
      fetch("/api/maintenance/machine-types"),
      fetch("/api/maintenance/lines"),
    ]);
    if (mRes.ok) setMachines(await mRes.json());
    if (tRes.ok) setMachineTypes(await tRes.json());
    if (lRes.ok) setLines(await lRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch("/api/auth").then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.authenticated) { router.push("/login"); return; }
      fetchAll();
    });
  }, [router, fetchAll]);

  const addMachine = async () => {
    if (!form.machineId || !form.name || !form.machineTypeId) return;
    setSaving(true);
    const res = await fetch("/api/maintenance/machines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { setShowAdd(false); setForm({ machineId: "", name: "", machineTypeId: "", defaultLineId: "" }); fetchAll(); }
    setSaving(false);
  };

  const addMachineType = async () => {
    if (!typeForm.name) return;
    setSaving(true);
    const res = await fetch("/api/maintenance/machine-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: typeForm.name }),
    });
    if (res.ok) { setShowAddType(false); setTypeForm({ name: "" }); fetchAll(); }
    setSaving(false);
  };

  const addLine = async () => {
    if (!lineForm.lineId || !lineForm.name) return;
    setSaving(true);
    const res = await fetch("/api/maintenance/lines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lineForm),
    });
    if (res.ok) { setShowAddLine(false); setLineForm({ lineId: "", name: "" }); fetchAll(); }
    setSaving(false);
  };

  const filtered = machines.filter(m =>
    m.machineId.toLowerCase().includes(search.toLowerCase()) ||
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.machineTypeName || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/maintenance"><Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button></Link>
            <h1 className="text-lg font-bold">Machine Registry</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddType(true)}><Plus size={14} className="mr-1" />Machine Type</Button>
            <Button variant="outline" size="sm" onClick={() => setShowAddLine(true)}><Plus size={14} className="mr-1" />Line</Button>
            <Button size="sm" onClick={() => setShowAdd(true)}><Plus size={14} className="mr-1" />Machine</Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search machines..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Stats row */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{machines.filter(m => m.status === "running").length} running</span>
          <span className="text-yellow-500">{machines.filter(m => m.status === "under_maintenance").length} maintenance</span>
          <span className="text-red-500">{machines.filter(m => m.status === "down").length} down</span>
        </div>

        {/* Machine list */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Settings2 size={40} className="mx-auto mb-4 opacity-30" />
            <p>{search ? "No machines match your search" : "No machines yet. Add your first machine."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(m => (
              <Link key={m.id} href={`/maintenance/machines/${m.id}`}>
                <Card className="hover:bg-muted/30 cursor-pointer transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="font-mono text-sm bg-muted px-2 py-1 rounded text-muted-foreground">{m.machineId}</div>
                      <div>
                        <p className="font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.machineTypeName} {m.currentLineName ? `• ${m.currentLineName}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs text-muted-foreground hidden sm:block">
                        <p>{m.runtimeHours.toFixed(1)} hrs</p>
                        <p>{m.runtimeCycles} cycles</p>
                      </div>
                      <Badge variant="outline" className={statusColors[m.status] || ""}>{m.status.replace("_", " ")}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Add Machine Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Machine</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Machine ID <span className="text-muted-foreground text-xs">(e.g. DEN-L2-01)</span></Label>
              <Input className="mt-1.5" value={form.machineId} onChange={e => setForm(f => ({ ...f, machineId: e.target.value }))} placeholder="DEN-L2-01" />
            </div>
            <div>
              <Label>Machine Name</Label>
              <Input className="mt-1.5" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Densifier Unit 1" />
            </div>
            <div>
              <Label>Machine Type</Label>
              <Select value={form.machineTypeId} onValueChange={v => setForm(f => ({ ...f, machineTypeId: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>{machineTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Production Line <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={form.defaultLineId} onValueChange={v => setForm(f => ({ ...f, defaultLineId: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select line..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {lines.filter(l => l.isActive).map(l => <SelectItem key={l.id} value={l.id}>{l.lineId} — {l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={addMachine} disabled={saving || !form.machineId || !form.name || !form.machineTypeId}>
                {saving ? "Adding..." : "Add Machine"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Machine Type Dialog */}
      <Dialog open={showAddType} onOpenChange={setShowAddType}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Machine Type</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type Name</Label>
              <Input className="mt-1.5" value={typeForm.name} onChange={e => setTypeForm({ name: e.target.value })} placeholder="e.g. Densifier, Separator..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddType(false)}>Cancel</Button>
              <Button onClick={addMachineType} disabled={saving || !typeForm.name}>{saving ? "Adding..." : "Add Type"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Line Dialog */}
      <Dialog open={showAddLine} onOpenChange={setShowAddLine}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Production Line</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Line ID <span className="text-muted-foreground text-xs">(e.g. LINE-1)</span></Label>
              <Input className="mt-1.5" value={lineForm.lineId} onChange={e => setLineForm(f => ({ ...f, lineId: e.target.value }))} placeholder="LINE-1" />
            </div>
            <div>
              <Label>Line Name</Label>
              <Input className="mt-1.5" value={lineForm.name} onChange={e => setLineForm(f => ({ ...f, name: e.target.value }))} placeholder="Production Line 1" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddLine(false)}>Cancel</Button>
              <Button onClick={addLine} disabled={saving || !lineForm.lineId || !lineForm.name}>{saving ? "Adding..." : "Add Line"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
