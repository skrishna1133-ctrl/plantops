"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Package } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LocationUtilizationBar } from "./location-utilization-bar";

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

interface Props {
  materialType: string;
  materialName: string;
  totalLbs: number;
  totalKg: number;
  lotCount: number;
  byStatus: Record<string, { lbs: number; lotCount: number }>;
  byLocation: LocationEntry[];
}

function fmt(n: number) {
  return n.toLocaleString();
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  in_storage: { label: "In Storage",        className: "bg-blue-100 text-blue-700 border-blue-200" },
  approved:   { label: "Awaiting Shipment", className: "bg-green-100 text-green-700 border-green-200" },
};

export function MaterialInventoryCard({
  materialType, materialName, totalLbs, totalKg, lotCount, byStatus, byLocation,
}: Props) {
  const [locationsOpen, setLocationsOpen] = useState(byLocation.length <= 2);

  return (
    <Card className="border-l-4" style={{ borderLeftColor: "hsl(var(--primary))" }}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{materialType}</p>
              <p className="text-sm font-semibold text-foreground leading-tight">{materialName}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold tabular-nums">{fmt(totalLbs)}</p>
            <p className="text-xs text-muted-foreground">lbs on hand</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* Lot count */}
        <p className="text-xs text-muted-foreground">{lotCount} lot{lotCount !== 1 ? "s" : ""} · {fmt(totalKg)} kg</p>

        {/* Status breakdown */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(byStatus).map(([status, data]) => {
            const style = STATUS_STYLES[status] ?? { label: status, className: "bg-slate-100 text-slate-700 border-slate-200" };
            return (
              <span
                key={status}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.className}`}
              >
                {fmt(data.lbs)} lbs · {style.label} ({data.lotCount})
              </span>
            );
          })}
        </div>

        {/* Location breakdown */}
        <div>
          <button
            onClick={() => setLocationsOpen(o => !o)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {locationsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {byLocation.length} location{byLocation.length !== 1 ? "s" : ""}
          </button>

          {locationsOpen && (
            <div className="mt-2 space-y-3 pl-1 border-l-2 border-muted ml-1">
              {byLocation.map(loc => (
                <div key={loc.locationId} className="pl-3 space-y-1.5">
                  <LocationUtilizationBar
                    locationName={loc.locationName}
                    onHandLbs={loc.onHandLbs}
                    capacityLbs={loc.capacityLbs}
                    utilizationPct={loc.utilizationPct}
                  />
                  {/* Lots in this location */}
                  <div className="space-y-0.5">
                    {loc.lots.map(lot => (
                      <div key={lot.lotId} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-mono">{lot.lotNumber}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] py-0 ${STATUS_STYLES[lot.status]?.className ?? ""}`}>
                            {STATUS_STYLES[lot.status]?.label ?? lot.status}
                          </Badge>
                          <span className="tabular-nums">{fmt(lot.weightLbs)} lbs</span>
                          <span className="text-muted-foreground/60">{lot.ageDays}d</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
