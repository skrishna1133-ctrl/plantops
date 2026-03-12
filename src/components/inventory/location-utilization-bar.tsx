"use client";

interface Props {
  locationName: string;
  onHandLbs: number;
  capacityLbs: number | null;
  utilizationPct: number | null;
}

function fmt(n: number) {
  return n.toLocaleString();
}

function barColor(pct: number) {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-green-500";
}

export function LocationUtilizationBar({ locationName, onHandLbs, capacityLbs, utilizationPct }: Props) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{locationName}</span>
        {capacityLbs != null && utilizationPct != null ? (
          <span className="text-muted-foreground">
            {fmt(onHandLbs)} / {fmt(capacityLbs)} lbs ({utilizationPct}%)
          </span>
        ) : (
          <span className="text-muted-foreground">{fmt(onHandLbs)} lbs</span>
        )}
      </div>
      {capacityLbs != null && utilizationPct != null && (
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor(utilizationPct)}`}
            style={{ width: `${Math.min(utilizationPct, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
