"use client";

interface CompanyBadgeProps {
  name: string | null;
  logoUrl?: string | null;
  className?: string;
}

const COLORS = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-orange-600",
  "bg-purple-600",
  "bg-red-600",
  "bg-teal-600",
  "bg-indigo-600",
  "bg-rose-600",
];

function pickColor(name: string): string {
  const idx = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % COLORS.length;
  return COLORS[idx];
}

export function CompanyBadge({ name, logoUrl, className = "" }: CompanyBadgeProps) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name ?? "Company logo"}
        className={`h-8 w-auto max-w-[120px] object-contain ${className}`}
      />
    );
  }

  if (!name) return null;

  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <div
      className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${pickColor(name)} ${className}`}
    >
      <span className="text-white text-[10px] font-bold tracking-tight">{initials}</span>
    </div>
  );
}
