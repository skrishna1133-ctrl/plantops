"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, ClipboardCheck, Clock, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MachineType { id: string; name: string; }
interface LogTemplate {
  id: string; title: string; machineTypeName?: string; machineTypeId: string;
  frequency: string; intervalDays?: number;
}
interface LogSubmission {
  id: string; templateTitle?: string; machineName?: string;
  submittedByName?: string; signedOffByName?: string;
  signedOffAt: string | null; submittedAt: string;
  isOutOfRange?: boolean;
}

interface NewField { label: string; unit: string; minValue: string; maxValue: string; isRequired: boolean; }

const FREQUENCIES = ["daily", "weekly", "monthly", "per_shift", "as_needed"];

export default function LogSheetsPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [tab, setTab] = useState<"templates" | "pending" | "history">("templates");
  const [templates, setTemplates] = useState<LogTemplate[]>([]);
  const [pendingSignoffs, setPendingSignoffs] = useState<LogSubmission[]>([]);
  const [submissions, setSubmissions] = useState<LogSubmission[]>([]);
  const [machineTypes, setMachineTypes] = useState<MachineType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ machineTypeId: "", title: "", frequency: "daily", intervalDays: "" });
  const [fields, setFields] = useState<NewField[]>([
    { label: "", unit: "", minValue: "", maxValue: "", isRequired: true },
  ]);
  const [saving, setSaving] = useState(false);

  const isManager = ["maintenance_manager", "engineer", "admin", "owner"].includes(role);

  const fetchData = useCallback(async () => {
    const fetches = [
      fetch("/api/maintenance/log-templates"),
      fetch("/api/maintenance/log-submissions"),
      fetch("/api/maintenance/machine-types"),
    ];
    if (isManager || role === "maintenance_manager") {
      fetches.push(fetch("/api/maintenance/log-submissions/pending-signoff"));
    }
    const results = await Promise.all(fetches);
    if (results[0].ok) setTemplates(await results[0].json());
    if (results[1].ok) setSubmissions(await results[1].json());
    if (results[2].ok) setMachineTypes(await results[2].json());
    if (results[3]?.ok) setPendingSignoffs(await results[3].json());
    setLoading(false);
  }, [isManager, role]);

  useEffect(() => {
    fetch("/api/auth").then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.authenticated) { router.push("/login"); return; }
      setRole(d.role);
    });
  }, [router]);

  useEffect(() => {
    if (role) fetchData();
  }, [role, fetchData]);

  const addField = () => setFields(prev => [...prev, { label: "", unit: "", minValue: "", maxValue: "", isRequired: true }]);
  const removeField = (i: number) => setFields(prev => prev.filter((_, idx) => idx !== i));
  const updateField = (i: number, field: keyof NewField, value: string | boolean) => {
    setFields(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: value } : f));
  };

  const createTemplate = async () => {
    if (!form.machineTypeId || !form.title || !form.frequency || fields.some(f => !f.label)) return;
    setSaving(true);
    const res = await fetch("/api/maintenance/log-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        machineTypeId: form.machineTypeId,
        title: form.title,
        frequency: form.frequency,
        intervalDays: form.intervalDays ? Number(form.intervalDays) : undefined,
        fields: fields.map(f => ({
          label: f.label,
          unit: f.unit || undefined,
          minValue: f.minValue ? Number(f.minValue) : undefined,
          maxValue: f.maxValue ? Number(f.maxValue) : undefined,
          isRequired: f.isRequired,
        })),
      }),
    });
    if (res.ok) {
      setShowCreate(false);
      setForm({ machineTypeId: "", title: "", frequency: "daily", intervalDays: "" });
      setFields([{ label: "", unit: "", minValue: "", maxValue: "", isRequired: true }]);
      fetchData();
    }
    setSaving(false);
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this log sheet template?")) return;
    await fetch(`/api/maintenance/log-templates/${id}`, { method: "DELETE" });
    fetchData();
  };

  const signOff = async (submissionId: string) => {
    await fetch(`/api/maintenance/log-submissions/${submissionId}/signoff`, { method: "POST" });
    fetchData();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const tabs = isManager
    ? [
        { key: "templates", label: "Templates" },
        { key: "pending", label: `Pending Sign-off${pendingSignoffs.length > 0 ? ` (${pendingSignoffs.length})` : ""}` },
        { key: "history", label: "History" },
      ]
    : [
        { key: "templates", label: "Templates" },
        { key: "history", label: "My Submissions" },
      ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/maintenance"><Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button></Link>
            <h1 className="text-lg font-bold">Log Sheets</h1>
          </div>
          {isManager && tab === "templates" && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={14} className="mr-1" />New Template
            </Button>
          )}
        </div>
        <div className="max-w-4xl mx-auto px-4 flex gap-1 pb-0">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-3">
        {tab === "templates" && (
          <>
            {templates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardCheck size={40} className="mx-auto mb-3 opacity-40" />
                <p>No log sheet templates yet.</p>
                {isManager && <p className="text-sm mt-1">Create a template to get started.</p>}
              </div>
            ) : (
              templates.map(t => (
                <Card key={t.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1 cursor-pointer" onClick={() => router.push(`/maintenance/log-sheets/${t.id}`)}>
                      <p className="font-medium">{t.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {t.machineTypeName} • <span className="capitalize">{t.frequency.replace("_", " ")}</span>
                        {t.intervalDays ? ` • ${t.intervalDays}d interval` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isManager && (
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteTemplate(t.id)}>
                          <Trash2 size={16} />
                        </Button>
                      )}
                      <ChevronRight size={16} className="text-muted-foreground cursor-pointer" onClick={() => router.push(`/maintenance/log-sheets/${t.id}`)} />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}

        {tab === "pending" && isManager && (
          <>
            {pendingSignoffs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock size={40} className="mx-auto mb-3 opacity-40" />
                <p>No submissions pending sign-off.</p>
              </div>
            ) : (
              pendingSignoffs.map(s => (
                <Card key={s.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{s.templateTitle || "Log Sheet"}</p>
                      <p className="text-sm text-muted-foreground">
                        {s.machineName} • {s.submittedByName} •{" "}
                        {new Date(s.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => router.push(`/maintenance/log-sheets/submission/${s.id}`)}>
                        View
                      </Button>
                      <Button size="sm" onClick={() => signOff(s.id)}>
                        Sign Off
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}

        {tab === "history" && (
          <>
            {submissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardCheck size={40} className="mx-auto mb-3 opacity-40" />
                <p>No log sheet submissions yet.</p>
              </div>
            ) : (
              submissions.map(s => (
                <Card key={s.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{s.templateTitle || "Log Sheet"}</p>
                        {s.signedOffAt
                          ? <Badge variant="secondary" className="text-xs">Signed Off</Badge>
                          : <Badge variant="outline" className="text-xs">Pending Sign-off</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {s.machineName} • {s.submittedByName} •{" "}
                        {new Date(s.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-muted-foreground cursor-pointer"
                      onClick={() => router.push(`/maintenance/log-sheets/submission/${s.id}`)}
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
          <DialogHeader><DialogTitle>New Log Sheet Template</DialogTitle></DialogHeader>
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
                <Input className="mt-1.5" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Shift Parameter Log" />
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
                <Label>Log Fields</Label>
                <Button type="button" variant="outline" size="sm" onClick={addField}><Plus size={14} className="mr-1" />Add Field</Button>
              </div>
              <div className="space-y-2">
                {fields.map((field, i) => (
                  <div key={i} className="p-3 border border-border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Input placeholder="Field label" value={field.label} onChange={e => updateField(i, "label", e.target.value)} className="flex-1" />
                      <Input placeholder="Unit (e.g. °C)" value={field.unit} onChange={e => updateField(i, "unit", e.target.value)} className="w-28" />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeField(i)} disabled={fields.length === 1}>
                        <Trash2 size={14} className="text-muted-foreground" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Min value" type="number" value={field.minValue} onChange={e => updateField(i, "minValue", e.target.value)} />
                      <Input placeholder="Max value" type="number" value={field.maxValue} onChange={e => updateField(i, "maxValue", e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={createTemplate} disabled={saving || !form.machineTypeId || !form.title || fields.some(f => !f.label)}>
                {saving ? "Creating..." : "Create Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
