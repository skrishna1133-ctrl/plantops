"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface Customer { id: string; name: string; code?: string; contact_name?: string; contact_email?: string; contact_phone?: string; address?: string; notes?: string; active: boolean }
interface Vendor { id: string; name: string; code?: string; contact_name?: string; contact_email?: string; contact_phone?: string; address?: string; notes?: string; active: boolean }
interface Carrier { id: string; name: string; code?: string; contact_name?: string; contact_phone?: string; notes?: string; active: boolean }
interface ProcessingType { id: string; name: string; code?: string; description?: string; production_line_id?: string; active: boolean }
interface Location { id: string; name: string; code?: string; type?: string; description?: string; active: boolean }
interface ProductionLine { id: string; line_id: string; name: string; is_active: boolean }

type Tab = "customers" | "vendors" | "carriers" | "processing-types" | "locations";

export default function OpsSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("");
  const [activeTab, setActiveTab] = useState<Tab>("customers");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [processingTypes, setProcessingTypes] = useState<ProcessingType[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Generic form state
  const [form, setForm] = useState<Record<string, string>>({});

  const canManage = ["owner", "admin", "engineer"].includes(role);

  const refresh = async () => {
    const [c, v, ca, pt, loc, ln] = await Promise.all([
      fetch("/api/ops/customers").then(r => r.json()).catch(() => []),
      fetch("/api/ops/vendors").then(r => r.json()).catch(() => []),
      fetch("/api/ops/carriers").then(r => r.json()).catch(() => []),
      fetch("/api/ops/processing-types").then(r => r.json()).catch(() => []),
      fetch("/api/ops/locations").then(r => r.json()).catch(() => []),
      fetch("/api/maintenance/lines").then(r => r.json()).catch(() => []),
    ]);
    setCustomers(Array.isArray(c) ? c : []);
    setVendors(Array.isArray(v) ? v : []);
    setCarriers(Array.isArray(ca) ? ca : []);
    setProcessingTypes(Array.isArray(pt) ? pt : []);
    setLocations(Array.isArray(loc) ? loc : []);
    setLines(Array.isArray(ln) ? ln : []);
  };

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(data => {
      if (!data.authenticated) { router.push("/login"); return; }
      setRole(data.role);
      refresh().finally(() => setLoading(false));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm({});
    setDialogOpen(true);
  }

  function openEdit(item: Record<string, string | boolean | undefined>) {
    setEditingId(item.id as string);
    const f: Record<string, string> = {};
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === "string" || typeof v === "number") f[k] = String(v);
    }
    setForm(f);
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const tabEndpoints: Record<Tab, string> = {
      customers: "/api/ops/customers",
      vendors: "/api/ops/vendors",
      carriers: "/api/ops/carriers",
      "processing-types": "/api/ops/processing-types",
      locations: "/api/ops/locations",
    };
    const endpoint = tabEndpoints[activeTab];
    try {
      if (editingId) {
        await fetch(`${endpoint}/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      } else {
        await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      }
      setDialogOpen(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(endpoint: string, id: string, active: boolean) {
    await fetch(`${endpoint}/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !active }) });
    await refresh();
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" size={28} /></div>;
  }

  // Dialog fields per tab
  const dialogTitle = editingId ? "Edit" : "Add New";
  const renderDialogFields = () => {
    const f = (key: string, label: string, type: "input" | "textarea" | "select" = "input", options?: { value: string; label: string }[]) => (
      <div key={key} className="space-y-1">
        <Label className="text-sm">{label}</Label>
        {type === "textarea" ? (
          <Textarea value={form[key] ?? ""} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} rows={2} />
        ) : type === "select" ? (
          <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={form[key] ?? ""} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}>
            <option value="">-- Select --</option>
            {options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <Input value={form[key] ?? ""} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
        )}
      </div>
    );

    if (activeTab === "customers" || activeTab === "vendors") {
      return (
        <div className="space-y-3">
          {f("name", "Name *")}
          {f("code", "Code / Short Name")}
          {f("contactName", "Contact Name")}
          {f("contactEmail", "Contact Email")}
          {f("contactPhone", "Contact Phone")}
          {f("address", "Address", "textarea")}
          {f("notes", "Notes", "textarea")}
        </div>
      );
    }
    if (activeTab === "carriers") {
      return (
        <div className="space-y-3">
          {f("name", "Carrier Name *")}
          {f("code", "Code")}
          {f("contactName", "Contact Name")}
          {f("contactPhone", "Phone")}
          {f("notes", "Notes", "textarea")}
        </div>
      );
    }
    if (activeTab === "processing-types") {
      return (
        <div className="space-y-3">
          {f("name", "Processing Type Name *")}
          {f("code", "Code")}
          {f("description", "Description", "textarea")}
          {f("productionLineId", "Production Line", "select", lines.filter(l => l.is_active).map(l => ({ value: l.id, label: `${l.line_id} — ${l.name}` })))}
        </div>
      );
    }
    if (activeTab === "locations") {
      return (
        <div className="space-y-3">
          {f("name", "Location Name *")}
          {f("code", "Code")}
          {f("type", "Type", "select", [
            { value: "storage", label: "Storage" },
            { value: "staging", label: "Staging" },
            { value: "production", label: "Production" },
            { value: "shipping", label: "Shipping / Dock" },
            { value: "other", label: "Other" },
          ])}
          {f("description", "Description", "textarea")}
        </div>
      );
    }
    return null;
  };

  const renderTable = (items: Record<string, string | boolean | undefined>[], cols: { key: string; label: string }[], endpoint: string) => (
    <div>
      {canManage && (
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={openCreate}><Plus size={14} className="mr-1" />Add New</Button>
        </div>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No entries yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                {cols.map(c => <th key={c.key} className="text-left px-3 py-2 font-medium">{c.label}</th>)}
                <th className="px-3 py-2 font-medium text-right">Status</th>
                {canManage && <th className="px-3 py-2 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item, i) => (
                <tr key={item.id as string ?? i} className="hover:bg-muted/30">
                  {cols.map(c => <td key={c.key} className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{item[c.key] as string ?? "—"}</td>)}
                  <td className="px-3 py-2 text-right">
                    <Badge variant={item.active !== false ? "default" : "secondary"} className="text-xs">
                      {item.active !== false ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  {canManage && (
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(item as Record<string, string | boolean | undefined>)}>
                          <Pencil size={13} />
                        </Button>
                        <Button size="sm" variant="ghost" className={item.active !== false ? "text-muted-foreground" : "text-green-500"}
                          onClick={() => toggleActive(endpoint, item.id as string, item.active !== false)}>
                          {item.active !== false ? <X size={13} /> : <Check size={13} />}
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/ops">
            <Button variant="ghost" size="sm"><ArrowLeft size={16} className="mr-1" />Operations</Button>
          </Link>
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as Tab)}>
          <TabsList className="mb-6 flex flex-wrap gap-1 h-auto">
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
            <TabsTrigger value="carriers">Carriers</TabsTrigger>
            <TabsTrigger value="processing-types">Processing Types</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
          </TabsList>

          <TabsContent value="customers">
            <Card><CardHeader><CardTitle className="text-base">Customers</CardTitle></CardHeader><CardContent>
              {renderTable(customers as unknown as Record<string, string | boolean | undefined>[],
                [{ key: "name", label: "Name" }, { key: "code", label: "Code" }, { key: "contact_name", label: "Contact" }, { key: "contact_phone", label: "Phone" }],
                "/api/ops/customers")}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="vendors">
            <Card><CardHeader><CardTitle className="text-base">Vendors / Suppliers</CardTitle></CardHeader><CardContent>
              {renderTable(vendors as unknown as Record<string, string | boolean | undefined>[],
                [{ key: "name", label: "Name" }, { key: "code", label: "Code" }, { key: "contact_name", label: "Contact" }, { key: "contact_phone", label: "Phone" }],
                "/api/ops/vendors")}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="carriers">
            <Card><CardHeader><CardTitle className="text-base">Carriers / Trucking</CardTitle></CardHeader><CardContent>
              {renderTable(carriers as unknown as Record<string, string | boolean | undefined>[],
                [{ key: "name", label: "Name" }, { key: "code", label: "Code" }, { key: "contact_name", label: "Contact" }, { key: "contact_phone", label: "Phone" }],
                "/api/ops/carriers")}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="processing-types">
            <Card><CardHeader><CardTitle className="text-base">Processing Types</CardTitle></CardHeader><CardContent>
              {renderTable(processingTypes as unknown as Record<string, string | boolean | undefined>[],
                [{ key: "name", label: "Name" }, { key: "code", label: "Code" }, { key: "description", label: "Description" }],
                "/api/ops/processing-types")}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="locations">
            <Card><CardHeader><CardTitle className="text-base">Storage Locations</CardTitle></CardHeader><CardContent>
              {renderTable(locations as unknown as Record<string, string | boolean | undefined>[],
                [{ key: "name", label: "Name" }, { key: "code", label: "Code" }, { key: "type", label: "Type" }, { key: "description", label: "Description" }],
                "/api/ops/locations")}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle} {activeTab === "customers" ? "Customer" : activeTab === "vendors" ? "Vendor" : activeTab === "carriers" ? "Carrier" : activeTab === "processing-types" ? "Processing Type" : "Location"}</DialogTitle>
          </DialogHeader>
          <div className="py-2">{renderDialogFields()}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              {editingId ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
