"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Building2, ArrowRight, Globe, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { CompanyBadge } from "@/components/company-badge";

interface Tenant {
  id: string;
  name: string;
  code: string;
  active: boolean;
  logoUrl?: string | null;
}

export default function PlatformPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", code: "", logoUrl: "" });
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Logo edit state
  const [editLogoId, setEditLogoId] = useState<string | null>(null);
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [savingLogo, setSavingLogo] = useState(false);

  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated || data.role !== "super_admin") {
          router.push("/login");
        }
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const loadTenants = () => {
    fetch("/api/tenants")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTenants(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTenants(); }, []);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  };

  const handleCreate = async () => {
    setCreateError(null);
    if (!createForm.name.trim() || !createForm.code.trim()) {
      setCreateError("Name and company code are required.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
          code: createForm.code.trim(),
          logoUrl: createForm.logoUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || "Failed to create tenant."); return; }
      setShowCreate(false);
      setCreateForm({ name: "", code: "", logoUrl: "" });
      loadTenants();
    } finally {
      setCreating(false);
    }
  };

  const handleSaveLogo = async (id: string) => {
    setSavingLogo(true);
    try {
      await fetch(`/api/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: editLogoUrl.trim() || null }),
      });
      setEditLogoId(null);
      loadTenants();
    } finally {
      setSavingLogo(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center">
              <Globe className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">PlantOps Platform</h1>
              <p className="text-xs text-muted-foreground">Super Admin — Platform Administration</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-red-400">
              <LogOut size={14} className="mr-2" />Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Tenants</h2>
            <p className="text-muted-foreground mt-1">Manage companies using PlantOps.</p>
          </div>
          <Button onClick={() => { setShowCreate(true); setCreateError(null); }} className="gap-2">
            <Plus size={16} />New Tenant
          </Button>
        </div>

        {/* Create Tenant Form */}
        {showCreate && (
          <div className="mb-8 rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">New Tenant</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Company Name *</label>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Frankfort Plastics"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Company Code *</label>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="FPFI"
                  value={createForm.code}
                  onChange={(e) => setCreateForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Logo URL (optional)</label>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="https://..."
                  value={createForm.logoUrl}
                  onChange={(e) => setCreateForm(f => ({ ...f, logoUrl: e.target.value }))}
                />
              </div>
            </div>
            {createError && <p className="text-sm text-red-400 mb-3">{createError}</p>}
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={creating} size="sm">
                {creating ? "Creating…" : "Create Tenant"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No tenants found</p>
            <p className="text-sm mt-1">Click "New Tenant" to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map((tenant) => (
              <div
                key={tenant.id}
                className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <CompanyBadge name={tenant.name} logoUrl={tenant.logoUrl} className="w-11 h-11 text-sm" />
                  <Badge
                    variant="outline"
                    className={`text-xs font-mono ${tenant.active ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"}`}
                  >
                    {tenant.active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-lg font-semibold">{tenant.name}</h3>
                  <p className="text-sm text-muted-foreground font-mono mt-0.5">{tenant.code}</p>
                </div>

                {/* Logo URL inline edit */}
                {editLogoId === tenant.id ? (
                  <div className="flex gap-2 items-center">
                    <input
                      className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="https://..."
                      value={editLogoUrl}
                      onChange={(e) => setEditLogoUrl(e.target.value)}
                      autoFocus
                    />
                    <Button size="sm" className="text-xs px-2 py-1 h-auto" onClick={() => handleSaveLogo(tenant.id)} disabled={savingLogo}>
                      {savingLogo ? "…" : "Save"}
                    </Button>
                    <button onClick={() => setEditLogoId(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditLogoId(tenant.id); setEditLogoUrl(tenant.logoUrl ?? ""); }}
                    className="text-xs text-muted-foreground hover:text-violet-400 text-left"
                  >
                    {tenant.logoUrl ? "Change logo URL" : "Set logo URL"}
                  </button>
                )}

                <button
                  onClick={() => router.push(`/platform/${tenant.id}`)}
                  className="flex items-center gap-1.5 mt-1 text-sm font-medium text-violet-500 hover:gap-2.5 transition-all"
                >
                  Enter Dashboard <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
