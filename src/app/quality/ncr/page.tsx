"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, AlertTriangle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const severityColors: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  major: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  minor: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const statusCols = [
  { key: "open", label: "Open" },
  { key: "under_investigation", label: "Under Investigation" },
  { key: "corrective_action_pending", label: "CA Pending" },
  { key: "corrective_action_taken", label: "CA Taken" },
  { key: "closed", label: "Closed" },
];

interface Ncr {
  id: string;
  ncr_number: string;
  title: string;
  severity: string;
  status: string;
  assigned_to_name?: string;
  due_date?: string;
  created_at: string;
}

export default function NcrPage() {
  const router = useRouter();
  const [ncrs, setNcrs] = useState<Ncr[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("");
  const [view, setView] = useState<"kanban" | "list">("kanban");

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(data => {
      if (!data.authenticated) { router.push("/login"); return; }
      setRole(data.role);
      if (data.role === "quality_tech") setView("list");
    });
    fetch("/api/qms/ncrs").then(r => r.json()).then(data => {
      setNcrs(Array.isArray(data) ? data : []);
    }).finally(() => setLoading(false));
  }, []);

  const isManager = ["quality_manager", "admin", "owner"].includes(role);

  const grouped = statusCols.reduce((acc, col) => {
    acc[col.key] = ncrs.filter(n => n.status === col.key);
    return acc;
  }, {} as Record<string, Ncr[]>);

  const NcrCard = ({ n }: { n: Ncr }) => (
    <Link href={`/quality/ncr/${n.id}`}>
      <Card className="hover:border-border/80 cursor-pointer mb-2">
        <CardContent className="p-3">
          <div className="flex items-start justify-between mb-1">
            <span className="font-mono text-xs font-bold">{n.ncr_number}</span>
            <Badge className={`text-[10px] border ${severityColors[n.severity] || ""}`}>{n.severity}</Badge>
          </div>
          <p className="text-xs line-clamp-2 text-muted-foreground">{n.title}</p>
          {n.assigned_to_name && <p className="text-[10px] text-muted-foreground mt-1">→ {n.assigned_to_name}</p>}
          {n.due_date && (
            <p className={`text-[10px] mt-0.5 ${new Date(n.due_date) < new Date() ? "text-red-400" : "text-muted-foreground"}`}>
              Due: {new Date(n.due_date).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-full px-4 py-4 flex items-center gap-3">
          <Link href="/quality"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div className="flex-1">
            <h1 className="font-bold">NCR Board</h1>
            <p className="text-xs text-muted-foreground">Non-Conformance Reports</p>
          </div>
          <div className="flex gap-2">
            {isManager && (
              <>
                <Button size="sm" variant="outline" onClick={() => setView(view === "kanban" ? "list" : "kanban")}>
                  {view === "kanban" ? "List" : "Kanban"}
                </Button>
                <Link href="/quality/ncr/new">
                  <Button size="sm"><Plus size={14} className="mr-1" /> New NCR</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : view === "kanban" && isManager ? (
          /* Kanban view */
          <div className="flex gap-4 overflow-x-auto pb-4">
            {statusCols.map(col => (
              <div key={col.key} className="flex-shrink-0 w-64">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">{col.label}</h3>
                  <Badge variant="outline" className="text-xs">{(grouped[col.key] || []).length}</Badge>
                </div>
                <div className="min-h-24">
                  {(grouped[col.key] || []).map(n => <NcrCard key={n.id} n={n} />)}
                  {(grouped[col.key] || []).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">—</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List view */
          <div className="max-w-3xl mx-auto space-y-2">
            {ncrs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle size={32} className="mx-auto mb-3 opacity-40" />
                <p>No NCRs</p>
              </div>
            ) : ncrs.map(n => (
              <Link key={n.id} href={`/quality/ncr/${n.id}`}>
                <Card className="hover:border-border/80 cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono font-semibold text-sm">{n.ncr_number}</span>
                        <Badge className={`text-xs border ${severityColors[n.severity] || ""}`}>{n.severity}</Badge>
                        <Badge variant="outline" className="text-xs capitalize">{n.status.replace(/_/g, " ")}</Badge>
                      </div>
                      <p className="text-sm truncate">{n.title}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
