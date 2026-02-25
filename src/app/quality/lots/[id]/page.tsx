"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, ClipboardList, AlertTriangle, FileCheck2, ChevronRight, CheckCircle2, XCircle, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const statusColors: Record<string, string> = {
  pending_qc: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  qc_in_progress: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  on_hold: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  shipped: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};
const statusLabels: Record<string, string> = {
  pending_qc: "Pending QC", qc_in_progress: "QC In Progress", approved: "Approved",
  rejected: "Rejected", on_hold: "On Hold", shipped: "Shipped",
};

export default function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string>("");
  const [lot, setLot] = useState<Record<string, unknown> | null>(null);
  const [inspections, setInspections] = useState<Array<Record<string, unknown>>>([]);
  const [ncrs, setNcrs] = useState<Array<Record<string, unknown>>>([]);
  const [coa, setCoa] = useState<Record<string, unknown> | null>(null);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("");
  const [outputWeight, setOutputWeight] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState("");
  const [newInspectionOpen, setNewInspectionOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [creating, setCreating] = useState(false);
  const [generatingCoa, setGeneratingCoa] = useState(false);

  useEffect(() => {
    params.then(p => {
      setId(p.id);
      return Promise.all([
        fetch("/api/auth").then(r => r.json()),
        fetch(`/api/qms/lots/${p.id}`).then(r => r.json()),
        fetch(`/api/qms/inspections?lotId=${p.id}`).then(r => r.json()),
        fetch(`/api/qms/ncrs`).then(r => r.json()),
        fetch(`/api/qms/coas`).then(r => r.json()),
        fetch("/api/qms/templates").then(r => r.json()),
      ]);
    }).then(([auth, l, insp, ncrsAll, coas, tmpl]) => {
      if (!auth.authenticated) { router.push("/login"); return; }
      setRole(auth.role);
      if (l.error) { router.push("/quality/lots"); return; }
      setLot(l);
      setOutputWeight(String(l.output_weight_kg || ""));
      setInspections(Array.isArray(insp) ? insp : []);
      setNcrs(Array.isArray(ncrsAll) ? ncrsAll.filter((n: Record<string, unknown>) => n.lot_id === l.id) : []);
      const lotCoa = Array.isArray(coas) ? coas.find((c: Record<string, unknown>) => c.lot_id === l.id) : null;
      setCoa(lotCoa || null);
      setTemplates(Array.isArray(tmpl) ? tmpl : []);
    }).finally(() => setLoading(false));
  }, []);

  const isManager = ["quality_manager", "admin", "owner"].includes(role);

  const saveOutputWeight = async () => {
    setSavingWeight(true);
    await fetch(`/api/qms/lots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outputWeightKg: parseFloat(outputWeight) }),
    });
    const updated = await fetch(`/api/qms/lots/${id}`).then(r => r.json());
    setLot(updated);
    setSavingWeight(false);
  };

  const changeStatus = async () => {
    await fetch(`/api/qms/lots/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: targetStatus }),
    });
    const updated = await fetch(`/api/qms/lots/${id}`).then(r => r.json());
    setLot(updated);
    setStatusDialogOpen(false);
  };

  const createInspection = async () => {
    if (!selectedTemplate) return;
    setCreating(true);
    const res = await fetch("/api/qms/inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotId: id, templateId: selectedTemplate }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/quality/inspections/${data.id}`);
    }
    setCreating(false);
  };

  const generateCoa = async () => {
    setGeneratingCoa(true);
    const res = await fetch("/api/qms/coas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotId: id }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/quality/coa/${data.id}`);
    } else {
      const err = await res.json();
      alert(err.error || "Failed to generate COA");
    }
    setGeneratingCoa(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!lot) return null;

  const lotStatus = lot.status as string;
  const yieldPct = lot.yield_percentage as number | null;
  const canChangeStatus = isManager;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/quality/lots">
            <Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-bold font-mono">{lot.lot_number as string}</h1>
              <Badge className={`text-xs border ${statusColors[lotStatus] || ""}`}>
                {statusLabels[lotStatus] || lotStatus}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {lot.material_type_name as string || "—"} {lot.customer_po_number ? `· PO: ${lot.customer_po_number}` : ""}
            </p>
          </div>
          {isManager && lotStatus === "approved" && !coa && (
            <Button size="sm" onClick={generateCoa} disabled={generatingCoa} className="bg-green-600 hover:bg-green-700">
              {generatingCoa ? <Loader2 size={14} className="animate-spin mr-1" /> : <FileCheck2 size={14} className="mr-1" />}
              Generate COA
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Lot Info Card */}
        <Card>
          <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Input Weight</p>
              <p className="font-semibold">{lot.input_weight_kg != null ? `${(lot.input_weight_kg as number).toLocaleString()} kg` : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Output Weight</p>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={outputWeight}
                  onChange={e => setOutputWeight(e.target.value)}
                  className="h-7 text-sm w-24"
                  placeholder="kg"
                />
                <Button size="sm" className="h-7 px-2 text-xs" onClick={saveOutputWeight} disabled={savingWeight}>
                  {savingWeight ? <Loader2 size={10} className="animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Yield</p>
              <p className={`font-semibold ${yieldPct != null && yieldPct < 90 ? "text-amber-400" : "text-green-400"}`}>
                {yieldPct != null ? `${yieldPct.toFixed(1)}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-sm">{new Date(lot.created_at as string).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Status Actions (manager) */}
        {canChangeStatus && (
          <div className="flex gap-2">
            {lotStatus === "qc_in_progress" && (
              <>
                <Button size="sm" onClick={() => { setTargetStatus("approved"); setStatusDialogOpen(true); }} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 size={14} className="mr-1" /> Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => { setTargetStatus("rejected"); setStatusDialogOpen(true); }}>
                  <XCircle size={14} className="mr-1" /> Reject
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setTargetStatus("on_hold"); setStatusDialogOpen(true); }}>
                  <PauseCircle size={14} className="mr-1" /> Hold
                </Button>
              </>
            )}
            {lotStatus === "on_hold" && (
              <>
                <Button size="sm" onClick={() => { setTargetStatus("approved"); setStatusDialogOpen(true); }} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 size={14} className="mr-1" /> Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => { setTargetStatus("rejected"); setStatusDialogOpen(true); }}>
                  <XCircle size={14} className="mr-1" /> Reject
                </Button>
              </>
            )}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="inspections">
          <TabsList>
            <TabsTrigger value="inspections">
              <ClipboardList size={14} className="mr-1" /> Inspections ({inspections.length})
            </TabsTrigger>
            <TabsTrigger value="ncrs">
              <AlertTriangle size={14} className="mr-1" /> NCRs ({ncrs.length})
            </TabsTrigger>
            <TabsTrigger value="coa">
              <FileCheck2 size={14} className="mr-1" /> COA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inspections" className="mt-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium">Inspections</h3>
              {["quality_tech", "quality_manager", "admin", "owner"].includes(role) && (
                <Button size="sm" variant="outline" onClick={() => setNewInspectionOpen(true)}>
                  <Plus size={14} className="mr-1" /> New Inspection
                </Button>
              )}
            </div>
            {inspections.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No inspections yet</p>
            ) : (
              <div className="space-y-2">
                {inspections.map((i) => (
                  <Link key={i.id as string} href={`/quality/inspections/${i.id as string}`}>
                    <Card className="hover:border-border/80 cursor-pointer">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <Badge variant="outline" className="text-xs mr-2">{i.status as string}</Badge>
                          <span className="text-sm">{i.inspected_by_name as string}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!!i.overall_result && (
                            <Badge className={`text-xs ${i.overall_result === "PASS" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                              {i.overall_result as string}
                            </Badge>
                          )}
                          <ChevronRight size={14} className="text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ncrs" className="mt-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium">NCRs</h3>
              {isManager && (
                <Link href={`/quality/ncr/new?lotId=${id}`}>
                  <Button size="sm" variant="outline"><Plus size={14} className="mr-1" /> New NCR</Button>
                </Link>
              )}
            </div>
            {ncrs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No NCRs</p>
            ) : (
              <div className="space-y-2">
                {ncrs.map((n) => (
                  <Link key={n.id as string} href={`/quality/ncr/${n.id as string}`}>
                    <Card className="hover:border-border/80 cursor-pointer">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <span className="font-mono text-sm font-semibold mr-2">{n.ncr_number as string}</span>
                          <span className="text-sm text-muted-foreground">{n.title as string}</span>
                        </div>
                        <Badge variant={n.severity === "critical" ? "destructive" : "outline"} className="text-xs">
                          {n.severity as string}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="coa" className="mt-4">
            {coa ? (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono font-semibold">{coa.coa_number as string}</p>
                      <p className="text-xs text-muted-foreground">Issued {new Date(coa.issued_at as string).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/quality/coa/${coa.id as string}`}>
                        <Button size="sm" variant="outline">View</Button>
                      </Link>
                      <a href={`/api/qms/coas/${coa.id as string}/pdf`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm">Download PDF</Button>
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileCheck2 size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No COA generated yet</p>
                {isManager && lotStatus === "approved" && (
                  <Button className="mt-3" onClick={generateCoa} disabled={generatingCoa}>
                    Generate COA
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Lot Status</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to mark this lot as <strong>{statusLabels[targetStatus] || targetStatus}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button onClick={changeStatus} className={targetStatus === "rejected" ? "bg-red-600 hover:bg-red-700" : ""}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Inspection Dialog */}
      <Dialog open={newInspectionOpen} onOpenChange={setNewInspectionOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Start New Inspection</DialogTitle></DialogHeader>
          <div>
            <Label>Inspection Template</Label>
            <select
              value={selectedTemplate}
              onChange={e => setSelectedTemplate(e.target.value)}
              className="w-full border border-input bg-background text-sm rounded-md px-3 py-2 mt-1"
            >
              <option value="">Select template...</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewInspectionOpen(false)}>Cancel</Button>
            <Button onClick={createInspection} disabled={!selectedTemplate || creating}>
              {creating ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Start Inspection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
