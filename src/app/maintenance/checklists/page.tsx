"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Flag, ChevronRight, ClipboardList, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MachineType { id: string; name: string; }
interface ChecklistTemplate {
  id: string; title: string; machineTypeName?: string; machineTypeId: string;
  frequency: string; intervalDays?: number; intervalHours?: number; intervalCycles?: number;
}
interface ChecklistSubmission {
  id: string; templateTitle?: string; machineName?: string;
  submittedByName?: string; hasFlags: boolean; submittedAt: string;
}

type ItemType = "checkbox" | "numeric" | "pass_fail" | "text_note";
interface NewItem { label: string; itemType: ItemType; expectedValue: string; isRequired: boolean; }

const FREQUENCIES = ["daily", "weekly", "monthly", "per_shift", "per_cycle", "as_needed"];
const ITEM_TYPES: { value: ItemType; label: string }[] = [
  { value: "checkbox", label: "Checkbox" },
  { value: "numeric", label: "Numeric" },
  { value: "pass_fail", label: "Pass/Fail" },
  { value: "text_note", label: "Text Note" },
];

export default function ChecklistsPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [tab, setTab] = useState<"templates" | "submissions">("templates");
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [submissions, setSubmissions] = useState<ChecklistSubmission[]>([]);
  const [machineTypes, setMachineTypes] = useState<MachineType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [flagsOnly, setFlagsOnly] = useState(false);
  const [form, setForm] = useState({
    machineTypeId: "", title: "", frequency: "daily",
    intervalDays: "", intervalHours: "", intervalCycles: "",
  });
  const [items, setItems] = useState<NewItem[]>([
    { label: "", itemType: "checkbox", expectedValue: "", isRequired: true },
  ]);
  const [saving, setSaving] = useState(false);

  const isManager = ["maintenance_manager", "engineer", "admin", "owner"].includes(role);

  const fetchData = useCallback(async () => {
    const [tRes, sRes, mtRes] = await Promise.all([
      fetch("/api/maintenance/checklist-templates"),
      fetch(`/api/maintenance/checklist-submissions${flagsOnly ? "?hasFlags=true" : ""}`),
      fetch("/api/maintenance/machine-types"),
    ]);
    if (tRes.ok) setTemplates(await tRes.json());
    if (sRes.ok) setSubmissions(await sRes.json());
    if (mtRes.ok) setMachineTypes(await mtRes.json());
    setLoading(false);
  }, [flagsOnly]);

  useEffect(() => {
    fetch("/api/auth").then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.authenticated) { router.push("/login"); return; }
      setRole(d.role);
      fetchData();
    });
  }, [router, fetchData]);

  const addItem = () => setItems(prev => [...prev, { label: "", itemType: "checkbox", expectedValue: "", isRequired: true }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof NewItem, value: string | boolean) => {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const createTemplate = async () => {
    if (!form.machineTypeId || !form.title || !form.frequency || items.some(it => !it.label)) return;
    setSaving(true);
    const res = await fetch("/api/maintenance/checklist-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        machineTypeId: form.machineTypeId,
        title: form.title,
        frequency: form.frequency,
        intervalDays: form.intervalDays ? Number(form.intervalDays) : undefined,
        intervalHours: form.intervalHours ? Number(form.intervalHours) : undefined,
        intervalCycles: form.intervalCycles ? Number(form.intervalCycles) : undefined,
        items: items.map(it => ({
          label: it.label,
          itemType: it.itemType,
          expectedValue: it.expectedValue || undefined,
          isRequired: it.isRequired,
        })),
      }),
    });
    if (res.ok) {
      setShowCreate(false);
      setForm({ machineTypeId: "", title: "", frequency: "daily", intervalDays: "", intervalHours: "", intervalCycles: "" });
      setItems([{ label: "", itemType: "checkbox", expectedValue: "", isRequired: true }]);
      fetchData();
    }
    setSaving(false);
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this checklist template? This cannot be undone.")) return;
    await fetch(`/api/maintenance/checklist-templates/${id}`, { method: "DELETE" });
    fetchData();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/maintenance"><Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button></Link>
            <h1 className="text-lg font-bold">Checklists</h1>
          </div>
          <div className="flex items-center gap-2">
            {isManager && tab === "submissions" && (
              <Button
                variant={flagsOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setFlagsOnly(f => !f)}
              >
                <Flag size={14} className="mr-1" />Flagged Only
              </Button>
            )}
            {isManager && tab === "templates" && (
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus size={14} className="mr-1" />New Template
              </Button>
            )}
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-4 flex gap-1 pb-0">
          {(["templates", "submissions"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-3">
        {tab === "templates" && (
          <>
            {templates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
                <p>No checklist templates yet.</p>
                {isManager && <p className="text-sm mt-1">Create a template to get started.</p>}
              </div>
            ) : (
              templates.map(t => (
                <Card key={t.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => router.push(`/maintenance/checklists/${t.id}`)}
                    >
                      <p className="font-medium">{t.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {t.machineTypeName} •{" "}
                        <span className="capitalize">{t.frequency.replace("_", " ")}</span>
                        {t.intervalDays ? ` • ${t.intervalDays}d interval` : ""}
                        {t.intervalHours ? ` • ${t.intervalHours}h interval` : ""}
                        {t.intervalCycles ? ` • ${t.intervalCycles} cycles` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isManager && (
                        <Button
                          variant="ghost" size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteTemplate(t.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      )}
                      <ChevronRight size={16} className="text-muted-foreground" onClick={() => router.push(`/maintenance/checklists/${t.id}`)} />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}

        {tab === "submissions" && (
          <>
            {submissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
                <p>{flagsOnly ? "No flagged submissions." : "No checklist submissions yet."}</p>
              </div>
            ) : (
              submissions.map(s => (
                <Card key={s.id} className={`hover:shadow-md transition-shadow ${s.hasFlags ? "border-orange-500/50" : ""}`}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{s.templateTitle || "Checklist"}</p>
                        {s.hasFlags && <Badge variant="destructive" className="text-xs">Flagged</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {s.machineName} • {s.submittedByName || "Unknown"} •{" "}
                        {new Date(s.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-muted-foreground cursor-pointer"
                      onClick={() => router.push(`/maintenance/checklists/submission/${s.id}`)}
                    />
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}
      </main>

      {/* Create Template Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Checklist Template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Machine Type</Label>
                <Select value={form.machineTypeId} onValueChange={v => setForm(f => ({ ...f, machineTypeId: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select type..." /></SelectTrigger>
                  <SelectContent>{machineTypes.map(mt => <SelectItem key={mt.id} value={mt.id}>{mt.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title</Label>
                <Input className="mt-1.5" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Daily Pre-start Check" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f} value={f} className="capitalize">{f.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Interval (days)</Label>
                <Input className="mt-1.5" type="number" value={form.intervalDays} onChange={e => setForm(f => ({ ...f, intervalDays: e.target.value }))} placeholder="Optional" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Checklist Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus size={14} className="mr-1" />Add Item</Button>
              </div>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 border border-border rounded-lg">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Item label"
                        value={item.label}
                        onChange={e => updateItem(i, "label", e.target.value)}
                      />
                      <Select value={item.itemType} onValueChange={v => updateItem(i, "itemType", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ITEM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                      {(item.itemType === "numeric") && (
                        <Input
                          placeholder="Expected value"
                          value={item.expectedValue}
                          onChange={e => updateItem(i, "expectedValue", e.target.value)}
                          className="col-span-2"
                        />
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} disabled={items.length === 1}>
                      <Trash2 size={14} className="text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                onClick={createTemplate}
                disabled={saving || !form.machineTypeId || !form.title || items.some(it => !it.label)}
              >
                {saving ? "Creating..." : "Create Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
