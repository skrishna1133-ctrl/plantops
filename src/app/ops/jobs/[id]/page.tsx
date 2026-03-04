"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Plus, Truck, Package, Factory, ChevronRight,
  Pencil, Check, X, Scale
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Job {
  id: string; job_number: string; job_type: string; status: string;
  customer_name?: string; vendor_name?: string; material_type_name?: string;
  customer_id?: string; vendor_id?: string; material_type_id?: string;
  customer_po_number?: string; our_po_number?: string;
  target_weight?: number; target_weight_unit?: string;
  description?: string; notes?: string;
  expected_start_date?: string; expected_end_date?: string;
  actual_start_date?: string; actual_end_date?: string;
  created_at: string; updated_at: string;
  statusHistory?: Array<{ to_status: string; changed_by_name?: string; changed_at: string; notes?: string }>;
}

interface InboundShipment {
  id: string; shipment_number: string; status: string;
  vendor_name?: string; carrier_name?: string; carrier_name_resolved?: string;
  driver_name?: string; truck_number?: string;
  scheduled_date?: string; received_date?: string;
  total_weight?: number; weight_unit?: string; entry_count?: number;
  location_name?: string;
}

interface WeightEntry {
  id: string; entry_number: number; gross_weight: number;
  tare_weight?: number; net_weight?: number; weight_unit: string;
  container_label?: string; notes?: string; entered_by_name?: string; entered_at: string;
}

interface Lot {
  id: string; lot_number: string; status: string; material_type_name?: string;
  inbound_weight?: number; inbound_weight_unit?: string; location_name?: string;
  created_at: string;
}

interface Carrier { id: string; name: string }
interface Vendor { id: string; name: string }
interface Location { id: string; name: string }
interface MaterialType { id: string; name: string }

const WEIGHT_UNITS = ["lbs", "kg", "tons"];

const LOT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-500/10 text-slate-500",
  in_storage: "bg-blue-500/10 text-blue-500",
  in_production: "bg-amber-500/10 text-amber-600",
  qc_hold: "bg-orange-500/10 text-orange-600",
  approved: "bg-green-500/10 text-green-600",
  shipped: "bg-teal-500/10 text-teal-600",
  rejected: "bg-red-500/10 text-red-500",
};

const SHIP_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-600",
  received: "bg-green-500/10 text-green-600",
  partial: "bg-amber-500/10 text-amber-600",
  cancelled: "bg-red-500/10 text-red-400",
};

const JOB_STATUSES = ["open", "in_progress", "on_hold", "completed", "cancelled"];

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [inboundShipments, setInboundShipments] = useState<InboundShipment[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);

  // Master lists
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);

  // Dialogs
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newShipmentOpen, setNewShipmentOpen] = useState(false);
  const [shipmentDetailOpen, setShipmentDetailOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<InboundShipment | null>(null);
  const [shipmentWeights, setShipmentWeights] = useState<WeightEntry[]>([]);
  const [newLotOpen, setNewLotOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");

  const [shipForm, setShipForm] = useState({
    vendorId: "", carrierId: "", carrierName: "", driverName: "",
    truckNumber: "", trailerNumber: "", scheduledDate: "", locationId: "", notes: "",
  });

  const [weightForm, setWeightForm] = useState({
    grossWeight: "", tareWeight: "", weightUnit: "lbs", containerLabel: "", notes: "",
  });

  const [lotForm, setLotForm] = useState({
    materialTypeId: "", inboundWeight: "", inboundWeightUnit: "lbs", locationId: "", notes: "",
  });

  const canManage = ["owner", "admin", "engineer"].includes(role);
  const canReceive = ["owner", "admin", "engineer", "receiving", "shipping"].includes(role);

  const refresh = async () => {
    const [j, ib, l, c, v, loc, mt] = await Promise.all([
      fetch(`/api/ops/jobs/${id}`).then(r => r.json()).catch(() => null),
      fetch(`/api/ops/inbound-shipments?jobId=${id}`).then(r => r.json()).catch(() => []),
      fetch(`/api/ops/lots?jobId=${id}`).then(r => r.json()).catch(() => []),
      fetch("/api/ops/carriers").then(r => r.json()).catch(() => []),
      fetch("/api/ops/vendors").then(r => r.json()).catch(() => []),
      fetch("/api/ops/locations").then(r => r.json()).catch(() => []),
      fetch("/api/qms/material-types").then(r => r.json()).catch(() => []),
    ]);
    setJob(j);
    setInboundShipments(Array.isArray(ib) ? ib : []);
    setLots(Array.isArray(l) ? l : []);
    setCarriers(Array.isArray(c) ? c : []);
    setVendors(Array.isArray(v) ? v : []);
    setLocations(Array.isArray(loc) ? loc : []);
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

  const handleStatusChange = async () => {
    setSaving(true);
    await fetch(`/api/ops/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, statusNotes: statusNote }),
    });
    setStatusDialogOpen(false);
    setStatusNote("");
    await refresh();
    setSaving(false);
  };

  const handleCreateShipment = async () => {
    setSaving(true);
    const body = { jobId: id, ...shipForm, vendorId: shipForm.vendorId || undefined, carrierId: shipForm.carrierId || undefined, locationId: shipForm.locationId || undefined };
    const res = await fetch("/api/ops/inbound-shipments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setNewShipmentOpen(false); await refresh(); }
    setSaving(false);
  };

  const openShipmentDetail = async (shp: InboundShipment) => {
    setSelectedShipment(shp);
    const entries = await fetch(`/api/ops/inbound-shipments/${shp.id}`).then(r => r.json()).catch(() => ({ weightEntries: [] }));
    setShipmentWeights(entries.weightEntries ?? []);
    setWeightForm({ grossWeight: "", tareWeight: "", weightUnit: "lbs", containerLabel: "", notes: "" });
    setShipmentDetailOpen(true);
  };

  const handleAddWeight = async () => {
    if (!selectedShipment) return;
    setSaving(true);
    await fetch(`/api/ops/inbound-shipments/${selectedShipment.id}/weights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grossWeight: parseFloat(weightForm.grossWeight),
        tareWeight: weightForm.tareWeight ? parseFloat(weightForm.tareWeight) : undefined,
        weightUnit: weightForm.weightUnit,
        containerLabel: weightForm.containerLabel || undefined,
        notes: weightForm.notes || undefined,
      }),
    });
    // Refresh weight list
    const entries = await fetch(`/api/ops/inbound-shipments/${selectedShipment.id}`).then(r => r.json()).catch(() => ({ weightEntries: [] }));
    setShipmentWeights(entries.weightEntries ?? []);
    setWeightForm({ grossWeight: "", tareWeight: "", weightUnit: "lbs", containerLabel: "", notes: "" });
    await refresh();
    setSaving(false);
  };

  const handleMarkReceived = async () => {
    if (!selectedShipment) return;
    await fetch(`/api/ops/inbound-shipments/${selectedShipment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "received", receivedDate: new Date().toISOString() }),
    });
    setShipmentDetailOpen(false);
    await refresh();
  };

  const handleCreateLot = async () => {
    setSaving(true);
    const body = {
      jobId: id,
      materialTypeId: lotForm.materialTypeId || undefined,
      inboundWeight: lotForm.inboundWeight ? parseFloat(lotForm.inboundWeight) : undefined,
      inboundWeightUnit: lotForm.inboundWeightUnit,
      locationId: lotForm.locationId || undefined,
      notes: lotForm.notes || undefined,
    };
    const res = await fetch("/api/ops/lots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setNewLotOpen(false); await refresh(); }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" size={28} /></div>;
  if (!job) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Job not found.</div>;

  const totalInboundWeight = inboundShipments.reduce((sum, s) => sum + (s.total_weight ?? 0), 0);
  const weightUnit = inboundShipments.find(s => s.weight_unit)?.weight_unit ?? "lbs";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/ops/jobs"><Button variant="ghost" size="sm"><ArrowLeft size={16} className="mr-1" />Jobs</Button></Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold">{job.job_number}</h1>
              <Badge variant="outline" className="text-xs capitalize">{job.job_type}</Badge>
              <Badge variant="outline" className="text-xs border capitalize" style={{ background: "transparent" }}>
                {job.status.replace("_", " ")}
              </Badge>
            </div>
          </div>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => { setNewStatus(job.status); setStatusDialogOpen(true); }}>
              <Pencil size={13} className="mr-1" />Status
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-5">
        {/* Job Info Card */}
        <Card>
          <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Customer / Vendor</p>
              <p className="font-medium">{job.customer_name ?? job.vendor_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Material</p>
              <p className="font-medium">{job.material_type_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Customer PO</p>
              <p className="font-medium">{job.customer_po_number ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Our PO</p>
              <p className="font-medium">{job.our_po_number ?? "—"}</p>
            </div>
            {job.target_weight != null && (
              <div>
                <p className="text-xs text-muted-foreground">Target Weight</p>
                <p className="font-medium">{Number(job.target_weight).toLocaleString()} {job.target_weight_unit}</p>
              </div>
            )}
            {job.expected_start_date && (
              <div>
                <p className="text-xs text-muted-foreground">Expected Start</p>
                <p className="font-medium">{new Date(job.expected_start_date).toLocaleDateString()}</p>
              </div>
            )}
            {job.description && (
              <div className="col-span-2 md:col-span-4">
                <p className="text-xs text-muted-foreground">Description</p>
                <p>{job.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-500">{inboundShipments.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Inbound Shipments</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-500">
              {totalInboundWeight > 0 ? `${Number(totalInboundWeight.toFixed(1)).toLocaleString()}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Received ({weightUnit})</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-purple-500">{lots.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Lots</p>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="inbound">
          <TabsList>
            <TabsTrigger value="inbound">Inbound ({inboundShipments.length})</TabsTrigger>
            <TabsTrigger value="lots">Lots ({lots.length})</TabsTrigger>
          </TabsList>

          {/* Inbound Shipments Tab */}
          <TabsContent value="inbound" className="space-y-3 mt-3">
            {canReceive && (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => { setShipForm({ vendorId: "", carrierId: "", carrierName: "", driverName: "", truckNumber: "", trailerNumber: "", scheduledDate: "", locationId: "", notes: "" }); setNewShipmentOpen(true); }}>
                  <Plus size={14} className="mr-1" />Add Inbound Shipment
                </Button>
              </div>
            )}
            {inboundShipments.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No inbound shipments yet.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {inboundShipments.map(shp => (
                  <Card key={shp.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => openShipmentDetail(shp)}>
                    <CardContent className="px-4 py-3 flex items-center gap-3">
                      <Truck size={16} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{shp.shipment_number}</span>
                          <Badge className={`text-xs ${SHIP_STATUS_COLORS[shp.status] ?? ""}`} variant="outline">{shp.status}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                          {shp.carrier_name_resolved && <span>{shp.carrier_name_resolved}</span>}
                          {shp.driver_name && <span>Driver: {shp.driver_name}</span>}
                          {shp.truck_number && <span>Truck: {shp.truck_number}</span>}
                          {shp.total_weight != null && <span className="font-medium text-foreground">{Number(shp.total_weight).toLocaleString()} {shp.weight_unit} ({shp.entry_count} entries)</span>}
                          {shp.received_date && <span>Received: {new Date(shp.received_date).toLocaleDateString()}</span>}
                          {!shp.received_date && shp.scheduled_date && <span>Scheduled: {new Date(shp.scheduled_date).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Lots Tab */}
          <TabsContent value="lots" className="space-y-3 mt-3">
            {canManage && (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => { setLotForm({ materialTypeId: job.material_type_id ?? "", inboundWeight: "", inboundWeightUnit: "lbs", locationId: "", notes: "" }); setNewLotOpen(true); }}>
                  <Plus size={14} className="mr-1" />Create Lot
                </Button>
              </div>
            )}
            {lots.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No lots yet.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {lots.map(lot => (
                  <Card key={lot.id}>
                    <CardContent className="px-4 py-3 flex items-center gap-3">
                      <Package size={16} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{lot.lot_number}</span>
                          <Badge className={`text-xs ${LOT_STATUS_COLORS[lot.status] ?? ""}`} variant="outline">{lot.status.replace("_", " ")}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                          {lot.material_type_name && <span>{lot.material_type_name}</span>}
                          {lot.inbound_weight != null && <span>{Number(lot.inbound_weight).toLocaleString()} {lot.inbound_weight_unit}</span>}
                          {lot.location_name && <span>Location: {lot.location_name}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{new Date(lot.created_at).toLocaleDateString()}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Job Status</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex flex-wrap gap-2">
              {JOB_STATUSES.map(s => (
                <Button key={s} size="sm" variant={newStatus === s ? "default" : "outline"}
                  onClick={() => setNewStatus(s)}>
                  <span className="capitalize">{s.replace("_", " ")}</span>
                </Button>
              ))}
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea value={statusNote} onChange={e => setStatusNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleStatusChange} disabled={saving || newStatus === job.status}>
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Inbound Shipment Dialog */}
      <Dialog open={newShipmentOpen} onOpenChange={setNewShipmentOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Inbound Shipment</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Vendor</Label>
                <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  value={shipForm.vendorId} onChange={e => setShipForm(p => ({ ...p, vendorId: e.target.value }))}>
                  <option value="">-- Select --</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Carrier</Label>
                <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  value={shipForm.carrierId} onChange={e => setShipForm(p => ({ ...p, carrierId: e.target.value }))}>
                  <option value="">-- Select --</option>
                  {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Driver Name</Label>
                <Input value={shipForm.driverName} onChange={e => setShipForm(p => ({ ...p, driverName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Truck #</Label>
                <Input value={shipForm.truckNumber} onChange={e => setShipForm(p => ({ ...p, truckNumber: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Scheduled Date</Label>
                <Input type="date" value={shipForm.scheduledDate} onChange={e => setShipForm(p => ({ ...p, scheduledDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Storage Location</Label>
                <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  value={shipForm.locationId} onChange={e => setShipForm(p => ({ ...p, locationId: e.target.value }))}>
                  <option value="">-- Select --</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={shipForm.notes} onChange={e => setShipForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewShipmentOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateShipment} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shipment Detail + Weight Entry Dialog */}
      <Dialog open={shipmentDetailOpen} onOpenChange={setShipmentDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedShipment?.shipment_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Weight Entries */}
            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5"><Scale size={14} />Weight Entries</h3>
              {shipmentWeights.length === 0 ? (
                <p className="text-xs text-muted-foreground">No weight entries yet.</p>
              ) : (
                <div className="space-y-1 mb-3">
                  <div className="grid grid-cols-4 gap-1 text-xs text-muted-foreground font-medium px-1 mb-1">
                    <span>#</span><span>Gross</span><span>Tare</span><span>Net</span>
                  </div>
                  {shipmentWeights.map(we => (
                    <div key={we.id} className="grid grid-cols-4 gap-1 text-xs bg-muted/30 rounded px-2 py-1.5">
                      <span>{we.entry_number}</span>
                      <span>{Number(we.gross_weight).toLocaleString()} {we.weight_unit}</span>
                      <span>{we.tare_weight != null ? `${Number(we.tare_weight).toLocaleString()} ${we.weight_unit}` : "—"}</span>
                      <span className="font-medium">{we.net_weight != null ? `${Number(we.net_weight).toLocaleString()} ${we.weight_unit}` : "—"}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-4 gap-1 text-xs font-semibold px-2 py-1 border-t">
                    <span>Total</span>
                    <span>{shipmentWeights.reduce((s, e) => s + e.gross_weight, 0).toLocaleString()}</span>
                    <span>{shipmentWeights.some(e => e.tare_weight) ? shipmentWeights.reduce((s, e) => s + (e.tare_weight ?? 0), 0).toLocaleString() : "—"}</span>
                    <span>{shipmentWeights.some(e => e.net_weight) ? shipmentWeights.reduce((s, e) => s + (e.net_weight ?? e.gross_weight), 0).toLocaleString() : "—"}</span>
                  </div>
                </div>
              )}

              {/* Add Weight Entry */}
              {canReceive && selectedShipment?.status !== "received" && (
                <div className="border rounded-md p-3 space-y-2 bg-muted/20">
                  <p className="text-xs font-medium">Add Weight Entry</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-0.5">
                      <Label className="text-xs">Gross Weight *</Label>
                      <Input className="h-8 text-sm" type="number" step="0.01" value={weightForm.grossWeight} onChange={e => setWeightForm(p => ({ ...p, grossWeight: e.target.value }))} />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-xs">Tare Weight</Label>
                      <Input className="h-8 text-sm" type="number" step="0.01" value={weightForm.tareWeight} onChange={e => setWeightForm(p => ({ ...p, tareWeight: e.target.value }))} />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-xs">Unit</Label>
                      <select className="w-full border border-input rounded-md px-2 py-1 text-sm bg-background h-8"
                        value={weightForm.weightUnit} onChange={e => setWeightForm(p => ({ ...p, weightUnit: e.target.value }))}>
                        {WEIGHT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <Label className="text-xs">Label (optional)</Label>
                      <Input className="h-8 text-sm" value={weightForm.containerLabel} onChange={e => setWeightForm(p => ({ ...p, containerLabel: e.target.value }))} placeholder="e.g. Gaylord #3" />
                    </div>
                    <div className="flex items-end">
                      <Button size="sm" className="w-full" onClick={handleAddWeight} disabled={saving || !weightForm.grossWeight}>
                        {saving ? <Loader2 size={13} className="animate-spin mr-1" /> : <Plus size={13} className="mr-1" />}
                        Add Entry
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mark Received */}
            {canReceive && selectedShipment?.status !== "received" && (
              <Button className="w-full" variant="outline" onClick={handleMarkReceived}>
                <Check size={14} className="mr-1.5 text-green-500" />Mark as Received
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipmentDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Lot Dialog */}
      <Dialog open={newLotOpen} onOpenChange={setNewLotOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Lot</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Material Type</Label>
              <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={lotForm.materialTypeId} onChange={e => setLotForm(p => ({ ...p, materialTypeId: e.target.value }))}>
                <option value="">-- Select --</option>
                {materialTypes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="col-span-2 space-y-1">
                <Label>Inbound Weight</Label>
                <Input type="number" step="0.01" value={lotForm.inboundWeight} onChange={e => setLotForm(p => ({ ...p, inboundWeight: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Unit</Label>
                <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  value={lotForm.inboundWeightUnit} onChange={e => setLotForm(p => ({ ...p, inboundWeightUnit: e.target.value }))}>
                  {WEIGHT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Storage Location</Label>
              <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={lotForm.locationId} onChange={e => setLotForm(p => ({ ...p, locationId: e.target.value }))}>
                <option value="">-- Select --</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={lotForm.notes} onChange={e => setLotForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewLotOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateLot} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}Create Lot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
