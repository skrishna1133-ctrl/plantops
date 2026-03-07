"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Plus, Truck, Package, Factory, ChevronRight,
  Pencil, Check, Scale, ArrowUpFromLine, Play, Square, TrendingUp, ExternalLink, FlaskConical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Job {
  id: string; job_number: string; job_type: string; status: string;
  customer_name?: string; vendor_name?: string; material_type_name?: string;
  customer_id?: string; vendor_id?: string; material_type_id?: string;
  customer_po_number?: string; our_po_number?: string;
  target_weight?: number; target_weight_unit?: string;
  description?: string; notes?: string;
  expected_start_date?: string; expected_end_date?: string;
  created_at: string; updated_at: string;
}

interface InboundShipment {
  id: string; shipment_number: string; status: string;
  carrier_name_resolved?: string; driver_name?: string; truck_number?: string;
  scheduled_date?: string; received_date?: string;
  total_weight?: number; weight_unit?: string; entry_count?: number;
}

interface WeightEntry {
  id: string; entry_number: number; gross_weight: number;
  tare_weight?: number; net_weight?: number; weight_unit: string;
  container_label?: string;
}

interface Lot {
  id: string; lot_number: string; status: string; material_type_name?: string;
  inbound_weight?: number; inbound_weight_unit?: string; location_name?: string;
  qms_lot_id?: string; qms_lot_status?: string; qms_lot_number?: string;
  created_at: string;
}

interface ProductionRun {
  id: string; run_number: string; status: string;
  production_line_id?: string; processing_type_name?: string;
  operator_name?: string; supervisor_name?: string;
  scheduled_start?: string; actual_start?: string; actual_end?: string;
  input_weight?: number; input_weight_unit?: string;
  output_weight?: number; output_weight_unit?: string;
  yield_percentage?: number; notes?: string;
}

interface OutboundShipment {
  id: string; shipment_number: string; status: string;
  customer_name_resolved?: string; carrier_name_resolved?: string;
  driver_name?: string; truck_number?: string; bol_number?: string;
  scheduled_date?: string; shipped_date?: string;
  total_weight?: number; total_weight_unit?: string;
}

interface Carrier { id: string; name: string }
interface Vendor { id: string; name: string }
interface Customer { id: string; name: string }
interface Location { id: string; name: string }
interface MaterialType { id: string; name: string }
interface ProcessingType { id: string; name: string }
interface ProductionLine { id: string; line_id: string; name: string; is_active: boolean }

interface DowntimeEvent {
  id: string; reason: string; category?: string;
  start_time: string; end_time?: string; duration_minutes?: number;
  notes?: string; reported_by_name?: string; cmms_work_order_id?: string;
}

interface ShipmentDoc {
  id: string; file_name: string; file_url: string; document_type?: string;
  uploaded_by_name?: string; uploaded_at: string;
}

const WEIGHT_UNITS = ["lbs", "kg", "tons"];
const DOWNTIME_CATEGORIES = ["equipment_failure", "material_jam", "changeover", "maintenance", "operator", "power", "quality_hold", "other"];
const DOC_TYPES = ["BOL", "COA", "weight_ticket", "customs", "invoice", "packing_list", "other"];
const JOB_STATUSES = ["open", "in_progress", "on_hold", "completed", "cancelled"];

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

const RUN_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-600",
  in_progress: "bg-amber-500/10 text-amber-600",
  completed: "bg-green-500/10 text-green-600",
  cancelled: "bg-red-500/10 text-red-400",
};

const OUT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-500/10 text-slate-500",
  ready: "bg-blue-500/10 text-blue-600",
  staged: "bg-amber-500/10 text-amber-600",
  shipped: "bg-teal-500/10 text-teal-600",
  delivered: "bg-green-500/10 text-green-600",
  cancelled: "bg-red-500/10 text-red-400",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);

  const [inboundShipments, setInboundShipments] = useState<InboundShipment[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [runs, setRuns] = useState<ProductionRun[]>([]);
  const [outbound, setOutbound] = useState<OutboundShipment[]>([]);

  // Master lists
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [processingTypes, setProcessingTypes] = useState<ProcessingType[]>([]);
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);

  // Dialogs
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newShipmentOpen, setNewShipmentOpen] = useState(false);
  const [newLotOpen, setNewLotOpen] = useState(false);
  const [newRunOpen, setNewRunOpen] = useState(false);
  const [runDetailOpen, setRunDetailOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<ProductionRun | null>(null);
  const [newOutboundOpen, setNewOutboundOpen] = useState(false);
  const [outboundDetailOpen, setOutboundDetailOpen] = useState(false);
  const [selectedOutbound, setSelectedOutbound] = useState<OutboundShipment & { lots?: Array<{ lot_id: string; lot_number: string; weight?: number; weight_unit?: string; lot_status?: string }> } | null>(null);
  const [shipmentDetailOpen, setShipmentDetailOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<InboundShipment | null>(null);
  const [shipmentWeights, setShipmentWeights] = useState<WeightEntry[]>([]);
  const [lotDetailOpen, setLotDetailOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [lotStatusEdit, setLotStatusEdit] = useState("");

  // Downtime
  const [downtimeEvents, setDowntimeEvents] = useState<DowntimeEvent[]>([]);
  const [downtimeFormOpen, setDowntimeFormOpen] = useState(false);
  const [downtimeForm, setDowntimeForm] = useState({ reason: "", category: "", startTime: "", endTime: "", notes: "" });

  // Outbound documents
  const [outboundDocs, setOutboundDocs] = useState<ShipmentDoc[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docType, setDocType] = useState("BOL");

  const [saving, setSaving] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");

  // Forms
  const [shipForm, setShipForm] = useState({ vendorId: "", carrierId: "", driverName: "", truckNumber: "", trailerNumber: "", scheduledDate: "", locationId: "", notes: "" });
  const [weightForm, setWeightForm] = useState({ grossWeight: "", tareWeight: "", weightUnit: "lbs", containerLabel: "", notes: "" });
  const [lotForm, setLotForm] = useState({ materialTypeId: "", inboundWeight: "", inboundWeightUnit: "lbs", locationId: "", notes: "" });
  const [runForm, setRunForm] = useState({ productionLineId: "", processingTypeId: "", operatorId: "", scheduledStart: "", inputWeight: "", inputWeightUnit: "lbs", notes: "" });
  const [runEditForm, setRunEditForm] = useState({ outputWeight: "", outputWeightUnit: "lbs", notes: "" });
  const [outboundForm, setOutboundForm] = useState({ customerId: "", carrierId: "", carrierName: "", driverName: "", truckNumber: "", trailerNumber: "", customerPoNumber: "", bolNumber: "", scheduledDate: "", notes: "" });
  const [addLotToOutbound, setAddLotToOutbound] = useState({ lotId: "", weight: "", weightUnit: "lbs" });

  const canManage = ["owner", "admin", "engineer"].includes(role);
  const canReceive = ["owner", "admin", "engineer", "receiving", "shipping"].includes(role);
  const canShip = ["owner", "admin", "engineer", "shipping"].includes(role);

  const refresh = async () => {
    const [j, ib, l, r, ob, c, v, cu, loc, mt, pt, pl] = await Promise.all([
      fetch(`/api/ops/jobs/${id}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/ops/inbound-shipments?jobId=${id}`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/ops/lots?jobId=${id}`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/ops/production-runs?jobId=${id}`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/ops/outbound-shipments?jobId=${id}`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/ops/carriers").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/ops/vendors").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/ops/customers").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/ops/locations").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/qms/material-types").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/ops/processing-types").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/maintenance/lines").then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
    setJob(j);
    setInboundShipments(Array.isArray(ib) ? ib : []);
    setLots(Array.isArray(l) ? l : []);
    setRuns(Array.isArray(r) ? r : []);
    setOutbound(Array.isArray(ob) ? ob : []);
    setCarriers(Array.isArray(c) ? c : []);
    setVendors(Array.isArray(v) ? v : []);
    setCustomers(Array.isArray(cu) ? cu : []);
    setLocations(Array.isArray(loc) ? loc : []);
    setMaterialTypes(Array.isArray(mt) ? mt : []);
    setProcessingTypes(Array.isArray(pt) ? pt : []);
    setProductionLines(Array.isArray(pl) ? pl.filter((x: ProductionLine) => x.is_active) : []);
  };

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(data => {
      if (!data.authenticated) { router.push("/login"); return; }
      setRole(data.role);
      refresh().finally(() => setLoading(false));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Status change ──────────────────────────────────────────────────────────
  const handleStatusChange = async () => {
    setSaving(true);
    await fetch(`/api/ops/jobs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus, statusNotes: statusNote }) });
    setStatusDialogOpen(false); setStatusNote("");
    await refresh(); setSaving(false);
  };

  // ── Inbound ────────────────────────────────────────────────────────────────
  const handleCreateShipment = async () => {
    setSaving(true);
    const body = { jobId: id, ...shipForm, vendorId: shipForm.vendorId || undefined, carrierId: shipForm.carrierId || undefined, locationId: shipForm.locationId || undefined };
    const res = await fetch("/api/ops/inbound-shipments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setNewShipmentOpen(false); await refresh(); }
    setSaving(false);
  };

  const openShipmentDetail = async (shp: InboundShipment) => {
    setSelectedShipment(shp);
    const data = await fetch(`/api/ops/inbound-shipments/${shp.id}`).then(r => r.json()).catch(() => ({ weightEntries: [] }));
    setShipmentWeights(data.weightEntries ?? []);
    setWeightForm({ grossWeight: "", tareWeight: "", weightUnit: "lbs", containerLabel: "", notes: "" });
    setShipmentDetailOpen(true);
  };

  const handleAddWeight = async () => {
    if (!selectedShipment) return;
    setSaving(true);
    await fetch(`/api/ops/inbound-shipments/${selectedShipment.id}/weights`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grossWeight: parseFloat(weightForm.grossWeight), tareWeight: weightForm.tareWeight ? parseFloat(weightForm.tareWeight) : undefined, weightUnit: weightForm.weightUnit, containerLabel: weightForm.containerLabel || undefined }),
    });
    const data = await fetch(`/api/ops/inbound-shipments/${selectedShipment.id}`).then(r => r.json()).catch(() => ({ weightEntries: [] }));
    setShipmentWeights(data.weightEntries ?? []);
    setWeightForm({ grossWeight: "", tareWeight: "", weightUnit: "lbs", containerLabel: "", notes: "" });
    await refresh(); setSaving(false);
  };

  const handleMarkReceived = async () => {
    if (!selectedShipment) return;
    await fetch(`/api/ops/inbound-shipments/${selectedShipment.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "received", receivedDate: new Date().toISOString() }) });
    setShipmentDetailOpen(false); await refresh();
  };

  // ── Lots ───────────────────────────────────────────────────────────────────
  const handleCreateLot = async () => {
    setSaving(true);
    const body = { jobId: id, materialTypeId: lotForm.materialTypeId || undefined, inboundWeight: lotForm.inboundWeight ? parseFloat(lotForm.inboundWeight) : undefined, inboundWeightUnit: lotForm.inboundWeightUnit, locationId: lotForm.locationId || undefined, notes: lotForm.notes || undefined };
    const res = await fetch("/api/ops/lots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setNewLotOpen(false); await refresh(); }
    setSaving(false);
  };

  const openLotDetail = (lot: Lot) => {
    setSelectedLot(lot);
    setLotStatusEdit(lot.status);
    setLotDetailOpen(true);
  };

  const handleLotStatusSave = async () => {
    if (!selectedLot || lotStatusEdit === selectedLot.status) { setLotDetailOpen(false); return; }
    setSaving(true);
    await fetch(`/api/ops/lots/${selectedLot.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: lotStatusEdit }) });
    await refresh(); setLotDetailOpen(false); setSaving(false);
  };

  const handleSendToQC = async () => {
    if (!selectedLot) return;
    setSaving(true);
    const res = await fetch(`/api/ops/lots/${selectedLot.id}/send-to-qc`, { method: "POST" });
    if (res.ok) { await refresh(); setLotDetailOpen(false); }
    setSaving(false);
  };

  // ── Production Runs ────────────────────────────────────────────────────────
  const handleCreateRun = async () => {
    setSaving(true);
    const body = { jobId: id, productionLineId: runForm.productionLineId || undefined, processingTypeId: runForm.processingTypeId || undefined, scheduledStart: runForm.scheduledStart || undefined, inputWeight: runForm.inputWeight ? parseFloat(runForm.inputWeight) : undefined, inputWeightUnit: runForm.inputWeightUnit, notes: runForm.notes || undefined };
    const res = await fetch("/api/ops/production-runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setNewRunOpen(false); await refresh(); }
    setSaving(false);
  };

  const openRunDetail = async (run: ProductionRun) => {
    const [data, dt] = await Promise.all([
      fetch(`/api/ops/production-runs/${run.id}`).then(r => r.json()).catch(() => run),
      fetch(`/api/ops/downtime-events?runId=${run.id}`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
    setSelectedRun(data);
    setRunEditForm({ outputWeight: String(data.output_weight ?? ""), outputWeightUnit: data.output_weight_unit ?? "lbs", notes: data.notes ?? "" });
    setDowntimeEvents(Array.isArray(dt) ? dt : []);
    setDowntimeFormOpen(false);
    setDowntimeForm({ reason: "", category: "", startTime: "", endTime: "", notes: "" });
    setRunDetailOpen(true);
  };

  const handleRunStatusChange = async (runId: string, status: string) => {
    setSaving(true);
    await fetch(`/api/ops/production-runs/${runId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    await refresh();
    if (selectedRun) {
      const data = await fetch(`/api/ops/production-runs/${runId}`).then(r => r.json()).catch(() => selectedRun);
      setSelectedRun(data);
    }
    setSaving(false);
  };

  const handleSaveRunOutput = async () => {
    if (!selectedRun) return;
    setSaving(true);
    const res = await fetch(`/api/ops/production-runs/${selectedRun.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outputWeight: parseFloat(runEditForm.outputWeight), outputWeightUnit: runEditForm.outputWeightUnit, notes: runEditForm.notes || undefined }),
    });
    const data = await res.json();
    await refresh();
    const updated = await fetch(`/api/ops/production-runs/${selectedRun.id}`).then(r => r.json()).catch(() => selectedRun);
    setSelectedRun(updated);
    setSaving(false);
  };

  // ── Outbound ───────────────────────────────────────────────────────────────
  const handleCreateOutbound = async () => {
    setSaving(true);
    const body = { jobId: id, customerId: outboundForm.customerId || undefined, carrierId: outboundForm.carrierId || undefined, carrierName: outboundForm.carrierName || undefined, driverName: outboundForm.driverName || undefined, truckNumber: outboundForm.truckNumber || undefined, trailerNumber: outboundForm.trailerNumber || undefined, customerPoNumber: outboundForm.customerPoNumber || undefined, bolNumber: outboundForm.bolNumber || undefined, scheduledDate: outboundForm.scheduledDate || undefined, notes: outboundForm.notes || undefined };
    const res = await fetch("/api/ops/outbound-shipments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setNewOutboundOpen(false); await refresh(); }
    setSaving(false);
  };

  const openOutboundDetail = async (shp: OutboundShipment) => {
    const [data, docs] = await Promise.all([
      fetch(`/api/ops/outbound-shipments/${shp.id}`).then(r => r.json()).catch(() => ({ ...shp, lots: [] })),
      fetch(`/api/ops/outbound-shipments/${shp.id}/documents`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
    setSelectedOutbound(data);
    setOutboundDocs(Array.isArray(docs) ? docs : []);
    setAddLotToOutbound({ lotId: "", weight: "", weightUnit: "lbs" });
    setDocType("BOL");
    setOutboundDetailOpen(true);
  };

  const handleAddLotToOutbound = async () => {
    if (!selectedOutbound || !addLotToOutbound.lotId) return;
    setSaving(true);
    await fetch(`/api/ops/outbound-shipments/${selectedOutbound.id}/lots`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotId: addLotToOutbound.lotId, weight: addLotToOutbound.weight ? parseFloat(addLotToOutbound.weight) : undefined, weightUnit: addLotToOutbound.weightUnit }),
    });
    const data = await fetch(`/api/ops/outbound-shipments/${selectedOutbound.id}`).then(r => r.json()).catch(() => selectedOutbound);
    setSelectedOutbound(data);
    setAddLotToOutbound({ lotId: "", weight: "", weightUnit: "lbs" });
    await refresh(); setSaving(false);
  };

  const handleMarkShipped = async () => {
    if (!selectedOutbound) return;
    await fetch(`/api/ops/outbound-shipments/${selectedOutbound.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "shipped" }) });
    setOutboundDetailOpen(false); await refresh();
  };

  const handleMarkStaged = async () => {
    if (!selectedOutbound) return;
    await fetch(`/api/ops/outbound-shipments/${selectedOutbound.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "staged" }) });
    const data = await fetch(`/api/ops/outbound-shipments/${selectedOutbound.id}`).then(r => r.json()).catch(() => selectedOutbound);
    setSelectedOutbound(data); await refresh();
  };

  const handleMarkDelivered = async () => {
    if (!selectedOutbound) return;
    await fetch(`/api/ops/outbound-shipments/${selectedOutbound.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "delivered" }) });
    setOutboundDetailOpen(false); await refresh();
  };

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedOutbound || !e.target.files?.[0]) return;
    setUploadingDoc(true);
    const file = e.target.files[0];
    const fd = new FormData();
    fd.append("file", file);
    fd.append("documentType", docType);
    const res = await fetch(`/api/ops/outbound-shipments/${selectedOutbound.id}/documents`, { method: "POST", body: fd });
    if (res.ok) {
      const docs = await fetch(`/api/ops/outbound-shipments/${selectedOutbound.id}/documents`).then(r => r.json()).catch(() => []);
      setOutboundDocs(Array.isArray(docs) ? docs : []);
    }
    e.target.value = "";
    setUploadingDoc(false);
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!selectedOutbound) return;
    await fetch(`/api/ops/outbound-shipments/${selectedOutbound.id}/documents/${docId}`, { method: "DELETE" });
    setOutboundDocs(prev => prev.filter(d => d.id !== docId));
  };

  const handleLogDowntime = async () => {
    if (!selectedRun || !downtimeForm.reason || !downtimeForm.startTime) return;
    setSaving(true);
    await fetch("/api/ops/downtime-events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: selectedRun.id, reason: downtimeForm.reason, category: downtimeForm.category || undefined, startTime: new Date(downtimeForm.startTime).toISOString(), endTime: downtimeForm.endTime ? new Date(downtimeForm.endTime).toISOString() : undefined, notes: downtimeForm.notes || undefined }),
    });
    const dt = await fetch(`/api/ops/downtime-events?runId=${selectedRun.id}`).then(r => r.ok ? r.json() : []).catch(() => []);
    setDowntimeEvents(Array.isArray(dt) ? dt : []);
    setDowntimeForm({ reason: "", category: "", startTime: "", endTime: "", notes: "" });
    setDowntimeFormOpen(false);
    setSaving(false);
  };

  const handleDeleteDowntime = async (evId: string) => {
    await fetch(`/api/ops/downtime-events/${evId}`, { method: "DELETE" });
    setDowntimeEvents(prev => prev.filter(d => d.id !== evId));
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" size={28} /></div>;
  if (!job) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Job not found.</div>;

  const totalInboundWeight = inboundShipments.reduce((sum, s) => sum + (s.total_weight ?? 0), 0);
  const totalOutputWeight = runs.filter(r => r.status === "completed").reduce((sum, r) => sum + (r.output_weight ?? 0), 0);
  const weightUnit = inboundShipments.find(s => s.weight_unit)?.weight_unit ?? "lbs";

  // Lots available to add to outbound (approved status)
  const approvedLots = lots.filter(l => l.status === "approved");
  const outboundLinkedLotIds = new Set((selectedOutbound?.lots ?? []).map(l => l.lot_id));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/ops/jobs"><Button variant="ghost" size="sm"><ArrowLeft size={16} className="mr-1" />Jobs</Button></Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold">{job.job_number}</h1>
              <Badge variant="outline" className="text-xs capitalize">{job.job_type}</Badge>
              <Badge variant="outline" className="text-xs capitalize">{job.status.replace("_", " ")}</Badge>
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
        {/* Job Info */}
        <Card>
          <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Customer / Vendor</p><p className="font-medium">{job.customer_name ?? job.vendor_name ?? "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Material</p><p className="font-medium">{job.material_type_name ?? "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Customer PO</p><p className="font-medium">{job.customer_po_number ?? "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Our PO</p><p className="font-medium">{job.our_po_number ?? "—"}</p></div>
            {job.target_weight != null && <div><p className="text-xs text-muted-foreground">Target</p><p className="font-medium">{Number(job.target_weight).toLocaleString()} {job.target_weight_unit}</p></div>}
            {job.description && <div className="col-span-2 md:col-span-4"><p className="text-xs text-muted-foreground">Description</p><p>{job.description}</p></div>}
          </CardContent>
        </Card>

        {/* Summary row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-500">{inboundShipments.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Inbound</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-green-500">{totalInboundWeight > 0 ? Number(totalInboundWeight.toFixed(0)).toLocaleString() : "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Received ({weightUnit})</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-500">{runs.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Runs</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-purple-500">{totalOutputWeight > 0 ? Number(totalOutputWeight.toFixed(0)).toLocaleString() : "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Output ({weightUnit})</p>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="inbound">
          <TabsList className="flex flex-wrap gap-1 h-auto">
            <TabsTrigger value="inbound">Inbound ({inboundShipments.length})</TabsTrigger>
            <TabsTrigger value="lots">Lots ({lots.length})</TabsTrigger>
            <TabsTrigger value="production">Production ({runs.length})</TabsTrigger>
            <TabsTrigger value="outbound">Outbound ({outbound.length})</TabsTrigger>
          </TabsList>

          {/* ── Inbound Tab ── */}
          <TabsContent value="inbound" className="space-y-3 mt-3">
            {canReceive && <div className="flex justify-end"><Button size="sm" onClick={() => { setShipForm({ vendorId: "", carrierId: "", driverName: "", truckNumber: "", trailerNumber: "", scheduledDate: "", locationId: "", notes: "" }); setNewShipmentOpen(true); }}><Plus size={14} className="mr-1" />Add Inbound Shipment</Button></div>}
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
                        <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-muted-foreground">
                          {shp.carrier_name_resolved && <span>{shp.carrier_name_resolved}</span>}
                          {shp.driver_name && <span>Driver: {shp.driver_name}</span>}
                          {shp.total_weight != null && <span className="font-medium text-foreground">{Number(shp.total_weight).toLocaleString()} {shp.weight_unit} · {shp.entry_count} entries</span>}
                          {shp.received_date ? <span>Received {new Date(shp.received_date).toLocaleDateString()}</span> : shp.scheduled_date ? <span>Scheduled {new Date(shp.scheduled_date).toLocaleDateString()}</span> : null}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Lots Tab ── */}
          <TabsContent value="lots" className="space-y-3 mt-3">
            {canManage && <div className="flex justify-end"><Button size="sm" onClick={() => { setLotForm({ materialTypeId: job.material_type_id ?? "", inboundWeight: "", inboundWeightUnit: "lbs", locationId: "", notes: "" }); setNewLotOpen(true); }}><Plus size={14} className="mr-1" />Create Lot</Button></div>}
            {lots.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No lots yet.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {lots.map(lot => (
                  <Card key={lot.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => openLotDetail(lot)}>
                    <CardContent className="px-4 py-3 flex items-center gap-3">
                      <Package size={16} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{lot.lot_number}</span>
                          <Badge className={`text-xs ${LOT_STATUS_COLORS[lot.status] ?? ""}`} variant="outline">{lot.status.replace("_", " ")}</Badge>
                          {lot.qms_lot_status && (
                            <Badge variant="outline" className="text-xs bg-violet-500/10 text-violet-600">QC: {lot.qms_lot_status.replace("_", " ")}</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-muted-foreground">
                          {lot.material_type_name && <span>{lot.material_type_name}</span>}
                          {lot.inbound_weight != null && <span>{Number(lot.inbound_weight).toLocaleString()} {lot.inbound_weight_unit}</span>}
                          {lot.location_name && <span>@ {lot.location_name}</span>}
                          {lot.qms_lot_number && <span className="text-violet-600">QMS: {lot.qms_lot_number}</span>}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Production Tab ── */}
          <TabsContent value="production" className="space-y-3 mt-3">
            {canManage && <div className="flex justify-end"><Button size="sm" onClick={() => { setRunForm({ productionLineId: "", processingTypeId: "", operatorId: "", scheduledStart: "", inputWeight: "", inputWeightUnit: "lbs", notes: "" }); setNewRunOpen(true); }}><Plus size={14} className="mr-1" />New Run</Button></div>}
            {runs.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No production runs yet.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {runs.map(run => (
                  <Card key={run.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => openRunDetail(run)}>
                    <CardContent className="px-4 py-3 flex items-center gap-3">
                      <Factory size={16} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{run.run_number}</span>
                          <Badge className={`text-xs ${RUN_STATUS_COLORS[run.status] ?? ""}`} variant="outline">{run.status.replace("_", " ")}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-muted-foreground">
                          {run.processing_type_name && <span>{run.processing_type_name}</span>}
                          {run.input_weight != null && <span>In: {Number(run.input_weight).toLocaleString()} {run.input_weight_unit}</span>}
                          {run.output_weight != null && <span>Out: {Number(run.output_weight).toLocaleString()} {run.output_weight_unit}</span>}
                          {run.yield_percentage != null && <span className="font-medium text-green-600">Yield: {Number(run.yield_percentage).toFixed(1)}%</span>}
                          {run.actual_start && <span>Started {new Date(run.actual_start).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Outbound Tab ── */}
          <TabsContent value="outbound" className="space-y-3 mt-3">
            {canShip && <div className="flex justify-end"><Button size="sm" onClick={() => { setOutboundForm({ customerId: "", carrierId: "", carrierName: "", driverName: "", truckNumber: "", trailerNumber: "", customerPoNumber: "", bolNumber: "", scheduledDate: "", notes: "" }); setNewOutboundOpen(true); }}><Plus size={14} className="mr-1" />New Outbound Shipment</Button></div>}
            {outbound.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No outbound shipments yet.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {outbound.map(shp => (
                  <Card key={shp.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => openOutboundDetail(shp)}>
                    <CardContent className="px-4 py-3 flex items-center gap-3">
                      <ArrowUpFromLine size={16} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{shp.shipment_number}</span>
                          <Badge className={`text-xs ${OUT_STATUS_COLORS[shp.status] ?? ""}`} variant="outline">{shp.status}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-muted-foreground">
                          {shp.customer_name_resolved && <span>{shp.customer_name_resolved}</span>}
                          {shp.carrier_name_resolved && <span>{shp.carrier_name_resolved}</span>}
                          {shp.total_weight != null && <span className="font-medium text-foreground">{Number(shp.total_weight).toLocaleString()} {shp.total_weight_unit}</span>}
                          {shp.bol_number && <span>BOL: {shp.bol_number}</span>}
                          {shp.shipped_date ? <span>Shipped {new Date(shp.shipped_date).toLocaleDateString()}</span> : shp.scheduled_date ? <span>Scheduled {new Date(shp.scheduled_date).toLocaleDateString()}</span> : null}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Status Dialog ── */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Job Status</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex flex-wrap gap-2">
              {JOB_STATUSES.map(s => <Button key={s} size="sm" variant={newStatus === s ? "default" : "outline"} onClick={() => setNewStatus(s)} className="capitalize">{s.replace("_", " ")}</Button>)}
            </div>
            <div className="space-y-1"><Label>Notes (optional)</Label><Textarea value={statusNote} onChange={e => setStatusNote(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleStatusChange} disabled={saving || newStatus === job.status}>{saving && <Loader2 size={14} className="animate-spin mr-1" />}Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Inbound Dialog ── */}
      <Dialog open={newShipmentOpen} onOpenChange={setNewShipmentOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Inbound Shipment</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Vendor</Label>
                <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={shipForm.vendorId} onChange={e => setShipForm(p => ({ ...p, vendorId: e.target.value }))}>
                  <option value="">-- Select --</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>Carrier</Label>
                <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={shipForm.carrierId} onChange={e => setShipForm(p => ({ ...p, carrierId: e.target.value }))}>
                  <option value="">-- Select --</option>{carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Driver</Label><Input value={shipForm.driverName} onChange={e => setShipForm(p => ({ ...p, driverName: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Truck #</Label><Input value={shipForm.truckNumber} onChange={e => setShipForm(p => ({ ...p, truckNumber: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Scheduled Date</Label><Input type="date" value={shipForm.scheduledDate} onChange={e => setShipForm(p => ({ ...p, scheduledDate: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Location</Label>
                <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={shipForm.locationId} onChange={e => setShipForm(p => ({ ...p, locationId: e.target.value }))}>
                  <option value="">-- Select --</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Textarea value={shipForm.notes} onChange={e => setShipForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewShipmentOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateShipment} disabled={saving}>{saving && <Loader2 size={14} className="animate-spin mr-1" />}Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Inbound Detail Dialog ── */}
      <Dialog open={shipmentDetailOpen} onOpenChange={setShipmentDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedShipment?.shipment_number}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5"><Scale size={14} />Weight Entries</h3>
              {shipmentWeights.length > 0 && (
                <div className="space-y-1 mb-3">
                  <div className="grid grid-cols-4 gap-1 text-xs text-muted-foreground font-medium px-1">#<span>Gross</span><span>Tare</span><span>Net</span></div>
                  {shipmentWeights.map(we => (
                    <div key={we.id} className="grid grid-cols-4 gap-1 text-xs bg-muted/30 rounded px-2 py-1.5">
                      <span>{we.entry_number}</span>
                      <span>{Number(we.gross_weight).toLocaleString()} {we.weight_unit}</span>
                      <span>{we.tare_weight != null ? `${Number(we.tare_weight).toLocaleString()}` : "—"}</span>
                      <span className="font-medium">{we.net_weight != null ? `${Number(we.net_weight).toLocaleString()}` : "—"}</span>
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
              {canReceive && selectedShipment?.status !== "received" && (
                <div className="border rounded-md p-3 space-y-2 bg-muted/20">
                  <p className="text-xs font-medium">Add Entry</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-0.5"><Label className="text-xs">Gross *</Label><Input className="h-8 text-sm" type="number" step="0.01" value={weightForm.grossWeight} onChange={e => setWeightForm(p => ({ ...p, grossWeight: e.target.value }))} /></div>
                    <div className="space-y-0.5"><Label className="text-xs">Tare</Label><Input className="h-8 text-sm" type="number" step="0.01" value={weightForm.tareWeight} onChange={e => setWeightForm(p => ({ ...p, tareWeight: e.target.value }))} /></div>
                    <div className="space-y-0.5"><Label className="text-xs">Unit</Label>
                      <select className="w-full border border-input rounded-md px-2 py-1 text-sm bg-background h-8" value={weightForm.weightUnit} onChange={e => setWeightForm(p => ({ ...p, weightUnit: e.target.value }))}>
                        {WEIGHT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5"><Label className="text-xs">Label (optional)</Label><Input className="h-8 text-sm" value={weightForm.containerLabel} onChange={e => setWeightForm(p => ({ ...p, containerLabel: e.target.value }))} placeholder="e.g. Gaylord #3" /></div>
                    <div className="flex items-end"><Button size="sm" className="w-full" onClick={handleAddWeight} disabled={saving || !weightForm.grossWeight}>{saving ? <Loader2 size={13} className="animate-spin mr-1" /> : <Plus size={13} className="mr-1" />}Add</Button></div>
                  </div>
                </div>
              )}
            </div>
            {canReceive && selectedShipment?.status !== "received" && (
              <Button className="w-full" variant="outline" onClick={handleMarkReceived}><Check size={14} className="mr-1.5 text-green-500" />Mark as Received</Button>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShipmentDetailOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Lot Dialog ── */}
      <Dialog open={newLotOpen} onOpenChange={setNewLotOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Lot</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1"><Label>Material Type</Label>
              <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={lotForm.materialTypeId} onChange={e => setLotForm(p => ({ ...p, materialTypeId: e.target.value }))}>
                <option value="">-- Select --</option>{materialTypes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="col-span-2 space-y-1"><Label>Inbound Weight</Label><Input type="number" step="0.01" value={lotForm.inboundWeight} onChange={e => setLotForm(p => ({ ...p, inboundWeight: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Unit</Label>
                <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={lotForm.inboundWeightUnit} onChange={e => setLotForm(p => ({ ...p, inboundWeightUnit: e.target.value }))}>
                  {WEIGHT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1"><Label>Location</Label>
              <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={lotForm.locationId} onChange={e => setLotForm(p => ({ ...p, locationId: e.target.value }))}>
                <option value="">-- Select --</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Textarea value={lotForm.notes} onChange={e => setLotForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewLotOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateLot} disabled={saving}>{saving && <Loader2 size={14} className="animate-spin mr-1" />}Create Lot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Production Run Dialog ── */}
      <Dialog open={newRunOpen} onOpenChange={setNewRunOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Schedule Production Run</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Production Line</Label>
                <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={runForm.productionLineId} onChange={e => setRunForm(p => ({ ...p, productionLineId: e.target.value }))}>
                  <option value="">-- Select --</option>{productionLines.map(l => <option key={l.id} value={l.id}>{l.line_id} — {l.name}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>Processing Type</Label>
                <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={runForm.processingTypeId} onChange={e => setRunForm(p => ({ ...p, processingTypeId: e.target.value }))}>
                  <option value="">-- Select --</option>{processingTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="col-span-2 space-y-1"><Label>Input Weight</Label><Input type="number" step="0.01" value={runForm.inputWeight} onChange={e => setRunForm(p => ({ ...p, inputWeight: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Unit</Label>
                <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={runForm.inputWeightUnit} onChange={e => setRunForm(p => ({ ...p, inputWeightUnit: e.target.value }))}>
                  {WEIGHT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1"><Label>Scheduled Start</Label><Input type="datetime-local" value={runForm.scheduledStart} onChange={e => setRunForm(p => ({ ...p, scheduledStart: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Notes</Label><Textarea value={runForm.notes} onChange={e => setRunForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRunOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRun} disabled={saving}>{saving && <Loader2 size={14} className="animate-spin mr-1" />}Schedule Run</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Run Detail Dialog ── */}
      <Dialog open={runDetailOpen} onOpenChange={setRunDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedRun?.run_number}</DialogTitle></DialogHeader>
          {selectedRun && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Status</p><Badge className={`text-xs ${RUN_STATUS_COLORS[selectedRun.status] ?? ""}`} variant="outline">{selectedRun.status.replace("_", " ")}</Badge></div>
                <div><p className="text-xs text-muted-foreground">Processing Type</p><p className="font-medium">{selectedRun.processing_type_name ?? "—"}</p></div>
                {selectedRun.input_weight != null && <div><p className="text-xs text-muted-foreground">Input</p><p className="font-medium">{Number(selectedRun.input_weight).toLocaleString()} {selectedRun.input_weight_unit}</p></div>}
                {selectedRun.output_weight != null && <div><p className="text-xs text-muted-foreground">Output</p><p className="font-medium">{Number(selectedRun.output_weight).toLocaleString()} {selectedRun.output_weight_unit}</p></div>}
                {selectedRun.yield_percentage != null && <div><p className="text-xs text-muted-foreground">Yield</p><p className="font-bold text-green-600">{Number(selectedRun.yield_percentage).toFixed(1)}%</p></div>}
                {selectedRun.actual_start && <div><p className="text-xs text-muted-foreground">Started</p><p>{new Date(selectedRun.actual_start).toLocaleString()}</p></div>}
                {selectedRun.actual_end && <div><p className="text-xs text-muted-foreground">Completed</p><p>{new Date(selectedRun.actual_end).toLocaleString()}</p></div>}
              </div>

              {/* Status actions */}
              {canManage && selectedRun.status !== "cancelled" && selectedRun.status !== "completed" && (
                <div className="flex gap-2 flex-wrap">
                  {selectedRun.status === "scheduled" && (
                    <Button size="sm" onClick={() => handleRunStatusChange(selectedRun.id, "in_progress")} disabled={saving}>
                      <Play size={13} className="mr-1 text-green-500" />Start Run
                    </Button>
                  )}
                  {selectedRun.status === "in_progress" && (
                    <Button size="sm" onClick={() => handleRunStatusChange(selectedRun.id, "completed")} disabled={saving}>
                      <Square size={13} className="mr-1 text-red-400" />Complete Run
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleRunStatusChange(selectedRun.id, "cancelled")} disabled={saving} className="text-red-400">Cancel</Button>
                </div>
              )}

              {/* Output weight entry */}
              {canManage && selectedRun.status !== "cancelled" && (
                <div className="border rounded-md p-3 space-y-2 bg-muted/20">
                  <p className="text-xs font-medium flex items-center gap-1.5"><TrendingUp size={13} />Record Output Weight</p>
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div className="col-span-2 space-y-0.5"><Label className="text-xs">Output Weight</Label><Input className="h-8 text-sm" type="number" step="0.01" value={runEditForm.outputWeight} onChange={e => setRunEditForm(p => ({ ...p, outputWeight: e.target.value }))} /></div>
                    <div className="space-y-0.5"><Label className="text-xs">Unit</Label>
                      <select className="w-full border border-input rounded-md px-2 py-1 text-sm bg-background h-8" value={runEditForm.outputWeightUnit} onChange={e => setRunEditForm(p => ({ ...p, outputWeightUnit: e.target.value }))}>
                        {WEIGHT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <Button size="sm" onClick={handleSaveRunOutput} disabled={saving || !runEditForm.outputWeight}>
                    {saving ? <Loader2 size={13} className="animate-spin mr-1" /> : <Check size={13} className="mr-1" />}Save Output
                  </Button>
                </div>
              )}

              {/* Downtime Events */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Square size={13} className="text-red-400" />
                    Downtime
                    {downtimeEvents.length > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({downtimeEvents.reduce((s, d) => s + (d.duration_minutes ?? 0), 0)} min total)
                      </span>
                    )}
                  </p>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDowntimeFormOpen(p => !p)}>
                    <Plus size={11} className="mr-1" />Log
                  </Button>
                </div>

                {downtimeFormOpen && (
                  <div className="border rounded-md p-3 space-y-2 bg-muted/20">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5 col-span-2"><Label className="text-xs">Reason *</Label><Input className="h-8 text-sm" value={downtimeForm.reason} onChange={e => setDowntimeForm(p => ({ ...p, reason: e.target.value }))} placeholder="e.g. Conveyor belt jam" /></div>
                      <div className="space-y-0.5"><Label className="text-xs">Category</Label>
                        <select className="w-full border border-input rounded-md px-2 py-1 text-sm bg-background h-8" value={downtimeForm.category} onChange={e => setDowntimeForm(p => ({ ...p, category: e.target.value }))}>
                          <option value="">-- Select --</option>
                          {DOWNTIME_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                        </select>
                      </div>
                      <div className="space-y-0.5"><Label className="text-xs">Start Time *</Label><Input className="h-8 text-sm" type="datetime-local" value={downtimeForm.startTime} onChange={e => setDowntimeForm(p => ({ ...p, startTime: e.target.value }))} /></div>
                      <div className="space-y-0.5 col-span-2"><Label className="text-xs">End Time</Label><Input className="h-8 text-sm" type="datetime-local" value={downtimeForm.endTime} onChange={e => setDowntimeForm(p => ({ ...p, endTime: e.target.value }))} /></div>
                      <div className="space-y-0.5 col-span-2"><Label className="text-xs">Notes</Label><Input className="h-8 text-sm" value={downtimeForm.notes} onChange={e => setDowntimeForm(p => ({ ...p, notes: e.target.value }))} /></div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleLogDowntime} disabled={saving || !downtimeForm.reason || !downtimeForm.startTime}>
                        {saving ? <Loader2 size={12} className="animate-spin mr-1" /> : <Check size={12} className="mr-1" />}Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDowntimeFormOpen(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                {downtimeEvents.length > 0 && (
                  <div className="space-y-1">
                    {downtimeEvents.map(ev => (
                      <div key={ev.id} className="flex items-start justify-between text-xs bg-muted/30 rounded px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{ev.reason}</span>
                            {ev.category && <span className="text-muted-foreground">{ev.category.replace(/_/g, " ")}</span>}
                            {ev.duration_minutes != null && <span className="text-amber-600 font-medium">{ev.duration_minutes} min</span>}
                          </div>
                          <div className="text-muted-foreground mt-0.5">
                            {new Date(ev.start_time).toLocaleString()}
                            {ev.end_time && ` → ${new Date(ev.end_time).toLocaleTimeString()}`}
                          </div>
                        </div>
                        {canManage && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400 shrink-0 ml-2" onClick={() => handleDeleteDowntime(ev.id)}>×</Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setRunDetailOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Outbound Dialog ── */}
      <Dialog open={newOutboundOpen} onOpenChange={setNewOutboundOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Outbound Shipment</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Customer</Label>
                <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={outboundForm.customerId} onChange={e => setOutboundForm(p => ({ ...p, customerId: e.target.value }))}>
                  <option value="">-- Select --</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>Carrier</Label>
                <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={outboundForm.carrierId} onChange={e => setOutboundForm(p => ({ ...p, carrierId: e.target.value }))}>
                  <option value="">-- Select --</option>{carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Driver</Label><Input value={outboundForm.driverName} onChange={e => setOutboundForm(p => ({ ...p, driverName: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Truck #</Label><Input value={outboundForm.truckNumber} onChange={e => setOutboundForm(p => ({ ...p, truckNumber: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Customer PO #</Label><Input value={outboundForm.customerPoNumber} onChange={e => setOutboundForm(p => ({ ...p, customerPoNumber: e.target.value }))} /></div>
              <div className="space-y-1"><Label>BOL #</Label><Input value={outboundForm.bolNumber} onChange={e => setOutboundForm(p => ({ ...p, bolNumber: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Scheduled Date</Label><Input type="date" value={outboundForm.scheduledDate} onChange={e => setOutboundForm(p => ({ ...p, scheduledDate: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Notes</Label><Textarea value={outboundForm.notes} onChange={e => setOutboundForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOutboundOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateOutbound} disabled={saving}>{saving && <Loader2 size={14} className="animate-spin mr-1" />}Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Outbound Detail Dialog ── */}
      <Dialog open={outboundDetailOpen} onOpenChange={setOutboundDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedOutbound?.shipment_number}</DialogTitle></DialogHeader>
          {selectedOutbound && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Customer</p><p className="font-medium">{selectedOutbound.customer_name_resolved ?? "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Carrier</p><p className="font-medium">{selectedOutbound.carrier_name_resolved ?? "—"}</p></div>
                {selectedOutbound.bol_number && <div><p className="text-xs text-muted-foreground">BOL #</p><p className="font-medium">{selectedOutbound.bol_number}</p></div>}
                {selectedOutbound.total_weight != null && <div><p className="text-xs text-muted-foreground">Total Weight</p><p className="font-bold">{Number(selectedOutbound.total_weight).toLocaleString()} {selectedOutbound.total_weight_unit}</p></div>}
              </div>

              {/* Linked lots */}
              <div>
                <p className="text-sm font-medium mb-2">Lots on this shipment</p>
                {(selectedOutbound.lots ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No lots added yet.</p>
                ) : (
                  <div className="space-y-1">
                    {(selectedOutbound.lots ?? []).map(l => (
                      <div key={l.lot_id} className="flex items-center justify-between text-sm bg-muted/30 rounded px-3 py-1.5">
                        <span className="font-medium">{l.lot_number}</span>
                        <span className="text-muted-foreground">{l.weight != null ? `${Number(l.weight).toLocaleString()} ${l.weight_unit}` : "—"}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add lot */}
                {canShip && selectedOutbound.status !== "shipped" && approvedLots.length > 0 && (
                  <div className="border rounded-md p-3 space-y-2 bg-muted/20 mt-3">
                    <p className="text-xs font-medium">Add Lot</p>
                    <div className="grid grid-cols-3 gap-2 items-end">
                      <div className="col-span-2 space-y-0.5"><Label className="text-xs">Lot</Label>
                        <select className="w-full border border-input rounded-md px-2 py-1 text-sm bg-background h-8" value={addLotToOutbound.lotId} onChange={e => setAddLotToOutbound(p => ({ ...p, lotId: e.target.value }))}>
                          <option value="">-- Select --</option>
                          {approvedLots.filter(l => !outboundLinkedLotIds.has(l.id)).map(l => <option key={l.id} value={l.id}>{l.lot_number} {l.inbound_weight ? `(${Number(l.inbound_weight).toLocaleString()} ${l.inbound_weight_unit})` : ""}</option>)}
                        </select>
                      </div>
                      <div className="space-y-0.5"><Label className="text-xs">Ship Weight</Label><Input className="h-8 text-sm" type="number" step="0.01" value={addLotToOutbound.weight} onChange={e => setAddLotToOutbound(p => ({ ...p, weight: e.target.value }))} /></div>
                    </div>
                    <Button size="sm" onClick={handleAddLotToOutbound} disabled={saving || !addLotToOutbound.lotId}>
                      {saving ? <Loader2 size={13} className="animate-spin mr-1" /> : <Plus size={13} className="mr-1" />}Add Lot
                    </Button>
                  </div>
                )}
              </div>

              {/* Documents */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Documents ({outboundDocs.length})</p>
                  {canShip && selectedOutbound.status !== "delivered" && (
                    <div className="flex items-center gap-2">
                      <select className="border border-input rounded px-2 py-1 text-xs bg-background h-7" value={docType} onChange={e => setDocType(e.target.value)}>
                        {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                      </select>
                      <label className="cursor-pointer">
                        <input type="file" className="hidden" onChange={handleUploadDoc} accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv" />
                        <span className="inline-flex items-center gap-1 text-xs border border-input rounded px-2 py-1 h-7 hover:bg-muted cursor-pointer">
                          {uploadingDoc ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}Upload
                        </span>
                      </label>
                    </div>
                  )}
                </div>
                {outboundDocs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
                ) : (
                  <div className="space-y-1">
                    {outboundDocs.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between text-xs bg-muted/30 rounded px-3 py-1.5">
                        <div className="flex-1 min-w-0">
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline text-blue-600 truncate block">{doc.file_name}</a>
                          <span className="text-muted-foreground">{doc.document_type?.replace(/_/g, " ")} · {doc.uploaded_by_name} · {new Date(doc.uploaded_at).toLocaleDateString()}</span>
                        </div>
                        {canShip && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400 shrink-0 ml-2" onClick={() => handleDeleteDoc(doc.id)}>×</Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status flow: pending → staged → shipped → delivered */}
              {canShip && (
                <div className="flex flex-col gap-2">
                  {selectedOutbound.status === "pending" && (selectedOutbound.lots ?? []).length > 0 && (
                    <Button className="w-full" variant="outline" onClick={handleMarkStaged}>
                      <Check size={14} className="mr-1.5 text-amber-500" />Mark as Staged
                    </Button>
                  )}
                  {selectedOutbound.status === "staged" && (
                    <Button className="w-full" variant="outline" onClick={handleMarkShipped}>
                      <ArrowUpFromLine size={14} className="mr-1.5 text-teal-500" />Mark as Shipped
                    </Button>
                  )}
                  {selectedOutbound.status === "shipped" && (
                    <Button className="w-full" variant="outline" onClick={handleMarkDelivered}>
                      <Check size={14} className="mr-1.5 text-green-500" />Confirm Delivery
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setOutboundDetailOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Lot Detail Dialog ── */}
      <Dialog open={lotDetailOpen} onOpenChange={setLotDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Lot: {selectedLot?.lot_number}</DialogTitle></DialogHeader>
          {selectedLot && (
            <div className="space-y-4 py-2">
              {/* Info row */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Material</p><p className="font-medium">{selectedLot.material_type_name ?? "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Weight</p><p className="font-medium">{selectedLot.inbound_weight != null ? `${Number(selectedLot.inbound_weight).toLocaleString()} ${selectedLot.inbound_weight_unit}` : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Location</p><p className="font-medium">{selectedLot.location_name ?? "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Created</p><p className="font-medium">{new Date(selectedLot.created_at).toLocaleDateString()}</p></div>
              </div>

              {/* Status edit */}
              {canManage && !["qc_hold", "approved", "shipped", "rejected"].includes(selectedLot.status) && (
                <div className="space-y-1">
                  <Label>Status</Label>
                  <select
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                    value={lotStatusEdit}
                    onChange={e => setLotStatusEdit(e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_storage">In Storage</option>
                    <option value="in_production">In Production</option>
                  </select>
                </div>
              )}

              {/* QMS section */}
              <div className="border rounded-md p-3 bg-muted/20 space-y-2">
                <p className="text-xs font-semibold flex items-center gap-1.5"><FlaskConical size={13} className="text-violet-500" />Quality Control</p>
                {selectedLot.qms_lot_id ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{selectedLot.qms_lot_number}</span>
                      <Badge variant="outline" className="text-xs bg-violet-500/10 text-violet-600 capitalize">
                        {(selectedLot.qms_lot_status ?? "").replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <Link
                      href={`/quality/lots/${selectedLot.qms_lot_id}`}
                      className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
                      onClick={() => setLotDetailOpen(false)}
                    >
                      <ExternalLink size={11} />View in QMS
                    </Link>
                  </div>
                ) : canManage ? (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Not yet sent to quality control.</p>
                    <Button size="sm" variant="outline" onClick={handleSendToQC} disabled={saving} className="text-violet-600 border-violet-300">
                      {saving ? <Loader2 size={13} className="animate-spin mr-1" /> : <FlaskConical size={13} className="mr-1" />}
                      Send to QC
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Not yet sent to quality control.</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLotDetailOpen(false)}>Close</Button>
            {canManage && selectedLot && !["qc_hold", "approved", "shipped", "rejected"].includes(selectedLot.status) && (
              <Button onClick={handleLotStatusSave} disabled={saving || lotStatusEdit === selectedLot?.status}>
                {saving && <Loader2 size={14} className="animate-spin mr-1" />}Save
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
