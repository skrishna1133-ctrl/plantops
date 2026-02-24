"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, FileText, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProcedureSheet {
  id: string; machineTypeId: string; machineTypeName?: string;
  title: string; currentRevision: number; createdAt: string;
}

interface MachineType { id: string; name: string; }

export default function ProceduresPage() {
  const router = useRouter();
  const [procedures, setProcedures] = useState<ProcedureSheet[]>([]);
  const [machineTypes, setMachineTypes] = useState<MachineType[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ machineTypeId: "", title: "", content: "", safetyWarnings: "" });
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");

  const isManager = ["maintenance_manager", "engineer", "admin", "owner"].includes(role);

  const fetchData = useCallback(async () => {
    const url = typeFilter !== "all" ? `/api/maintenance/procedures?machineTypeId=${typeFilter}` : "/api/maintenance/procedures";
    const [pRes, tRes] = await Promise.all([
      fetch(url),
      fetch("/api/maintenance/machine-types"),
    ]);
    if (pRes.ok) setProcedures(await pRes.json());
    if (tRes.ok) setMachineTypes(await tRes.json());
    setLoading(false);
  }, [typeFilter]);

  useEffect(() => {
    fetch("/api/auth").then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.authenticated) { router.push("/login"); return; }
      setRole(d.role);
      fetchData();
    });
  }, [router, fetchData]);

  const create = async () => {
    if (!form.machineTypeId || !form.title || !form.content) return;
    setSaving(true);
    const res = await fetch("/api/maintenance/procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { setShowCreate(false); setForm({ machineTypeId: "", title: "", content: "", safetyWarnings: "" }); fetchData(); }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/maintenance"><Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button></Link>
            <h1 className="text-lg font-bold">Procedure Sheets</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 h-9"><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {machineTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {isManager && <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} className="mr-1" />New Procedure</Button>}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {procedures.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText size={40} className="mx-auto mb-4 opacity-30" />
            <p>No procedure sheets yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {procedures.map(p => (
              <Link key={p.id} href={`/maintenance/procedures/${p.id}`}>
                <Card className="hover:bg-muted/30 cursor-pointer transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText size={20} className="text-green-500 shrink-0" />
                      <div>
                        <p className="font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">{p.machineTypeName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">Rev {p.currentRevision}</Badge>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Procedure Sheet</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Machine Type</Label>
              <Select value={form.machineTypeId} onValueChange={v => setForm(f => ({ ...f, machineTypeId: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>{machineTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title</Label>
              <Input className="mt-1.5" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Densifier Daily Maintenance Procedure" />
            </div>
            <div>
              <Label>Procedure Content</Label>
              <Textarea className="mt-1.5 font-mono text-sm" rows={8} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Step 1: ...&#10;Step 2: ...&#10;..." />
            </div>
            <div>
              <Label>Safety Warnings <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea className="mt-1.5" rows={3} value={form.safetyWarnings} onChange={e => setForm(f => ({ ...f, safetyWarnings: e.target.value }))} placeholder="⚠️ Lock out / tag out before servicing..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={create} disabled={saving || !form.machineTypeId || !form.title || !form.content}>{saving ? "Creating..." : "Create"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
