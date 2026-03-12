"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface SnapshotEntry {
  date: string;
  [materialType: string]: string | { lbs: number; lotCount: number };
}

interface Props {
  snapshots: SnapshotEntry[];
  materials: string[];
  days: number;
  onDaysChange: (days: number) => void;
  materialFilter: string | null;
  onMaterialChange: (material: string | null) => void;
}

// Fixed color palette; falls back to cycling if more than defined
const PALETTE: Record<string, string> = {
  HDPE:  "#2563EB",
  PP:    "#16A34A",
  PET:   "#D97706",
  LDPE:  "#7C3AED",
  OCC:   "#0891B2",
  LLDPE: "#DC2626",
  HIPS:  "#EA580C",
  ABS:   "#4F46E5",
};
const FALLBACK_COLORS = ["#64748B", "#0F172A", "#6D28D9", "#0369A1", "#047857"];

function colorFor(material: string, index: number): string {
  return PALETTE[material] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtLbs(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return String(value);
}

// Transform snapshots so recharts can read flat numeric values per material
function flattenSnapshots(snapshots: SnapshotEntry[], materials: string[]) {
  return snapshots.map(s => {
    const row: Record<string, unknown> = { date: s.date, dateLabel: fmtDate(s.date as string) };
    for (const mat of materials) {
      const entry = s[mat] as { lbs: number; lotCount: number } | undefined;
      row[mat] = entry?.lbs ?? 0;
      row[`${mat}_lots`] = entry?.lotCount ?? 0;
    }
    return row;
  });
}

const DAY_OPTIONS = [
  { label: "7d",  value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
  { label: "1y",  value: 365 },
];

export function InventoryHistogram({
  snapshots, materials, days, onDaysChange, materialFilter, onMaterialChange,
}: Props) {
  const activeMaterials = materialFilter ? [materialFilter] : materials;
  const chartData = flattenSnapshots(snapshots, activeMaterials);

  const isEmpty = snapshots.length === 0;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range */}
        <div className="flex rounded-md border overflow-hidden text-xs">
          {DAY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onDaysChange(opt.value)}
              className={`px-3 py-1.5 font-medium transition-colors ${
                days === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Material filter */}
        {materials.length > 1 && (
          <select
            value={materialFilter ?? ""}
            onChange={e => onMaterialChange(e.target.value || null)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            <option value="">All Materials</option>
            {materials.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
      </div>

      {/* Chart */}
      {isEmpty ? (
        <div className="flex h-52 items-center justify-center rounded-lg border border-dashed">
          <div className="text-center text-muted-foreground">
            <p className="text-sm font-medium">No history yet</p>
            <p className="text-xs mt-1">Daily snapshots will appear here starting tomorrow.</p>
          </div>
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={fmtLbs}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const total = (payload as unknown as Array<{ value: number }>).reduce((s, p) => s + (p.value || 0), 0);
                  return (
                    <div className="rounded-md border bg-background p-2 shadow-md text-xs space-y-1">
                      <p className="font-semibold">{label}</p>
                      {(payload as unknown as Array<{ name?: string; value?: number; color?: string }>).map((p) => (
                        <div key={String(p.name)} className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
                          <span className="text-muted-foreground">{p.name}:</span>
                          <span className="font-medium tabular-nums">{(p.value ?? 0).toLocaleString()} lbs</span>
                        </div>
                      ))}
                      {payload.length > 1 && (
                        <div className="border-t pt-1 flex justify-between font-semibold">
                          <span>Total</span>
                          <span>{total.toLocaleString()} lbs</span>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              {activeMaterials.length > 1 && (
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  iconType="circle"
                  iconSize={8}
                />
              )}
              {activeMaterials.map((mat, i) => (
                <Bar
                  key={mat}
                  dataKey={mat}
                  stackId="inventory"
                  fill={colorFor(mat, i)}
                  radius={i === activeMaterials.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
