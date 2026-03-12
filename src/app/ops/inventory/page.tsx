"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { CompanyBadge } from "@/components/company-badge";
import { MaterialInventoryCard } from "@/components/inventory/material-inventory-card";
import { InventoryHistogram } from "@/components/inventory/inventory-histogram";
import { LocationUtilizationBar } from "@/components/inventory/location-utilization-bar";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Lot {
  lotId: string;
  lotNumber: string;
  status: string;
  weightLbs: number;
  ageDays: number;
}

interface LocationEntry {
  locationId: string;
  locationName: string;
  locationType: string | null;
  capacityLbs: number | null;
  onHandLbs: number;
  utilizationPct: number | null;
  lots: Lot[];
}

interface MaterialTotal {
  materialTypeId: string;
  materialType: string;
  materialName: string;
  totalLbs: number;
  totalKg: number;
  lotCount: number;
  byStatus: Record<string, { lbs: number; lotCount: number }>;
  byLocation: LocationEntry[];
}

interface LocationSummaryEntry {
  locationName: string;
  onHandLbs: number;
  capacityLbs: number | null;
  utilizationPct: number | null;
}

interface CurrentData {
  asOf: string;
  totals: MaterialTotal[];
  grandTotalLbs: number;
  locationSummary: LocationSummaryEntry[];
}

interface SnapshotEntry {
  date: string;
  [materialType: string]: string | { lbs: number; lotCount: number };
}

interface HistoryData {
  range: { from: string; to: string };
  materials: string[];
  snapshots: SnapshotEntry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString();
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const router = useRouter();

  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [current, setCurrent]           = useState<CurrentData | null>(null);
  const [history, setHistory]           = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [companyName, setCompanyName]   = useState<string>("");
  const [logoUrl, setLogoUrl]           = useState<string | null>(null);

  // History controls
  const [days, setDays]                   = useState(30);
  const [materialFilter, setMaterialFilter] = useState<string | null>(null);

  // Auto-refresh interval ref
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auth check + initial load ─────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/auth")
      .then(r => r.json())
      .then(data => {
        if (!data.authenticated) {
          router.push("/login?from=/ops/inventory");
          return;
        }
        setCompanyName(data.companyName ?? "");
        setLogoUrl(data.logoUrl ?? null);
        loadCurrent();
      });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh current panel every 5 min
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => loadCurrent(true), 5 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload history when days or material filter changes
  useEffect(() => {
    if (!loading) loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, materialFilter]);

  const loadCurrent = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/ops/inventory/current");
      if (res.ok) {
        const data = await res.json() as CurrentData;
        setCurrent(data);
        // Load history after first current load
        if (!isRefresh) loadHistory();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (materialFilter) params.set("material", materialFilter);
      const res = await fetch(`/api/ops/inventory/history?${params}`);
      if (res.ok) setHistory(await res.json() as HistoryData);
    } finally {
      setHistoryLoading(false);
    }
  }, [days, materialFilter]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={28} />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/ops">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowLeft size={14} /> OPS
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Warehouse size={16} className="text-blue-600" />
              <div>
                <h1 className="text-sm font-semibold leading-none">Inventory</h1>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Showing: In Storage · Awaiting Shipment
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadCurrent(true)}
              disabled={refreshing}
              className="gap-1.5 text-xs"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </Button>
            <CompanyBadge name={companyName} logoUrl={logoUrl} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-8">

        {/* ── PANEL 1: Current Inventory ───────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Current Inventory</h2>
              {current?.asOf && (
                <p className="text-xs text-muted-foreground">
                  As of {new Date(current.asOf).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
            {current && (
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums">{fmt(current.grandTotalLbs)}</p>
                <p className="text-xs text-muted-foreground">total lbs on hand</p>
              </div>
            )}
          </div>

          {!current || current.totals.length === 0 ? (
            <Card>
              <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
                <p className="text-sm">No inventory on hand matching the criteria.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Material cards */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {current.totals.map(mat => (
                  <MaterialInventoryCard
                    key={mat.materialType}
                    materialType={mat.materialType}
                    materialName={mat.materialName}
                    totalLbs={mat.totalLbs}
                    totalKg={mat.totalKg}
                    lotCount={mat.lotCount}
                    byStatus={mat.byStatus}
                    byLocation={mat.byLocation}
                  />
                ))}
              </div>

              {/* Location utilization summary */}
              {current.locationSummary.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold">Location Utilization</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {current.locationSummary.map(loc => (
                      <LocationUtilizationBar
                        key={loc.locationName}
                        locationName={loc.locationName}
                        onHandLbs={loc.onHandLbs}
                        capacityLbs={loc.capacityLbs}
                        utilizationPct={loc.utilizationPct}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </section>

        {/* ── PANEL 2: Inventory History ───────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">Inventory History</h2>
            <p className="text-xs text-muted-foreground">
              Daily snapshots — recorded nightly at 11 pm
            </p>
          </div>

          <Card>
            <CardContent className="p-4">
              {historyLoading ? (
                <div className="flex h-52 items-center justify-center">
                  <Loader2 className="animate-spin text-muted-foreground" size={22} />
                </div>
              ) : (
                <InventoryHistogram
                  snapshots={(history?.snapshots ?? []) as Parameters<typeof InventoryHistogram>[0]["snapshots"]}
                  materials={history?.materials ?? []}
                  days={days}
                  onDaysChange={setDays}
                  materialFilter={materialFilter}
                  onMaterialChange={setMaterialFilter}
                />
              )}
              {history?.snapshots && history.snapshots.length > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  History from {history.range.from} to {history.range.to}
                </p>
              )}
            </CardContent>
          </Card>
        </section>

      </main>
    </div>
  );
}
