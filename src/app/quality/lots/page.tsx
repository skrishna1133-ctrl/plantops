"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Loader2, Search, ChevronRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const statusColors: Record<string, string> = {
  pending_qc: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  qc_in_progress: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  on_hold: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  shipped: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const statusLabels: Record<string, string> = {
  pending_qc: "Pending QC",
  qc_in_progress: "QC In Progress",
  approved: "Approved",
  rejected: "Rejected",
  on_hold: "On Hold",
  shipped: "Shipped",
};

interface Lot {
  id: string;
  lot_number: string;
  material_type_name?: string;
  customer_po_number?: string;
  status: string;
  input_weight_kg?: number;
  output_weight_kg?: number;
  yield_percentage?: number;
  created_at: string;
}

interface MaterialType {
  id: string;
  name: string;
}

export default function LotsPage() {
  const router = useRouter();
  const [lots, setLots] = useState<Lot[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [canCreate, setCanCreate] = useState(false);
  const [newLotOpen, setNewLotOpen] = useState(false);
  const [form, setForm] = useState({ customerPoNumber: "", materialTypeId: "", inputWeightKg: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(data => {
      if (!data.authenticated) { router.push("/login"); return; }
      setCanCreate(["quality_tech", "quality_manager", "admin", "owner"].includes(data.role));
    });

    const params = statusFilter ? `?status=${statusFilter}` : "";
    Promise.all([
      fetch(`/api/qms/lots${params}`).then(r => r.json()),
      fetch("/api/qms/material-types").then(r => r.json()),
    ]).then(([l, mt]) => {
      setLots(Array.isArray(l) ? l : []);
      setMaterialTypes(Array.isArray(mt) ? mt : []);
    }).finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = lots.filter(l =>
    l.lot_number.toLowerCase().includes(search.toLowerCase()) ||
    (l.customer_po_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (l.material_type_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    setSaving(true);
    const res = await fetch("/api/qms/lots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerPoNumber: form.customerPoNumber || undefined,
        materialTypeId: form.materialTypeId || undefined,
        inputWeightKg: form.inputWeightKg ? parseFloat(form.inputWeightKg) : undefined,
        notes: form.notes || undefined,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewLotOpen(false);
      router.push(`/quality/lots/${data.id}`);
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/quality">
            <Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="font-bold">Lot Registry</h1>
            <p className="text-xs text-muted-foreground">All production lots</p>
          </div>
          {canCreate && (
            <Button size="sm" onClick={() => setNewLotOpen(true)}>
              <Plus size={14} className="mr-1" /> New Lot
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search lots..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-input bg-background text-sm rounded-md px-3"
          >
            <option value="">All Statuses</option>
            {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package size={32} className="mx-auto mb-3 opacity-40" />
            <p>No lots found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(lot => (
              <Link key={lot.id} href={`/quality/lots/${lot.id}`}>
                <Card className="hover:border-border/80 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono font-semibold">{lot.lot_number}</span>
                        <Badge className={`text-xs border ${statusColors[lot.status] || ""}`}>
                          {statusLabels[lot.status] || lot.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-3">
                        {lot.material_type_name && <span>{lot.material_type_name}</span>}
                        {lot.customer_po_number && <span>PO: {lot.customer_po_number}</span>}
                        {lot.yield_percentage != null && (
                          <span className="text-green-400">Yield: {lot.yield_percentage.toFixed(1)}%</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {lot.input_weight_kg != null && <div>{lot.input_weight_kg.toLocaleString()} kg input</div>}
                      <div>{new Date(lot.created_at).toLocaleDateString()}</div>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* New Lot Dialog */}
      <Dialog open={newLotOpen} onOpenChange={setNewLotOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Lot</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Customer PO Number</Label>
              <Input value={form.customerPoNumber} onChange={e => setForm(f => ({ ...f, customerPoNumber: e.target.value }))} placeholder="PO-12345" />
            </div>
            <div>
              <Label>Material Type</Label>
              <select
                value={form.materialTypeId}
                onChange={e => setForm(f => ({ ...f, materialTypeId: e.target.value }))}
                className="w-full border border-input bg-background text-sm rounded-md px-3 py-2"
              >
                <option value="">Select material type...</option>
                {materialTypes.map(mt => <option key={mt.id} value={mt.id}>{mt.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Input Weight (kg)</Label>
              <Input type="number" value={form.inputWeightKg} onChange={e => setForm(f => ({ ...f, inputWeightKg: e.target.value }))} placeholder="0.0" />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewLotOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Create Lot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
