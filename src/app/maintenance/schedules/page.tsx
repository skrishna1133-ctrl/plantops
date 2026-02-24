"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, CalendarClock, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MachineType { id: string; name: string; }
interface ChecklistTemplate { id: string; title: string; machineTypeId: string; }
interface LogTemplate { id: string; title: string; machineTypeId: string; }
interface User { id: string; fullName: string; role: string; }
interface Schedule {
  id: string; name: string; machineTypeName?: string; frequency: string;
  intervalDays: number | null; intervalHours: number | null; intervalCycles: number | null;
  warningDaysBeforeDue: number; assignedTechId: string | null;
  isActive: boolean; nextDueAt: string | null; lastTriggeredAt: string | null;
  checklistTemplateId: string | null; logSheetTemplateId: string | null;
}

const FREQUENCIES = ["daily", "weekly", "monthly", "per_shift", "per_cycle", "as_needed"];

export default function SchedulesPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [machineTypes, setMachineTypes] = useState<MachineType[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [logTemplates, setLogTemplates] = useState<LogTemplate[]>([]);
  const [techs, setTechs] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [runningCron, setRunningCron] = useState(false);
  const [form, setForm] = useState({
    machineTypeId: "", name: "", frequency: "monthly",
    intervalDays: "", intervalHours: "", intervalCycles: "",
    warningDaysBeforeDue: "3", checklistTemplateId: "",
    logSheetTemplateId: "", assignedTechId: "", nextDueAt: "",
  });
  const [saving, setSaving] = useState(false);

  const isManager = ["maintenance_manager", "engineer", "admin", "owner"].includes(role);

  const fetchData = useCallback(async () => {
    const [sRes, mtRes, ctRes, ltRes] = await Promise.all([
      fetch("/api/maintenance/schedules"),
      fetch("/api/maintenance/machine-types"),
      fetch("/api/maintenance/checklist-templates"),
      fetch("/api/maintenance/log-templates"),
    ]);
    if (sRes.ok) setSchedules(await sRes.json());
    if (mtRes.ok) setMachineTypes(await mtRes.json());
    if (ctRes.ok) setChecklistTemplates(await ctRes.json());
    if (ltRes.ok) setLogTemplates(await ltRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch("/api/auth").then(r => r.ok ? r.json() : null).then(async d => {
      if (!d?.authenticated) { router.push("/login"); return; }
      setRole(d.role);
      // Fetch all users to find techs
      const usersRes = await fetch("/api/users");
      if (usersRes.ok) {
        const users: User[] = await usersRes.json();
        setTechs(users.filter(u => u.role === "maintenance_tech"));
      }
      fetchData();
    });
  }, [router, fetchData]);

  const toggleActive = async (id: string, isActive: boolean) => {
    await fetch(`/api/maintenance/schedules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    fetchData();
  };

  const createSchedule = async () => {
    if (!form.machineTypeId || !form.name || !form.frequency) return;
    setSaving(true);
    const res = await fetch("/api/maintenance/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        machineTypeId: form.machineTypeId,
        name: form.name,
        frequency: form.frequency,
        intervalDays: form.intervalDays ? Number(form.intervalDays) : undefined,
        intervalHours: form.intervalHours ? Number(form.intervalHours) : undefined,
        intervalCycles: form.intervalCycles ? Number(form.intervalCycles) : undefined,
        warningDaysBeforeDue: Number(form.warningDaysBeforeDue) || 3,
        checklistTemplateId: form.checklistTemplateId || undefined,
        logSheetTemplateId: form.logSheetTemplateId || undefined,
        assignedTechId: form.assignedTechId || undefined,
        nextDueAt: form.nextDueAt || undefined,
      }),
    });
    if (res.ok) {
      setShowCreate(false);
      setForm({ machineTypeId: "", name: "", frequency: "monthly", intervalDays: "", intervalHours: "", intervalCycles: "", warningDaysBeforeDue: "3", checklistTemplateId: "", logSheetTemplateId: "", assignedTechId: "", nextDueAt: "" });
      fetchData();
    }
    setSaving(false);
  };

  const runCronCheck = async () => {
    setRunningCron(true);
    const res = await fetch("/api/maintenance/cron/check-schedules", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      alert(`Schedule check complete. Checked: ${data.checked}, Notified: ${data.notified}`);
    }
    setRunningCron(false);
  };

  const getDueStatus = (s: Schedule): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } => {
    if (!s.isActive) return { label: "Inactive", variant: "outline" };
    if (!s.nextDueAt) return { label: "No due date", variant: "secondary" };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(s.nextDueAt);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((due.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return { label: "Overdue", variant: "destructive" };
    if (diffDays === 0) return { label: "Due Today", variant: "destructive" };
    if (diffDays <= s.warningDaysBeforeDue) return { label: `Due in ${diffDays}d`, variant: "default" };
    return { label: `Due ${due.toLocaleDateString()}`, variant: "secondary" };
  };

  // Filter checklist and log templates by selected machine type
  const filteredChecklists = form.machineTypeId
    ? checklistTemplates.filter(ct => ct.machineTypeId === form.machineTypeId)
    : checklistTemplates;
  const filteredLogTemplates = form.machineTypeId
    ? logTemplates.filter(lt => lt.machineTypeId === form.machineTypeId)
    : logTemplates;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/maintenance"><Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button></Link>
            <h1 className="text-lg font-bold">PM Schedules</h1>
          </div>
          {isManager && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={runCronCheck} disabled={runningCron}>
                <RefreshCw size={14} className={`mr-1 ${runningCron ? "animate-spin" : ""}`} />
                Check Due
              </Button>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus size={14} className="mr-1" />New Schedule
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-3">
        {schedules.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarClock size={40} className="mx-auto mb-3 opacity-40" />
            <p>No PM schedules configured yet.</p>
            {isManager && <p className="text-sm mt-1">Create a schedule to start tracking preventive maintenance.</p>}
          </div>
        ) : (
          schedules.map(s => {
            const status = getDueStatus(s);
            return (
              <Card key={s.id} className={`${!s.isActive ? "opacity-60" : ""}`}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{s.name}</p>
                      <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {s.machineTypeName} •{" "}
                      <span className="capitalize">{s.frequency.replace("_", " ")}</span>
                      {s.intervalDays ? ` • every ${s.intervalDays}d` : ""}
                      {s.intervalHours ? ` • every ${s.intervalHours}h` : ""}
                      {s.intervalCycles ? ` • every ${s.intervalCycles} cycles` : ""}
                      {s.warningDaysBeforeDue > 0 ? ` • warn ${s.warningDaysBeforeDue}d before` : ""}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {s.checklistTemplateId && <span>+ Checklist</span>}
                      {s.logSheetTemplateId && <span>+ Log Sheet</span>}
                      {s.lastTriggeredAt && <span>Last run: {new Date(s.lastTriggeredAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  {isManager && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleActive(s.id, s.isActive)}
                      title={s.isActive ? "Deactivate" : "Activate"}
                    >
                      {s.isActive
                        ? <ToggleRight size={20} className="text-primary" />
                        : <ToggleLeft size={20} className="text-muted-foreground" />}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </main>

      {/* Create Schedule Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New PM Schedule</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Machine Type</Label>
                <Select value={form.machineTypeId} onValueChange={v => setForm(f => ({ ...f, machineTypeId: v, checklistTemplateId: "", logSheetTemplateId: "" }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select type..." /></SelectTrigger>
                  <SelectContent>{machineTypes.map(mt => <SelectItem key={mt.id} value={mt.id}>{mt.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Schedule Name</Label>
                <Input className="mt-1.5" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Monthly Lubrication" />
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
                <Label>Next Due Date</Label>
                <Input className="mt-1.5" type="date" value={form.nextDueAt} onChange={e => setForm(f => ({ ...f, nextDueAt: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Interval (days)</Label>
                <Input className="mt-1" type="number" value={form.intervalDays} onChange={e => setForm(f => ({ ...f, intervalDays: e.target.value }))} placeholder="Optional" />
              </div>
              <div>
                <Label className="text-xs">Interval (hours)</Label>
                <Input className="mt-1" type="number" value={form.intervalHours} onChange={e => setForm(f => ({ ...f, intervalHours: e.target.value }))} placeholder="Optional" />
              </div>
              <div>
                <Label className="text-xs">Warning (days before)</Label>
                <Input className="mt-1" type="number" value={form.warningDaysBeforeDue} onChange={e => setForm(f => ({ ...f, warningDaysBeforeDue: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Checklist Template</Label>
                <Select value={form.checklistTemplateId} onValueChange={v => setForm(f => ({ ...f, checklistTemplateId: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {filteredChecklists.map(ct => <SelectItem key={ct.id} value={ct.id}>{ct.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Log Sheet Template</Label>
                <Select value={form.logSheetTemplateId} onValueChange={v => setForm(f => ({ ...f, logSheetTemplateId: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {filteredLogTemplates.map(lt => <SelectItem key={lt.id} value={lt.id}>{lt.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Assigned Technician</Label>
              <Select value={form.assignedTechId} onValueChange={v => setForm(f => ({ ...f, assignedTechId: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {techs.map(t => <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={createSchedule} disabled={saving || !form.machineTypeId || !form.name}>
                {saving ? "Creating..." : "Create Schedule"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
