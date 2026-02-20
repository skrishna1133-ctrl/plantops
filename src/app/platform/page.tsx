"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Building2, ArrowRight, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

interface Tenant {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

export default function PlatformPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetch("/api/tenants")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTenants(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
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
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-red-400"
            >
              <LogOut size={14} className="mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Select a Tenant</h2>
          <p className="text-muted-foreground mt-1">
            Click a tenant to view and manage their dashboard.
          </p>
        </div>

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
            <p className="text-sm mt-1">Create a tenant to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map((tenant) => (
              <button
                key={tenant.id}
                onClick={() => router.push(`/platform/${tenant.id}`)}
                className="group text-left rounded-xl border border-border bg-card hover:border-violet-500 hover:bg-violet-500/5 transition-all duration-200 p-6 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-11 h-11 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center group-hover:bg-violet-600/20 transition-colors">
                    <Building2 size={20} className="text-violet-500" />
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs font-mono ${
                      tenant.active
                        ? "border-green-500/30 text-green-400"
                        : "border-red-500/30 text-red-400"
                    }`}
                  >
                    {tenant.active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <h3 className="text-lg font-semibold">{tenant.name}</h3>
                <p className="text-sm text-muted-foreground font-mono mt-0.5">{tenant.code}</p>

                <div className="flex items-center gap-1.5 mt-4 text-sm font-medium text-violet-500 group-hover:gap-2.5 transition-all">
                  Enter Dashboard
                  <ArrowRight size={14} />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
