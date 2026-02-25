"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ActivityLogEntry {
  id: string;
  userId: string;
  userName: string | null;
  role: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  created: "bg-green-500/15 text-green-400 border-green-500/30",
  submitted: "bg-green-500/15 text-green-400 border-green-500/30",
  updated: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  signed_off: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  added_revision: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  closed: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  resolved: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  deleted: "bg-red-500/15 text-red-400 border-red-500/30",
};

const ROLE_LABELS: Record<string, string> = {
  worker: "Worker",
  quality_tech: "Quality Tech",
  engineer: "Engineer",
  shipping: "Shipping",
  admin: "Admin",
  owner: "Owner",
  maintenance_manager: "Maint. Manager",
  maintenance_tech: "Maint. Tech",
  super_admin: "Super Admin",
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  incident: "Incident",
  shipment: "Shipment",
  quality_doc: "Quality Doc",
  user: "User",
  work_order: "Work Order",
  breakdown_report: "Breakdown",
  checklist: "Checklist",
  log_sheet: "Log Sheet",
  procedure: "Procedure",
};

const ROLE_COLORS: Record<string, string> = {
  worker: "bg-gray-500/15 text-gray-400",
  quality_tech: "bg-purple-500/15 text-purple-400",
  engineer: "bg-cyan-500/15 text-cyan-400",
  shipping: "bg-indigo-500/15 text-indigo-400",
  admin: "bg-orange-500/15 text-orange-400",
  owner: "bg-orange-500/15 text-orange-400",
  maintenance_manager: "bg-blue-500/15 text-blue-400",
  maintenance_tech: "bg-sky-500/15 text-sky-400",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function actionLabel(action: string): string {
  return action.replace(/_/g, " ");
}

interface Props {
  viewAs?: string;
}

export default function ActivityLogTab({ viewAs }: Props) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (viewAs) params.set("viewAs", viewAs);
    if (entityTypeFilter !== "all") params.set("entityType", entityTypeFilter);
    if (userFilter !== "all") params.set("userId", userFilter);
    const res = await fetch(`/api/activity-log?${params.toString()}`);
    if (res.ok) setEntries(await res.json());
    setLoading(false);
  }, [viewAs, entityTypeFilter, userFilter]);

  useEffect(() => { fetch_(); }, [fetch_]);

  // Build unique users list from entries (unfiltered by user)
  const uniqueUsers = useMemo(() => {
    const seen = new Map<string, string>();
    entries.forEach(e => { if (!seen.has(e.userId)) seen.set(e.userId, e.userName || e.userId.slice(0, 8)); });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [entries]);

  // Build unique entity types from entries
  const uniqueEntityTypes = useMemo(() => {
    const seen = new Set<string>();
    entries.forEach(e => seen.add(e.entityType));
    return Array.from(seen);
  }, [entries]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={entityTypeFilter} onValueChange={v => { setEntityTypeFilter(v); }}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {uniqueEntityTypes.map(t => (
              <SelectItem key={t} value={t}>{ENTITY_TYPE_LABELS[t] ?? t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={userFilter} onValueChange={v => { setUserFilter(v); }}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="All users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {uniqueUsers.map(u => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={fetch_} disabled={loading} className="ml-auto">
          <RefreshCw size={14} className={`mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Log table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Activity size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No activity recorded yet.</p>
              <p className="text-xs mt-1">Activities from all users will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {entries.map(entry => (
                <div key={entry.id} className="px-4 py-3 flex items-start gap-4 hover:bg-muted/20 transition-colors">
                  {/* User + role */}
                  <div className="min-w-[140px] shrink-0">
                    <p className="text-sm font-medium truncate">{entry.userName ?? "Unknown"}</p>
                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium mt-0.5 ${ROLE_COLORS[entry.role] ?? "bg-gray-500/15 text-gray-400"}`}>
                      {ROLE_LABELS[entry.role] ?? entry.role}
                    </span>
                  </div>

                  {/* Action badge */}
                  <div className="shrink-0 pt-0.5">
                    <Badge variant="outline" className={`text-xs capitalize ${ACTION_COLORS[entry.action] ?? "bg-gray-500/15 text-gray-400"}`}>
                      {actionLabel(entry.action)}
                    </Badge>
                  </div>

                  {/* Entity */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="text-muted-foreground">{ENTITY_TYPE_LABELS[entry.entityType] ?? entry.entityType}</span>
                      {entry.entityName && <span className="ml-1 font-mono font-medium">{entry.entityName}</span>}
                    </p>
                  </div>

                  {/* Time */}
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground" title={new Date(entry.createdAt).toLocaleString()}>
                      {relativeTime(entry.createdAt)}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Activity log retains the last 7 days of actions across all users.
      </p>
    </div>
  );
}
