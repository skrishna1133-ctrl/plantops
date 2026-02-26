"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Settings, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const PARAM_TYPES = ["numeric", "percentage", "pass_fail", "text", "visual_rating", "photo", "calculated"];

interface MaterialType { id: string; name: string; code: string; description?: string }
interface Parameter { id: string; name: string; code: string; parameter_type: string; unit?: string; formula?: string }
interface Template { id: string; name: string; material_type_name?: string; revision_number: number }

export default function ConfigPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  // Dialogs
  const [newMtOpen, setNewMtOpen] = useState(false);
  const [newParamOpen, setNewParamOpen] = useState(false);
  const [newTplOpen, setNewTplOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Forms
  const [mtForm, setMtForm] = useState({ name: "", code: "", description: "" });
  const [paramForm, setParamForm] = useState({ name: "", code: "", parameterType: "numeric", unit: "", description: "", formula: "" });
  const [tplForm, setTplForm] = useState({ name: "", materialTypeId: "" });
  const [tplItems, setTplItems] = useState<Array<{ parameterId: string; minValue: string; maxValue: string; isRequired: boolean; instructions: string }>>([]);

  const refresh = async () => {
    const [mt, p, t] = await Promise.all([
      fetch("/api/qms/material-types").then(r => r.json()),
      fetch("/api/qms/parameters").then(r => r.json()),
      fetch("/api/qms/templates").then(r => r.json()),
    ]);
    setMaterialTypes(Array.isArray(mt) ? mt : []);
    setParameters(Array.isArray(p) ? p : []);
    setTemplates(Array.isArray(t) ? t : []);
  };

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(data => {
      if (!data.authenticated) { router.push("/login"); return; }
      if (!["quality_manager", "admin", "owner"].includes(data.role)) {
        router.push("/quality");
        return;
      }
      refresh().finally(() => setLoading(false));
    });
  }, []);

  const saveMaterialType = async () => {
    if (!mtForm.name || !mtForm.code) return;
    setSaving(true);
    await fetch("/api/qms/material-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mtForm),
    });
    setMtForm({ name: "", code: "", description: "" });
    setNewMtOpen(false);
    await refresh();
    setSaving(false);
  };

  const saveParameter = async () => {
    if (!paramForm.name || !paramForm.code) return;
    setSaving(true);
    await fetch("/api/qms/parameters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paramForm),
    });
    setParamForm({ name: "", code: "", parameterType: "numeric", unit: "", description: "", formula: "" });
    setNewParamOpen(false);
    await refresh();
    setSaving(false);
  };

  const addTplItem = () => {
    setTplItems(prev => [...prev, { parameterId: "", minValue: "", maxValue: "", isRequired: true, instructions: "" }]);
  };

  const saveTemplate = async () => {
    if (!tplForm.name) return;
    setSaving(true);
    const items = tplItems.filter(i => i.parameterId).map(i => ({
      parameterId: i.parameterId,
      minValue: i.minValue ? parseFloat(i.minValue) : undefined,
      maxValue: i.maxValue ? parseFloat(i.maxValue) : undefined,
      isRequired: i.isRequired,
      instructions: i.instructions || undefined,
    }));
    await fetch("/api/qms/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tplForm.name, materialTypeId: tplForm.materialTypeId || undefined, items }),
    });
    setTplForm({ name: "", materialTypeId: "" });
    setTplItems([]);
    setNewTplOpen(false);
    await refresh();
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/quality"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div className="flex-1">
            <h1 className="font-bold flex items-center gap-2"><Settings size={16} /> QMS Configuration</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* BD & Metal Contamination hint */}
        <div className="mb-6 p-4 rounded-lg border border-blue-500/30 bg-blue-500/5 text-sm">
          <p className="font-medium text-blue-400 mb-1">Getting Started — BD & Metal Contamination Template</p>
          <p className="text-muted-foreground text-xs">
            Create these parameters first: <strong>Gross Weight</strong> (numeric, g), <strong>Net Weight</strong> (numeric, g),
            <strong> Bulk Density</strong> (numeric, g/cc), <strong>Bulk Density</strong> (numeric, lb/ft³),
            <strong> Metal Contamination</strong> (numeric, g), <strong>Metal Contamination %</strong> (percentage).
            Then create an inspection template named &ldquo;BD & Metal Contamination&rdquo; using these parameters.
          </p>
        </div>

        <Tabs defaultValue="material-types">
          <TabsList className="mb-6">
            <TabsTrigger value="material-types">Material Types ({materialTypes.length})</TabsTrigger>
            <TabsTrigger value="parameters">Parameters ({parameters.length})</TabsTrigger>
            <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
          </TabsList>

          {/* Material Types */}
          <TabsContent value="material-types">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Material Types</h2>
              <Button size="sm" onClick={() => setNewMtOpen(true)}><Plus size={14} className="mr-1" /> Add</Button>
            </div>
            <div className="space-y-2">
              {materialTypes.map(mt => (
                <Card key={mt.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs">{mt.code}</Badge>
                    <div>
                      <p className="font-medium text-sm">{mt.name}</p>
                      {mt.description && <p className="text-xs text-muted-foreground">{mt.description}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {materialTypes.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No material types yet</p>}
            </div>
          </TabsContent>

          {/* Parameters */}
          <TabsContent value="parameters">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Parameters</h2>
              <Button size="sm" onClick={() => setNewParamOpen(true)}><Plus size={14} className="mr-1" /> Add</Button>
            </div>
            <div className="space-y-2">
              {parameters.map(p => (
                <Card key={p.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs">{p.code}</Badge>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.parameter_type}{p.unit ? ` · ${p.unit}` : ""}</p>
                      {p.formula && <p className="text-xs font-mono text-blue-400 mt-0.5">= {p.formula}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {parameters.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No parameters yet</p>}
            </div>
          </TabsContent>

          {/* Templates */}
          <TabsContent value="templates">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Inspection Templates</h2>
              <Button size="sm" onClick={() => setNewTplOpen(true)} disabled={parameters.length === 0}>
                <Plus size={14} className="mr-1" /> New Template
              </Button>
            </div>
            {parameters.length === 0 && (
              <p className="text-sm text-amber-400 mb-4">Add parameters before creating templates.</p>
            )}
            <div className="space-y-2">
              {templates.map(t => (
                <Card key={t.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.material_type_name ? `${t.material_type_name} · ` : ""}Rev. {t.revision_number}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">v{t.revision_number}</Badge>
                  </CardContent>
                </Card>
              ))}
              {templates.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No templates yet</p>}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* New Material Type Dialog */}
      <Dialog open={newMtOpen} onOpenChange={setNewMtOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Material Type</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name <span className="text-red-400">*</span></Label>
              <Input value={mtForm.name} onChange={e => setMtForm(f => ({ ...f, name: e.target.value }))} className="mt-1" placeholder="e.g. HDPE Regrind" /></div>
            <div><Label>Code <span className="text-red-400">*</span></Label>
              <Input value={mtForm.code} onChange={e => setMtForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className="mt-1 font-mono" placeholder="e.g. HDPE-REG" /></div>
            <div><Label>Description</Label>
              <Input value={mtForm.description} onChange={e => setMtForm(f => ({ ...f, description: e.target.value }))} className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewMtOpen(false)}>Cancel</Button>
            <Button onClick={saveMaterialType} disabled={!mtForm.name || !mtForm.code || saving}>
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Parameter Dialog */}
      <Dialog open={newParamOpen} onOpenChange={setNewParamOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Parameter</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name <span className="text-red-400">*</span></Label>
              <Input value={paramForm.name} onChange={e => setParamForm(f => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
            <div><Label>Code <span className="text-red-400">*</span></Label>
              <Input value={paramForm.code} onChange={e => setParamForm(f => ({ ...f, code: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} className="mt-1 font-mono" placeholder="e.g. bulk_density_gcc" /></div>
            <div><Label>Type</Label>
              <select value={paramForm.parameterType} onChange={e => setParamForm(f => ({ ...f, parameterType: e.target.value, formula: "" }))}
                className="w-full border border-input bg-background text-sm rounded-md px-3 py-2 mt-1">
                {PARAM_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select></div>
            {paramForm.parameterType === "calculated" ? (
              <div>
                <Label>Formula <span className="text-red-400">*</span></Label>
                <Input
                  value={paramForm.formula}
                  onChange={e => setParamForm(f => ({ ...f, formula: e.target.value }))}
                  className="mt-1 font-mono"
                  placeholder="e.g. bulk_density_gcc * 62.428"
                />
                {parameters.length > 0 && (
                  <div className="mt-2 p-2 rounded bg-muted/40 text-xs">
                    <p className="font-medium mb-1 text-muted-foreground">Available parameter codes:</p>
                    <div className="flex flex-wrap gap-1">
                      {parameters.filter(p => p.parameter_type !== "calculated" && p.parameter_type !== "photo" && p.parameter_type !== "pass_fail" && p.parameter_type !== "text").map(p => (
                        <code key={p.id} className="bg-background border border-border rounded px-1 py-0.5 text-xs cursor-pointer hover:bg-muted"
                          onClick={() => setParamForm(f => ({ ...f, formula: f.formula + p.code }))}>
                          {p.code}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div><Label>Unit</Label>
                <Input value={paramForm.unit} onChange={e => setParamForm(f => ({ ...f, unit: e.target.value }))} className="mt-1" placeholder="g/cc, %, kg..." /></div>
            )}
            {paramForm.parameterType === "calculated" && (
              <div><Label>Unit (display only)</Label>
                <Input value={paramForm.unit} onChange={e => setParamForm(f => ({ ...f, unit: e.target.value }))} className="mt-1" placeholder="e.g. lb/ft³" /></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewParamOpen(false)}>Cancel</Button>
            <Button onClick={saveParameter} disabled={!paramForm.name || !paramForm.code || (paramForm.parameterType === "calculated" && !paramForm.formula) || saving}>
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Template Dialog */}
      <Dialog open={newTplOpen} onOpenChange={setNewTplOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Inspection Template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Template Name <span className="text-red-400">*</span></Label>
                <Input value={tplForm.name} onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
              <div><Label>Material Type</Label>
                <select value={tplForm.materialTypeId} onChange={e => setTplForm(f => ({ ...f, materialTypeId: e.target.value }))}
                  className="w-full border border-input bg-background text-sm rounded-md px-3 py-2 mt-1">
                  <option value="">Any material</option>
                  {materialTypes.map(mt => <option key={mt.id} value={mt.id}>{mt.name}</option>)}
                </select></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Parameters</Label>
                <Button size="sm" variant="outline" onClick={addTplItem}><Plus size={14} className="mr-1" /> Add Parameter</Button>
              </div>
              <div className="space-y-2">
                {tplItems.map((item, i) => (
                  <Card key={i} className="bg-muted/30">
                    <CardContent className="p-3 space-y-2">
                      <select value={item.parameterId} onChange={e => setTplItems(prev => prev.map((it, j) => j === i ? { ...it, parameterId: e.target.value } : it))}
                        className="w-full border border-input bg-background text-sm rounded-md px-3 py-1.5">
                        <option value="">Select parameter...</option>
                        {parameters.map(p => <option key={p.id} value={p.id}>{p.name} ({p.parameter_type})</option>)}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">Min</Label>
                          <Input type="number" value={item.minValue} onChange={e => setTplItems(prev => prev.map((it, j) => j === i ? { ...it, minValue: e.target.value } : it))} className="h-7 text-xs mt-0.5" /></div>
                        <div><Label className="text-xs">Max</Label>
                          <Input type="number" value={item.maxValue} onChange={e => setTplItems(prev => prev.map((it, j) => j === i ? { ...it, maxValue: e.target.value } : it))} className="h-7 text-xs mt-0.5" /></div>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <input type="checkbox" checked={item.isRequired} onChange={e => setTplItems(prev => prev.map((it, j) => j === i ? { ...it, isRequired: e.target.checked } : it))} />
                          Required
                        </label>
                        <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400" onClick={() => setTplItems(prev => prev.filter((_, j) => j !== i))}>Remove</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {tplItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No parameters added yet</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNewTplOpen(false); setTplItems([]); }}>Cancel</Button>
            <Button onClick={saveTemplate} disabled={!tplForm.name || saving}>
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null} Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
