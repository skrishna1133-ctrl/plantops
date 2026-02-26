/**
 * QMS multi-reading statistics.
 * Used on both server (submit route) and client (inspection fill UI).
 */

export const STATISTICS = [
  { value: "none",     label: "None (record only)" },
  { value: "average",  label: "Average (Mean)" },
  { value: "median",   label: "Median" },
  { value: "sum",      label: "Sum" },
  { value: "range",    label: "Range (Max − Min)" },
  { value: "mode",     label: "Mode (Most Frequent)" },
  { value: "min",      label: "Minimum" },
  { value: "max",      label: "Maximum" },
  { value: "std_dev",  label: "Std Deviation (σ)" },
  { value: "cv_pct",   label: "CV %" },
] as const;

export type Statistic = typeof STATISTICS[number]["value"];

export function statisticLabel(stat: string): string {
  return STATISTICS.find(s => s.value === stat)?.label ?? stat;
}

/**
 * Compute the chosen statistic from an array of readings.
 * Returns null if readings is empty.
 */
export function computeStatistic(readings: number[], statistic: string): number | null {
  if (readings.length === 0) return null;

  switch (statistic) {
    case "none":
      return null; // record readings only, no aggregation

    case "average":
      return readings.reduce((a, b) => a + b, 0) / readings.length;

    case "median": {
      const sorted = [...readings].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    }

    case "sum":
      return readings.reduce((a, b) => a + b, 0);

    case "range":
      return Math.max(...readings) - Math.min(...readings);

    case "mode": {
      const freq: Record<string, number> = {};
      for (const v of readings) freq[String(v)] = (freq[String(v)] || 0) + 1;
      let maxFreq = 0, modeVal = readings[0];
      for (const [k, f] of Object.entries(freq)) {
        if (f > maxFreq) { maxFreq = f; modeVal = parseFloat(k); }
      }
      return modeVal;
    }

    case "min":
      return Math.min(...readings);

    case "max":
      return Math.max(...readings);

    case "std_dev": {
      const avg = readings.reduce((a, b) => a + b, 0) / readings.length;
      const variance = readings.reduce((a, b) => a + (b - avg) ** 2, 0) / readings.length;
      return Math.sqrt(variance);
    }

    case "cv_pct": {
      const avg = readings.reduce((a, b) => a + b, 0) / readings.length;
      if (avg === 0) return null;
      const stdDev = Math.sqrt(readings.reduce((a, b) => a + (b - avg) ** 2, 0) / readings.length);
      return (stdDev / avg) * 100;
    }

    default:
      return readings.reduce((a, b) => a + b, 0) / readings.length;
  }
}
