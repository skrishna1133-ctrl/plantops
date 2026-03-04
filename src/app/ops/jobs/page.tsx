"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Plus, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Job {
  id: string; job_number: string; job_type: string; status: string;
  customer_name?: string; vendor_name?: string; material_type_name?: string;
  customer_po_number?: string; our_po_number?: string;
  target_weight?: number; target_weight_unit?: string;
  created_at: string;
}
interface Customer { id: string; name: string }
interface Vendor { id: string; name: string }
interface MaterialType { id: string; name: string }

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-600 border-blue-200",
  in_progress: "bg-amber-500/10 text-amber-600 border-amber-200",
  on_hold: "bg-orange-500/10 text-orange-600 border-orange-200",
  completed: "bg-green-500/10 text-green-600 border-green-200",
  cancelled: "bg-red-500/10 text-red-400 border-red-200",
};

const WEIGHT_UNITS = ["lbs", "kg", "tons"];

function JobsPageContent() {
  const router = useRouter();
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  const [newJobOpen, setNewJobOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    jobType: "toll",
    customerId: "", vendorId: "", customerPoNumber: "", ourPoNumber: "",
    materialTypeId: "", description: "", notes: "",
    targetWeight: "", targetWeightUnit: "lbs",
    expectedStartDate: "", expectedEndDate: "",
  });

  const canManage = ["owner", "admin", "engineer"].includes(role);

  const refresh = async () => {
    const [j, c, v, mt] = await Promise.all([
      fetch("/api/ops/jobs").then(r => r.json()).catch(() => []),
      fetch("/api/ops/customers").then(r => r.json()).catch(() => []),
      fetch("/api/ops/vendors").then(r => r.json()).catch(() => []),
      fetch("/api/qms/material-types").then(r => r.json()).catch(() => []),
    ]);
    setJobs(Array.isArray(j) ? j : []);
    setCustomers(Array.isArray(c) ? c : []);
    setVendors(Array.isArray(v) ? v : []);
    setMaterialTypes(Array.isArray(mt) ? mt : []);
  };

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(data => {
      if (!data.authenticated) { router.push("/login"); return; }
      setRole(data.role);
      refresh().finally(() => setLoading(false));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = jobs.filter(j => {
    if (filterStatus && j.status !== filterStatus) return false;
    if (filterType && j.job_type !== filterType) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        j.job_number.toLowerCase().includes(s) ||
        (j.customer_name ?? "").toLowerCase().includes(s) ||
        (j.vendor_name ?? "").toLowerCase().includes(s) ||
        (j.customer_po_number ?? "").toLowerCase().includes(s) ||
        (j.our_po_number ?? "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  const handleCreate = async () => {
    setSaving(true);
    try {
      const body: Record<string, string | number | undefined> = {
        jobType: form.jobType,
        customerId: form.customerId || undefined,
        vendorId: form.vendorId || undefined,
        customerPoNumber: form.customerPoNumber || undefined,
        ourPoNumber: form.ourPoNumber || undefined,
        materialTypeId: form.materialTypeId || undefined,
        description: form.description || undefined,
        notes: form.notes || undefined,
        targetWeightUnit: form.targetWeightUnit,
        expectedStartDate: form.expectedStartDate || undefined,
        expectedEndDate: form.expectedEndDate || undefined,
      };
      if (form.targetWeight) body.targetWeight = parseFloat(form.targetWeight);

      const res = await fetch("/api/ops/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        const data = await res.json();
        setNewJobOpen(false);
        router.push(`/ops/jobs/${data.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" size={28} /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/ops"><Button variant="ghost" size="sm"><ArrowLeft size={16} className="mr-1" />Operations</Button></Link>
          <h1 className="text-lg font-semibold flex-1">Jobs</h1>
          {canManage && (
            <Button size="sm" onClick={() => setNewJobOpen(true)}><Plus size={14} className="mr-1" />New Job</Button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8 h-9 text-sm" placeholder="Search jobs…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="border border-input rounded-md px-3 py-1.5 text-sm bg-background h-9" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {["open", "in_progress", "on_hold", "completed", "cancelled"].map(s => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
          <select className="border border-input rounded-md px-3 py-1.5 text-sm bg-background h-9" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            <option value="toll">Toll</option>
            <option value="purchase">Purchase</option>
          </select>
        </div>

        {/* Jobs List */}
        {filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No jobs found.{canManage && " Create the first one."}</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(job => (
              <Link key={job.id} href={`/ops/jobs/${job.id}`}>
                <Card className="cursor-pointer hover:bg-muted/30 transition-colors">
                  <CardContent className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{job.job_number}</span>
                        <Badge variant="outline" className="text-xs capitalize">{job.job_type}</Badge>
                        <Badge className={`text-xs border ${STATUS_COLORS[job.status] ?? ""}`} variant="outline">
                          {job.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {(job.customer_name || job.vendor_name) && (
                          <span className="text-xs text-muted-foreground">{job.customer_name ?? job.vendor_name}</span>
                        )}
                        {job.material_type_name && (
                          <span className="text-xs text-muted-foreground">{job.material_type_name}</span>
                        )}
                        {job.customer_po_number && (
                          <span className="text-xs text-muted-foreground">PO: {job.customer_po_number}</span>
                        )}
                        {job.target_weight != null && (
                          <span className="text-xs text-muted-foreground">
                            Target: {Number(job.target_weight).toLocaleString()} {job.target_weight_unit}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                      {new Date(job.created_at).toLocaleDateString()}
                    </div>
                    <ChevronRight size={15} className="text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* New Job Dialog */}
      <Dialog open={newJobOpen} onOpenChange={setNewJobOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create New Job</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {/* Job Type */}
            <div className="space-y-1">
              <Label>Job Type *</Label>
              <div className="flex gap-2">
                {["toll", "purchase"].map(t => (
                  <Button key={t} variant={form.jobType === t ? "default" : "outline"} size="sm"
                    onClick={() => setForm(p => ({ ...p, jobType: t }))}>
                    <span className="capitalize">{t}</span>
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {form.jobType === "toll" ? "Customer provides material, pays for processing." : "Facility buys and processes material."}
              </p>
            </div>

            {/* Customer / Vendor */}
            {form.jobType === "toll" && (
              <div className="space-y-1">
                <Label>Customer</Label>
                <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  value={form.customerId} onChange={e => setForm(p => ({ ...p, customerId: e.target.value }))}>
                  <option value="">-- Select Customer --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {form.jobType === "purchase" && (
              <div className="space-y-1">
                <Label>Vendor / Supplier</Label>
                <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  value={form.vendorId} onChange={e => setForm(p => ({ ...p, vendorId: e.target.value }))}>
                  <option value="">-- Select Vendor --</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <Label>Material Type</Label>
              <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={form.materialTypeId} onChange={e => setForm(p => ({ ...p, materialTypeId: e.target.value }))}>
                <option value="">-- Select Material --</option>
                {materialTypes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Customer PO #</Label>
                <Input value={form.customerPoNumber} onChange={e => setForm(p => ({ ...p, customerPoNumber: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Our PO #</Label>
                <Input value={form.ourPoNumber} onChange={e => setForm(p => ({ ...p, ourPoNumber: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="col-span-2 space-y-1">
                <Label>Target Weight</Label>
                <Input type="number" step="0.01" value={form.targetWeight} onChange={e => setForm(p => ({ ...p, targetWeight: e.target.value }))} placeholder="e.g. 10000" />
              </div>
              <div className="space-y-1">
                <Label>Unit</Label>
                <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  value={form.targetWeightUnit} onChange={e => setForm(p => ({ ...p, targetWeightUnit: e.target.value }))}>
                  {WEIGHT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Expected Start</Label>
                <Input type="date" value={form.expectedStartDate} onChange={e => setForm(p => ({ ...p, expectedStartDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Expected End</Label>
                <Input type="date" value={form.expectedEndDate} onChange={e => setForm(p => ({ ...p, expectedEndDate: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewJobOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Create Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <JobsPageContent />
    </Suspense>
  );
}
